import { DatabaseSync } from "node:sqlite";
import fs from "fs";
import path from "path";

let db: DatabaseSync | null = null;

function resolveDbPath(): string {
  const raw = process.env.DATABASE_URL ?? "file:../../data/poketag.sqlite";
  const filePath = raw.startsWith("file:") ? raw.slice("file:".length) : raw;
  if (path.isAbsolute(filePath)) return filePath;
  return path.resolve(process.cwd(), filePath);
}

export function getDb(): DatabaseSync {
  if (db) return db;

  const dbPath = resolveDbPath();
  fs.mkdirSync(path.dirname(dbPath), { recursive: true });

  db = new DatabaseSync(dbPath);
  db.exec("PRAGMA journal_mode = WAL;");
  db.exec("PRAGMA foreign_keys = ON;");
  migrate(db);
  return db;
}

function columnExists(
  database: DatabaseSync,
  table: string,
  column: string
): boolean {
  const rows = database
    .prepare(`PRAGMA table_info(${table})`)
    .all() as unknown as Array<{ name: string }>;
  return rows.some((r) => r.name === column);
}

function migrate(database: DatabaseSync) {
  database.exec(`
    CREATE TABLE IF NOT EXISTS save_slots (
      id TEXT PRIMARY KEY,
      game_version TEXT NOT NULL,
      generation INTEGER,
      run_label TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL,
      current_version_id TEXT
    );

    CREATE TABLE IF NOT EXISTS save_versions (
      id TEXT PRIMARY KEY,
      slot_id TEXT NOT NULL,
      parent_version_id TEXT,
      storage_key TEXT NOT NULL,
      sha256 TEXT NOT NULL,
      size_bytes INTEGER NOT NULL,
      original_filename TEXT NOT NULL,
      source_format TEXT NOT NULL,
      source_emulator TEXT NOT NULL DEFAULT '',
      source_device TEXT NOT NULL DEFAULT '',
      uploaded_at TEXT NOT NULL,
      note TEXT NOT NULL DEFAULT '',
      recognized INTEGER NOT NULL DEFAULT 0,
      detection_json TEXT NOT NULL DEFAULT '{}',
      FOREIGN KEY (slot_id) REFERENCES save_slots(id)
    );

    CREATE INDEX IF NOT EXISTS idx_versions_slot ON save_versions(slot_id);
    CREATE INDEX IF NOT EXISTS idx_versions_sha ON save_versions(sha256);

    CREATE TABLE IF NOT EXISTS device_state (
      device_label TEXT NOT NULL,
      slot_id TEXT NOT NULL,
      last_downloaded_version_id TEXT,
      PRIMARY KEY (device_label, slot_id),
      FOREIGN KEY (slot_id) REFERENCES save_slots(id)
    );

    CREATE TABLE IF NOT EXISTS parsed_snapshots (
      version_id TEXT PRIMARY KEY,
      trainer_json TEXT NOT NULL DEFAULT '{}',
      party_json TEXT NOT NULL DEFAULT '[]',
      boxes_json TEXT NOT NULL DEFAULT '[]',
      dex_json TEXT NOT NULL DEFAULT '{}',
      badges_json TEXT NOT NULL DEFAULT '[]',
      location TEXT NOT NULL DEFAULT '',
      location_map_id INTEGER,
      play_time_seconds INTEGER NOT NULL DEFAULT 0,
      parser_version TEXT NOT NULL DEFAULT '',
      is_demo INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      inventory_json TEXT NOT NULL DEFAULT '{"bag":[],"pc":[]}',
      progress_json TEXT NOT NULL DEFAULT '{"eliteFourDefeated":null,"championDefeated":null,"note":""}',
      FOREIGN KEY (version_id) REFERENCES save_versions(id)
    );
  `);

  if (!columnExists(database, "save_versions", "parse_status")) {
    database.exec(
      `ALTER TABLE save_versions ADD COLUMN parse_status TEXT NOT NULL DEFAULT 'pending'`
    );
  }
  if (!columnExists(database, "save_versions", "parse_error")) {
    database.exec(
      `ALTER TABLE save_versions ADD COLUMN parse_error TEXT NOT NULL DEFAULT ''`
    );
  }
  if (!columnExists(database, "save_versions", "parsed_at")) {
    database.exec(`ALTER TABLE save_versions ADD COLUMN parsed_at TEXT`);
  }

  if (!columnExists(database, "parsed_snapshots", "inventory_json")) {
    database.exec(
      `ALTER TABLE parsed_snapshots ADD COLUMN inventory_json TEXT NOT NULL DEFAULT '{"bag":[],"pc":[]}'`
    );
  }
  if (!columnExists(database, "parsed_snapshots", "progress_json")) {
    database.exec(
      `ALTER TABLE parsed_snapshots ADD COLUMN progress_json TEXT NOT NULL DEFAULT '{"eliteFourDefeated":null,"championDefeated":null,"note":""}'`
    );
  }

  // Existing rows that already have snapshots are done; demos too.
  database.exec(`
    UPDATE save_versions
    SET parse_status = 'done', parsed_at = COALESCE(parsed_at, uploaded_at)
    WHERE parse_status = 'pending'
      AND (
        id LIKE 'demo-%'
        OR EXISTS (SELECT 1 FROM parsed_snapshots p WHERE p.version_id = save_versions.id)
      )
  `);
}

export type ParseStatus = "pending" | "running" | "done" | "failed";

export interface ParsedSnapshotRow {
  version_id: string;
  trainer_json: string;
  party_json: string;
  boxes_json: string;
  dex_json: string;
  badges_json: string;
  location: string;
  location_map_id: number | null;
  play_time_seconds: number;
  parser_version: string;
  is_demo: number;
  created_at: string;
  inventory_json?: string | null;
  progress_json?: string | null;
}

export interface SaveSlotRow {
  id: string;
  game_version: string;
  generation: number | null;
  run_label: string;
  created_at: string;
  current_version_id: string | null;
}

export interface SaveVersionRow {
  id: string;
  slot_id: string;
  parent_version_id: string | null;
  storage_key: string;
  sha256: string;
  size_bytes: number;
  original_filename: string;
  source_format: string;
  source_emulator: string;
  source_device: string;
  uploaded_at: string;
  note: string;
  recognized: number;
  detection_json: string;
  parse_status: ParseStatus;
  parse_error: string;
  parsed_at: string | null;
}
