import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { describe, it } from "node:test";
import { convertSave, suggestedFilename } from "./convert.js";
import { detectSave } from "./detect.js";
import {
  DESMUME_MAGIC,
  appendDesmumeFooter,
  stripDesmumeFooter,
} from "./desmume.js";

function sha256(buf: Buffer): string {
  return createHash("sha256").update(buf).digest("hex");
}

function makeGbaFixture(): Buffer {
  const buf = Buffer.alloc(0x20000, 0);
  // Plant Emerald game code so detection can label it.
  buf.write("BPEE", 0x1000, "ascii");
  return buf;
}

function makeDsFixture(): Buffer {
  return Buffer.alloc(0x80000, 0x5a);
}

describe("detectSave", () => {
  it("recognizes Gen 3 Emerald-sized .sav", () => {
    const data = makeGbaFixture();
    const result = detectSave(data, "emerald.sav");
    assert.equal(result.format, "sav");
    assert.equal(result.generation, 3);
    assert.equal(result.gameVersion, "emerald");
    assert.equal(result.recognized, true);
  });

  it("detects DeSmuME footer as .dsv", () => {
    const raw = makeDsFixture();
    const dsv = appendDesmumeFooter(raw);
    const result = detectSave(dsv, "game.dsv");
    assert.equal(result.format, "dsv");
    assert.equal(result.hasDesmumeFooter, true);
    assert.equal(result.rawPayloadSize, raw.length);
    assert.ok(result.recognized);
  });

  it("allows unknown files as unrecognized", () => {
    const data = Buffer.from("not a save");
    const result = detectSave(data, "mystery.bin");
    assert.equal(result.recognized, false);
    assert.ok(result.notes.some((n) => n.includes("vaulted")));
  });
});

describe("convertSave", () => {
  it("round-trips .sav -> .dsv -> .sav byte-identical payload", () => {
    const original = makeDsFixture();
    const toDsv = convertSave(original, "dsv", "run.sav");
    assert.ok(toDsv.data.subarray(-DESMUME_MAGIC.length).equals(DESMUME_MAGIC));
    const back = convertSave(toDsv.data, "sav", "run.dsv");
    assert.equal(sha256(back.data), sha256(original));
  });

  it("strips footer for .dsv -> .sav", () => {
    const raw = makeGbaFixture();
    const dsv = appendDesmumeFooter(raw);
    const sav = convertSave(dsv, "sav", "leaf.dsv");
    assert.equal(sav.data.length, raw.length);
    assert.equal(sha256(sav.data), sha256(stripDesmumeFooter(dsv)));
  });

  it(".sav -> .srm keeps identical bytes", () => {
    const original = makeGbaFixture();
    const srm = convertSave(original, "srm", "firered.sav");
    assert.equal(srm.filename, "firered.srm");
    assert.equal(sha256(srm.data), sha256(original));
  });
});

describe("suggestedFilename", () => {
  it("uses ROM basename and format extension", () => {
    assert.equal(
      suggestedFilename("Pokemon - Emerald Version (USA, Europe).gba", "sav"),
      "Pokemon - Emerald Version (USA, Europe).sav"
    );
  });
});
