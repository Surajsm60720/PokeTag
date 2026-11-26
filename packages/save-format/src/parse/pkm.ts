/**
 * Pokémon structure decrypt / shuffle helpers (Gen 3–5).
 * Layouts per Bulbapedia / Project Pokémon — original TypeScript.
 */

import { abilityName } from "./abilities.js";
import { levelFromSpeciesExp } from "./exp.js";
import { ballName } from "./balls.js";
import { decodeGen3String, decodeGen4String } from "./charset.js";
import { itemName } from "./items.js";
import { locationName } from "./locations.js";
import { moveDetail, moveName } from "./moves.js";
import { natureName } from "./natures.js";
import { speciesName } from "./species.js";
import { speciesAbilityName, speciesTypes } from "./species-meta.js";
import type { ParsedMove, ParsedPokemon } from "./types.js";

export { natureName } from "./natures.js";

/** Personality % 24 → order of Growth / Attacks / EVs / Misc (0–3). */
export const PK3_SHUFFLE_ORDER: readonly (readonly number[])[] = [
  [0, 1, 2, 3],
  [0, 1, 3, 2],
  [0, 2, 1, 3],
  [0, 3, 1, 2],
  [0, 2, 3, 1],
  [0, 3, 2, 1],
  [1, 0, 2, 3],
  [1, 0, 3, 2],
  [2, 0, 1, 3],
  [3, 0, 1, 2],
  [2, 0, 3, 1],
  [3, 0, 2, 1],
  [1, 2, 0, 3],
  [1, 3, 0, 2],
  [2, 1, 0, 3],
  [3, 1, 0, 2],
  [2, 3, 0, 1],
  [3, 2, 0, 1],
  [1, 2, 3, 0],
  [1, 3, 2, 0],
  [2, 1, 3, 0],
  [3, 1, 2, 0],
  [2, 3, 1, 0],
  [3, 2, 1, 0],
];

const ORIGIN_GAMES: Record<number, string> = {
  1: "Sapphire",
  2: "Ruby",
  3: "Emerald",
  4: "FireRed",
  5: "LeafGreen",
  7: "Colosseum/XD",
  8: "Colosseum/XD",
  10: "Diamond",
  11: "Pearl",
  12: "Platinum",
  15: "HeartGold",
  16: "SoulSilver",
};

function readU16(data: Uint8Array, off: number): number {
  return data[off]! | (data[off + 1]! << 8);
}

function readU32(data: Uint8Array, off: number): number {
  return (
    (data[off]! |
      (data[off + 1]! << 8) |
      (data[off + 2]! << 16) |
      (data[off + 3]! << 24)) >>>
    0
  );
}

function writeU32(data: Uint8Array, off: number, value: number): void {
  data[off] = value & 0xff;
  data[off + 1] = (value >>> 8) & 0xff;
  data[off + 2] = (value >>> 16) & 0xff;
  data[off + 3] = (value >>> 24) & 0xff;
}

/** Decrypt PK3 48-byte data region in place (XOR with PID ^ OTID). */
export function decryptPk3Data(
  data: Uint8Array,
  personality: number,
  otId: number
): Uint8Array {
  const key = (personality ^ otId) >>> 0;
  const out = data.slice();
  for (let i = 0; i < out.length; i += 4) {
    const word = readU32(out, i) ^ key;
    writeU32(out, i, word);
  }
  return out;
}

/** Unshuffle four 12-byte PK3 substructures into Growth, Attacks, EVs, Misc. */
export function unshufflePk3(
  decrypted48: Uint8Array,
  personality: number
): {
  growth: Uint8Array;
  attacks: Uint8Array;
  evs: Uint8Array;
  misc: Uint8Array;
  order: readonly number[];
} {
  const order = PK3_SHUFFLE_ORDER[personality % 24]!;
  const blocks = [0, 1, 2, 3].map((i) =>
    decrypted48.subarray(i * 12, i * 12 + 12)
  );
  const byKind: Uint8Array[] = new Array(4);
  for (let pos = 0; pos < 4; pos++) {
    byKind[order[pos]!] = blocks[pos]!;
  }
  return {
    growth: byKind[0]!,
    attacks: byKind[1]!,
    evs: byKind[2]!,
    misc: byKind[3]!,
    order,
  };
}

function isShinyPk3(personality: number, otId: number): boolean {
  const tid = otId & 0xffff;
  const sid = (otId >>> 16) & 0xffff;
  const p1 = personality & 0xffff;
  const p2 = (personality >>> 16) & 0xffff;
  return (tid ^ sid ^ p1 ^ p2) < 8;
}

