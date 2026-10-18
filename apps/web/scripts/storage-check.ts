/**
 * Smoke-test object storage credentials (local MinIO or Cloudflare R2).
 *
 *   npm run storage:check
 *
 * Loads apps/web/.env.local — set STORAGE_DRIVER=r2 and R2_* to verify the cloud bucket.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  deleteObject,
  describeStorage,
  getObject,
  putObject,
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

const key = `healthchecks/poketag-${Date.now()}.bin`;
const payload = Buffer.from("poketag-storage-ok");

async function main() {
  console.log(`Storage: ${describeStorage()}`);
  await putObject(key, payload);
  const roundTrip = await getObject(key);
  await deleteObject(key);

  if (!roundTrip.equals(payload)) {
    throw new Error("Round-trip bytes did not match");
  }
  console.log("OK — put / get / delete succeeded.");
}

main().catch((err) => {
  console.error("\nStorage check failed.");
  console.error(err instanceof Error ? err.message : err);
  console.error(
    "\nLocal MinIO: docker compose up -d\nR2: see docs/storage.md\n"
  );
  process.exit(1);
});
