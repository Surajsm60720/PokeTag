import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

import { detectSave } from "../detect.js";
import { parseGen6 } from "./gen6.js";
import {
  gen6LocationName,
  gen6SituationLocation,
} from "./locations-gen6.js";

function writeU16(buf: Uint8Array, off: number, value: number): void {
  buf[off] = value & 0xff;
  buf[off + 1] = (value >>> 8) & 0xff;
}

function setBit(buf: Uint8Array, off: number, speciesMinus1: number): void {
  const bd = speciesMinus1 >> 3;
  const mask = 1 << (speciesMinus1 & 7);
  buf[off + bd]! |= mask;
}

describe("gen6LocationName", () => {
  it("maps Kalos and Hoenn indexes", () => {
    assert.equal(gen6LocationName(10), "Aquacorde Town");
    assert.equal(gen6LocationName(14), "Santalune Forest");
    assert.equal(gen6LocationName(170), "Littleroot Town");
    assert.equal(gen6LocationName(9999), "Location #9999");
  });

  it("maps XY Situation zonedata entries to location indexes", () => {
    assert.deepEqual(gen6SituationLocation(286, "xy"), {
      locationId: 14,
      name: "Santalune Forest",
    });
    assert.deepEqual(gen6SituationLocation(8, "xy"), {
      locationId: 10,
      name: "Aquacorde Town",
    });
    // ORAS Situation.M is a zone id. 7 is Oldale, 286 is a Rustboro interior.
    assert.deepEqual(gen6SituationLocation(7, "oras"), {
      locationId: 172,
      name: "Oldale Town",
    });
    assert.equal(gen6SituationLocation(6, "oras").name, "Littleroot Town");
    assert.equal(gen6SituationLocation(23, "oras").name, "Route 101");
    assert.equal(gen6SituationLocation(286, "oras").name, "Rustboro City");
  });

  it("reads Oldale Town from the local Omega Ruby save", () => {
    let data: Buffer;
    try {
      data = readFileSync("/tmp/poketag-oras/main");
    } catch {
      return;
    }
    const parsed = parseGen6(data, detectSave(data, "main"));
    assert.equal(parsed.gameVersion, "omegaruby");
    assert.equal(parsed.trainer.name, "Suraj");
    assert.equal(parsed.location, "Oldale Town");
    assert.equal(parsed.locationMapId, 172);
  });
});

describe("parseGen6 dex / location / bag", () => {
  it("reads Situation zone id, Zukan flags, and MyItem pouches", () => {
    const data = Buffer.alloc(0x65600, 0);
    data[0x14004] = 25; // Y

    // Situation.M = XY zonedata 286 → Santalune Forest (loc 14)
    writeU16(data, 0x01402, 286);

    // Zukan: own + see Froakie (#656 → bit 655)
    const flags = 0x15000 + 0x08;
    setBit(data, flags, 655); // owned native
    setBit(data, flags + 0x60, 655); // seen male

    // Bag: 5 Poké Balls in Items; 3 Potions in medicine (Gen 6 indexes)
    writeU16(data, 0x00400, 4); // Poké Ball
    writeU16(data, 0x00402, 5);
    writeU16(data, 0x00400 + 0x968, 17); // Potion
    writeU16(data, 0x00400 + 0x96a, 3);

    const detection = detectSave(data, "main");
    const parsed = parseGen6(data, detection);

    assert.equal(parsed.gameVersion, "y");
    assert.equal(parsed.locationMapId, 14);
    assert.equal(parsed.location, "Santalune Forest");
    assert.equal(parsed.dex.owned, 1);
    assert.equal(parsed.dex.seen, 1);
    assert.equal(parsed.dex.entries[0]?.speciesId, 656);
    assert.ok(parsed.inventory.bag.some((i) => i.id === 4 && i.quantity === 5));
    assert.ok(
      parsed.inventory.bag.some(
        (i) =>
          i.id === 17 &&
          i.quantity === 3 &&
          i.pocket === "medicine" &&
          i.name === "Potion"
      )
    );
    assert.equal(
      parsed.inventory.bag.find((i) => i.id === 4)?.name,
      "Poké Ball"
    );
    assert.equal(parsed.progress.championDefeated, false);
    assert.equal(parsed.progress.eliteFourDefeated, false);
  });

  it("marks Champion/Elite Four from SecondsToFame", () => {
    const data = Buffer.alloc(0x65600, 0);
    data[0x14004] = 25; // Y
    // AdventureInfo.SecondsToFame at 0x01220
    data[0x01220] = 1;
    const parsed = parseGen6(data, detectSave(data, "main"));
    assert.equal(parsed.progress.championDefeated, true);
    assert.equal(parsed.progress.eliteFourDefeated, true);
  });

  it("marks Champion from a non-empty Hall of Fame record", () => {
    const data = Buffer.alloc(0x65600, 0);
    data[0x14004] = 24; // X
    data[0x19400] = 0x92; // occupied Dendou head
    const parsed = parseGen6(data, detectSave(data, "main"));
    assert.equal(parsed.progress.championDefeated, true);
    assert.equal(parsed.progress.eliteFourDefeated, true);
  });

  it("counts XY foreign-owned flags for species under 649", () => {
    const data = Buffer.alloc(0x65600, 0);
    data[0x14004] = 24; // X
    const flags = 0x15000 + 0x08;
    // Bulbasaur foreign owned only
    setBit(data, flags + 0x644, 0);
    setBit(data, flags + 0x60, 0); // seen

    const parsed = parseGen6(data, detectSave(data, "main"));
    assert.equal(parsed.dex.owned, 1);
    assert.equal(parsed.dex.seen, 1);
    assert.equal(parsed.dex.entries[0]?.speciesId, 1);
  });

  it("keeps cheat-sized stacks and every seen national dex entry", () => {
    const data = Buffer.alloc(0x65600, 0);
    data[0x14004] = 25;
    writeU16(data, 0x00400, 50); // Rare Candy
    writeU16(data, 0x00402, 9000);

    const flags = 0x15000 + 0x08;
    for (let i = 0; i < 30; i++) setBit(data, flags + 0x60, i);
    // Display flag only — no gender/shiny seen bit.
    setBit(data, flags + 5 * 0x60, 200);

    const parsed = parseGen6(data, detectSave(data, "main"));
    const candy = parsed.inventory.bag.find((item) => item.id === 50);
    assert.ok(candy);
    assert.equal(candy.quantity, 9000);
    assert.equal(parsed.dex.seen, 31);
    assert.equal(parsed.dex.entries.length, 31);
    assert.equal(parsed.dex.entries[0]?.speciesId, 1);
    assert.equal(parsed.dex.entries[29]?.speciesId, 30);
    assert.equal(parsed.dex.entries[30]?.speciesId, 201);
  });
});
