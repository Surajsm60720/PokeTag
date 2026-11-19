import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { detectSave } from "../detect.js";
import { decodeGen4String, gen4Char } from "./charset.js";
import { parseGen4 } from "./gen4.js";
import { hgssMapName } from "./hgss-maps.js";
import { crc16Ccitt, parsePk4Box } from "./pkm.js";
import { levelFromSpeciesExp } from "./exp.js";

function writeGen4(block: Buffer, offset: number, text: string): void {
  for (let i = 0; i < 8; i++) {
    const ch = text[i];
    if (!ch) {
      block.writeUInt16LE(0xffff, offset + i * 2);
      return;
    }
    const code =
      ch >= "a" && ch <= "z"
        ? 0x0145 + ch.charCodeAt(0) - 0x61
        : ch >= "A" && ch <= "Z"
          ? 0x012b + ch.charCodeAt(0) - 0x41
          : 0;
    block.writeUInt16LE(code, offset + i * 2);
  }
}

function seal(block: Buffer): void {
  const sum = crc16Ccitt(block.subarray(0, block.length - 0x10));
  block.writeUInt16LE(sum, block.length - 2);
}

describe("parseGen4 HeartGold", () => {
  it("accepts a checksummed HGSS general block and reads trainer, bag, and dex", () => {
    const save = Buffer.alloc(0x80000, 0xff);
    const general = save.subarray(0, 0xf628);
    general.fill(0);
    writeGen4(general, 0x64, "GOLD");
    general.writeUInt16LE(1234, 0x74);
    general.writeUInt32LE(5000, 0x78);
    general[0x7c] = 0;
    general[0x7e] = 0b0000_0111;
    general[0x83] = 0b0000_0001;
    general.writeUInt16LE(12, 0x86);
    general[0x88] = 30;
    general[0x89] = 15;
    general[0x94] = 0;
    general.writeUInt16LE(17, 0x644);
    general.writeUInt16LE(5, 0x646);
    general.writeUInt16LE(67, 0x1234);
    general[0x12bc] = 0b0000_0001;
    general[0x12fc] = 0b0000_0011;
    seal(general);

    const storage = save.subarray(0xf700, 0xf700 + 0x12310);
    storage.fill(0);
    seal(storage);

    const parsed = parseGen4(save, detectSave(save, "Pokemon - HeartGold Version.sav"));
    assert.equal(parsed.gameVersion, "heartgold");
    assert.equal(parsed.trainer.name, "GOLD");
    assert.equal(parsed.trainer.trainerId, 1234);
    assert.equal(parsed.trainer.money, 5000);
    assert.equal(parsed.playTimeSeconds, 12 * 3600 + 30 * 60 + 15);
    assert.equal(parsed.badges.filter((b) => b.earned).length, 4);
    assert.equal(parsed.dex.owned, 1);
    assert.equal(parsed.dex.seen, 2);
    assert.equal(parsed.dex.entries.length, 2);
    const potion = parsed.inventory.bag.find((item) => item.id === 17);
    assert.ok(potion);
    assert.equal(potion.quantity, 5);
    assert.equal(potion.pocket, "items");
    assert.equal(potion.name, "Potion");
    assert.equal(parsed.location, "Cherrygrove City");
    assert.equal(parsed.locationMapId, 67);
  });

  it("names HeartGold and SoulSilver maps", () => {
    assert.equal(hgssMapName(67), "Cherrygrove City");
    assert.equal(hgssMapName(60), "New Bark Town");
    assert.equal(hgssMapName(33), "Route 29");
    assert.equal(hgssMapName(69), "Cherrygrove City, Pokémon Center");
    assert.equal(hgssMapName(9999), "Map 9999");
  });

  it("reads a HeartGold block whose CRC is stale but whose footer still matches", () => {
    const save = Buffer.alloc(0x80000, 0xff);
    const general = save.subarray(0, 0xf628);
    general.fill(0);
    writeGen4(general, 0x64, "Suraj");
    general.writeUInt16LE(43746, 0x74);
    general.writeUInt32LE(3000, 0x78);
    general.writeUInt32LE(4, general.length - 0x10);
    general.writeUInt32LE(general.length, general.length - 12);
    general.writeUInt32LE(0x20060623, general.length - 8);
    general.writeUInt16LE(0xffff, general.length - 2);

    const storage = save.subarray(0xf700, 0xf700 + 0x12310);
    storage.fill(0);
    storage.writeUInt32LE(4, storage.length - 0x10);
    storage.writeUInt32LE(storage.length, storage.length - 12);
    storage.writeUInt32LE(0x20060623, storage.length - 8);
    storage.writeUInt16LE(0xffff, storage.length - 2);

    const parsed = parseGen4(save, detectSave(save, "Pokemon - HeartGold Version (USA).sav"));
    assert.equal(parsed.trainer.name, "Suraj");
    assert.equal(parsed.trainer.trainerId, 43746);
    assert.equal(parsed.trainer.money, 3000);

    general[0x64 + 0x1c] = 8;
    const unnamed = detectSave(save, "save.sav");
    const silver = parseGen4(save, { ...unnamed, generation: 4, gameVersion: "unknown" });
    assert.equal(silver.gameVersion, "soulsilver");
    assert.equal(silver.trainer.name, "Suraj");
  });

  it("decodes the Gen 4 character set used by trainer names", () => {
    assert.equal(gen4Char(0x0003), "あ");
    assert.equal(gen4Char(0x00a1), "ン");
    const bytes = Buffer.alloc(12);
    for (const [i, code] of [0x013d, 0x0159, 0x0156, 0x0145, 0x014e, 0xffff].entries()) {
      bytes.writeUInt16LE(code, i * 2);
    }
    assert.equal(decodeGen4String(bytes, 0, 8), "Suraj");
  });

  it("reads a real HeartGold party slot that is stored decrypted", () => {
    // First 136 bytes of the uploaded HeartGold party. Checksum already matches
    // the plaintext, so a second decrypt would turn Cyndaquil into garbage.
    const raw = Buffer.alloc(236);
    Buffer.from(
      "bf95c11e0000f413f869ac7c721e7e8a7c1d6c2afd92d0ff91c4c40e1d9a236f4ad42c0ac8995e6ccb0caf00191c379f6165fb5d66b69783a58f0081c2f63649f4d7abe112639a30aec74344ea03ae973d7ff3a11a2fd9dc4cb40df10c23a666da5ba0f1d343d9a3120caaea1978d0257c8f7891421abb349ba19dd2f4099594bdcb9411647fb03a",
      "hex"
    ).copy(raw);
    Buffer.from("000000000600140014000c000b000f000a000c00", "hex").copy(raw, 0x88);
    const mon = parsePk4Box(raw, 0);
    assert.ok(mon);
    assert.equal(mon.speciesName, "Cyndaquil");
    assert.equal(mon.nickname, "CYNDAQUIL");
    assert.equal(mon.otName, "Suraj");
    assert.equal(mon.level, 6);
    assert.equal(levelFromSpeciesExp(155, 197), 6);
    assert.equal(mon.currentHp, 20);
    assert.equal(mon.maxHp, 20);
    assert.deepEqual(mon.moves, ["Tackle", "Leer", "Smokescreen"]);
    assert.equal(mon.ability, "Blaze");
    assert.equal(mon.originGame, "HeartGold");
  });
});
