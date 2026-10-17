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
  `);
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
}
