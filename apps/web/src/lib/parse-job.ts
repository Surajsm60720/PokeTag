import { detectSave, parseSave, type DetectionResult } from "@poketag/save-format";
import { getDb, type ParseStatus, type SaveVersionRow } from "./db";
import { getObject } from "./storage";
import type { ParsedSnapshot } from "./parsed";
import { saveParsedSnapshot } from "./snapshots";

/** A 'running' row older than this belongs to a process that died. */
export const STALE_RUNNING_MS = 10 * 60 * 1000;
/** One claim plus one automatic retry, then the version is marked failed. */
export const MAX_PARSE_ATTEMPTS = 2;
/** Default backoff before the automatic retry (tests lower it via env). */
const DEFAULT_RETRY_DELAY_MS = 2_000;

function retryDelayMs(): number {
  const raw = Number(process.env.PARSE_RETRY_DELAY_MS);
  return Number.isFinite(raw) && raw >= 0 ? raw : DEFAULT_RETRY_DELAY_MS;
}
/** Minimum gap between shelf-triggered sweeps for abandoned parses. */
const SWEEP_INTERVAL_MS = 60_000;

let lastSweepAt = 0;

async function setParseStatus(
  versionId: string,
  status: ParseStatus,
  error = ""
): Promise<void> {
  const db = await getDb();
  const parsedAt =
    status === "done" || status === "failed" ? new Date().toISOString() : null;
  await db
    .prepare(
      `UPDATE save_versions
     SET parse_status = ?, parse_error = ?, parsed_at = COALESCE(?, parsed_at)
     WHERE id = ?`
    )
    .run(status, error, parsedAt, versionId);
}

async function loadVersion(
  versionId: string
): Promise<SaveVersionRow | undefined> {
  return (await (
    await getDb()
  )
    .prepare(`SELECT * FROM save_versions WHERE id = ?`)
    .get(versionId)) as unknown as SaveVersionRow | undefined;
}

/**
 * Atomically take ownership of a parse. Returns undefined when another
 * worker holds a fresh claim, or when the version no longer exists. A
 * stale 'running' row (no live claimant) is reclaimed so an abandoned parse
 * can never wedge a version forever.
 */
async function claimParse(
  versionId: string
): Promise<SaveVersionRow | undefined> {
  const db = await getDb();
  const now = new Date().toISOString();
  const staleCutoff = new Date(Date.now() - STALE_RUNNING_MS).toISOString();
  const claimed = await db
    .prepare(
      `UPDATE save_versions
         SET parse_status = 'running', parse_started_at = ?,
             parse_attempts = parse_attempts + 1
       WHERE id = ?
         AND NOT (parse_status = 'running'
                  AND COALESCE(parse_started_at, uploaded_at) > ?)`
    )
    .run(now, versionId, staleCutoff);
  if (!claimed) return undefined;
  return loadVersion(versionId);
}

/**
 * Async parse for one version. Never deletes storage on failure.
 */
