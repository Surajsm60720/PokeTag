/**
 * PK6 decrypt / parse (Gen 6–7 entity format).
 *
 * Stored = 232 bytes, party = 260 bytes. Matches PKHeX PokeCrypto Decrypt67 /
 * Encrypt67: LCRNG xor of the 4×56-byte blocks, then BlockPosition unshuffle.
 */

import { abilityName } from "./abilities.js";
import { ballName } from "./balls.js";
import { itemName } from "./items.js";
import { moveDetail, moveName } from "./moves.js";
import { natureName } from "./natures.js";
import { speciesName } from "./species.js";
import { speciesAbilityName, speciesTypes } from "./species-meta.js";
import type { ParsedPokemon } from "./types.js";
import { pokemonExtras } from "./util.js";

export const PK6_STORED = 232;
export const PK6_PARTY = 260;
const BLOCK = 56;

/**
 * PKHeX BlockPosition — 24 permutations × 4 (plus 8 duplicates for sv≥24).
 * Decrypt uses this table directly; encrypt uses BlockPositionInvert[sv].
 */
const BLOCK_POSITION: readonly number[] = [
  0, 1, 2, 3, 0, 1, 3, 2, 0, 2, 1, 3, 0, 3, 1, 2, 0, 2, 3, 1, 0, 3, 2, 1, 1, 0,
  2, 3, 1, 0, 3, 2, 2, 0, 1, 3, 3, 0, 1, 2, 2, 0, 3, 1, 3, 0, 2, 1, 1, 2, 0, 3,
  1, 3, 0, 2, 2, 1, 0, 3, 3, 1, 0, 2, 2, 3, 0, 1, 3, 2, 0, 1, 1, 2, 3, 0, 1, 3,
  2, 0, 2, 1, 3, 0, 3, 1, 2, 0, 2, 3, 1, 0, 3, 2, 1, 0,
  // duplicates of 0–7 so sv 24–31 need no modulus
  0, 1, 2, 3, 0, 1, 3, 2, 0, 2, 1, 3, 0, 3, 1, 2, 0, 2, 3, 1, 0, 3, 2, 1, 1, 0,
  2, 3, 1, 0, 3, 2,
];

/** PKHeX BlockPositionInvert — maps decrypt sv → encrypt shuffle sv. */
const BLOCK_POSITION_INVERT: readonly number[] = [
  0, 1, 2, 4, 3, 5, 6, 7, 12, 18, 13, 19, 8, 10, 14, 20, 16, 22, 9, 11, 15, 21,
  17, 23, 0, 1, 2, 4, 3, 5, 6, 7,
];

function readU16(data: Uint8Array, off: number): number {
  return data[off]! | (data[off + 1]! << 8);
}

