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
    assert.ok(parsed.dex.owned >= 1);
    assert.ok(parsed.inventory.bag.some((i) => i.name === "Poké Ball"));
    assert.equal(parsed.badges.filter((b) => b.earned).length, 1);
    assert.equal(parsed.progress.championDefeated, false);
  });
});

describe("parseGen7 Ultra Sun", () => {
  it("reads trainer, party, dex, stamps, location, and play time", () => {
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
    assert.ok(parsed.dex.owned >= 1);
    assert.equal(parsed.badges.filter((b) => b.earned).length, 1);
    assert.equal(parsed.progress.championDefeated, false);
  });
});
