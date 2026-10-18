/**
 * Uploads a visible dummy object to R2 for dashboard verification.
 *
 *   npm run storage:dummy
 *
 * Object key (delete this in the Cloudflare R2 UI after checking):
 *   poketag-test/DELETE-ME-dashboard-check.txt
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  describeStorage,
  getObject,
  putObject,
  resetStorageClient,
} from "../src/lib/storage.ts";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const webRoot = path.resolve(__dirname, "..");

const OBJECT_KEY = "poketag-test/DELETE-ME-dashboard-check.txt";

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
  if (!process.env.R2_ACCESS_KEY_ID?.trim() || !process.env.R2_SECRET_ACCESS_KEY?.trim()) {
    console.error(
      "Missing R2_ACCESS_KEY_ID / R2_SECRET_ACCESS_KEY in apps/web/.env.local\n\n" +
        "Create them: Cloudflare Dashboard → R2 → Manage R2 API Tokens → Create API Token\n" +
        "(Object Read & Write on bucket poketag-saves). Paste both values into .env.local, then re-run."
    );
    process.exit(1);
  }

  const body = Buffer.from(
    [
      "PokéTag R2 dashboard check",
      `uploadedAt=${new Date().toISOString()}`,
      "Safe to delete this object from the Cloudflare R2 UI.",
      "",
    ].join("\n"),
    "utf8"
  );

  console.log(`Storage: ${describeStorage()}`);
  console.log(`Uploading: ${OBJECT_KEY}`);
  await putObject(OBJECT_KEY, body, "text/plain");
  const roundTrip = await getObject(OBJECT_KEY);
  if (!roundTrip.equals(body)) {
    throw new Error("Round-trip mismatch after upload");
  }

  console.log("\nOK — dummy object is in the bucket.");
  console.log("In Cloudflare → R2 → poketag-saves, open folder poketag-test/");
  console.log(`File: DELETE-ME-dashboard-check.txt (${body.length} bytes)`);
  console.log("Delete it there when you've confirmed it showed up.");
}

main().catch((err) => {
  console.error("\nDummy upload failed.");
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
