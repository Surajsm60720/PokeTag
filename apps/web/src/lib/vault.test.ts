import assert from "node:assert/strict";
import { after, describe, it } from "node:test";

import { getDb } from "./db";
import { getObject, listMemoryObjects } from "./storage";
import {
  commitUpload,
  deleteSlot,
  deleteVersion,
  getSlot,
  listSlots,
  listVersions,
  loadVersionBytes,
  restoreVersion,
  sha256,
} from "./vault";

/**
 * Vault integrity suite — the PRD §12 success criteria plus the commit/restore
 * invariants the design document promises.
 *
 * Runs against a throwaway SQLite file and the in-process storage driver (see
 * ../../test/register.mjs), so it never touches dev data or Docker.
 */

/** Synthetic GBA save: correct size, real Gen 3 game code at the real offset. */
function gbaSave(gameCode: string, fill = 0): Buffer {
  const buf = Buffer.alloc(0x20000, fill);
  buf.write(gameCode, 0x1000, "ascii");
  return buf;
}

const EMERALD = gbaSave("BPEE", 0);
const EMERALD_V2 = gbaSave("BPEE", 2);
const LEAFGREEN = gbaSave("BPGE", 1);

async function newRun(bytes: Buffer, label: string) {
  const result = await commitUpload({
    data: bytes,
    filename: `${label}.sav`,
    runLabel: label,
  });
  assert.equal(result.duplicate, false, `fresh run "${label}" must not dedupe`);
  return result;
}

