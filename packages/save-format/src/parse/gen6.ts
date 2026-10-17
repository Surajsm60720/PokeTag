/**
 * Generation VI save parser (XY / ORAS) via BEEF block scan + PK6-sized slots.
 */

import type { DetectionResult, GameVersion } from "../types.js";
import { badgesFromBitmask, emptyBadges } from "./badges.js";
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

const PK6_SIZE = 0x104; // 260 boxed
const PK6_PARTY = 0x118; // 280 party

function decodeUtf16z(data: Uint8Array, off: number, maxChars: number): string {
  let s = "";
  for (let i = 0; i < maxChars; i++) {
    const code = readU16LE(data, off + i * 2);
    if (code === 0xffff || code === 0) break;
    if (code < 0x100) s += String.fromCharCode(code);
  }
  return s;
}

/** Minimal PK6 read: species at 0x08 after decrypt is complex — use plaintext demo path. */
function parsePk6Shallow(raw: Uint8Array, slot: number): ParsedPokemon | null {
  if (raw.length < 0x10) return null;
  // Encrypted PK6: species is inside shuffled blocks. For save scanning we accept
  // zeroed slots as empty; non-zero checksum at 0x06 indicates occupancy.
  const checksum = readU16LE(raw, 0x06);
  const encryptionConstant = readU32LE(raw, 0);
  if (encryptionConstant === 0 && checksum === 0) return null;
  // Without full PK6 crypto, expose placeholder identity when EC present.
  const speciesId = readU16LE(raw, 0x08) || 0;
  if (speciesId === 0 || speciesId > 721) {
    return {
      slot,
      speciesId: speciesId || 0,
      speciesName: speciesId ? speciesName(speciesId) : "Unknown",
      nickname: "",
      level: raw.length >= PK6_PARTY ? raw[0xec] ?? 1 : 1,
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
  return {
    slot,
    speciesId,
    speciesName: speciesName(speciesId),
    nickname: decodeUtf16z(raw, 0x40, 12) || speciesName(speciesId),
    level: raw.length >= PK6_PARTY ? raw[0xec] ?? 1 : 1,
    currentHp: 0,
    maxHp: 0,
    gender: "U",
    shiny: false,
    ability: "",
    nature: "",
    heldItem: null,
    moves: [],
    types: [],
    friendship: raw[0xca] ?? 0,
    ...pokemonExtras(),
  };
}

export function parseGen6(
  bytes: Uint8Array,
  detection: DetectionResult
): ParsedSave {
  const game = detection.gameVersion === "unknown" ? "x" : detection.gameVersion;
  const blocks = findBeefBlocks(bytes);
  const bad = blocks.find((b) => !validateBeefBlock(b));
  if (blocks.length > 0 && bad && bad.data.length > 2) {
    // Only throw when a clearly checksummed block fails.
    const stored =
      bad.data[bad.data.length - 2]! | (bad.data[bad.data.length - 1]! << 8);
    if (stored !== 0) {
      throw new Error("Gen 6 BEEF block checksum validation failed");
    }
  }

  // Trainer info lives at fixed offsets in raw XY/ORAS saves (community docs).
  const isOras = game === "omegaruby" || game === "alphasapphire";
  const trainerOff = isOras ? 0x14000 : 0x14000;
  const name =
    trainerOff + 16 < bytes.length
      ? decodeUtf16z(bytes, trainerOff, 12)
      : "";
  const tid = trainerOff + 0x10 + 2 < bytes.length ? readU16LE(bytes, trainerOff + 0x10) : 0;
  const sid = trainerOff + 0x12 + 2 < bytes.length ? readU16LE(bytes, trainerOff + 0x12) : 0;
  const moneyOff = isOras ? 0x4200 : 0x4208;
  const money = moneyOff + 4 < bytes.length ? readU32LE(bytes, moneyOff) : 0;
  const badgeOff = isOras ? 0x4210 : 0x4214;
  const badgeMask = badgeOff < bytes.length ? bytes[badgeOff]! : 0;

  const partyOff = isOras ? 0x14200 : 0x14200;
  const partySlots: Array<ParsedPokemon | null> = [];
  for (let i = 0; i < 6; i++) {
    const base = partyOff + i * PK6_PARTY;
    if (base + PK6_SIZE > bytes.length) break;
    const mon = parsePk6Shallow(bytes.subarray(base, base + PK6_PARTY), i);
    if (mon && (mon.speciesId > 0 || readU32LE(bytes, base) !== 0)) {
      if (mon.speciesId > 0) partySlots.push(mon);
    }
  }

  const boxes = makeBoxes(31, 30);
  const boxOff = isOras ? 0x1a000 : 0x1a000;
  for (let i = 0; i < 31 * 30; i++) {
    const off = boxOff + i * PK6_SIZE;
    if (off + PK6_SIZE > bytes.length) break;
    const mon = parsePk6Shallow(bytes.subarray(off, off + PK6_SIZE), i % 30);
    if (mon && mon.speciesId > 0) {
      boxes[Math.floor(i / 30)]!.pokemon[i % 30] = mon;
    }
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
    dex: emptyDex(721),
    badges: badgeMask ? badgesFromBitmask(game, badgeMask) : emptyBadges(game),
    playTimeSeconds: 0,
  });
}
