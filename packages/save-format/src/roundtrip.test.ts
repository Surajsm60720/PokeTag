import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import { convertSave } from "./convert.js";
import { DESMUME_MAGIC, hasDesmumeFooter, stripDesmumeFooter } from "./desmume.js";
import { detectSave } from "./detect.js";

/**
 * Round-trip guarantees from PRD §12:
 *   - every fixture is detected as the format/generation it claims to be
 *   - conversion only adds or strips known footers, never rewrites bytes
 *   - the source buffer is never mutated in place
 *
 * Fixtures are synthetic and generated (see scripts/make-fixtures.mjs) so no
 * real save data is ever committed.
 */

const FIXTURES_DIR = fileURLToPath(new URL("../fixtures", import.meta.url));

function loadFixtures(): string[] {
  if (!existsSync(FIXTURES_DIR)) {
    assert.fail(
      `Fixtures missing at ${FIXTURES_DIR}. Run "npm run fixtures" first (npm test does this for you).`
    );
  }
  const names = readdirSync(FIXTURES_DIR)
    .filter((f) => !f.startsWith("."))
    .sort();
  assert.ok(
    names.length > 0,
    `No fixtures at ${FIXTURES_DIR}. Run "npm run fixtures" first.`
  );
  return names;
}

function load(name: string): Buffer {
  return readFileSync(path.join(FIXTURES_DIR, name));
}

function sha256(buf: Buffer): string {
  return createHash("sha256").update(buf).digest("hex");
}

/** Payload with any DeSmuME footer removed — what a raw .sav should contain. */
function payloadOf(name: string, data: Buffer): Buffer {
  return name.endsWith(".dsv") ? stripDesmumeFooter(data) : data;
}

const EXPECTED_DETECTION: Record<
  string,
  { format: string; generation: number | null; gameVersion: string }
> = {
  "desmume-gen4.dsv": { format: "dsv", generation: 4, gameVersion: "unknown" },
  "ds-gen4.sav": { format: "sav", generation: 4, gameVersion: "unknown" },
  "emerald-gba.sav": { format: "sav", generation: 3, gameVersion: "emerald" },
  "firered-gba.sav": { format: "sav", generation: 3, gameVersion: "firered" },
  "leafgreen-gba.srm": { format: "srm", generation: 3, gameVersion: "leafgreen" },
  "ruby-rtc-gba.sav": { format: "sav", generation: 3, gameVersion: "ruby" },
};

const fixtures = loadFixtures();

describe("fixture set", () => {
  it("covers every supported wrapper (.sav / .dsv / .srm)", () => {
    assert.deepEqual(
      fixtures,
      Object.keys(EXPECTED_DETECTION).sort(),
      "fixtures/ and EXPECTED_DETECTION are out of sync — update both"
    );
  });

  it("regenerates from a documented script (no real saves in git)", () => {
    assert.ok(
      existsSync(path.join(FIXTURES_DIR, "..", "scripts", "make-fixtures.mjs")),
      "scripts/make-fixtures.mjs must stay next to fixtures/"
    );
  });
});

describe("detectSave on committed fixtures (PRD §12)", () => {
  for (const name of fixtures) {
    const expected = EXPECTED_DETECTION[name];
    it(`detects ${name}`, () => {
      const result = detectSave(load(name), name);
      assert.equal(result.format, expected.format);
      assert.equal(result.generation, expected.generation);
      assert.equal(result.gameVersion, expected.gameVersion);
      assert.equal(result.recognized, true);
    });
  }

  it("flags the GBA RTC trailing bytes", () => {
    const result = detectSave(load("ruby-rtc-gba.sav"), "ruby-rtc-gba.sav");
    assert.ok(
      result.notes.some((n) => n.includes("RTC")),
      `expected an RTC note, got ${JSON.stringify(result.notes)}`
    );
  });
});

describe("conversion round trips (PRD §12)", () => {
  for (const name of fixtures) {
    const original = load(name);
    const stem = path.parse(name).name;
    const isDsv = name.endsWith(".dsv");

    it(`${name}: download of the original is byte-identical`, () => {
      const stored = Buffer.from(original);
      assert.equal(sha256(stored), sha256(original));
      assert.ok(stored.equals(original));
    });

    if (isDsv) {
      // A .dsv is payload + footer, so identity holds in the other direction.
      it(`${name}: .dsv -> .sav -> .dsv is byte-identical`, () => {
        const raw = convertSave(original, "sav", name);
        assert.equal(sha256(raw.data), sha256(stripDesmumeFooter(original)));
        const back = convertSave(raw.data, "dsv", `${stem}.sav`);
        assert.equal(sha256(back.data), sha256(original));
      });

      it(`${name}: .dsv -> .srm strips the footer, keeps the payload`, () => {
        const srm = convertSave(original, "srm", name);
        assert.equal(srm.filename, `${stem}.srm`);
        assert.equal(sha256(srm.data), sha256(stripDesmumeFooter(original)));
      });
    } else {
      it(`${name}: .sav -> .dsv -> .sav is byte-identical`, () => {
        const toDsv = convertSave(original, "dsv", name);
        assert.ok(
          hasDesmumeFooter(toDsv.data),
          "converting to .dsv must append the DeSmuME footer"
        );
        const back = convertSave(toDsv.data, "sav", `${stem}.dsv`);
        assert.equal(sha256(back.data), sha256(original));
      });

      it(`${name}: .sav -> .srm keeps identical bytes`, () => {
        const srm = convertSave(original, "srm", name);
        assert.equal(srm.filename, `${stem}.srm`);
        assert.equal(sha256(srm.data), sha256(original));
      });
    }

    it(`${name}: conversion never mutates the source buffer`, () => {
      const before = sha256(original);
      convertSave(original, "sav", name);
      convertSave(original, "dsv", name);
      convertSave(original, "srm", name);
      assert.equal(sha256(original), before, "input buffer was modified in place");
    });
  }

  it("desmume-gen4.dsv: .dsv -> .sav strips only the footer", () => {
    const dsv = load("desmume-gen4.dsv");
    const sav = convertSave(dsv, "sav", "desmume-gen4.dsv");
    assert.equal(sav.data.length, dsv.length - DESMUME_MAGIC.length - 24);
    assert.equal(sha256(sav.data), sha256(stripDesmumeFooter(dsv)));
    assert.ok(sav.data.equals(payloadOf("desmume-gen4.dsv", dsv)));
  });

  it("desmume-gen4.dsv: .dsv -> .dsv returns the file untouched", () => {
    const dsv = load("desmume-gen4.dsv");
    const out = convertSave(dsv, "dsv", "desmume-gen4.dsv");
    assert.equal(sha256(out.data), sha256(dsv));
  });
});
