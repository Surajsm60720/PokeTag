/**
 * Removes all demo-* slots (and their R2/MinIO objects) so the shelf is empty
 * for real saves.
 *
 *   npm run clear:demo
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { DatabaseSync } from "node:sqlite";
import {
  deleteObject,
  describeStorage,
  resetStorageClient,
} from "../src/lib/storage.ts";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const webRoot = path.resolve(__dirname, "..");

function loadEnvFile(filePath: string) {
  if (!fs.existsSync(filePath)) return;
  for (const line of fs.readFileSync(filePath, "utf8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq < 0) continue;
    const key = trimmed.slice(0, eq).trim();
    let val = trimmed.slice(eq + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    if (!(key in process.env)) process.env[key] = val;
  }
}

loadEnvFile(path.join(webRoot, ".env.local"));
loadEnvFile(path.join(webRoot, "../../.env"));
resetStorageClient();

function resolveDbPath(): string {
  const raw = process.env.DATABASE_URL || "file:../../data/poketag.sqlite";
  const file = raw.startsWith("file:") ? raw.slice("file:".length) : raw;
  return path.isAbsolute(file) ? file : path.resolve(webRoot, file);
}

async function main() {
  const dbPath = resolveDbPath();
  if (!fs.existsSync(dbPath)) {
    console.log(`No database at ${dbPath} — nothing to clear.`);
    return;
  }

  const db = new DatabaseSync(dbPath);
  const slots = db
    .prepare(
      `SELECT id FROM save_slots WHERE id LIKE 'demo-%' ORDER BY id`
    )
    .all() as Array<{ id: string }>;

  if (slots.length === 0) {
    console.log("No demo slots found. Shelf is already clean.");
    db.close();
    return;
  }

  const slotIds = slots.map((s) => s.id);
  const ph = slotIds.map(() => "?").join(",");
  const versions = db
    .prepare(
      `SELECT id, storage_key FROM save_versions WHERE slot_id IN (${ph})`
    )
    .all(...slotIds) as Array<{ id: string; storage_key: string }>;

  console.log(`Storage: ${describeStorage()}`);
  console.log(`Removing ${slotIds.length} demo slots (${versions.length} versions)…`);

  const keys = [...new Set(versions.map((v) => v.storage_key))];
  let storageDeleted = 0;
  for (const key of keys) {
    try {
      await deleteObject(key);
      storageDeleted += 1;
    } catch (err) {
      console.warn(
        `  skip object ${key}:`,
        err instanceof Error ? err.message : err
      );
    }
  }

  db.exec("BEGIN");
  try {
    if (versions.length) {
      const vph = versions.map(() => "?").join(",");
      db.prepare(
        `DELETE FROM parsed_snapshots WHERE version_id IN (${vph})`
      ).run(...versions.map((v) => v.id));
    }
    db.prepare(`DELETE FROM device_state WHERE slot_id IN (${ph})`).run(
      ...slotIds
    );
    db.prepare(`DELETE FROM save_versions WHERE slot_id IN (${ph})`).run(
      ...slotIds
    );
    db.prepare(`DELETE FROM save_slots WHERE id IN (${ph})`).run(...slotIds);
    db.exec("COMMIT");
  } catch (err) {
    db.exec("ROLLBACK");
    db.close();
    throw err;
  }

  db.close();
  console.log(
    `Done. Deleted ${slotIds.length} slots, ${storageDeleted}/${keys.length} storage objects.`
  );
  console.log("Refresh http://localhost:3000 — empty shelf until you upload a real save.");
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
