import { detectSave, type DetectionResult } from "@poketag/save-format";
import { createHash } from "crypto";
import { v4 as uuid } from "uuid";
import {
  getDb,
  withTransaction,
  type ParseStatus,
  type SaveVersionRow,
} from "./db";
import { deleteObject, getObject, putObject } from "./storage";
import type { ParsedSnapshot } from "./parsed";
import { queueParseVersion, sweepStaleParses } from "./parse-job";
import {
  getParsedSnapshot,
  saveParsedSnapshot,
  snapshotShelfFields,
} from "./snapshots";

const MAX_UPLOAD_BYTES = 32 * 1024 * 1024;

export function sha256(data: Buffer): string {
  return createHash("sha256").update(data).digest("hex");
}

export interface SlotSummary {
  id: string;
  gameVersion: string;
  generation: number | null;
  runLabel: string;
  createdAt: string;
  currentVersionId: string | null;
  lastUploadedAt: string | null;
  originalFilename: string | null;
  sourceFormat: string | null;
  sizeBytes: number | null;
  recognized: boolean;
  label: string;
  playTimeSeconds: number | null;
  badgeCount: number | null;
  partyIcons: Array<{
    speciesId: number;
    speciesName: string;
    types: string[];
    shiny: boolean;
    level: number;
  }>;
  trainerName: string | null;
  location: string | null;
  hasParsed: boolean;
  parseStatus: ParseStatus | null;
  parseError: string | null;
}

function detectionLabel(json: string): string {
  try {
    const d = JSON.parse(json) as DetectionResult;
    return d.label || "Save";
  } catch {
    return "Save";
  }
}

/** Row shape produced by SLOT_SUMMARY_SELECT. */
type SlotJoinRow = {
  id: string;
  game_version: string;
  generation: number | null;
  run_label: string;
  created_at: string;
  current_version_id: string | null;
  last_uploaded_at: string | null;
  original_filename: string | null;
  source_format: string | null;
  size_bytes: number | null;
  recognized: number | null;
  detection_json: string | null;
  parse_status: ParseStatus | null;
  parse_error: string | null;
};

const SLOT_SUMMARY_SELECT = `SELECT s.*, v.uploaded_at as last_uploaded_at,
        v.original_filename, v.source_format, v.size_bytes, v.recognized,
        v.detection_json, v.parse_status, v.parse_error
 FROM save_slots s
 LEFT JOIN save_versions v ON v.id = s.current_version_id`;

async function summarizeSlot(s: SlotJoinRow): Promise<SlotSummary> {
  const snapshot = await getParsedSnapshot(
    s.current_version_id,
    s.game_version
  );
  const shelf = snapshotShelfFields(snapshot);
  return {
    id: s.id,
    gameVersion: s.game_version,
    generation: s.generation,
    runLabel: s.run_label,
    createdAt: s.created_at,
    currentVersionId: s.current_version_id,
    lastUploadedAt: s.last_uploaded_at,
    originalFilename: s.original_filename,
    sourceFormat: s.source_format,
    sizeBytes: s.size_bytes,
    recognized: Boolean(s.recognized),
    label: s.detection_json
      ? detectionLabel(s.detection_json)
      : s.run_label || s.game_version,
    playTimeSeconds: shelf.playTimeSeconds,
    badgeCount: shelf.badgeCount,
    partyIcons: shelf.partyIcons,
    trainerName: shelf.trainerName,
    location: shelf.location,
    hasParsed: Boolean(snapshot),
    parseStatus: s.parse_status,
    parseError: s.parse_error,
  };
}

export async function listSlots(): Promise<SlotSummary[]> {
  // Self-heal parses abandoned by a dead process before rendering the shelf.
  await sweepStaleParses();
  const db = await getDb();
  const slots = await db
    .prepare(
      `${SLOT_SUMMARY_SELECT}
       ORDER BY COALESCE(v.uploaded_at, s.created_at) DESC`
    )
    .all<SlotJoinRow>();

  const out: SlotSummary[] = [];
  for (const s of slots) {
    out.push(await summarizeSlot(s));
  }
  return out;
}

export async function getSlot(slotId: string): Promise<SlotSummary | null> {
  const db = await getDb();
  const slot = await db
    .prepare(`${SLOT_SUMMARY_SELECT} WHERE s.id = ?`)
    .get<SlotJoinRow>(slotId);
  if (!slot) return null;
  return summarizeSlot(slot);
}

export async function getSlotSnapshot(
  slotId: string
): Promise<ParsedSnapshot | null> {
  const slot = await getSlot(slotId);
  if (!slot) return null;
  return getParsedSnapshot(slot.currentVersionId, slot.gameVersion);
}