function writeU16(data: Uint8Array, off: number, value: number): void {
  data[off] = value & 0xff;
  data[off + 1] = (value >>> 8) & 0xff;
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

function cryptArray(data: Uint8Array, seed: number): void {
  let s = seed >>> 0;
  for (let i = 0; i + 1 < data.length; i += 2) {
    s = (Math.imul(0x41c64e6d, s) + 0x00006073) >>> 0;
    writeU16(data, i, readU16(data, i) ^ ((s >>> 16) & 0xffff));
  }
}

/**
 * PKHeX Shuffle67 over the 4×56-byte block region (no 8-byte header).
 * Swaps block buffers the same way PKHeX swaps block contents in-place.
 */
function shuffleBlocks(region: Uint8Array, sv: number): void {
  if (sv === 0) return;
  const blocks: Uint8Array[] = [];
  for (let i = 0; i < 4; i++) {
    blocks.push(region.slice(i * BLOCK, (i + 1) * BLOCK));
  }
  const perm = [0, 1, 2, 3];
  const slotOf = [0, 1, 2, 3];
  const base = sv * 4;
  for (let i = 0; i < 3; i++) {
    const desired = BLOCK_POSITION[base + i]!;
    const j = slotOf[desired]!;
    if (j === i) continue;
    const tmp = blocks[i]!;
    blocks[i] = blocks[j]!;
    blocks[j] = tmp;
    const blockAtI = perm[i]!;
    perm[j] = blockAtI;
    slotOf[blockAtI] = j;
  }
  for (let i = 0; i < 4; i++) {
    region.set(blocks[i]!, i * BLOCK);
  }
}

/** Decrypt an ekx (stored or party). Returns null when the slot is empty. */
export function decryptPk6(ekx: Uint8Array): Uint8Array | null {
  if (ekx.length < PK6_STORED) return null;
  const ec = readU32(ekx, 0);
  const checksum = readU16(ekx, 6);
  if (ec === 0 && checksum === 0) return null;

  // Own buffer so subarray crypt/shuffle cannot alias the caller's memory.
  const out = Uint8Array.from(ekx);
  const pv = readU32(out, 0);
  const sv = (pv >>> 13) & 31;

  const stored = out.slice(8, PK6_STORED);
  cryptArray(stored, pv);
  shuffleBlocks(stored, sv);
  out.set(stored, 8);

  if (out.length >= PK6_PARTY) {
    const party = out.slice(PK6_STORED, PK6_PARTY);
    cryptArray(party, pv);
    out.set(party, PK6_STORED);
  }
  return out;
}

/** Encrypt a plaintext pkx (stored or party). */
export function encryptPk6(pkx: Uint8Array): Uint8Array {
  const out = Uint8Array.from(pkx);
  const pv = readU32(out, 0);
  const sv = BLOCK_POSITION_INVERT[(pv >>> 13) & 31]!;

  const stored = out.slice(8, PK6_STORED);
  shuffleBlocks(stored, sv);
  cryptArray(stored, pv);
  out.set(stored, 8);

  if (out.length >= PK6_PARTY) {
    const party = out.slice(PK6_STORED, PK6_PARTY);
    cryptArray(party, pv);
    out.set(party, PK6_STORED);
  }
  return out;
}

/** Verify the PK6 checksum over the decrypted stored region. */
export function pk6ChecksumOk(pkx: Uint8Array): boolean {
  if (pkx.length < PK6_STORED) return false;
  let sum = 0;
  for (let i = 8; i < PK6_STORED; i += 2) {
    sum = (sum + readU16(pkx, i)) & 0xffff;
  }
  return sum === readU16(pkx, 6);
}

function decodeUtf16z(data: Uint8Array, off: number, maxChars: number): string {
  let s = "";
  for (let i = 0; i < maxChars; i++) {
    const code = readU16(data, off + i * 2);
    if (code === 0 || code === 0xffff) break;
    if (code < 0x100) s += String.fromCharCode(code);
  }
  return s;
}

function genderFromPid(pid: number): "M" | "F" | "U" {
  const low = pid & 0xff;
  if (low >= 254) return "U";
  return low < 127 ? "M" : "F";
}

/**
 * Parse one encrypted PK6 slot. Returns null for empty / corrupt checksums.
 */
export function parsePk6(
  ekx: Uint8Array,
  slot: number
): ParsedPokemon | null {
  const pkx = decryptPk6(ekx);
  if (!pkx) return null;
  if (!pk6ChecksumOk(pkx)) return null;

  const speciesId = readU16(pkx, 0x08);
  if (speciesId === 0 || speciesId > 721) return null;

  const heldItemId = readU16(pkx, 0x0a);
  const abilityId = pkx[0x14] ?? 0;
  const pid = readU32(pkx, 0x18);
  const natureId = pkx[0x1c] ?? 0;
  const nickname =
    decodeUtf16z(pkx, 0x40, 12) || speciesName(speciesId);
  const moves: string[] = [];
  const moveDetails = [];
  for (let i = 0; i < 4; i++) {
    const mid = readU16(pkx, 0x5a + i * 2);
    const pp = pkx[0x62 + i] ?? 0;
    if (!mid) continue;
    moves.push(moveName(mid));
    moveDetails.push(moveDetail(mid, pp));
  }
  const otName = decodeUtf16z(pkx, 0xb0, 12);
  const friendship = pkx[0xca] ?? 0;
  const ballId = pkx[0xdc] ?? 0;
  const level = ekx.length >= PK6_PARTY ? (pkx[0xec] ?? 1) : 1;
  const currentHp =
    ekx.length >= PK6_PARTY ? readU16(pkx, 0xf0) : 0;
  const maxHp = ekx.length >= PK6_PARTY ? readU16(pkx, 0xf2) : 0;
  const tid = readU16(pkx, 0x0c);
  const sid = readU16(pkx, 0x0e);
  const shiny = ((tid ^ sid ^ (pid >>> 16) ^ (pid & 0xffff)) & 0xffff) < 16;

  return {
    slot,
    speciesId,
    speciesName: speciesName(speciesId),
    nickname,
    level,
    currentHp,
    maxHp,
    gender: genderFromPid(pid),
    shiny,
    ability: abilityName(abilityId) || speciesAbilityName(speciesId, 0) || "",
    nature: natureName(natureId),
    heldItem: heldItemId ? itemName(heldItemId) || null : null,
    moves,
    types: speciesTypes(speciesId),
    friendship,
    ...pokemonExtras({
      moveDetails,
      heldItemId: heldItemId || null,
      ball: ballId ? ballName(ballId) : null,
      otName,
    }),
  };
}
