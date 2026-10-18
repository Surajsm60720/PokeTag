import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { v4 as uuid } from "uuid";

import { getDb, type ParseStatus } from "./db";
import {
  MAX_PARSE_ATTEMPTS,
  STALE_RUNNING_MS,
  parseVersion,
  recoverStaleParses,
} from "./parse-job";
import { getObject, putObject } from "./storage";
import { sha256 } from "./vault";

/**
 * Parse-job unit tests.
 *
 * Rows are seeded directly rather than going through commitUpload, because
 * commitUpload fires a background parse of its own — letting the queue race
 * the assertions here would test the scheduler instead of the state machine.
 */

const UNRECOGNIZED = Buffer.from("not a save");

interface SeedOptions {
  status?: ParseStatus;
  attempts?: number;
  startedAt?: string | null;
  bytes?: Buffer;
}

/** Insert a slot + version + stored object without triggering a parse. */
async function seedVersion(opts: SeedOptions = {}) {
  const bytes = opts.bytes ?? UNRECOGNIZED;
  const slotId = uuid();
  const versionId = uuid();
  const storageKey = `saves/${versionId}/seed.sav`;
  const now = new Date().toISOString();

  await putObject(storageKey, bytes);

  const db = await getDb();
  await db
    .prepare(
      `INSERT INTO save_slots (id, game_version, generation, run_label, created_at, current_version_id)
       VALUES (?, 'unknown', NULL, ?, ?, ?)`
    )
    .run(slotId, `seed-${versionId.slice(0, 8)}`, now, versionId);

  await db
    .prepare(
      `INSERT INTO save_versions (
         id, slot_id, parent_version_id, storage_key, sha256, size_bytes,
         original_filename, source_format, source_emulator, source_device,
         uploaded_at, note, recognized, detection_json,
         parse_status, parse_error, parsed_at, parse_attempts, parse_started_at
       ) VALUES (?, ?, NULL, ?, ?, ?, 'seed.sav', 'sav', '', '', ?, '', 0, '{}',
                 ?, '', NULL, ?, ?)`
    )
    .run(
      versionId,
      slotId,
      storageKey,
      sha256(bytes),
      bytes.length,
      now,
      opts.status ?? "pending",
      opts.attempts ?? 0,
      opts.startedAt ?? null
    );

  return { slotId, versionId, storageKey };
}

async function readVersion(versionId: string) {
  const db = await getDb();
  const row = await db
    .prepare(
      `SELECT parse_status, parse_error, parse_attempts FROM save_versions WHERE id = ?`
    )
    .get<{
      parse_status: ParseStatus;
      parse_error: string;
      parse_attempts: number;
    }>(versionId);
  assert.ok(row, `version ${versionId} should exist`);
  return row;
}

/** Poll until the version settles, or explain what it is stuck on. */
async function waitForTerminalState(versionId: string, timeoutMs = 5000) {
  const deadline = Date.now() + timeoutMs;
  let last: ParseStatus | undefined;
  while (Date.now() < deadline) {
    last = (await readVersion(versionId)).parse_status;
    if (last === "failed" || last === "done") return last;
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
  throw new Error(
    `parse for ${versionId} never settled; still "${String(last)}"`
  );
}

describe("parse job", () => {
  it("claims a version exactly once under concurrent parses", async () => {
    // Park the automatic retry far enough out that it cannot skew the count.
    const previousDelay = process.env.PARSE_RETRY_DELAY_MS;
    process.env.PARSE_RETRY_DELAY_MS = "60000";
    try {
      const { versionId } = await seedVersion();

      await Promise.all([
        parseVersion(versionId),
        parseVersion(versionId),
        parseVersion(versionId),
      ]);

      const row = await readVersion(versionId);
      assert.equal(
        row.parse_attempts,
        1,
        "only one caller may claim a parse; the others must stand down"
      );
      assert.equal(
        row.parse_status,
        "pending",
        "first failure is requeued, not terminal"
      );
      assert.ok(row.parse_error, "the failure reason must be recorded");
    } finally {
      process.env.PARSE_RETRY_DELAY_MS = previousDelay ?? "50";
    }
  });

  it("retries once, then marks the version failed", async () => {
    const { versionId } = await seedVersion();

    await parseVersion(versionId); // attempt 1 — schedules the retry
    assert.equal((await readVersion(versionId)).parse_attempts, 1);

    const terminal = await waitForTerminalState(versionId);

    assert.equal(terminal, "failed");
    const row = await readVersion(versionId);
    assert.equal(row.parse_attempts, MAX_PARSE_ATTEMPTS, "exactly one retry");
    assert.ok(row.parse_error);
  });

  it("never deletes storage when parsing fails", async () => {
    const { versionId, storageKey } = await seedVersion();

    await parseVersion(versionId); // attempt 1 — schedules the retry
    await waitForTerminalState(versionId);

    const stored = await getObject(storageKey);
    assert.ok(stored.equals(UNRECOGNIZED), "bytes must survive a failed parse");
  });

  it("requeues a parse abandoned by a dead process", async () => {
    const { versionId } = await seedVersion({
      status: "running",
      attempts: 1,
      startedAt: new Date(Date.now() - STALE_RUNNING_MS * 2).toISOString(),
    });

    const requeue = await recoverStaleParses();

    assert.deepEqual(requeue, [versionId]);
    const row = await readVersion(versionId);
    assert.equal(row.parse_status, "pending");
    assert.equal(
      row.parse_attempts,
      1,
      "recovery must not spend an attempt"
    );
  });

  it("gives up on an abandoned parse that has spent its attempts", async () => {
    const { versionId } = await seedVersion({
      status: "running",
      attempts: MAX_PARSE_ATTEMPTS,
      startedAt: new Date(Date.now() - STALE_RUNNING_MS * 2).toISOString(),
    });

    const requeue = await recoverStaleParses();

    assert.deepEqual(requeue, [], "exhausted parses must not be requeued");
    const row = await readVersion(versionId);
    assert.equal(row.parse_status, "failed");
    assert.ok(row.parse_error, "the row must explain itself");
  });

  it("leaves a live parse claim alone", async () => {
    const { versionId } = await seedVersion({
      status: "running",
      attempts: 1,
      startedAt: new Date().toISOString(),
    });

    const requeue = await recoverStaleParses();

    assert.deepEqual(requeue, [], "a fresh claim must not be stolen");
    assert.equal((await readVersion(versionId)).parse_status, "running");
  });
});