function genderFromPid(personality: number): "M" | "F" | "U" {
  return (personality & 0xff) >= 127 ? "M" : "F";
}

/** Medium-fast EXP curve: level³. Returns level 1–100. */
export function levelFromExpMediumFast(exp: number): number {
  if (exp <= 0) return 1;
  let level = 1;
  for (let l = 100; l >= 1; l--) {
    if (exp >= l * l * l) {
      level = l;
      break;
    }
  }
  return Math.min(100, Math.max(1, level));
}

export interface ParsePk3Options {
  gameVersion?: string;
  /** Full OTID (TID | SID<<16) of the save trainer for trade detection. */
  trainerOtId?: number;
}

function ppWithBonus(basePp: number | null, ppBonuses: number, slot: number): number | null {
  if (basePp == null) return null;
  const bonus = (ppBonuses >> (slot * 2)) & 0x3;
  return basePp + Math.floor((basePp * 20 * bonus) / 100);
}

/** Parse a 80- or 100-byte PK3 record into ParsedPokemon (null if empty). */
export function parsePk3(
  raw: Uint8Array,
  slot: number,
  opts: ParsePk3Options = {}
): ParsedPokemon | null {
  if (raw.length < 80) return null;
  const personality = readU32(raw, 0);
  const otId = readU32(raw, 4);
  const nickname = decodeGen3String(raw.subarray(8, 18));
  const otName = decodeGen3String(raw.subarray(0x14, 0x1b));
  const encrypted = raw.subarray(0x20, 0x50);
  const decrypted = decryptPk3Data(encrypted, personality, otId);
  const { growth, attacks, misc } = unshufflePk3(decrypted, personality);
  const speciesId = readU16(growth, 0);
  if (speciesId === 0) return null;

  const heldItemId = readU16(growth, 2);
  const experience = readU32(growth, 4);
  const ppBonuses = growth[8] ?? 0;
  const friendship = growth[9] ?? 0;

  const moveDetails: ParsedMove[] = [];
  const moves: string[] = [];
  for (let i = 0; i < 4; i++) {
    const mid = readU16(attacks, i * 2);
    if (!mid) continue;
    const storedPp = attacks[8 + i] ?? 0;
    const detail = moveDetail(mid, storedPp);
    // Prefer stored PP; if 0 and move known, apply bonus estimate from base
    if (storedPp === 0 && detail.pp == null) {
      detail.pp = ppWithBonus(null, ppBonuses, i);
    } else {
      detail.pp = storedPp;
    }
    moveDetails.push(detail);
    moves.push(detail.name || moveName(mid));
  }

  // Misc: met location @1, origins @2 (u16), IVs @4 (u32)
  const metLocationId = misc[1] ?? 0;
  const origins = readU16(misc, 2);
  const metLevel = origins & 0x7f;
  const originGameId = (origins >> 7) & 0xf;
  const ballId = (origins >> 11) & 0xf;
  const ivWord = readU32(misc, 4);
  const abilitySlot = ((ivWord >>> 31) & 1) as 0 | 1;
  // Egg flag: bit 30 of IV word in Gen 3
  const isEgg = ((ivWord >>> 30) & 1) === 1;

  const originGame =
    ORIGIN_GAMES[originGameId] ?? (originGameId ? `Game #${originGameId}` : null);
  const ball = ballName(ballId);
  const gameVersion = opts.gameVersion ?? "";
  // Gen3 met location is a single-byte location constant; map as bank 0 / mapNum (best-effort).
  const metLocDisplay =
    metLocationId > 0
      ? locationName(gameVersion || "emerald", 0, metLocationId)
      : null;

  let originKind: ParsedPokemon["originKind"] = "wild";
  if (isEgg || metLevel === 0) {
    originKind = "egg";
  } else if (
    opts.trainerOtId != null &&
    opts.trainerOtId !== 0 &&
    otId !== opts.trainerOtId
  ) {
    originKind = "trade";
  }

  const heldItem = heldItemId ? itemName(heldItemId, 3) || null : null;
  const locPart = metLocDisplay && metLocDisplay !== `Map 0/${metLocationId}`
    ? metLocDisplay
    : metLocationId > 0
      ? `Location #${metLocationId}`
      : null;
  const originParts: string[] = [];
  if (originKind === "egg") {
    originParts.push("Hatched from Egg");
  } else if (originKind === "trade") {
    originParts.push("Obtained via trade");
  }
  if (locPart && metLevel > 0) {
    originParts.push(`Met at ${locPart} (Lv.${metLevel})`);
  } else if (locPart) {
    originParts.push(`Met at ${locPart}`);
  } else if (metLevel > 0) {
    originParts.push(`Met at Lv.${metLevel}`);
  }
  if (ball) originParts.push(ball);
  const origin = originParts.length ? originParts.join(" · ") : undefined;

  let level = 1;
  let currentHp = 0;
  let maxHp = 0;
  if (raw.length >= 100) {
    level = raw[0x54] ?? 1;
    currentHp = readU16(raw, 0x56);
    maxHp = readU16(raw, 0x58);
  } else {
    level = levelFromExpMediumFast(experience);
  }

  return {
    slot,
    speciesId,
    speciesName: speciesName(speciesId),
    nickname: nickname || speciesName(speciesId),
    level,
    currentHp,
    maxHp,
    gender: genderFromPid(personality),
    shiny: isShinyPk3(personality, otId),
    ability: speciesAbilityName(speciesId, abilitySlot),
    nature: natureName(personality % 25),
    heldItem,
    moves,
    types: speciesTypes(speciesId),
    friendship,
    origin,
    moveDetails,
    heldItemId: heldItemId || null,
    ball,
    metLevel: metLevel || null,
    metLocation: metLocDisplay,
    metLocationId: metLocationId || null,
    originGame,
    originKind,
    caughtAt: null,
    otName,
  };
}

