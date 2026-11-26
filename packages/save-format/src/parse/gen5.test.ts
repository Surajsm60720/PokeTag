import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

import { detectSave } from "../detect.js";
import { parseGen5 } from "./gen5.js";

const WHITE_FIXTURE = "/tmp/poketag-gen5/white-12fecf78.sav";

describe("detect Gen 5 filenames", () => {
  it("classifies No-Intro White Version 2 / Black Version 2 as sequels", () => {
    assert.equal(
      detectSave(
        Buffer.alloc(0x80000),
        "Pokemon - White Version 2 (USA, Europe) (NDSi Enhanced).sav"
      ).gameVersion,
      "white2"
    );
    assert.equal(
      detectSave(
        Buffer.alloc(0x80000),
        "Pokemon - Black Version 2 (USA, Europe).sav"
      ).gameVersion,
      "black2"
    );
    assert.equal(
      detectSave(
        Buffer.alloc(0x80000),
        "Pokemon - White Version (USA, Europe) (NDSi Enhanced).sav"
      ).gameVersion,
      "white"
    );
  });
});

describe("parseGen5 White", () => {
  it("reads trainer, badges, play time, party, bag, and dex from a real White save", () => {
    let bytes: Buffer;
    try {
      bytes = readFileSync(WHITE_FIXTURE);
    } catch {
      // Fixture is pulled from vault during local repair sessions only.
      return;
    }
    const detection = detectSave(
      bytes,
      "Pokemon - White Version (USA, Europe) (NDSi Enhanced).sav"
    );
    assert.equal(detection.gameVersion, "white");
    assert.equal(detection.generation, 5);

    const parsed = parseGen5(bytes, detection);
    assert.equal(parsed.gameVersion, "white");
    assert.equal(parsed.trainer.name, "Suraj");
    assert.equal(parsed.trainer.trainerId, 9139);
    assert.equal(parsed.trainer.money, 9999999);
    assert.equal(parsed.playTimeSeconds, 25 * 60 + 14);
    assert.equal(parsed.badges.filter((b) => b.earned).length, 0);
    assert.ok(parsed.party.length >= 1);
    const lead = parsed.party[0]!;
    assert.ok(lead.maxHp > 0, `expected HP, got ${lead.currentHp}/${lead.maxHp}`);
    assert.equal(lead.currentHp, lead.maxHp);
    assert.equal(parsed.location, "Accumula Town");
    assert.equal(parsed.locationMapId, 397);
    assert.ok(parsed.inventory.bag.length > 0);
    assert.ok(parsed.dex.owned >= 1);
    assert.equal(parsed.progress.championDefeated, false);
    assert.equal(parsed.progress.eliteFourDefeated, false);
    assert.ok(parsed.locationMapId);
  });
});

describe("parseGen5 White 2", () => {
  it("reads location and party HP from a real White 2 save", () => {
    let bytes: Buffer;
    try {
      bytes = readFileSync("/tmp/poketag-gen5/white2-2e539cdc.sav");
    } catch {
      return;
    }
    const detection = detectSave(
      bytes,
      "Pokemon - White Version 2 (USA, Europe) (NDSi Enhanced).sav"
    );
    assert.equal(detection.gameVersion, "white2");
    const parsed = parseGen5(bytes, detection);
    assert.equal(parsed.gameVersion, "white2");
    assert.equal(parsed.location, "Aspertia City");
    assert.ok(parsed.party.length >= 1);
    const lead = parsed.party[0]!;
    assert.ok(lead.maxHp > 0);
    assert.equal(lead.currentHp, lead.maxHp);
  });
});
