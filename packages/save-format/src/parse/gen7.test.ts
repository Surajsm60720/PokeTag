import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

import { detectSave } from "../detect.js";
import { parseGen7 } from "./gen7.js";
import { gen7SituationLocation } from "./locations-gen7.js";

const MOON_FIXTURE = "/tmp/poketag-gen7/moon-40c5ddc2.sav";
const US_FIXTURE = "/tmp/poketag-gen7/ultrasun-6f69db7f.sav";

describe("gen7SituationLocation", () => {
  it("pins Melemele map 0 coords near Route 1", () => {
    const nearHouse = gen7SituationLocation(0, 28654, 15712);
    assert.equal(nearHouse.name, "Route 1");
    assert.equal(gen7SituationLocation(5, 0, 0).name, "Ruins of Conflict");
  });
});

describe("parseGen7 Moon", () => {
  it("reads trainer, party, bag, dex, stamps, location, and play time", () => {
    let bytes: Buffer;
    try {
      bytes = readFileSync(MOON_FIXTURE);
    } catch {
      return;
    }
    const detection = detectSave(bytes, "main", { hint: "Moon · Run 1" });
    assert.equal(detection.gameVersion, "moon");
    const parsed = parseGen7(bytes, detection);
    assert.equal(parsed.gameVersion, "moon");
    assert.equal(parsed.trainer.name, "Suraj");
    assert.equal(parsed.trainer.money, 9999999);
    assert.ok(parsed.playTimeSeconds > 0);
    assert.equal(parsed.location, "Route 1");
    assert.ok(parsed.party.length >= 1);
    const lead = parsed.party[0]!;
    assert.equal(lead.speciesName, "Litten");
    assert.equal(lead.level, 6);
    assert.ok(lead.maxHp > 0);
    assert.equal(lead.currentHp, lead.maxHp);
    assert.ok(lead.moves.includes("Ember"));
    assert.equal(parsed.dex.owned, 1);
    assert.ok(parsed.dex.seen >= 1);
    assert.ok(parsed.dex.entries.some((e) => e.speciesName === "Litten" && e.owned));
    assert.ok(!parsed.dex.entries.some((e) => e.speciesName === "Stunky"));
    assert.ok(!parsed.dex.entries.some((e) => e.speciesName === "Gible"));
    // getPouch7: these HaX saves stock ~950 of most items; Poké Balls decode as 960.
    assert.ok(parsed.inventory.bag.some((i) => i.name === "Poké Ball" && i.quantity === 960));
    assert.ok(parsed.inventory.bag.length > 100);
    assert.ok(parsed.inventory.bag.some((i) => i.name === "TM01" && i.quantity === 1));
    // Official Trainer passport stamp is NOT a Kahuna grand trial.
    assert.equal(parsed.badges.filter((b) => b.earned).length, 0);
    assert.equal(parsed.badges.length, 4);
    assert.equal(parsed.progress.championDefeated, false);
    assert.match(parsed.progress.note, /Official Trainer|no Kahuna/i);
  });
});

describe("parseGen7 Ultra Sun", () => {
  it("reads trainer, party, dex, kahunas, location, and play time", () => {
    let bytes: Buffer;
    try {
      bytes = readFileSync(US_FIXTURE);
    } catch {
      return;
    }
    const detection = detectSave(bytes, "main", { hint: "Ultra Sun · Run 1" });
    assert.equal(detection.gameVersion, "ultrasun");
    const parsed = parseGen7(bytes, detection);
    assert.equal(parsed.gameVersion, "ultrasun");
    assert.equal(parsed.trainer.name, "Suraj");
    assert.equal(parsed.trainer.money, 9999999);
    assert.ok(parsed.playTimeSeconds > 0);
    assert.equal(parsed.location, "Route 1");
    assert.ok(parsed.party.length >= 1);
    const lead = parsed.party[0]!;
    assert.equal(lead.speciesName, "Litten");
    assert.equal(lead.level, 6);
    assert.ok(lead.maxHp > 0);
    assert.equal(lead.currentHp, lead.maxHp);
    assert.equal(parsed.dex.owned, 1);
    assert.ok(!parsed.dex.entries.some((e) => e.speciesName === "Stunky"));
    assert.equal(parsed.badges.filter((b) => b.earned).length, 0);
    assert.equal(parsed.progress.championDefeated, false);
    // Free Space getPouch7 — full item/TM/Z catalog present on this HaX save.
    assert.ok(parsed.inventory.bag.length > 100);
    assert.ok(parsed.inventory.bag.some((i) => i.name === "Master Ball" && i.quantity === 950));
    assert.ok(parsed.inventory.bag.some((i) => i.name === "Normalium Z" && i.quantity === 1));
    assert.ok(parsed.inventory.bag.some((i) => i.name === "TM01" && i.quantity === 1));
  });
});
