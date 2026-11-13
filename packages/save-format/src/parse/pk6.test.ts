import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  decryptPk6,
  encryptPk6,
  parsePk6,
  pk6ChecksumOk,
  PK6_PARTY,
  PK6_STORED,
} from "./pk6.js";

function writeU16(buf: Uint8Array, off: number, value: number): void {
  buf[off] = value & 0xff;
  buf[off + 1] = (value >>> 8) & 0xff;
}

function writeU32(buf: Uint8Array, off: number, value: number): void {
  buf[off] = value & 0xff;
  buf[off + 1] = (value >>> 8) & 0xff;
  buf[off + 2] = (value >>> 16) & 0xff;
  buf[off + 3] = (value >>> 24) & 0xff;
}

function writeUtf16z(buf: Uint8Array, off: number, text: string): void {
  for (let i = 0; i < text.length; i++) {
    writeU16(buf, off + i * 2, text.charCodeAt(i));
  }
}

/** Build a plaintext PK6 party mon and fix its checksum. */
function makePlainPk6(opts: {
  ec?: number;
  species: number;
  level: number;
  nickname?: string;
  ot?: string;
}): Uint8Array {
  const pkx = new Uint8Array(PK6_PARTY);
  const ec = opts.ec ?? 0x12345678;
  writeU32(pkx, 0, ec);
  writeU16(pkx, 0x08, opts.species);
  writeU16(pkx, 0x0c, 12345); // TID
  writeU16(pkx, 0x0e, 54321); // SID
  pkx[0x14] = 1; // ability id
  writeU32(pkx, 0x18, ec); // PID
  pkx[0x1c] = 0; // Hardy
  writeUtf16z(pkx, 0x40, opts.nickname ?? "Testmon");
  writeU16(pkx, 0x5a, 33); // Tackle
  writeUtf16z(pkx, 0xb0, opts.ot ?? "Trainer");
  pkx[0xca] = 70;
  pkx[0xec] = opts.level;
  writeU16(pkx, 0xf0, 20);
  writeU16(pkx, 0xf2, 40);

  let sum = 0;
  for (let i = 8; i < PK6_STORED; i += 2) {
    sum = (sum + (pkx[i]! | (pkx[i + 1]! << 8))) & 0xffff;
  }
  writeU16(pkx, 6, sum);
  return pkx;
}

describe("PK6 crypto", () => {
  it("round-trips encrypt → decrypt byte-identical", () => {
    const plain = makePlainPk6({ species: 25, level: 18, nickname: "Pika" });
    const ekx = encryptPk6(plain);
    assert.notDeepEqual(
      Buffer.from(ekx.subarray(8, 40)),
      Buffer.from(plain.subarray(8, 40)),
      "encryption must change block bytes"
    );
    const back = decryptPk6(ekx);
    assert.ok(back);
    assert.ok(pk6ChecksumOk(back));
    assert.deepEqual(Buffer.from(back), Buffer.from(plain));
  });

  it("parsePk6 reads species, level, and nickname after decrypt", () => {
    const plain = makePlainPk6({
      species: 70,
      level: 13,
      nickname: "Bells",
      ot: "Suraj",
    });
    const ekx = encryptPk6(plain);
    const mon = parsePk6(ekx, 0);
    assert.ok(mon);
    assert.equal(mon.speciesId, 70);
    assert.equal(mon.speciesName, "Weepinbell");
    assert.equal(mon.level, 13);
    assert.equal(mon.nickname, "Bells");
    assert.equal(mon.otName, "Suraj");
    assert.ok(mon.moves.includes("Tackle"));
  });

  it("treats an all-zero slot as empty", () => {
    assert.equal(parsePk6(new Uint8Array(PK6_PARTY), 0), null);
  });
});
