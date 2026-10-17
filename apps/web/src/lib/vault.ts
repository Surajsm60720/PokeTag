import { detectSave, type DetectionResult } from "@poketag/save-format";
import { createHash } from "crypto";
import { v4 as uuid } from "uuid";
import { getDb, type SaveVersionRow } from "./db";
import { getObject, putObject } from "./minio";

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
}

function detectionLabel(json: string): string {
  try {
    const d = JSON.parse(json) as DetectionResult;
    return d.label || "Save";
  } catch {
    return "Save";
  }
}

export function listSlots(): SlotSummary[] {
  const db = getDb();
  const slots = db
    .prepare(
      `SELECT s.*, v.uploaded_at as last_uploaded_at, v.original_filename,
              v.source_format, v.size_bytes, v.recognized, v.detection_json
       FROM save_slots s
       LEFT JOIN save_versions v ON v.id = s.current_version_id
       ORDER BY COALESCE(v.uploaded_at, s.created_at) DESC`
    )
    .all() as unknown as Array<{
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
  }>;

  return slots.map((s) => ({
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
  }));
}

export function getSlot(slotId: string): SlotSummary | null {
  return listSlots().find((s) => s.id === slotId) ?? null;
}

export function listVersions(slotId: string): SaveVersionRow[] {
  return getDb()
    .prepare(
      `SELECT * FROM save_versions WHERE slot_id = ? ORDER BY uploaded_at DESC`
    )
    .all(slotId) as unknown as SaveVersionRow[];
}

export function findVersionByHash(hash: string): SaveVersionRow | undefined {
  return getDb()
    .prepare(`SELECT * FROM save_versions WHERE sha256 = ? LIMIT 1`)
    .get(hash) as unknown as SaveVersionRow | undefined;
}

export function getVersion(versionId: string): SaveVersionRow | undefined {
  return getDb()
    .prepare(`SELECT * FROM save_versions WHERE id = ?`)
    .get(versionId) as unknown as SaveVersionRow | undefined;
}

export interface PreviewResult {
  detection: DetectionResult;
  sha256: string;
  sizeBytes: number;
  duplicate: boolean;
  duplicateSlotId?: string;
  duplicateVersionId?: string;
}

export function previewUpload(data: Buffer, filename: string): PreviewResult {
  if (data.length > MAX_UPLOAD_BYTES) {
    throw new Error("File is too large. Max 32 MB.");
  }
  const hash = sha256(data);
  const detection = detectSave(data, filename);
  const existing = findVersionByHash(hash);
  return {
    detection,
    sha256: hash,
    sizeBytes: data.length,
    duplicate: Boolean(existing),
    duplicateSlotId: existing?.slot_id,
    duplicateVersionId: existing?.id,
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
  const preview = previewUpload(input.data, input.filename);
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

  const db = getDb();
  const now = new Date().toISOString();
  const versionId = uuid();
  const storageKey = `saves/${versionId}/${input.filename}`;

  await putObject(storageKey, input.data);

  let slotId = input.slotId;
  const parentRow = slotId
    ? (db
        .prepare(`SELECT current_version_id FROM save_slots WHERE id = ?`)
        .get(slotId) as unknown as
        | { current_version_id: string | null }
        | undefined)
    : undefined;
  const parentVersionId = parentRow?.current_version_id ?? null;

  db.exec("BEGIN");
  try {
    if (!slotId) {
      slotId = uuid();
      db.prepare(
        `INSERT INTO save_slots (id, game_version, generation, run_label, created_at, current_version_id)
         VALUES (?, ?, ?, ?, ?, ?)`
      ).run(
        slotId,
        preview.detection.gameVersion,
        preview.detection.generation,
        input.runLabel?.trim() || preview.detection.label,
        now,
        versionId
      );
    } else {
      const label = input.runLabel?.trim() || "";
      db.prepare(
        `UPDATE save_slots SET current_version_id = ?, game_version = ?, generation = ?,
         run_label = CASE WHEN ? != '' THEN ? ELSE run_label END WHERE id = ?`
      ).run(
        versionId,
        preview.detection.gameVersion,
        preview.detection.generation,
        label,
        label,
        slotId
      );
    }

    db.prepare(
      `INSERT INTO save_versions (
        id, slot_id, parent_version_id, storage_key, sha256, size_bytes,
        original_filename, source_format, source_emulator, source_device,
        uploaded_at, note, recognized, detection_json
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
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
    db.exec("COMMIT");
  } catch (err) {
    db.exec("ROLLBACK");
    throw err;
  }

  return { slotId: slotId!, versionId, duplicate: false };
}

export async function restoreVersion(
  slotId: string,
  versionId: string
): Promise<{ versionId: string }> {
  const db = getDb();
  const source = getVersion(versionId);
  if (!source || source.slot_id !== slotId) {
    throw new Error("Version not found for this slot.");
  }

  const now = new Date().toISOString();
  const newId = uuid();
  const current = db
    .prepare(`SELECT current_version_id FROM save_slots WHERE id = ?`)
    .get(slotId) as unknown as { current_version_id: string | null };

  db.exec("BEGIN");
  try {
    db.prepare(
      `INSERT INTO save_versions (
        id, slot_id, parent_version_id, storage_key, sha256, size_bytes,
        original_filename, source_format, source_emulator, source_device,
        uploaded_at, note, recognized, detection_json
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
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
      source.detection_json
    );
    db.prepare(
      `UPDATE save_slots SET current_version_id = ? WHERE id = ?`
    ).run(newId, slotId);
    db.exec("COMMIT");
  } catch (err) {
    db.exec("ROLLBACK");
    throw err;
  }

  return { versionId: newId };
}

export async function loadVersionBytes(versionId: string): Promise<{
  data: Buffer;
  version: SaveVersionRow;
}> {
  const version = getVersion(versionId);
  if (!version) throw new Error("Version not found.");
  const data = await getObject(version.storage_key);
  return { data, version };
}

export { MAX_UPLOAD_BYTES };
