/**
 * Wipe every run, version, snapshot, and R2 object.
 * Usage (from apps/web): node --env-file=.env.local scripts/wipe-vault.mjs
 */
import { createClient } from "@libsql/client";
import * as Minio from "minio";

const url = process.env.TURSO_DATABASE_URL?.trim();
const authToken = process.env.TURSO_AUTH_TOKEN?.trim();
if (!url || !authToken) {
  console.error("TURSO_DATABASE_URL and TURSO_AUTH_TOKEN required");
  process.exit(1);
}

const accountId = process.env.R2_ACCOUNT_ID;
const bucket = process.env.R2_BUCKET || "poketag-saves";
const r2 = new Minio.Client({
  endPoint: `${accountId}.r2.cloudflarestorage.com`,
  port: 443,
  useSSL: true,
  accessKey: process.env.R2_ACCESS_KEY_ID,
  secretKey: process.env.R2_SECRET_ACCESS_KEY,
  region: "auto",
});

const c = createClient({ url, authToken });

const before = await c.execute(`
  SELECT
    (SELECT COUNT(*) FROM save_slots) AS slots,
    (SELECT COUNT(*) FROM save_versions) AS versions,
    (SELECT COUNT(*) FROM parsed_snapshots) AS snapshots
`);
console.log("before", before.rows[0]);

const keys = await c.execute(`SELECT DISTINCT storage_key FROM save_versions`);
const storageKeys = keys.rows.map((r) => String(r.storage_key));

await c.execute(`DELETE FROM parsed_snapshots`);
await c.execute(`DELETE FROM device_state`);
await c.execute(`DELETE FROM save_versions`);
await c.execute(`DELETE FROM save_slots`);

let removed = 0;
for (const key of storageKeys) {
  try {
    await r2.removeObject(bucket, key);
    removed += 1;
  } catch (err) {
    console.warn("R2 remove failed", key, err instanceof Error ? err.message : err);
  }
}

// Also sweep any leftover objects under saves/
const leftovers = [];
const stream = r2.listObjectsV2(bucket, "saves/", true);
for await (const obj of stream) {
  if (obj.name) leftovers.push(obj.name);
}
for (const key of leftovers) {
  try {
    await r2.removeObject(bucket, key);
    removed += 1;
    console.log("removed leftover", key);
  } catch (err) {
    console.warn("leftover remove failed", key, err instanceof Error ? err.message : err);
  }
}

const after = await c.execute(`
  SELECT
    (SELECT COUNT(*) FROM save_slots) AS slots,
    (SELECT COUNT(*) FROM save_versions) AS versions,
    (SELECT COUNT(*) FROM parsed_snapshots) AS snapshots
`);
console.log("after", after.rows[0]);
console.log(`removed ${removed} R2 objects (${storageKeys.length} referenced + leftovers)`);

await c.close();