/** Gen 4/5 LCRNG used for PK encryption. */
export function pkmLcrng(seed: number): number {
  return (Math.imul(0x41c64e6d, seed) + 0x6073) >>> 0;
}

/**
 * Decrypt Gen 4/5 PK data block (bytes after checksum header).
 * Seeded with checksum; each u16 XORed with (rng >>> 16).
 */
export function decryptPkmBlock(block: Uint8Array, seedIn: number): Uint8Array {
  const out = new Uint8Array(block);
  let seed = seedIn >>> 0;
  for (let i = 0; i < out.length; i += 2) {
    seed = pkmLcrng(seed);
    const xor = (seed >>> 16) & 0xffff;
    const val = readU16(out, i) ^ xor;
    out[i] = val & 0xff;
    out[i + 1] = (val >>> 8) & 0xff;
  }
  return out;
}

/**
 * Gen 4/5 shuffle index. The game uses `(PID >> 13) & 31`, then the inverse
 * of PKHeX's BlockPosition table, because block `order[i]` is stored at
 * position `i`.
 */
const PK45_SHUFFLE_INVERT = [
  0, 1, 2, 4, 3, 5, 6, 7, 12, 18, 13, 19, 8, 10, 14, 20, 16, 22, 9, 11, 15, 21,
  17, 23, 0, 1, 2, 4, 3, 5, 6, 7,
] as const;

/** Unshuffle Gen 4/5 4×32-byte blocks. Gen 3 keeps using PID % 24. */
export function unshufflePkm45(
  data: Uint8Array,
  personality: number,
  blockSize: number
): Uint8Array {
  const sv = (personality >>> 13) & 31;
  const order = PK3_SHUFFLE_ORDER[PK45_SHUFFLE_INVERT[sv]!]!;
  const out = new Uint8Array(data.length);
  for (let pos = 0; pos < 4; pos++) {
    const dest = order[pos]!;
    out.set(
      data.subarray(pos * blockSize, pos * blockSize + blockSize),
      dest * blockSize
    );
  }
  return out;
}

/** Unshuffle Gen 4/5 4×32-byte (PK4) or similar blocks using PID % 24 order. */
export function unshufflePkmBlocks(
  data: Uint8Array,
  personality: number,
  blockSize: number
): Uint8Array {
  const order = PK3_SHUFFLE_ORDER[personality % 24]!;
  const out = new Uint8Array(data.length);
  for (let pos = 0; pos < 4; pos++) {
    const src = order[pos]!;
    out.set(
      data.subarray(pos * blockSize, pos * blockSize + blockSize),
      src * blockSize
    );
  }
  return out;
}

function decodeUtf16z(data: Uint8Array, off: number, maxChars: number): string {
  let s = "";
  for (let i = 0; i < maxChars; i++) {
    const code = readU16(data, off + i * 2);
    if (code === 0xffff || code === 0) break;
    if (code < 0x100) s += String.fromCharCode(code);
  }
  return s;
}

