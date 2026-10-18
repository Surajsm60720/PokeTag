/** In-memory login throttle (fine for a single-operator Node process). */

const WINDOW_MS = 15 * 60 * 1000;
const MAX_FAILURES = 8;

type Entry = { failures: number; firstAt: number };

const hits = new Map<string, Entry>();

export function loginAllowed(key: string): boolean {
  const now = Date.now();
  const entry = hits.get(key);
  if (!entry) return true;
  if (now - entry.firstAt > WINDOW_MS) {
    hits.delete(key);
    return true;
  }
  return entry.failures < MAX_FAILURES;
}

export function recordLoginFailure(key: string): void {
  const now = Date.now();
  const entry = hits.get(key);
  if (!entry || now - entry.firstAt > WINDOW_MS) {
    hits.set(key, { failures: 1, firstAt: now });
    return;
  }
  entry.failures += 1;
}

export function clearLoginFailures(key: string): void {
  hits.delete(key);
}
