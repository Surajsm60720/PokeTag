import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { describe, it } from "node:test";
import { detectSave } from "../detect.js";
import { findBeefBlocks, BEEF_MAGIC } from "./beef.js";
import { decodeGen3String, encodeGen3String } from "./charset.js";
import { buildMinimalGen3Save, gen3SectionChecksum } from "./gen3.js";
import { parseSave } from "./index.js";
import {
  decryptPk3Data,
  parsePk3,
  PK3_SHUFFLE_ORDER,
  unshufflePk3,
} from "./pkm.js";
import {
  cryptStaticXorpad,
  decryptSCBlocks,
  encodeU32Block,
  fnv1a32,
  isScHashValid,
  parseSCBlockStream,
  SCTypeCode,
} from "./scblock.js";
import { PARSER_VERSION } from "./types.js";
import { writeU16LE, writeU32LE } from "./util.js";

describe("charset", () => {
  it("round-trips Gen3 English letters", () => {
    const encoded = encodeGen3String("ASH", 7);
    assert.equal(decodeGen3String(encoded), "ASH");
  });
});

describe("PK3 decrypt / shuffle", () => {
  it("exposes 24 shuffle orders and decrypts with PID^OTID", () => {
    assert.equal(PK3_SHUFFLE_ORDER.length, 24);
    assert.deepEqual(PK3_SHUFFLE_ORDER[0], [0, 1, 2, 3]);

    const personality = 0x12345678;
    const otId = 0x9abcdef0;
    const plain = new Uint8Array(48);
    // Growth species = 25 (Pikachu) at start of growth substructure (order 0).
    plain[0] = 25;
    plain[1] = 0;
    const encrypted = decryptPk3Data(plain, personality, otId);
    const again = decryptPk3Data(encrypted, personality, otId);
    assert.deepEqual(again, plain);

    const { growth, order } = unshufflePk3(plain, personality);
    assert.equal(order[0], 0);
    assert.equal(growth[0], 25);
  });
});

describe("BEEF helpers", () => {
  it("finds BEEF-marked blocks", () => {
    const buf = new Uint8Array(64);
    writeU32LE(buf, 8, BEEF_MAGIC);
    buf[12] = 4; // length
    buf[13] = 0;
    buf[16] = 0xaa;
    buf[17] = 0xbb;
    buf[18] = 0xcc;
    buf[19] = 0xdd;
    const blocks = findBeefBlocks(buf);
    assert.equal(blocks.length, 1);
    assert.equal(blocks[0]!.length, 4);
    assert.equal(blocks[0]!.data[0], 0xaa);
  });
});

describe("SCBlock helpers", () => {
  it("parses UInt32 blocks and applies XOR pad round-trip", () => {
    const key = fnv1a32("MONEY");
    const block = encodeU32Block(key, 12345);
    const parsed = parseSCBlockStream(block);
    assert.equal(parsed.length, 1);
    assert.equal(parsed[0]!.type, SCTypeCode.UInt32);
    assert.equal(parsed[0]!.key >>> 0, key >>> 0);

    const pad = new Uint8Array([1, 2, 3, 4, 5]);
    const x = cryptStaticXorpad(block, pad);
    const y = cryptStaticXorpad(x, pad);
    assert.deepEqual(y, block);
  });

  it("decryptSCBlocks validates SHA-256 footer", () => {
    const key = 0x11223344;
    const payload = encodeU32Block(key, 7);
    const pad = new Uint8Array([0x5a]);
    const xored = cryptStaticXorpad(payload, pad);
    const hash = createHash("sha256").update(xored).digest();
    const file = new Uint8Array(xored.length + 32);
    file.set(xored, 0);
    file.set(hash, xored.length);
    assert.equal(isScHashValid(file), true);
    const map = decryptSCBlocks(file, pad);
    assert.ok(map.has(key));

    file[0] ^= 0xff;
    assert.throws(
      () => decryptSCBlocks(file, pad),
      /checksum|hash/i
    );
  });
});