function formatMetDate(year: number, month: number, day: number): string | null {
  if (!year && !month && !day) return null;
  const y = year < 100 ? 2000 + year : year;
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  return `${y}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function sumU16(data: Uint8Array): number {
  let sum = 0;
  for (let i = 0; i < data.length; i += 2) {
    sum = (sum + readU16(data, i)) & 0xffff;
  }
  return sum;
}

/** Version byte inside a PK4. HeartGold is 7 and SoulSilver is 8. */
const PK4_VERSIONS: Record<number, string> = {
  1: "Sapphire",
  2: "Ruby",
  3: "Emerald",
  4: "FireRed",
  5: "LeafGreen",
  7: "HeartGold",
  8: "SoulSilver",
  10: "Diamond",
  11: "Pearl",
  12: "Platinum",
  15: "Colosseum/XD",
  20: "White",
  21: "Black",
  22: "White 2",
  23: "Black 2",
};

function readPkString(
  data: Uint8Array,
  offset: number,
  maxChars: number,
  encoding: "gen4" | "utf16"
): string {
  if (encoding === "utf16") return decodeUtf16z(data, offset, maxChars);
  return decodeGen4String(data, offset, maxChars);
}

/**
 * Parse boxed PK4 (136 bytes) / party (236).
 * Offsets are into the 128-byte data block, which starts at file offset 0x08.
 * `encoding` is utf16 for Generation 5, which shares this layout.
 */
export function parsePk4Box(
  raw: Uint8Array,
  slot: number,
  encoding: "gen4" | "utf16" = "gen4"
): ParsedPokemon | null {
  if (raw.length < 136) return null;
  const personality = readU32(raw, 0);
  const checksum = readU16(raw, 6);
  if (personality === 0 && checksum === 0) return null;
  const stored = raw.subarray(8, 8 + 128);
  // A matching word-sum means the block is already decrypted. Decrypting it
  // again scrambles the Pokémon. Cartridge saves fail the sum and need a decrypt.
  let plain = stored;
  if (sumU16(stored) !== checksum) {
    plain = decryptPkmBlock(stored, checksum);
    if (sumU16(plain) !== checksum) return null;
  }
  const unshuffled = unshufflePkm45(plain, personality, 32);
  const speciesId = readU16(unshuffled, 0);
  const maxSpecies = encoding === "utf16" ? 649 : 493;
  if (speciesId === 0 || speciesId > maxSpecies) return null;

  const heldItemId = readU16(unshuffled, 0x02);
  const tidU = readU16(unshuffled, 0x04);
  const sidU = readU16(unshuffled, 0x06);
  const shiny =
    ((tidU ^ sidU ^ (personality & 0xffff) ^ (personality >>> 16)) & 0xffff) < 8;
  const friendship = unshuffled[0x0c] ?? 0;
  const abilityId = unshuffled[0x0d] ?? 0;
  const genderBits = ((unshuffled[0x38] ?? 0) >> 1) & 3;
  const gender: "M" | "F" | "U" =
    genderBits === 1 ? "F" : genderBits === 2 ? "U" : "M";

  const moveDetails: ParsedMove[] = [];
  const moves: string[] = [];
  for (let i = 0; i < 4; i++) {
    const mid = readU16(unshuffled, 0x20 + i * 2);
    if (!mid) continue;
    const pp = unshuffled[0x28 + i] ?? 0;
    const detail = moveDetail(mid, pp);
    moveDetails.push(detail);
    moves.push(detail.name);
  }

  const nickname = readPkString(unshuffled, 0x40, 10, encoding);
  const otName = readPkString(unshuffled, 0x60, 7, encoding);

  const metYear = unshuffled[0x73] ?? 0;
  const metMonth = unshuffled[0x74] ?? 0;
  const metDay = unshuffled[0x75] ?? 0;
  const metLocationId = readU16(unshuffled, 0x78);
  const ballDp = unshuffled[0x7b] ?? 0;
  const metLevel = (unshuffled[0x7c] ?? 0) & 0x7f;
  const ballHgss = unshuffled[0x7e] ?? 0;
  const ballId =
    encoding === "gen4" && ballHgss >= 1 && ballHgss <= 26 ? ballHgss : ballDp;
  const originGame = PK4_VERSIONS[unshuffled[0x57] ?? 0] ?? null;

  const experience = readU32(unshuffled, 0x08);
  const level = levelFromSpeciesExp(speciesId, experience);
  let currentHp = 0;
  let maxHp = 0;
  // Party trailer: PK4 is 236 bytes, PK5 is 220. Stats start at 0x88 and are
  // encrypted with the PID (not the checksum), without block shuffling.
  if (raw.length >= 220) {
    const stats = raw.subarray(0x88);
    const decryptedStats = decryptPkmBlock(stats, personality);
    const statsView =
      decryptedStats[4] === level
        ? decryptedStats
        : (raw[0x8c] ?? 0) === level
          ? stats
          : null;
    if (statsView) {
      currentHp = readU16(statsView, 6);
      maxHp = readU16(statsView, 8);
    }
  }

  const ball = ballName(ballId);
  const heldItem = heldItemId ? itemName(heldItemId, 4) || null : null;
  const caughtAt = formatMetDate(metYear, metMonth, metDay);
  const metLocation = metLocationId > 0 ? `Location #${metLocationId}` : null;

  const originParts: string[] = [];
  if (metLocation && metLevel) {
    originParts.push(`Met at ${metLocation} (Lv.${metLevel})`);
  } else if (metLevel) {
    originParts.push(`Met at Lv.${metLevel}`);
  }
  if (ball) originParts.push(ball);
  if (caughtAt) originParts.push(caughtAt);
  if (otName) originParts.push(`OT ${otName}`);

  return {
    slot,
    speciesId,
    speciesName: speciesName(speciesId),
    nickname: nickname || speciesName(speciesId),
    level,
    currentHp,
    maxHp,
    gender,
    shiny,
    ability: abilityName(abilityId) || "",
    nature: natureName(personality % 25),
    heldItem,
    moves,
    types: speciesTypes(speciesId),
    friendship,
    origin: originParts.length ? originParts.join(" · ") : undefined,
    moveDetails,
    heldItemId: heldItemId || null,
    ball,
    metLevel: metLevel || null,
    metLocation,
    metLocationId: metLocationId || null,
    originGame,
    originKind: metLevel === 0 ? "egg" : "unknown",
    caughtAt,
    otName,
  };
}

