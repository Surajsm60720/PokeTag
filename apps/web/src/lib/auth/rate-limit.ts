import { createHash } from "node:crypto";
import { getDb } from "../db";

/** Lockout window and cap for the single login route. */
const WINDOW_MS = 15 * 60 * 1000;
const MAX_FAILURES = 8;

function attemptKey(ip: string): string {
  const secret = process.env.AUTH_SESSION_SECRET?.trim() || "poketag-login";
  return createHash("sha256").update(`${secret}:${ip}`).digest("hex");
}

type Row = { failures: number; first_at: number };

/**
 * Whether this address may try to log in.
 * The count is stored in the app database so it survives a new server
 * instance. If that read fails, the attempt is allowed — a lockout outage
 * must not take the login page down.
 */
export async function loginAllowed(
  ip: string
): Promise<{ ok: boolean; retryAfter: number }> {
  try {
    const db = await getDb();
    const row = await db
      .prepare(`SELECT failures, first_at FROM login_attempts WHERE ip = ?`)
      .get<Row>(attemptKey(ip));
    if (!row) return { ok: true, retryAfter: 0 };
    const age = Date.now() - row.first_at;
    if (age > WINDOW_MS) {
      await db.prepare(`DELETE FROM login_attempts WHERE ip = ?`).run(attemptKey(ip));
      return { ok: true, retryAfter: 0 };
    }
    if (row.failures < MAX_FAILURES) return { ok: true, retryAfter: 0 };
    return {
      ok: false,
      retryAfter: Math.max(1, Math.ceil((WINDOW_MS - age) / 1000)),
    };
  } catch {
    return { ok: true, retryAfter: 0 };
  }
}

export async function recordLoginFailure(ip: string): Promise<void> {
  try {
    const db = await getDb();
    const key = attemptKey(ip);
    const now = Date.now();
    const row = await db
      .prepare(`SELECT failures, first_at FROM login_attempts WHERE ip = ?`)
      .get<Row>(key);
    if (!row || now - row.first_at > WINDOW_MS) {
      await db
        .prepare(
          `INSERT INTO login_attempts (ip, failures, first_at)
           VALUES (?, 1, ?)
           ON CONFLICT(ip) DO UPDATE SET failures = 1, first_at = excluded.first_at`
        )
        .run(key, now);
      return;
    }
    await db
      .prepare(`UPDATE login_attempts SET failures = failures + 1 WHERE ip = ?`)
      .run(key);
  } catch {
    // Lockout is best-effort.
  }
}

export async function clearLoginFailures(ip: string): Promise<void> {
  try {
    const db = await getDb();
    await db
      .prepare(`DELETE FROM login_attempts WHERE ip = ?`)
      .run(attemptKey(ip));
  } catch {
    // Lockout is best-effort.
  }
}
