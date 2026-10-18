/**
 * End-to-end smoke against a running Next server (auth + empty shelf + fake upload).
 *
 *   npm run smoke:vault
 *
 * Requires: npm run dev (localhost:3000) and AUTH_* + storage configured.
 */
import { createHash, randomBytes } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const webRoot = path.resolve(__dirname, "..");
const BASE = process.env.SMOKE_BASE_URL || "http://127.0.0.1:3000";

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

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg);
}

function parseSetCookie(header: string | null): string | null {
  if (!header) return null;
  return header.split(";")[0] || null;
}

async function main() {
  const username = process.env.AUTH_USERNAME?.trim();
  const password = process.env.SMOKE_PASSWORD?.trim();
  assert(username, "AUTH_USERNAME missing in .env.local");
  assert(
    password,
    "Set SMOKE_PASSWORD to your vault password (not stored in repo)"
  );

  // 1) Unauthenticated home → redirect login
  const home = await fetch(`${BASE}/`, { redirect: "manual" });
  assert(
    home.status === 307 || home.status === 302,
    `Expected redirect from /, got ${home.status}`
  );
  const loc = home.headers.get("location") || "";
  assert(loc.includes("/login"), `Expected /login redirect, got ${loc}`);
  console.log("OK  unauthenticated / → login");

  // 2) API without cookie → 401
  const slotsNoAuth = await fetch(`${BASE}/api/slots`);
  assert(slotsNoAuth.status === 401, `Expected 401 slots, got ${slotsNoAuth.status}`);
  console.log("OK  /api/slots without session → 401");

  // 3) Bad password → 401
  const bad = await fetch(`${BASE}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password: "definitely-wrong" }),
  });
  assert(bad.status === 401, `Expected 401 bad login, got ${bad.status}`);
  console.log("OK  bad password → 401");

  // 4) Good login → cookie
  const login = await fetch(`${BASE}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password }),
  });
  assert(login.status === 200, `Login failed: ${login.status} ${await login.text()}`);
  const cookie = parseSetCookie(login.headers.get("set-cookie"));
  assert(cookie?.startsWith("poketag_session="), "Missing HttpOnly session cookie");
  assert(
    (login.headers.get("set-cookie") || "").toLowerCase().includes("httponly"),
    "Session cookie must be HttpOnly"
  );
  console.log("OK  login → HttpOnly session cookie");

  // 5) Authenticated shelf API
  const slotsRes = await fetch(`${BASE}/api/slots`, {
    headers: { Cookie: cookie },
  });
  assert(slotsRes.status === 200, `slots ${slotsRes.status}`);
  const slotsJson = (await slotsRes.json()) as { slots?: unknown[] };
  assert(Array.isArray(slotsJson.slots), "slots payload missing");
  console.log(`OK  /api/slots → ${slotsJson.slots.length} slot(s)`);

  // 6) Upload a tiny Gen3-sized buffer (unrecognized is fine — still vaulted)
  const bytes = Buffer.alloc(0x20000, 0);
  randomBytes(32).copy(bytes, 0);
  bytes.write("POKETAG-SMOKE", 48, "utf8");
  const form = new FormData();
  form.append(
    "file",
    new Blob([bytes], { type: "application/octet-stream" }),
    "smoke-test.sav"
  );
  form.append("gameVersion", "emerald");
  form.append("runLabel", "Smoke test run");
  form.append("note", "Automated smoke — safe to delete");

  const upload = await fetch(`${BASE}/api/upload`, {
    method: "POST",
    headers: { Cookie: cookie },
    body: form,
  });
  const uploadBody = await upload.text();
  assert(upload.status === 200, `upload ${upload.status}: ${uploadBody}`);
  const uploaded = JSON.parse(uploadBody) as {
    slotId?: string;
    versionId?: string;
  };
  assert(uploaded.slotId && uploaded.versionId, "upload missing ids");
  console.log(`OK  upload → slot ${uploaded.slotId} version ${uploaded.versionId}`);

  // 7) Download original bytes match
  const dl = await fetch(
    `${BASE}/api/download?versionId=${encodeURIComponent(uploaded.versionId!)}&format=original`,
    { headers: { Cookie: cookie } }
  );
  assert(dl.status === 200, `download ${dl.status}`);
  const got = Buffer.from(await dl.arrayBuffer());
  assert(got.equals(bytes), "download bytes != upload");
  const shaUp = createHash("sha256").update(bytes).digest("hex");
  const shaDown = createHash("sha256").update(got).digest("hex");
  assert(shaUp === shaDown, "sha mismatch");
  console.log("OK  download original round-trip (byte-identical)");

  // 8) Delete the smoke slot
  const del = await fetch(`${BASE}/api/slots/${uploaded.slotId}`, {
    method: "DELETE",
    headers: { Cookie: cookie },
  });
  // Some apps use DELETE on version; try slot delete route
  if (del.status === 404 || del.status === 405) {
    console.log("WARN slot DELETE not available — leave smoke slot for manual cleanup");
  } else {
    assert(del.ok, `delete slot ${del.status} ${await del.text()}`);
    console.log("OK  deleted smoke slot");
  }

  // 9) Logout clears cookie header
  const logout = await fetch(`${BASE}/api/auth/logout`, {
    method: "POST",
    headers: { Cookie: cookie },
  });
  assert(logout.status === 200, `logout ${logout.status}`);
  const cleared = logout.headers.get("set-cookie") || "";
  assert(cleared.toLowerCase().includes("max-age=0"), "logout should clear cookie");
  console.log("OK  logout clears session cookie");

  console.log("\nAll smoke checks passed.");
}

main().catch((err) => {
  console.error("\nSMOKE FAILED:", err instanceof Error ? err.message : err);
  process.exit(1);
});