export async function parseVersion(versionId: string): Promise<void> {
  const version = await claimParse(versionId);
  if (!version) return;

  try {
    const bytes = await getObject(version.storage_key);
    const db = await getDb();
    const slot = await db
      .prepare(`SELECT run_label, game_version FROM save_slots WHERE id = ?`)
      .get<{ run_label: string; game_version: string }>(version.slot_id);

    // Always re-detect from bytes so parser upgrades (e.g. Gen 6 `main` sizes)
    // heal older unrecognized uploads. Run label breaks X/Y ties.
    const detection: DetectionResult = detectSave(
      bytes,
      version.original_filename,
      { hint: slot?.run_label }
    );

    // Spin-offs (Pokkén) are recognized with generation null; main-series still
    // needs a generation before parseSave can route.
    const needsGeneration =
      detection.gameVersion !== "pokkentournamentdx" &&
      detection.generation == null;
    if (!detection.recognized || needsGeneration) {
      throw new Error(
        detection.notes?.[0] ||
          "Unrecognized save — vaulted but not parseable."
      );
    }

    await db
      .prepare(
        `UPDATE save_versions
            SET detection_json = ?, recognized = ?, source_format = ?
          WHERE id = ?`
      )
      .run(
        JSON.stringify(detection),
        detection.recognized ? 1 : 0,
        detection.format,
        versionId
      );
    const parsed = parseSave(bytes, detection);
    // Prefer the parser's resolved game (e.g. MyStatus says Y even if the
    // run was labeled X) when the slot is still unknown or disagrees.
    const resolvedGame = parsed.gameVersion || detection.gameVersion;
    if (
      resolvedGame &&
      resolvedGame !== "unknown" &&
      slot &&
      slot.game_version !== resolvedGame
    ) {
      await db
        .prepare(
          `UPDATE save_slots SET game_version = ?, generation = ? WHERE id = ?`
        )
        .run(
          resolvedGame,
          detection.generation,
          version.slot_id
        );
    }
    const snapshot: ParsedSnapshot = {
      versionId,
      gameVersion: parsed.gameVersion,
      parserVersion: parsed.parserVersion,
      isDemo: false,
      trainer: parsed.trainer,
      party: parsed.party,
      boxes: parsed.boxes,
      dex: parsed.dex,
      badges: parsed.badges,
      playTimeSeconds: parsed.playTimeSeconds,
      location: parsed.location,
      locationMapId: parsed.locationMapId,
      inventory: parsed.inventory ?? { bag: [], pc: [] },
      progress: parsed.progress ?? {
        eliteFourDefeated: null,
        championDefeated: null,
        note: "",
      },
    };
    await saveParsedSnapshot(snapshot);
    await setParseStatus(versionId, "done");
  } catch (err) {
    const message = err instanceof Error ? err.message : "Parse failed";
    // Attempts were incremented by the claim, so this is the number of
    // tries spent so far. One retry covers a transient storage read; a bad
    // save file fails deterministically and stops there.
    if (version.parse_attempts < MAX_PARSE_ATTEMPTS) {
      await setParseStatus(versionId, "pending", message);
      scheduleRetry(versionId);
    } else {
      await setParseStatus(versionId, "failed", message);
    }
  }
}

function scheduleRetry(versionId: string): void {
  const timer = setTimeout(() => {
    void parseVersion(versionId).catch(() => {
      // parseVersion records its own failure; swallow the rejection.
    });
  }, retryDelayMs());
  // Never hold the process open just to retry a parse.
  timer.unref?.();
}

/** Fire-and-forget queue (same process). */
export function queueParseVersion(versionId: string): void {
  void parseVersion(versionId).catch(() => {
    // parseVersion already records failure; swallow unhandled rejection.
  });
}

/**
 * Move versions abandoned in 'running' back to a usable state: requeue the
 * ones with attempts left, mark the exhausted ones failed so they stop
 * looking in-flight. Returns the ids that should be parsed again — the
 * caller decides whether to queue them.
 */
export async function recoverStaleParses(): Promise<string[]> {
  const db = await getDb();
  const staleCutoff = new Date(Date.now() - STALE_RUNNING_MS).toISOString();
  const stuck = await db
    .prepare(
      `SELECT id, parse_attempts FROM save_versions
        WHERE parse_status = 'running'
          AND COALESCE(parse_started_at, uploaded_at) <= ?`
    )
    .all<{ id: string; parse_attempts: number }>(staleCutoff);

  const requeue: string[] = [];
  for (const row of stuck) {
    if (row.parse_attempts >= MAX_PARSE_ATTEMPTS) {
      await db
        .prepare(
          `UPDATE save_versions
              SET parse_status = 'failed', parse_error = ?, parsed_at = ?
            WHERE id = ? AND parse_status = 'running'`
        )
        .run("Parse timed out.", new Date().toISOString(), row.id);
      continue;
    }
    const reset = await db
      .prepare(
        `UPDATE save_versions SET parse_status = 'pending'
          WHERE id = ? AND parse_status = 'running'`
      )
      .run(row.id);
    if (reset) requeue.push(row.id);
  }
  return requeue;
}

/**
 * Throttled shelf-facing sweep: recover abandoned parses and requeue the
 * ones that still have attempts left.
 */
export async function sweepStaleParses(): Promise<void> {
  const now = Date.now();
  if (now - lastSweepAt < SWEEP_INTERVAL_MS) return;
  lastSweepAt = now;
  const requeue = await recoverStaleParses();
  for (const versionId of requeue) queueParseVersion(versionId);
}