/** PK5 boxed is also 136 bytes; party 220. Same block crypto as PK4, Unicode names. */
export function parsePk5Box(raw: Uint8Array, slot: number): ParsedPokemon | null {
  return parsePk4Box(raw, slot, "utf16");
}

/** CRC-16-CCITT (poly 0x1021, init 0xFFFF) used by Gen 4/5 block footers. */
export function crc16Ccitt(data: Uint8Array): number {
  let crc = 0xffff;
  for (let i = 0; i < data.length; i++) {
    crc ^= data[i]! << 8;
    for (let b = 0; b < 8; b++) {
      if (crc & 0x8000) crc = ((crc << 1) ^ 0x1021) & 0xffff;
      else crc = (crc << 1) & 0xffff;
    }
  }
  return crc & 0xffff;
}

/** Shallow PK8/PK9-style slot: try move ids at known offsets when buffer looks plaintext. */
export function parsePk8Shallow(raw: Uint8Array, slot: number): ParsedPokemon | null {
  if (raw.length < 0x10) return null;
  const speciesId = readU16(raw, 0x08);
  if (!speciesId) return null;

  // PK8 moves at 0x72 (4×u16) when decrypted; best-effort on plaintext dumps
  const moveDetails: ParsedMove[] = [];
  const moves: string[] = [];
  const moveOff = 0x72;
  if (raw.length >= moveOff + 8) {
    for (let i = 0; i < 4; i++) {
      const mid = readU16(raw, moveOff + i * 2);
      if (!mid || mid > 900) continue;
      const d = moveDetail(mid, null);
      moveDetails.push(d);
      moves.push(d.name);
    }
  }

  const heldItemId = raw.length >= 0x0c ? readU16(raw, 0x0a) : 0;
  const natureId = raw.length > 0x20 ? raw[0x20] ?? 0 : 0;
  const abilityId = raw.length > 0x15 ? raw[0x14] ?? 0 : 0;

  return {
    slot,
    speciesId,
    speciesName: speciesName(speciesId),
    nickname: speciesName(speciesId),
    level: raw.length >= 0x10c ? raw[0x10c] ?? 1 : 1,
    currentHp: 0,
    maxHp: 0,
    gender: "U",
    shiny: false,
    ability: abilityId ? abilityName(abilityId) : "",
    nature: natureId < 25 ? natureName(natureId) : "",
    heldItem: heldItemId ? itemName(heldItemId, 5) || null : null,
    moves,
    types: speciesTypes(speciesId),
    friendship: 0,
    moveDetails,
    heldItemId: heldItemId || null,
    ball: null,
    metLevel: null,
    metLocation: null,
    metLocationId: null,
    originGame: null,
    originKind: "unknown",
    caughtAt: null,
    otName: "",
  };
}