describe("vault integrity (PRD §12)", () => {
  it("upload then download returns byte-identical bytes", async () => {
    const { slotId, versionId } = await newRun(EMERALD, "round-trip");

    const { data, version } = await loadVersionBytes(versionId);

    assert.equal(sha256(data), sha256(EMERALD));
    assert.ok(data.equals(EMERALD));
    assert.equal(version.slot_id, slotId);
    assert.equal(version.size_bytes, EMERALD.length);
    assert.equal(version.sha256, sha256(EMERALD));
    assert.equal(version.original_filename, "round-trip.sav");
  });

  it("rejects a repeat upload of the same bytes into the same run", async () => {
    const { slotId, versionId } = await newRun(EMERALD, "dupes");

    const again = await commitUpload({
      data: EMERALD,
      filename: "dupes-copy.sav",
      slotId,
    });

    assert.equal(again.duplicate, true);
    assert.equal(again.versionId, versionId, "returns the existing version");
    assert.equal((await listVersions(slotId)).length, 1);
  });

  it("one upload wins when the same bytes arrive concurrently", async () => {
    const { slotId } = await newRun(EMERALD, "race");

    const results = await Promise.all([
      commitUpload({ data: EMERALD_V2, filename: "race.sav", slotId }),
      commitUpload({ data: EMERALD_V2, filename: "race.sav", slotId }),
    ]);

    // v1 (EMERALD) plus exactly one new version — not two.
    const versions = await listVersions(slotId);
    assert.equal(versions.length, 2, "the race must land exactly one version");
    assert.equal(
      results.filter((r) => r.duplicate).length,
      1,
      "exactly one caller must be told it lost"
    );
    assert.equal(
      new Set(results.map((r) => r.versionId)).size,
      1,
      "both callers must be handed the same winning version"
    );
    assert.equal(sha256(EMERALD_V2), versions[0].sha256);
  });

  it("refuses a save from a different game", async () => {
    const { slotId } = await newRun(EMERALD, "locked");

    await assert.rejects(
      commitUpload({ data: LEAFGREEN, filename: "leaf.sav", slotId }),
      /locked to emerald/
    );
    assert.equal((await listVersions(slotId)).length, 1, "nothing was written");
  });

  it("requires a run label for a new run", async () => {
    await assert.rejects(
      commitUpload({ data: EMERALD, filename: "unlabelled.sav" }),
      /Run label is required/
    );
    assert.equal((await listSlots()).length >= 0, true);
  });

  it("restores an older version as a new version", async () => {
    const { slotId, versionId: v1 } = await newRun(EMERALD, "history");
    await commitUpload({ data: EMERALD_V2, filename: "history.sav", slotId });

    const restored = await restoreVersion(slotId, v1);

    assert.notEqual(restored.versionId, v1, "restore must append, not rewind");
    const { data } = await loadVersionBytes(restored.versionId);
    assert.equal(sha256(data), sha256(EMERALD));
    assert.equal(
      (await getSlot(slotId))?.currentVersionId,
      restored.versionId,
      "the run now points at the restored version"
    );
    assert.equal((await listVersions(slotId)).length, 3);
  });

  it("keeps bytes that another version still references", async () => {
    const { slotId, versionId: v1 } = await newRun(EMERALD, "shared");
    const restored = await restoreVersion(slotId, v1);
    const sharedKey = (await listVersions(slotId)).find((v) => v.id === v1)!
      .storage_key;

    await deleteVersion(slotId, v1);

    assert.equal((await listVersions(slotId)).length, 1);
    assert.ok(
      listMemoryObjects().includes(sharedKey),
      "restore shares the storage key — the object must survive"
    );
    const { data } = await loadVersionBytes(restored.versionId);
    assert.equal(sha256(data), sha256(EMERALD), "bytes must still be readable");
  });

  it("deletes the object once the last reference goes", async () => {
    const { slotId } = await newRun(EMERALD, "unshared");
    const second = await commitUpload({
      data: EMERALD_V2,
      filename: "unshared.sav",
      slotId,
    });
    const key = (await listVersions(slotId)).find(
      (v) => v.id === second.versionId
    )!.storage_key;

    await deleteVersion(slotId, second.versionId);

    assert.equal(
      listMemoryObjects().includes(key),
      false,
      "unreferenced object should be cleaned up"
    );
    assert.equal((await listVersions(slotId)).length, 1);
  });

  it("refuses to delete the last version of a run", async () => {
    const { slotId, versionId } = await newRun(EMERALD, "last-version");
    await assert.rejects(
      deleteVersion(slotId, versionId),
      /Cannot delete the last version/
    );
  });

  it("getSlot returns exactly the requested run", async () => {
    const a = await newRun(EMERALD, "slot-a");
    const b = await newRun(EMERALD_V2, "slot-b");

    const slotA = await getSlot(a.slotId);
    const slotB = await getSlot(b.slotId);

    assert.equal(slotA?.id, a.slotId);
    assert.equal(slotA?.runLabel, "slot-a");
    assert.equal(slotB?.id, b.slotId);
    assert.equal(slotB?.runLabel, "slot-b");
    assert.equal(await getSlot("no-such-run"), null);
  });

  it("deleting a run removes its rows and objects", async () => {
    const { slotId } = await newRun(EMERALD, "doomed");
    const keys = (await listVersions(slotId)).map((v) => v.storage_key);

    await deleteSlot(slotId);

    assert.equal((await listVersions(slotId)).length, 0);
    assert.equal(await getSlot(slotId), null);
    for (const key of keys) {
      assert.equal(
        listMemoryObjects().includes(key),
        false,
        `object ${key} should be gone`
      );
    }
  });
});

/**
 * Whole-store invariants: after every test above, storage and metadata must
 * agree in both directions. This is the property the vault exists for.
 */
after(async () => {
  const db = await getDb();
  const rows = await db
    .prepare(`SELECT storage_key FROM save_versions`)
    .all<{ storage_key: string }>();
  const referenced = new Set(rows.map((r) => r.storage_key));

  assert.deepEqual(
    listMemoryObjects().filter((key) => !referenced.has(key)),
    [],
    "orphaned objects: bytes in storage with no save_versions row"
  );

  for (const key of referenced) {
    await getObject(key); // throws if a row points at missing bytes
  }
});
