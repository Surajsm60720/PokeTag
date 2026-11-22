/**
 * Generation VII LGPE (Let's Go Pikachu / Eevee) parser — SAV7b / PB7.
 *
 * Real size is 0xB8800; Switch dumps are often padded to 0x100000.
 * Storage is a flat list of 1000 party-sized PB7 slots (260 bytes) with a
 * header of party pointers — same crypto as PK6.
 */

import type { DetectionResult, GameVersion } from "../types.js";
import { emptyBadges } from "./badges.js";
import { itemName } from "./items.js";
import { parsePk6, PK6_PARTY } from "./pk6.js";
import type {
  ParsedBagItem,
  ParsedInventory,
  ParsedPokemon,
  ParsedSave,
} from "./types.js";
import {
  baseSave,
  compactParty,
  emptyDex,
  makeBoxes,
  readU16LE,
  readU32LE,
} from "./util.js";

/** PKHeX SaveUtil.SIZE_G7GG */
export const LGPE_SIZE = 0xb8800;
/** Common padded Switch dump size (also a Gen 4 size — detect via BEEF footer). */
export const LGPE_PADDED_SIZE = 0x100000;
const BEEF_MAGIC = 0x42454546; // "BEEF" LE
const BEEF_OFF = 0xb8610;

const MY_STATUS = 0x01000;
const MISC = 0x04c00;
const POKE_LIST_HEADER = 0x05a00;
const STORAGE = 0x05c00;
const PLAY_TIME = 0x45400;
const ITEMS = 0x00000;
const ITEMS_LEN = 0x0d90;
const COORDINATES = 0x47a00;

const SLOT_EMPTY = 1001;
const MAX_SLOTS = 1000;
const BOX_COUNT = 40;
const BOX_SLOTS = 25;
const MAX_SPECIES = 809;
const REGIONAL_DEX = 153; // Kanto 151 + Meltan + Melmetal

const GAME_BYTE: Record<number, GameVersion> = {
  42: "letsgopikachu",
  43: "letsgoeevee",
};

function decodeUtf16z(data: Uint8Array, off: number, maxChars: number): string {
  let s = "";
  for (let i = 0; i < maxChars; i++) {
    const code = readU16LE(data, off + i * 2);
    if (code === 0xffff || code === 0) break;
    if (code < 0x100) s += String.fromCharCode(code);
  }
  return s;
}

/** True when buffer looks like a SAV7b (exact or padded). */
export function isLgpeSave(data: Uint8Array, payloadSize?: number): boolean {
  const size = payloadSize ?? data.length;
  if (size !== LGPE_SIZE && size !== LGPE_PADDED_SIZE) return false;
  if (data.length < LGPE_SIZE) return false;
  const magic =
    data[BEEF_OFF]! |
    (data[BEEF_OFF + 1]! << 8) |
    (data[BEEF_OFF + 2]! << 16) |
    (data[BEEF_OFF + 3]! << 24);
  if (magic === BEEF_MAGIC) return true;
  const game = data[MY_STATUS + 4];
  return game === 42 || game === 43;
}

export function peekLgpeGame(data: Uint8Array): GameVersion | null {
  if (data.length < MY_STATUS + 5) return null;
  return GAME_BYTE[data[MY_STATUS + 4]!] ?? null;
}

function trimLgpe(bytes: Uint8Array): Uint8Array {
  if (bytes.length > LGPE_SIZE) return bytes.subarray(0, LGPE_SIZE);
  return bytes;
}

function resolveGame(
  detection: DetectionResult,
  data: Uint8Array
): GameVersion {
  const fromSave = peekLgpeGame(data);
  if (fromSave) return fromSave;
  if (
    detection.gameVersion === "letsgopikachu" ||
    detection.gameVersion === "letsgoeevee"
  ) {
    return detection.gameVersion;
  }
  return "letsgopikachu";
}

