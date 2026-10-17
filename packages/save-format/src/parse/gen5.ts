/**
 * Generation V save parser (BW / B2W2).
 * Dual partitions with CRC-16-CCITT footers; PK5 decrypt (same box size as PK4).
 */

import type { DetectionResult, GameVersion } from "../types.js";
import { badgesFromBitmask } from "./badges.js";
import { crc16Ccitt, parsePk5Box } from "./pkm.js";
import type { ParsedPokemon, ParsedSave } from "./types.js";
import {
  baseSave,
  compactParty,
  emptyDex,
  makeBoxes,
  readU16LE,
  readU32LE,
} from "./util.js";

const PARTITION = 0x40000;
const FOOTER = 0x14;

interface Gen5Layout {
  trainerName: number;
  tid: number;
  money: number;
  badges: number;
  partyCount: number;
  party: number;
  boxStart: number;
  boxCount: number;
}

function layoutFor(game: GameVersion): Gen5Layout {
  const b2 = game === "black2" || game === "white2";
  return {
    trainerName: 0x19404,
    tid: 0x19414,
    money: b2 ? 0x21100 : 0x21200,
    badges: b2 ? 0x21108 : 0x21208,
    partyCount: b2 ? 0x18e20 : 0x18e4c,
    party: b2 ? 0x18e24 : 0x18e54,
    boxStart: 0x400,
    boxCount: 24,
  };
}

function decodeUtf16z(data: Uint8Array, off: number, maxChars: number): string {
  let s = "";
  for (let i = 0; i < maxChars; i++) {
    const code = readU16LE(data, off + i * 2);
    if (code === 0xffff || code === 0) break;
    if (code < 0x100) s += String.fromCharCode(code);
  }
  return s;
}

function blockChecksumOk(block: Uint8Array): boolean {
  if (block.length < FOOTER) return false;
  const body = block.subarray(0, block.length - FOOTER);
  const stored = readU16LE(block, block.length - 2);
  return crc16Ccitt(body) === stored;
}

function pickActivePartition(save: Uint8Array): Uint8Array {
  const size = Math.min(PARTITION, save.length);
  const a = save.subarray(0, size);
  const b =
    save.length >= PARTITION + 0x100
      ? save.subarray(PARTITION, Math.min(save.length, PARTITION * 2))
      : null;

  // Gen 5 uses many CRC sections; validate a trailing footer on the partition
  // when present, otherwise prefer the higher save counter at a known offset.
  const counterOff = 0x25f0a; // approximate — fall back to length heuristics
  if (b) {
    const ca =
      counterOff + 4 < a.length ? readU32LE(a, Math.min(counterOff, a.length - 4)) : 0;
    const cb =
      counterOff + 4 < b.length ? readU32LE(b, Math.min(counterOff, b.length - 4)) : 0;
    // Prefer validated footers when the last 0x14 bytes look like a footer.
    const aOk = a.length >= FOOTER && blockChecksumOk(a.subarray(a.length - 0x100));
    const bOk = b.length >= FOOTER && blockChecksumOk(b.subarray(b.length - 0x100));
    if (aOk && !bOk) return a;
    if (bOk && !aOk) return b;
    return cb >= ca ? b : a;
  }
  return a;
}

export function parseGen5(
  bytes: Uint8Array,
  detection: DetectionResult
): ParsedSave {
  const game =
    detection.gameVersion === "unknown" ? "black" : detection.gameVersion;
  if (bytes.length < 0x20000) {
    throw new Error("Gen 5 save too small");
  }

  const data = pickActivePartition(bytes);
  const layout = layoutFor(game);

  const name =
    layout.trainerName + 16 < data.length
      ? decodeUtf16z(data, layout.trainerName, 8)
      : "";
  const tid =
    layout.tid + 2 < data.length ? readU16LE(data, layout.tid) : 0;
  const sid =
    layout.tid + 4 < data.length ? readU16LE(data, layout.tid + 2) : 0;
  const money =
    layout.money + 4 < data.length ? readU32LE(data, layout.money) : 0;
  const badgeMask =
    layout.badges < data.length ? data[layout.badges]! : 0;
  const partyCount =
    layout.partyCount < data.length
      ? Math.min(6, data[layout.partyCount]!)
      : 0;

  const partySlots: Array<ParsedPokemon | null> = [];
  for (let i = 0; i < partyCount; i++) {
    const base = layout.party + i * 220;
    if (base + 136 > data.length) break;
    const mon = parsePk5Box(data.subarray(base, base + 136), i);
    if (mon) partySlots.push(mon);
  }

  const boxes = makeBoxes(layout.boxCount, 30);
  for (let i = 0; i < layout.boxCount * 30; i++) {
    const off = layout.boxStart + i * 136;
    if (off + 136 > data.length) break;
    const mon = parsePk5Box(data.subarray(off, off + 136), i % 30);
    boxes[Math.floor(i / 30)]!.pokemon[i % 30] = mon;
  }

  return baseSave(game, {
    trainer: {
      name,
      trainerId: tid,
      secretId: sid,
      money,
      gender: "M",
    },
    party: compactParty(partySlots),
    boxes,
    dex: emptyDex(649),
    badges: badgesFromBitmask(game, badgeMask, 8),
    playTimeSeconds: 0,
    location: "",
    inventory: { bag: [], pc: [] },
    progress: {
      eliteFourDefeated: null,
      championDefeated: null,
      note: "Gen 5 story flags not probed.",
    },
  });
}