export async function listVersions(slotId: string): Promise<SaveVersionRow[]> {
  const rows = await (
    await getDb()
  )
    .prepare(
      `SELECT * FROM save_versions WHERE slot_id = ? ORDER BY uploaded_at DESC`
    )
    .all(slotId);
  return rows as unknown as SaveVersionRow[];
}

/** Same bytes only conflict inside the same run (slot). */
export async function findVersionByHash(
  hash: string,
  slotId?: string
): Promise<SaveVersionRow | undefined> {
  const db = await getDb();
  if (slotId) {
    return (await db
      .prepare(
        `SELECT * FROM save_versions WHERE sha256 = ? AND slot_id = ? LIMIT 1`
      )
      .get(hash, slotId)) as unknown as SaveVersionRow | undefined;
  }
  return (await db
    .prepare(`SELECT * FROM save_versions WHERE sha256 = ? LIMIT 1`)
    .get(hash)) as unknown as SaveVersionRow | undefined;
}

export async function getVersion(
  versionId: string
): Promise<SaveVersionRow | undefined> {
  return (await (
    await getDb()
  )
    .prepare(`SELECT * FROM save_versions WHERE id = ?`)
    .get(versionId)) as unknown as SaveVersionRow | undefined;
}

export async function listSlotsForGame(
  gameVersion: string
): Promise<SlotSummary[]> {
  const slots = await listSlots();
  return slots.filter((s) => s.gameVersion === gameVersion);
}

export interface PreviewResult {
  detection: DetectionResult;
  sha256: string;
  sizeBytes: number;
  duplicate: boolean;
  duplicateSlotId?: string;
  duplicateVersionId?: string;
  matchingRuns: Array<{ id: string; runLabel: string }>;
}

export async function previewUpload(
  data: Buffer,
  filename: string,
  slotId?: string
): Promise<PreviewResult> {
  if (data.length > MAX_UPLOAD_BYTES) {
    throw new Error("File is too large. Max 32 MB.");
  }
  const hash = sha256(data);
  const detection = detectSave(data, filename);
  const existing = slotId ? await findVersionByHash(hash, slotId) : undefined;
  const matchingRuns =
    !slotId && detection.gameVersion !== "unknown"
      ? (await listSlotsForGame(detection.gameVersion)).map((s) => ({
          id: s.id,
          runLabel: s.runLabel,
        }))
      : [];
  return {
    detection,
    sha256: hash,
    sizeBytes: data.length,
    duplicate: Boolean(existing),
    duplicateSlotId: existing?.slot_id,
    duplicateVersionId: existing?.id,
    matchingRuns,
  };
}

export interface CommitUploadInput {
  data: Buffer;
  filename: string;
  runLabel?: string;
  slotId?: string;
  sourceEmulator?: string;
  sourceDevice?: string;
  note?: string;
}

