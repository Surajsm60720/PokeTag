import { detectSave, parseSave, type DetectionResult } from "@poketag/save-format";
import { getDb, type SaveVersionRow } from "./db";
import { getObject } from "./minio";
import type { ParsedSnapshot } from "./parsed";
import { saveParsedSnapshot } from "./snapshots";

function setParseStatus(
  versionId: string,
  status: "pending" | "running" | "done" | "failed",
  error = ""
): void {
  const db = getDb();
  const parsedAt =
    status === "done" || status === "failed" ? new Date().toISOString() : null;
  db.prepare(
    `UPDATE save_versions
     SET parse_status = ?, parse_error = ?, parsed_at = COALESCE(?, parsed_at)
     WHERE id = ?`
  ).run(status, error, parsedAt, versionId);
}

function loadVersion(versionId: string): SaveVersionRow | undefined {
  return getDb()
    .prepare(`SELECT * FROM save_versions WHERE id = ?`)
    .get(versionId) as unknown as SaveVersionRow | undefined;
}

/**
 * Async parse for one version. Never deletes storage on failure.
 */
export async function parseVersion(versionId: string): Promise<void> {
  const version = loadVersion(versionId);
  if (!version) return;

  setParseStatus(versionId, "running");

  try {
    const bytes = await getObject(version.storage_key);
    let detection: DetectionResult;
    try {
      detection = JSON.parse(version.detection_json) as DetectionResult;
    } catch {
      detection = detectSave(bytes, version.original_filename);
    }
    if (!detection.recognized || detection.generation == null) {
      detection = detectSave(bytes, version.original_filename);
    }
    if (!detection.recognized || detection.generation == null) {
      throw new Error(
        detection.notes?.[0] ||
          "Unrecognized save — vaulted but not parseable."
      );
    }

    const parsed = parseSave(bytes, detection);
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
    saveParsedSnapshot(snapshot);
    setParseStatus(versionId, "done");
  } catch (err) {
    const message = err instanceof Error ? err.message : "Parse failed";
    setParseStatus(versionId, "failed", message);
  }
}

/** Fire-and-forget queue (same process). */
export function queueParseVersion(versionId: string): void {
  void parseVersion(versionId).catch(() => {
    // parseVersion already records failure; swallow unhandled rejection.
  });
}
