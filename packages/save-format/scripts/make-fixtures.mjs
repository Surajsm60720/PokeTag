#!/usr/bin/env node
/**
 * Regenerate the committed fixtures in ../fixtures.
 *
 * Every fixture is SYNTHETIC: plain bytes sized to a real save format plus
 * the few markers detection keys on (size, Gen 3 game code, DeSmuME footer).
 * No real Pokémon save data ships in this repository — real saves are
 * copyrighted, and detection only ever reads sizes, a 4-byte game code and
 * footer magic.
 *
 *   node scripts/make-fixtures.mjs
 */
import { mkdirSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const outDir = path.join(root, "fixtures");

const GBA_FLASH_128K = 0x20000;
const GBA_FLASH_64K = 0x10000;
const GBA_FLASH_32K = 0x8000;
const DS_SIZE = 0x40000;
const DESMUME_MAGIC = Buffer.from("|-DESMUME SAVE-|", "ascii");

/** All-zero payload with a Gen 3 game code planted where the real one sits. */
function gbaSave(length, gameCode) {
  const buf = Buffer.alloc(length, 0);
  buf.write(gameCode, 0x1000, "ascii");
  return buf;
}

/** DeSmuME .dsv = raw payload + 24 metadata bytes + magic. */
function desmume(raw) {
  return Buffer.concat([raw, Buffer.alloc(24, 0), DESMUME_MAGIC]);
}

const fixtures = {
  "emerald-gba.sav": gbaSave(GBA_FLASH_128K, "BPEE"),
  "firered-gba.sav": gbaSave(GBA_FLASH_64K, "BPRE"),
  "ruby-rtc-gba.sav": (() => {
    // 16 trailing bytes: the GBA real-time-clock record some emulators append.
    const buf = Buffer.alloc(GBA_FLASH_64K + 16, 0);
    buf.write("AXVE", 0x1000, "ascii");
    return buf;
  })(),
  "leafgreen-gba.srm": gbaSave(GBA_FLASH_32K, "BPGE"),
  "ds-gen4.sav": Buffer.alloc(DS_SIZE, 0),
  "desmume-gen4.dsv": desmume(Buffer.alloc(DS_SIZE, 0)),
};

// Wipe stale fixtures so a removed case cannot linger and rot.
mkdirSync(outDir, { recursive: true });
for (const name of readdirSync(outDir)) {
  if (name === ".gitkeep" || name in fixtures) continue;
  rmSync(path.join(outDir, name));
}

let bytes = 0;
for (const [name, data] of Object.entries(fixtures)) {
  writeFileSync(path.join(outDir, name), data);
  bytes += data.length;
  console.log(`  ${name.padEnd(22)} ${String(data.length).padStart(7)} bytes`);
}
console.log(
  `wrote ${Object.keys(fixtures).length} fixtures (${bytes} bytes) -> fixtures/`
);
