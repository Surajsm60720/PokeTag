/**
 * Generation IV save parser (DP / Pt / HGSS).
 * Dual general+storage blocks with 20-byte footers; CRC-16-CCITT; PK4 decrypt.
 */

import type { DetectionResult, GameVersion } from "../types.js";
import { badgesFromBitmask } from "./badges.js";
import { crc16Ccitt, parsePk4Box } from "./pkm.js";
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

interface Gen4Layout {
  generalSize: number;
  storageSize: number;
  /** Trainer name offset in general block (UTF-16LE). */
  trainerName: number;
  tid: number;
  money: number;
  badges: number;
  partyCount: number;
  party: number;
  /** Boxed PK4 start relative to storage block. */
  boxStart: number;
  boxCount: number;
  slotsPerBox: number;
}

function layoutFor(game: GameVersion): Gen4Layout {
  if (game === "heartgold" || game === "soulsilver") {
    return {
      generalSize: 0xf700,
      storageSize: 0x12310,
      trainerName: 0x64,
      tid: 0x74,
      money: 0x84,
      badges: 0x8c,
      partyCount: 0x94,
      party: 0x98,
      boxStart: 4,
      boxCount: 18,
      slotsPerBox: 30,
    };
  }
  if (game === "platinum") {
    return {
      generalSize: 0xcf2c,
      storageSize: 0x121e4,
      trainerName: 0x68,
      tid: 0x78,
      money: 0x8c,
      badges: 0x96,
      partyCount: 0x94,
      party: 0x98,
      boxStart: 4,
      boxCount: 18,
      slotsPerBox: 30,
    };
  }
  // Diamond / Pearl defaults
  return {
    generalSize: 0xc100,
    storageSize: 0x121e0,
    trainerName: 0x64,
    tid: 0x74,
    money: 0x78,
    badges: 0x82,
    partyCount: 0x9c,
    party: 0xa0,
    boxStart: 4,
    boxCount: 18,
    slotsPerBox: 30,
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

function footerMeta(block: Uint8Array): {
  saveCount: number;
  size: number;
  checksum: number;
  body: Uint8Array;
} {
  const end = block.length;
  const foot = block.subarray(end - FOOTER, end);
  const saveCount = readU32LE(foot, 4);
  const size = readU32LE(foot, 8);
  const checksum = readU16LE(foot, 0x12);
  const bodyLen = Math.min(size > 0 && size < block.length ? size - FOOTER : end - FOOTER, end - FOOTER);
  const body = block.subarray(0, bodyLen);
  return { saveCount, size, checksum, body };
}

function validateBlock(block: Uint8Array): boolean {
  const { checksum, body } = footerMeta(block);
  return crc16Ccitt(body) === checksum;
}

function pickActiveGeneral(save: Uint8Array, generalSize: number): Uint8Array {
  const g0 = save.subarray(0, generalSize);
  const g1 =
    save.length >= PARTITION + generalSize
      ? save.subarray(PARTITION, PARTITION + generalSize)
      : null;

  const v0 = validateBlock(g0);
  const v1 = g1 ? validateBlock(g1) : false;
  if (!v0 && !v1) {
    throw new Error("Gen 4 checksum validation failed for general blocks");
  }
  if (v0 && v1 && g1) {
    const c0 = footerMeta(g0).saveCount;
    const c1 = footerMeta(g1).saveCount;
    return c1 >= c0 ? g1 : g0;
  }
  return v0 ? g0 : g1!;
}

function pickActiveStorage(
  save: Uint8Array,
  generalSize: number,
  storageSize: number
): Uint8Array | null {
  const s0off = generalSize;
  const s1off = PARTITION + generalSize;
  if (save.length < s0off + storageSize) return null;
  const s0 = save.subarray(s0off, s0off + storageSize);
  const s1 =
    save.length >= s1off + storageSize
      ? save.subarray(s1off, s1off + storageSize)
      : null;
  const v0 = validateBlock(s0);
  const v1 = s1 ? validateBlock(s1) : false;
  if (!v0 && !v1) return null;
  if (v0 && v1 && s1) {
    const c0 = footerMeta(s0).saveCount;
    const c1 = footerMeta(s1).saveCount;
    return c1 >= c0 ? s1 : s0;
  }
  return v0 ? s0 : s1;
}

export function parseGen4(
  bytes: Uint8Array,
  detection: DetectionResult
): ParsedSave {
  const game =
    detection.gameVersion === "unknown" ? "diamond" : detection.gameVersion;
  const layout = layoutFor(game);
  if (bytes.length < layout.generalSize) {
    throw new Error("Gen 4 save too small");
  }

  const general = pickActiveGeneral(bytes, layout.generalSize);
  const storage = pickActiveStorage(bytes, layout.generalSize, layout.storageSize);

  const name = decodeUtf16z(general, layout.trainerName, 8);
  const tid = readU16LE(general, layout.tid);
  const sid = readU16LE(general, layout.tid + 2);
  const money = readU32LE(general, layout.money);
  const badgeMask = general[layout.badges] ?? 0;
  const partyCount = Math.min(6, general[layout.partyCount] ?? 0);

  const partySlots: Array<ParsedPokemon | null> = [];
  for (let i = 0; i < partyCount; i++) {
    // Party PK4 is 236 bytes.
    const base = layout.party + i * 236;
    if (base + 136 > general.length) break;
    const mon = parsePk4Box(general.subarray(base, base + 136), i);
    if (mon) {
      if (base + 0x8c < general.length) mon.level = general[base + 0x8c] ?? mon.level;
      partySlots.push(mon);
    }
  }

  const boxes = makeBoxes(layout.boxCount, layout.slotsPerBox);
  if (storage) {
    for (let i = 0; i < layout.boxCount * layout.slotsPerBox; i++) {
      const off = layout.boxStart + i * 136;
      if (off + 136 > storage.length - FOOTER) break;
      const mon = parsePk4Box(storage.subarray(off, off + 136), i % layout.slotsPerBox);
      const bi = Math.floor(i / layout.slotsPerBox);
      const si = i % layout.slotsPerBox;
      boxes[bi]!.pokemon[si] = mon;
    }
  }

  // Bag offsets vary by title and are easy to mis-read; leave empty when unsure.
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
    dex: emptyDex(493),
    badges: badgesFromBitmask(game, badgeMask),
    playTimeSeconds: 0,
    location: "",
    inventory: { bag: [], pc: [] },
    progress: {
      eliteFourDefeated: null,
      championDefeated: null,
      note: "Gen 4 story flags not probed.",
    },
  });
}
