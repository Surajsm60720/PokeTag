import { getDb, type ParseStatus, type ParsedSnapshotRow } from "./db";
import type { ParsedSnapshot } from "./parsed";
import { snapshotFromRow, snapshotShelfFields } from "./snapshots";

/**
 * Shelf and game-page reads.
 *
 * Kept separate from vault.ts so opening the shelf or a game does not load
 * the save parser or object storage. One query per screen: the shelf never
 * pulls box, dex, or bag JSON, and a game page does not fetch its snapshot twice.
 */

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

export interface SlotPageVersion {
  id: string;
  uploaded_at: string;
  original_filename: string;
  source_format: string;
  source_device: string;
  source_emulator: string;
  sha256: string;
  size_bytes: number;
  note: string;
  recognized: number;
  detection_json: string;
}

export interface SlotPageData {
  slot: SlotSummary;
  snapshot: ParsedSnapshot | null;
  versions: SlotPageVersion[];
}

interface ShelfRow {
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
  snapshot_version_id: string | null;
  play_time_seconds: number | null;
  location: string | null;
  trainer_json: string | null;
  party_json: string | null;
  badges_json: string | null;
}

interface SlotPageRow extends ShelfRow {
  boxes_json: string | null;
  dex_json: string | null;
  inventory_json: string | null;
  progress_json: string | null;
  location_map_id: number | null;
  parser_version: string | null;
  is_demo: number | null;
  snapshot_created_at: string | null;
  versions_json: string | SlotPageVersion[] | null;
}

const LIGHT_FIELDS = `
  s.id, s.game_version, s.generation, s.run_label, s.created_at, s.current_version_id,
  v.uploaded_at AS last_uploaded_at, v.original_filename, v.source_format, v.size_bytes,
  v.recognized, v.detection_json, v.parse_status, v.parse_error,
  p.version_id AS snapshot_version_id, p.play_time_seconds, p.location,
  p.trainer_json, p.party_json, p.badges_json`;

const FROM_CURRENT = `
 FROM save_slots s
 LEFT JOIN save_versions v ON v.id = s.current_version_id
 LEFT JOIN parsed_snapshots p ON p.version_id = s.current_version_id`;

function detectionLabel(json: string): string {
  try {
    const d = JSON.parse(json) as { label?: string };
    return d.label || "Save";
  } catch {
    return "Save";
  }
}

function partyIcons(raw: string | null): SlotSummary["partyIcons"] {
  if (!raw) return [];
  try {
    const party = JSON.parse(raw) as Array<{
      speciesId?: number;
      speciesName?: string;
      types?: string[];
      shiny?: boolean;
      level?: number;
    }>;
    if (!Array.isArray(party)) return [];
    return party.slice(0, 6).map((p) => ({
      speciesId: p.speciesId ?? 0,
      speciesName: p.speciesName ?? "",
      types: Array.isArray(p.types) ? p.types : [],
      shiny: Boolean(p.shiny),
      level: p.level ?? 0,
    }));
  } catch {
    return [];
  }
}

function earnedBadges(raw: string | null): number {
  if (!raw) return 0;
  try {
    const badges = JSON.parse(raw) as Array<{ earned?: boolean }>;
    if (!Array.isArray(badges)) return 0;
    return badges.filter((b) => b.earned).length;
  } catch {
    return 0;
  }
}

function readTrainerName(raw: string | null): string | null {
  if (!raw) return null;
  try {
    const trainer = JSON.parse(raw) as { name?: string };
    return trainer.name || null;
  } catch {
    return null;
  }
}

function mapShelf(row: ShelfRow): SlotSummary {
  const hasParsed = Boolean(row.snapshot_version_id);
  return {
    id: row.id,
    gameVersion: row.game_version,
    generation: row.generation,
    runLabel: row.run_label,
    createdAt: row.created_at,
    currentVersionId: row.current_version_id,
    lastUploadedAt: row.last_uploaded_at,
    originalFilename: row.original_filename,
    sourceFormat: row.source_format,
    sizeBytes: row.size_bytes,
    recognized: Boolean(row.recognized),
    label: row.detection_json
      ? detectionLabel(row.detection_json)
      : row.run_label || row.game_version,
    playTimeSeconds: hasParsed ? (row.play_time_seconds ?? 0) : null,
    badgeCount: hasParsed ? earnedBadges(row.badges_json) : null,
    partyIcons: hasParsed ? partyIcons(row.party_json) : [],
    trainerName: hasParsed ? readTrainerName(row.trainer_json) : null,
    location: hasParsed ? (row.location ?? "") : null,
    hasParsed,
    parseStatus: row.parse_status,
    parseError: row.parse_error,
  };
}

async function withDemoShelf(slot: SlotSummary): Promise<SlotSummary> {
  if (slot.hasParsed || !slot.currentVersionId?.startsWith("demo-")) {
    return slot;
  }
  const { buildDemoSnapshot } = await import("./demo-parsed");
  const snapshot = buildDemoSnapshot(slot.gameVersion, slot.currentVersionId);
  const shelf = snapshotShelfFields(snapshot);
  return { ...slot, ...shelf, hasParsed: true };
}

