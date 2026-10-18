/**
 * Removes all demo-* slots (and their R2/MinIO objects) so the shelf is empty
 * for real saves.
 *
 *   npm run clear:demo
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describeDatabase, getDb } from "../src/lib/db.ts";
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

async function main() {
  const db = await getDb();
  const slots = await db
    .prepare(`SELECT id FROM save_slots WHERE id LIKE 'demo-%' ORDER BY id`)
    .all<{ id: string }>();

  if (slots.length === 0) {
    console.log("No demo slots found. Shelf is already clean.");
    return;
  }

  const slotIds = slots.map((s) => s.id);
  const ph = slotIds.map(() => "?").join(",");
  const versions = await db
    .prepare(
      `SELECT id, storage_key FROM save_versions WHERE slot_id IN (${ph})`
    )
    .all<{ id: string; storage_key: string }>(...slotIds);

  console.log(`DB: ${describeDatabase()}`);
  console.log(`Storage: ${describeStorage()}`);
  console.log(
    `Removing ${slotIds.length} demo slots (${versions.length} versions)…`
  );

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

  if (versions.length) {
    const vph = versions.map(() => "?").join(",");
    await db
      .prepare(`DELETE FROM parsed_snapshots WHERE version_id IN (${vph})`)
      .run(...versions.map((v) => v.id));
  }
  await db
    .prepare(`DELETE FROM device_state WHERE slot_id IN (${ph})`)
    .run(...slotIds);
  await db
    .prepare(`DELETE FROM save_versions WHERE slot_id IN (${ph})`)
    .run(...slotIds);
  await db.prepare(`DELETE FROM save_slots WHERE id IN (${ph})`).run(...slotIds);

  console.log(
    `Done. Deleted ${slotIds.length} slots, ${storageDeleted}/${keys.length} storage objects.`
  );
  console.log(
    "Refresh http://localhost:3000 — empty shelf until you upload a real save."
  );
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