export async function commitUpload(input: CommitUploadInput): Promise<{
  slotId: string;
  versionId: string;
  duplicate: boolean;
}> {
  const preview = await previewUpload(
    input.data,
    input.filename,
    input.slotId
  );
  if (
    preview.duplicate &&
    preview.duplicateSlotId &&
    preview.duplicateVersionId
  ) {
    return {
      slotId: preview.duplicateSlotId,
      versionId: preview.duplicateVersionId,
      duplicate: true,
    };
  }

  const db = await getDb();
  const now = new Date().toISOString();
  const versionId = uuid();
  const storageKey = `saves/${versionId}/${input.filename}`;

  let slotId = input.slotId;

  // Validate before writing bytes so a rejected upload never touches storage.
  if (!slotId && !input.runLabel?.trim()) {
    throw new Error("Run label is required for a new run.");
  }

  if (slotId) {
    const slot = await db
      .prepare(
        `SELECT id, game_version, current_version_id FROM save_slots WHERE id = ?`
      )
      .get<{
        id: string;
        game_version: string;
        current_version_id: string | null;
      }>(slotId);
    if (!slot) {
      throw new Error("Run not found.");
    }
    if (
      preview.detection.recognized &&
      preview.detection.gameVersion !== "unknown" &&
      preview.detection.gameVersion !== slot.game_version
    ) {
      throw new Error(
        `This save is ${preview.detection.label}, but this run is locked to ${slot.game_version}. Start a new run instead.`
      );
    }
  }

  await putObject(storageKey, input.data);

  type CommitOutcome = {
    slotId: string;
    versionId: string;
    duplicate: boolean;
  };

  let outcome: CommitOutcome;
  try {
    outcome = await withTransaction(async (tx): Promise<CommitOutcome> => {
      // previewUpload ran outside this transaction, so a concurrent upload of
      // the same bytes may have landed since. Re-check here: this is the only
      // place that decides. Only runs for an existing run — the same bytes in
      // a brand-new run is a deliberate second run, not a duplicate.
      if (slotId) {
        const existing = await tx
          .prepare(
            `SELECT id, slot_id FROM save_versions WHERE sha256 = ? AND slot_id = ? LIMIT 1`
          )
          .get<{ id: string; slot_id: string }>(preview.sha256, slotId);
        if (existing) {
          return {
            slotId: existing.slot_id,
            versionId: existing.id,
            duplicate: true,
          };
        }
      }

      let parentVersionId: string | null = null;

      if (!slotId) {
        const label = input.runLabel?.trim();
        if (!label) {
          throw new Error("Run label is required for a new run.");
        }
        slotId = uuid();
        await tx
          .prepare(
            `INSERT INTO save_slots (id, game_version, generation, run_label, created_at, current_version_id)
         VALUES (?, ?, ?, ?, ?, ?)`
          )
          .run(
            slotId,
            preview.detection.gameVersion,
            preview.detection.generation,
            label,
            now,
            versionId
          );
      } else {
        const label = input.runLabel?.trim() || "";
        // Read the parent inside the transaction or two uploads race the chain.
        const parent = await tx
          .prepare(`SELECT current_version_id FROM save_slots WHERE id = ?`)
          .get<{ current_version_id: string | null }>(slotId);
        parentVersionId = parent?.current_version_id ?? null;
        await tx
          .prepare(
            `UPDATE save_slots SET current_version_id = ?,
         run_label = CASE WHEN ? != '' THEN ? ELSE run_label END WHERE id = ?`
          )
          .run(versionId, label, label, slotId);
      }

      await tx
        .prepare(
          `INSERT INTO save_versions (
        id, slot_id, parent_version_id, storage_key, sha256, size_bytes,
        original_filename, source_format, source_emulator, source_device,
        uploaded_at, note, recognized, detection_json,
        parse_status, parse_error, parsed_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', '', NULL)`
        )
        .run(
          versionId,
          slotId,
          parentVersionId,
          storageKey,
          preview.sha256,
          preview.sizeBytes,
          input.filename,
          preview.detection.format,
          input.sourceEmulator || "",
          input.sourceDevice || "",
          now,
          input.note || "",
          preview.detection.recognized ? 1 : 0,
          JSON.stringify(preview.detection)
        );

      return { slotId: slotId!, versionId, duplicate: false };
    });
  } catch (err) {
    // The transaction rolled back, so nothing references these bytes.
    await dropOrphanObject(storageKey);
    throw err;
  }

  if (outcome.duplicate) {
    // The concurrent upload won; drop the bytes only we wrote.
    await dropOrphanObject(storageKey);
    return outcome;
  }

  queueParseVersion(versionId);
  return outcome;
}

/**
 * Remove an object after a failed or lost commit. Checked against the DB
 * first: a leftover blob is recoverable, a referenced save is not, so never
 * delete bytes a committed row still points at.
 */
async function dropOrphanObject(storageKey: string): Promise<void> {
  try {
    const db = await getDb();
    const row = await db
      .prepare(`SELECT COUNT(*) as n FROM save_versions WHERE storage_key = ?`)
      .get<{ n: number }>(storageKey);
    if ((row?.n ?? 0) > 0) return;
    await deleteObject(storageKey);
  } catch {
    // Best-effort cleanup; never mask the original error.
  }
}