/** Build an encrypted 80-byte PK3 with known growth/attacks/misc (shuffle order 0). */
function buildEncryptedPk3Fixture(): Uint8Array {
  const personality = 0; // shuffle order 0, Hardy
  const otId = 0x12345678;
  const plain = new Uint8Array(48);
  // Growth: species 25, item 164 (Leftovers), exp for Lv.5 medium-fast = 125
  writeU16LE(plain, 0, 25);
  writeU16LE(plain, 2, 164);
  writeU32LE(plain, 4, 125);
  plain[8] = 0; // pp bonuses
  plain[9] = 70; // friendship
  // Attacks: Thunderbolt (85), Quick Attack (98)
  writeU16LE(plain, 12, 85);
  writeU16LE(plain, 14, 98);
  plain[20] = 15; // PP move 1
  plain[21] = 30; // PP move 2
  // Misc at offset 36: met loc 16 (Route 101 in our bank0 table), origins
  plain[37] = 16;
  // metLevel=5, game=Emerald(3), ball=Poké Ball(4)
  const origins = 5 | (3 << 7) | (4 << 11);
  writeU16LE(plain, 38, origins);
  // IVs word: ability slot 0
  writeU32LE(plain, 40, 0);

  const encrypted = decryptPk3Data(plain, personality, otId);
  const raw = new Uint8Array(80);
  writeU32LE(raw, 0, personality);
  writeU32LE(raw, 4, otId);
  raw.set(encodeGen3String("PIKA", 10), 8);
  raw.set(encodeGen3String("ASH", 7), 0x14);
  raw.set(encrypted, 0x20);
  return raw;
}

describe("parsePk3 enrichment", () => {
  it("reads held item, move name, and ball from crafted encrypted mon", () => {
    const raw = buildEncryptedPk3Fixture();
    const mon = parsePk3(raw, 0, { gameVersion: "emerald", trainerOtId: 0x12345678 });
    assert.ok(mon);
    assert.equal(mon!.speciesId, 25);
    assert.equal(mon!.speciesName, "Pikachu");
    assert.equal(mon!.heldItem, "Leftovers");
    assert.equal(mon!.heldItemId, 164);
    assert.ok(mon!.moves.includes("Thunderbolt"));
    assert.equal(mon!.moveDetails[0]!.name, "Thunderbolt");
    assert.equal(mon!.moveDetails[0]!.type, "Electric");
    assert.equal(mon!.ball, "Poké Ball");
    assert.equal(mon!.metLevel, 5);
    assert.equal(mon!.otName, "ASH");
    assert.equal(mon!.originKind, "wild");
    assert.equal(mon!.caughtAt, null);
    assert.equal(mon!.level, 5); // from medium-fast EXP
  });
});

describe("parseSave Gen3", () => {
  it("parses trainer from minimal dual-bank save with party count 0", () => {
    const raw = buildMinimalGen3Save({ trainerName: "MAY" });
    const detection = detectSave(Buffer.from(raw), "emerald.sav");
    assert.equal(detection.generation, 3);
    const parsed = parseSave(raw, detection);
    assert.equal(parsed.isDemo, false);
    assert.equal(parsed.parserVersion, PARSER_VERSION);
    assert.equal(parsed.trainer.name, "MAY");
    assert.equal(parsed.trainer.trainerId, 0x5678);
    assert.equal(parsed.trainer.secretId, 0x1234);
    assert.equal(parsed.trainer.money, 3000);
    assert.equal(parsed.party.length, 0);
    assert.equal(parsed.playTimeSeconds, 1 * 3600 + 2 * 60 + 3);
    assert.ok(parsed.boxes.length >= 14);
    assert.ok(parsed.inventory);
    assert.deepEqual(parsed.inventory.bag, []);
    assert.ok(parsed.progress);
    assert.equal(parsed.progress.eliteFourDefeated, null);
  });

  it("throws on bad Gen3 checksums", () => {
    const raw = buildMinimalGen3Save({
      trainerName: "BAD",
      corruptChecksum: true,
    });
    const detection = {
      ...detectSave(Buffer.from(raw), "emerald.sav"),
      generation: 3 as const,
      gameVersion: "emerald" as const,
    };
    assert.throws(() => parseSave(raw, detection), /checksum/i);
  });

  it("throws when generation is unrecognized", () => {
    const detection = detectSave(Buffer.from("nope"), "mystery.bin");
    assert.equal(detection.generation, null);
    assert.throws(() => parseSave(new Uint8Array([1, 2, 3]), detection), /generation/i);
  });
});

describe("gen3SectionChecksum", () => {
  it("is stable for empty trainer section size", () => {
    const data = new Uint8Array(3968);
    const chk = gen3SectionChecksum(data, 3884);
    assert.equal(chk, 0);
  });
});
