/**
 * Test bootstrap: registered via `node --import ./test/register.mjs`.
 *
 * Runs before any test module is loaded, so it can install the resolver hook
 * and pin the environment. Tests get their own throwaway SQLite file and the
 * in-process "memory" object store — `npm test` never touches the dev vault
 * in data/poketag.sqlite, never needs MinIO/Docker, and never talks to R2.
 */
import { mkdtempSync, rmSync } from "node:fs";
import { register } from "node:module";
import os from "node:os";
import path from "node:path";

register("./resolve-ts.mjs", import.meta.url);

const tempDir = mkdtempSync(path.join(os.tmpdir(), "poketag-test-"));

process.env.DATABASE_URL = `file:${path.join(tempDir, "poketag.sqlite")}`;
process.env.STORAGE_DRIVER = "memory";
// Never let a test reach a real cloud store, whatever .env.local says.
delete process.env.TURSO_DATABASE_URL;
delete process.env.TURSO_AUTH_TOKEN;
delete process.env.R2_ACCOUNT_ID;
delete process.env.R2_ACCESS_KEY_ID;
delete process.env.R2_SECRET_ACCESS_KEY;
// Fail the parse quickly instead of waiting out the production backoff.
process.env.PARSE_RETRY_DELAY_MS = process.env.PARSE_RETRY_DELAY_MS ?? "50";

process.on("exit", () => {
  try {
    rmSync(tempDir, { recursive: true, force: true });
  } catch {
    // Leaving a temp dir behind is not worth failing a test run over.
  }
});