export async function restoreVersion(
  slotId: string,
  versionId: string
): Promise<{ versionId: string }> {
  const db = await getDb();
  const source = await getVersion(versionId);
  if (!source || source.slot_id !== slotId) {
    throw new Error("Version not found for this slot.");
  }

  const now = new Date().toISOString();
  const newId = uuid();

  const slotMeta = await db
    .prepare(`SELECT game_version FROM save_slots WHERE id = ?`)
    .get<{ game_version: string }>(slotId);
  const sourceSnapshot = await getParsedSnapshot(
    versionId,
    slotMeta?.game_version || "unknown"
  );
  const parseStatus: ParseStatus = sourceSnapshot
    ? "done"
    : source.parse_status;
  const parseError = sourceSnapshot ? "" : source.parse_error || "";
  const parsedAt = sourceSnapshot ? now : source.parsed_at;

  await withTransaction(async (tx) => {
    // Read the parent inside the transaction so a concurrent upload cannot
    // slip between the read and the insert.
    const current = await tx
      .prepare(`SELECT current_version_id FROM save_slots WHERE id = ?`)
      .get<{ current_version_id: string | null }>(slotId);

    await tx
      .prepare(
        `INSERT INTO save_versions (
        id, slot_id, parent_version_id, storage_key, sha256, size_bytes,
        original_filename, source_format, source_emulator, source_device,
        uploaded_at, note, recognized, detection_json,
        parse_status, parse_error, parsed_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        newId,
        slotId,
        current?.current_version_id ?? null,
        source.storage_key,
        source.sha256,
        source.size_bytes,
        source.original_filename,
        source.source_format,
        source.source_emulator,
        source.source_device,
        now,
        `Restored from ${versionId}`,
        source.recognized,
        source.detection_json,
        parseStatus,
        parseError,
        parsedAt
      );

    await tx
      .prepare(`UPDATE save_slots SET current_version_id = ? WHERE id = ?`)
      .run(newId, slotId);
  });

  if (sourceSnapshot) {
    await saveParsedSnapshot({
      ...sourceSnapshot,
      versionId: newId,
    });
  } else if (parseStatus !== "done") {
    queueParseVersion(newId);
  }

  return { versionId: newId };
}

export async function deleteVersion(
  slotId: string,
  versionId: string
): Promise<void> {
  const version = await getVersion(versionId);
  if (!version || version.slot_id !== slotId) {
    throw new Error("Version not found for this run.");
  }

  // Guards and deletes must observe the same snapshot, otherwise a concurrent
  // upload can slip past the "last version" check.
  const { sharedStorage } = await withTransaction(async (tx) => {
    const countRow = await tx
      .prepare(`SELECT COUNT(*) as n FROM save_versions WHERE slot_id = ?`)
      .get<{ n: number }>(slotId);
    if ((countRow?.n ?? 0) <= 1) {
      throw new Error(
        "Cannot delete the last version of a run. Delete the whole run instead."
      );
    }

    const slot = await tx
      .prepare(`SELECT current_version_id FROM save_slots WHERE id = ?`)
      .get<{ current_version_id: string | null }>(slotId);

    const shared = await tx
      .prepare(
        `SELECT COUNT(*) as n FROM save_versions WHERE storage_key = ? AND id != ?`
      )
      .get<{ n: number }>(version.storage_key, versionId);

    await tx
      .prepare(`DELETE FROM parsed_snapshots WHERE version_id = ?`)
      .run(versionId);
    await tx.prepare(`DELETE FROM save_versions WHERE id = ?`).run(versionId);

    if (slot?.current_version_id === versionId) {
      const next = await tx
        .prepare(
          `SELECT id FROM save_versions WHERE slot_id = ? ORDER BY uploaded_at DESC LIMIT 1`
        )
        .get<{ id: string }>(slotId);
      await tx
        .prepare(`UPDATE save_slots SET current_version_id = ? WHERE id = ?`)
        .run(next?.id ?? null, slotId);
    }

    return { sharedStorage: shared?.n ?? 0 };
  });

  if (sharedStorage === 0) {
    try {
      await deleteObject(version.storage_key);
    } catch {
      // Best-effort storage cleanup.
    }
  }
}

export async function deleteSlot(slotId: string): Promise<void> {
  const db = await getDb();
  const slot = await db
    .prepare(`SELECT id FROM save_slots WHERE id = ?`)
    .get<{ id: string }>(slotId);
  if (!slot) {
    throw new Error("Run not found.");
  }

  const versions = await listVersions(slotId);
  const keys = [...new Set(versions.map((v) => v.storage_key))];

  await withTransaction(async (tx) => {
    for (const v of versions) {
      await tx
        .prepare(`DELETE FROM parsed_snapshots WHERE version_id = ?`)
        .run(v.id);
    }
    await tx.prepare(`DELETE FROM device_state WHERE slot_id = ?`).run(slotId);
    await tx.prepare(`DELETE FROM save_versions WHERE slot_id = ?`).run(slotId);
    await tx.prepare(`DELETE FROM save_slots WHERE id = ?`).run(slotId);
  });

  for (const key of keys) {
    try {
      await deleteObject(key);
    } catch {
      // Best-effort.
    }
  }
}

export async function loadVersionBytes(versionId: string): Promise<{
  data: Buffer;
  version: SaveVersionRow;
}> {
  const version = await getVersion(versionId);
  if (!version) throw new Error("Version not found.");
  const data = await getObject(version.storage_key);
  return { data, version };
}

export { MAX_UPLOAD_BYTES };