function readBag(data: Uint8Array): ParsedInventory {
  const bag: ParsedBagItem[] = [];
  const end = Math.min(data.length, ITEMS + ITEMS_LEN);
  for (let off = ITEMS; off + 4 <= end; off += 4) {
    const value = readU32LE(data, off);
    if (value === 0) continue;
    const id = value & 0x7ff;
    const quantity = (value >>> 15) & 0x3ff;
    if (id === 0 || quantity === 0) continue;
    const name = itemName(id);
    if (!name) continue;
    bag.push({
      id,
      name,
      quantity,
      pocket: "items",
    });
    if (bag.length >= 200) break;
  }
  return { bag, pc: [] };
}

function dexFromPokemon(mons: ParsedPokemon[]): ReturnType<typeof emptyDex> {
  const owned = new Set<number>();
  for (const mon of mons) {
    if (mon.speciesId > 0) owned.add(mon.speciesId);
  }
  const entries = [...owned]
    .sort((a, b) => a - b)
    .slice(0, 24)
    .map((speciesId) => ({
      speciesId,
      speciesName: mons.find((m) => m.speciesId === speciesId)!.speciesName,
      seen: true,
      owned: true,
    }));
  return {
    seen: owned.size,
    owned: owned.size,
    regionalTotal: REGIONAL_DEX,
    entries,
  };
}

/**
 * Parse a Let's Go Pikachu / Eevee save (SAV7b).
 */
export function parseGen7b(
  bytes: Uint8Array,
  detection: DetectionResult
): ParsedSave {
  if (!isLgpeSave(bytes)) {
    throw new Error("Not a Let's Go (SAV7b) save");
  }
  const data = trimLgpe(bytes);
  const game = resolveGame(detection, data);

  const tid = readU16LE(data, MY_STATUS);
  const sid = readU16LE(data, MY_STATUS + 2);
  const gender = data[MY_STATUS + 5] === 1 ? "F" : "M";
  const name = decodeUtf16z(data, MY_STATUS + 0x38, 12);
  const money = readU32LE(data, MISC + 4);

  const hours = readU16LE(data, PLAY_TIME);
  const minutes = data[PLAY_TIME + 2] ?? 0;
  const seconds = data[PLAY_TIME + 3] ?? 0;
  const playTimeSeconds = hours * 3600 + minutes * 60 + seconds;

  const partyIndexes: number[] = [];
  for (let i = 0; i < 6; i++) {
    partyIndexes.push(readU16LE(data, POKE_LIST_HEADER + i * 2));
  }
  const storedCount = readU16LE(data, POKE_LIST_HEADER + 14);

  const boxes = makeBoxes(BOX_COUNT, BOX_SLOTS);
  const allMons: ParsedPokemon[] = [];
  const byIndex = new Map<number, ParsedPokemon>();

  const limit = Math.min(MAX_SLOTS, Math.max(storedCount, 0));
  for (let i = 0; i < limit; i++) {
    const off = STORAGE + i * PK6_PARTY;
    if (off + PK6_PARTY > data.length) break;
    const mon = parsePk6(data.subarray(off, off + PK6_PARTY), i % BOX_SLOTS, MAX_SPECIES);
    if (!mon) continue;
    byIndex.set(i, mon);
    allMons.push(mon);
    const box = Math.floor(i / BOX_SLOTS);
    const slot = i % BOX_SLOTS;
    if (box < BOX_COUNT) {
      boxes[box]!.pokemon[slot] = { ...mon, slot };
    }
  }

  const partySlots: Array<ParsedPokemon | null> = [];
  for (let p = 0; p < 6; p++) {
    const idx = partyIndexes[p]!;
    if (idx >= MAX_SLOTS || idx === SLOT_EMPTY) continue;
    const mon = byIndex.get(idx);
    if (mon) partySlots.push({ ...mon, slot: p });
  }

  return baseSave(game, {
    trainer: {
      name,
      trainerId: tid,
      secretId: sid,
      money,
      gender,
    },
    party: compactParty(partySlots),
    boxes,
    dex: allMons.length ? dexFromPokemon(allMons) : emptyDex(REGIONAL_DEX),
    badges: emptyBadges(game),
    playTimeSeconds,
    location: "",
    locationMapId: null,
    inventory: readBag(data),
  });
}
