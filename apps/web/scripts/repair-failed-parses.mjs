/**
 * One-shot: re-detect + re-parse versions that failed as unrecognized.
 * Usage (from apps/web): node --env-file=.env.local scripts/repair-failed-parses.mjs
 */
import { createClient } from "@libsql/client";
import * as Minio from "minio";
import { detectSave, parseSave } from "../../../packages/save-format/dist/index.js";

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

async function getObject(key) {
  const stream = await r2.getObject(bucket, key);
  const chunks = [];
  for await (const chunk of stream) chunks.push(Buffer.from(chunk));
  return Buffer.concat(chunks);
}

const c = createClient({ url, authToken });

const versions = await c.execute(`
  SELECT v.id, v.slot_id, v.storage_key, v.original_filename, v.parse_status,
         s.run_label
  FROM save_versions v
  JOIN save_slots s ON s.id = v.slot_id
  ORDER BY v.uploaded_at ASC
`);

for (const row of versions.rows) {
  console.log(`\n--- ${row.id} (${row.original_filename}, ${row.parse_status})`);
  const bytes = await getObject(String(row.storage_key));
  const detection = detectSave(bytes, String(row.original_filename), {
    hint: String(row.run_label || ""),
  });
  console.log(
    `  detect → ${detection.label} recognized=${detection.recognized} format=${detection.format}`
  );

  if (
    !detection.recognized ||
    (detection.gameVersion !== "pokkentournamentdx" &&
      detection.generation == null)
  ) {
    console.log("  skip: still not parseable");
    continue;
  }

  const parsed = parseSave(bytes, detection);
  const now = new Date().toISOString();

  await c.execute({
    sql: `UPDATE save_versions
            SET detection_json = ?, recognized = 1, source_format = ?,
                parse_status = 'done', parse_error = '', parsed_at = ?,
                parse_attempts = 0, parse_started_at = NULL
          WHERE id = ?`,
    args: [JSON.stringify(detection), detection.format, now, row.id],
  });
  await c.execute({
    sql: `UPDATE save_slots SET game_version = ?, generation = ? WHERE id = ?`,
    args: [detection.gameVersion, detection.generation, row.slot_id],
  });

  await c.execute({
    sql: `DELETE FROM parsed_snapshots WHERE version_id = ?`,
    args: [row.id],
  });
  await c.execute({
    sql: `INSERT INTO parsed_snapshots (
      version_id, trainer_json, party_json, boxes_json, dex_json, badges_json,
      location, location_map_id, play_time_seconds, parser_version, is_demo,
      created_at, inventory_json, progress_json
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?)`,
    args: [
      row.id,
      JSON.stringify(parsed.trainer),
      JSON.stringify(parsed.party),
      JSON.stringify(parsed.boxes),
      JSON.stringify(parsed.dex),
      JSON.stringify(parsed.badges),
      parsed.location || "",
      parsed.locationMapId,
      parsed.playTimeSeconds || 0,
      parsed.parserVersion,
      now,
      JSON.stringify(parsed.inventory ?? { bag: [], pc: [] }),
      JSON.stringify(
        parsed.progress ?? {
          eliteFourDefeated: null,
          championDefeated: null,
          note: "",
        }
      ),
    ],
  });

  console.log(
    `  ok → OT ${parsed.trainer.name}, party ${parsed.party.length}, money ${parsed.trainer.money}`
  );
}

const check = await c.execute(`
  SELECT s.run_label, s.game_version, s.generation,
         v.parse_status, v.original_filename, v.source_format
  FROM save_slots s
  JOIN save_versions v ON v.id = s.current_version_id
  ORDER BY s.created_at
`);
console.log("\n=== shelf after repair ===");
for (const r of check.rows) console.log(r);

await c.close();
