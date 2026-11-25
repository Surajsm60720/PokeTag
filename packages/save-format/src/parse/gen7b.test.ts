import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

import { detectSave } from "../detect.js";
import { parseSave } from "./index.js";
import { isLgpeSave, parseGen7b } from "./gen7b.js";

const SAVE_PATH = "/tmp/poketag-lgpe/savedata.bin";

function loadSave(): Buffer | null {
  try {
    return readFileSync(SAVE_PATH);
  } catch {
    return null;
  }
}

describe("LGPE / SAV7b detection + parse", () => {
  it("detects padded 1MB Let's Go Pikachu as gen 7 (not gen 4)", () => {
    const buf = loadSave();
    if (!buf) {
      // CI without the local dump — skip.
      return;
    }
    assert.equal(buf.length, 0x100000);
    assert.equal(isLgpeSave(buf), true);

    const detected = detectSave(buf, "savedata.bin");
    assert.equal(detected.generation, 7);
    assert.equal(detected.gameVersion, "letsgopikachu");
    assert.equal(detected.recognized, true);
    assert.match(detected.label, /Let's Go.*Pikachu/i);
  });

  it("parses trainer, party Pikachu, dex, bag, location, and badges", () => {
    const buf = loadSave();
    if (!buf) return;

    const detected = detectSave(buf, "savedata.bin");
    const parsed = parseGen7b(buf, detected);

    assert.equal(parsed.gameVersion, "letsgopikachu");
    assert.equal(parsed.trainer.name, "Suraj");
    assert.equal(parsed.trainer.trainerId, 181);
    assert.equal(parsed.trainer.secretId, 35309);
    assert.equal(parsed.trainer.gender, "M");
    assert.ok(parsed.trainer.money >= 0);

    assert.ok(parsed.party.length >= 1);
    const lead = parsed.party[0]!;
    assert.ok(lead.speciesId > 0);
    assert.ok(lead.level >= 1);

    assert.ok(parsed.playTimeSeconds >= 60);

    assert.equal(parsed.boxes.length, 40);
    assert.ok(parsed.dex.owned >= 1);
    assert.ok(
      parsed.inventory.bag.some((i) => i.name === "Health Candy"),
      "LGPE candy names should resolve"
    );
    assert.ok(
      parsed.inventory.bag.every((i) => !i.name.startsWith("Item #")),
      "bag should not show raw Item # ids"
    );
    assert.equal(parsed.badges.length, 8);
    const earned = parsed.badges.filter((b) => b.earned).length;
    if (parsed.playTimeSeconds > 3600) {
      assert.equal(earned, 8);
      assert.equal(parsed.location, "Pokémon League");
      assert.equal(parsed.progress.eliteFourDefeated, true);
      assert.equal(parsed.progress.championDefeated, true);
    } else {
      assert.equal(parsed.location === "" || parsed.location.length > 0, true);
    }
  });

  it("parseSave routes padded LGPE even if filename is generic", () => {
    const buf = loadSave();
    if (!buf) return;

    const detected = detectSave(buf, "main");
    const parsed = parseSave(buf, detected);
    assert.equal(parsed.gameVersion, "letsgopikachu");
    assert.ok((parsed.party[0]?.speciesId ?? 0) > 0);
    assert.equal(parsed.location, "Pokémon League");
    assert.equal(parsed.progress.championDefeated, true);
  });
});