export async function listSlots(): Promise<SlotSummary[]> {
  const db = await getDb();
  const rows = (await db
    .prepare(
      `SELECT ${LIGHT_FIELDS}
       ${FROM_CURRENT}
       ORDER BY COALESCE(v.uploaded_at, s.created_at) DESC`
    )
    .all()) as unknown as ShelfRow[];
  const slots: SlotSummary[] = [];
  for (const row of rows) {
    slots.push(await withDemoShelf(mapShelf(row)));
  }
  return slots;
}

export async function getSlot(slotId: string): Promise<SlotSummary | null> {
  const db = await getDb();
  const row = (await db
    .prepare(
      `SELECT ${LIGHT_FIELDS}
       ${FROM_CURRENT}
       WHERE s.id = ?`
    )
    .get(slotId)) as unknown as ShelfRow | undefined;
  if (!row) return null;
  return withDemoShelf(mapShelf(row));
}

function parseVersions(raw: SlotPageRow["versions_json"]): SlotPageVersion[] {
  let parsed: unknown = raw;
  if (typeof raw === "string") {
    if (!raw) return [];
    try {
      parsed = JSON.parse(raw);
    } catch {
      return [];
    }
  }
  if (!Array.isArray(parsed)) return [];
  const versions = parsed.map((item) => {
    const v = item as Record<string, unknown>;
    return {
      id: String(v.id ?? ""),
      uploaded_at: String(v.uploaded_at ?? ""),
      original_filename: String(v.original_filename ?? ""),
      source_format: String(v.source_format ?? ""),
      source_device: String(v.source_device ?? ""),
      source_emulator: String(v.source_emulator ?? ""),
      sha256: String(v.sha256 ?? ""),
      size_bytes: Number(v.size_bytes ?? 0),
      note: String(v.note ?? ""),
      recognized: Number(v.recognized ?? 0),
      detection_json:
        typeof v.detection_json === "string"
          ? v.detection_json
          : JSON.stringify(v.detection_json ?? {}),
    };
  });
  versions.sort((a, b) => b.uploaded_at.localeCompare(a.uploaded_at));
  return versions;
}

function snapshotFromJoin(row: SlotPageRow, gameVersion: string): ParsedSnapshot | null {
  if (!row.snapshot_version_id) return null;
  const stored: ParsedSnapshotRow = {
    version_id: row.snapshot_version_id,
    trainer_json: row.trainer_json ?? "{}",
    party_json: row.party_json ?? "[]",
    boxes_json: row.boxes_json ?? "[]",
    dex_json: row.dex_json ?? "{}",
    badges_json: row.badges_json ?? "[]",
    location: row.location ?? "",
    location_map_id: row.location_map_id,
    play_time_seconds: row.play_time_seconds ?? 0,
    parser_version: row.parser_version ?? "",
    is_demo: row.is_demo ?? 0,
    created_at: row.snapshot_created_at ?? "",
    inventory_json: row.inventory_json,
    progress_json: row.progress_json,
  };
  return snapshotFromRow(stored, gameVersion);
}

/** Slot, versions, and parsed save in a single round trip. */
export async function readSlotPage(slotId: string): Promise<SlotPageData | null> {
  const db = await getDb();
  const row = (await db
    .prepare(
      `SELECT ${LIGHT_FIELDS},
              p.boxes_json, p.dex_json, p.inventory_json, p.progress_json,
              p.location_map_id, p.parser_version, p.is_demo,
              p.created_at AS snapshot_created_at,
              (
                SELECT json_group_array(json_object(
                  'id', id,
                  'uploaded_at', uploaded_at,
                  'original_filename', original_filename,
                  'source_format', source_format,
                  'source_device', source_device,
                  'source_emulator', source_emulator,
                  'sha256', sha256,
                  'size_bytes', size_bytes,
                  'note', note,
                  'recognized', recognized,
                  'detection_json', detection_json
                ))
                FROM save_versions
                WHERE slot_id = s.id
              ) AS versions_json
       ${FROM_CURRENT}
       WHERE s.id = ?`
    )
    .get(slotId)) as unknown as SlotPageRow | undefined;
  if (!row) return null;

  let slot = mapShelf(row);
  let snapshot = snapshotFromJoin(row, slot.gameVersion);
  if (!snapshot && slot.currentVersionId?.startsWith("demo-")) {
    const { buildDemoSnapshot } = await import("./demo-parsed");
    snapshot = buildDemoSnapshot(slot.gameVersion, slot.currentVersionId);
    slot = {
      ...slot,
      ...snapshotShelfFields(snapshot),
      hasParsed: true,
    };
  }

  return {
    slot,
    snapshot,
    versions: parseVersions(row.versions_json),
  };
}

/** Kick a stale-parse sweep without making the shelf wait on it. */
export function scheduleStaleParseSweep(): void {
  void import("./parse-job")
    .then((mod) => mod.sweepStaleParses())
    .catch(() => {
      // The shelf still renders if the self-heal cannot start.
    });
}
