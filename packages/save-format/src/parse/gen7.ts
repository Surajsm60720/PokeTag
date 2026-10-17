/**
 * Generation VII save parser (SM / USUM) via BEEF blocks + PK7-sized slots.
 */

import type { DetectionResult, GameVersion } from "../types.js";
import { emptyBadges } from "./badges.js";
import { findBeefBlocks, validateBeefBlock } from "./beef.js";
import { speciesName } from "./species.js";
import type { ParsedPokemon, ParsedSave } from "./types.js";
import {
  baseSave,
  compactParty,
  emptyDex,
  makeBoxes,
  pokemonExtras,
  readU16LE,
  readU32LE,
} from "./util.js";

const PK7_SIZE = 0x104;
const PK7_PARTY = 0x158;

function decodeUtf16z(data: Uint8Array, off: number, maxChars: number): string {
  let s = "";
  for (let i = 0; i < maxChars; i++) {
    const code = readU16LE(data, off + i * 2);
    if (code === 0xffff || code === 0) break;
    if (code < 0x100) s += String.fromCharCode(code);
  }
  return s;
}

function parsePk7Shallow(raw: Uint8Array, slot: number): ParsedPokemon | null {
  if (raw.length < 0x10) return null;
  const checksum = readU16LE(raw, 0x06);
  const ec = readU32LE(raw, 0);
  if (ec === 0 && checksum === 0) return null;
  const speciesId = readU16LE(raw, 0x08);
  if (speciesId === 0 || speciesId > 807) return null;
  return {
    slot,
    speciesId,
    speciesName: speciesName(speciesId),
    nickname: decodeUtf16z(raw, 0x40, 12) || speciesName(speciesId),
    level: 1,
    currentHp: 0,
    maxHp: 0,
    gender: "U",
    shiny: false,
    ability: "",
    nature: "",
    heldItem: null,
    moves: [],
    types: [],
    friendship: 0,
    ...pokemonExtras(),
  };
}

export function parseGen7(
  bytes: Uint8Array,
  detection: DetectionResult
): ParsedSave {
  const game = detection.gameVersion === "unknown" ? "sun" : detection.gameVersion;
  const ultra = game === "ultrasun" || game === "ultramoon";
  const blocks = findBeefBlocks(bytes);
  for (const b of blocks) {
    if (!validateBeefBlock(b)) {
      const stored =
        b.data[b.data.length - 2]! | (b.data[b.data.length - 1]! << 8);
      if (stored !== 0) {
        throw new Error("Gen 7 BEEF block checksum validation failed");
      }
    }
  }

  const trainerOff = ultra ? 0x1240 : 0x1200;
  const name =
    trainerOff + 24 < bytes.length
      ? decodeUtf16z(bytes, trainerOff, 12)
      : "";
  const tid = trainerOff + 0x20 < bytes.length ? readU16LE(bytes, trainerOff + 0x20) : 0;
  const sid = trainerOff + 0x22 < bytes.length ? readU16LE(bytes, trainerOff + 0x22) : 0;
  const moneyOff = ultra ? 0x4400 : 0x4000;
  const money = moneyOff + 4 < bytes.length ? readU32LE(bytes, moneyOff) : 0;

  const partyOff = ultra ? 0x14a00 : 0x14000;
  const partySlots: Array<ParsedPokemon | null> = [];
  for (let i = 0; i < 6; i++) {
    const base = partyOff + i * PK7_PARTY;
    if (base + PK7_SIZE > bytes.length) break;
    const mon = parsePk7Shallow(bytes.subarray(base, base + PK7_SIZE), i);
    if (mon) partySlots.push(mon);
  }

  const boxes = makeBoxes(32, 30);
  const boxOff = ultra ? 0x52000 : 0x4e000;
  for (let i = 0; i < 32 * 30; i++) {
    const off = boxOff + i * PK7_SIZE;
    if (off + PK7_SIZE > bytes.length) break;
    const mon = parsePk7Shallow(bytes.subarray(off, off + PK7_SIZE), i % 30);
    if (mon) boxes[Math.floor(i / 30)]!.pokemon[i % 30] = mon;
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
    dex: emptyDex(ultra ? 807 : 802),
    badges: emptyBadges(game),
    playTimeSeconds: 0,
  });
}
