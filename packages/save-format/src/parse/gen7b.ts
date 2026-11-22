/**
 * Generation VII LGPE (Let's Go Pikachu / Eevee) parser — SAV7b / PB7.
 *
 * Real size is 0xB8800; Switch dumps are often padded to 0x100000.
 * Storage is a flat list of 1000 party-sized PB7 slots (260 bytes) with a
 * header of party pointers — same crypto as PK6. Party members live in that
 * list too, so boxes must skip party indexes.
 */

import type { DetectionResult, GameVersion } from "../types.js";
import { badgesFromBitmask } from "./badges.js";
import { itemName } from "./items.js";
import {
  lgpeLocationFromArriveFlags,
  lgpeMetLocationName,
} from "./locations-lgpe.js";
import { parsePk6, PK6_PARTY } from "./pk6.js";
import { speciesName } from "./species.js";
import type {
  ParsedBagItem,
  ParsedDex,
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
const EVENT_WORK = 0x01200;
const ZUKAN = 0x02a00;
const POKE_LIST_HEADER = 0x05a00;
const STORAGE = 0x05c00;
const PLAY_TIME = 0x45400;

/** EventWork: 1000×u32 works, then bitflags. */
const EW_FLAG_START = 1000 * 4;
/** FSYS_GYM_CLEAR_* — Rock through Ground (FlagsEditorEX). */
const GYM_FLAG_ROCK = 0x08c;

const SLOT_EMPTY = 1001;
const MAX_SLOTS = 1000;
const BOX_COUNT = 40;
const BOX_SLOTS = 25;
const MAX_SPECIES = 809;
const REGIONAL_DEX = 153; // Kanto 151 + Meltan + Melmetal

/** Zukan7 layout inside the Zukan block. */
const ZUKAN_MAGIC = 0x2f120f17;
const ZUKAN_OFS_CAUGHT = 0x88; // after magic+flags+misc
const ZUKAN_OFS_SEEN = 0xf0;
const ZUKAN_BIT_SEEN_SIZE = 0x8c;
const ZUKAN_SEEN_REGIONS = 4;

const GAME_BYTE: Record<number, GameVersion> = {
  42: "letsgopikachu",
  43: "letsgoeevee",
};

/** PlayerBag7b pouch layout (offset, slot count, pocket). */
const POUCHES: Array<{
  offset: number;
  slots: number;
  pocket: ParsedBagItem["pocket"];
}> = [
  { offset: 0x0000, slots: 60, pocket: "medicine" },
  { offset: 0x00f0, slots: 108, pocket: "tmhm" },
  { offset: 0x02a0, slots: 200, pocket: "other" }, // Candy
  { offset: 0x05c0, slots: 150, pocket: "other" }, // Power-ups / Z
  { offset: 0x0818, slots: 50, pocket: "balls" },
  { offset: 0x08e0, slots: 150, pocket: "other" }, // Battle
  { offset: 0x0b38, slots: 150, pocket: "items" },
];

/** FSYS_ARRIVE_* flag indexes from FlagsEditorEX (partial, roads + towns). */
const ARRIVE_FLAGS: Array<{ flag: number; key: string }> = [
  { flag: 0x9a, key: "FSYS_ARRIVE_ROAD001" },
  { flag: 0x9b, key: "FSYS_ARRIVE_ROAD002" },
  { flag: 0x9c, key: "FSYS_ARRIVE_ROAD003" },
  { flag: 0x9d, key: "FSYS_ARRIVE_ROAD004" },
  { flag: 0x9e, key: "FSYS_ARRIVE_ROAD005" },
  { flag: 0x9f, key: "FSYS_ARRIVE_ROAD006" },
  { flag: 0xa0, key: "FSYS_ARRIVE_ROAD007" },
  { flag: 0xa1, key: "FSYS_ARRIVE_ROAD008" },
  { flag: 0xa2, key: "FSYS_ARRIVE_ROAD009" },
  { flag: 0xa3, key: "FSYS_ARRIVE_ROAD010" },
  { flag: 0xa4, key: "FSYS_ARRIVE_ROAD011" },
  { flag: 0xa5, key: "FSYS_ARRIVE_ROAD012" },
  { flag: 0xa6, key: "FSYS_ARRIVE_ROAD013" },
  { flag: 0xa7, key: "FSYS_ARRIVE_ROAD014" },
  { flag: 0xa8, key: "FSYS_ARRIVE_ROAD015" },
  { flag: 0xa9, key: "FSYS_ARRIVE_ROAD016" },
  { flag: 0xaa, key: "FSYS_ARRIVE_ROAD017" },
  { flag: 0xab, key: "FSYS_ARRIVE_ROAD018" },
  { flag: 0xac, key: "FSYS_ARRIVE_ROAD019" },
  { flag: 0xad, key: "FSYS_ARRIVE_ROAD020" },
  { flag: 0xae, key: "FSYS_ARRIVE_ROAD021" },
  { flag: 0xaf, key: "FSYS_ARRIVE_ROAD022" },
  { flag: 0xb0, key: "FSYS_ARRIVE_ROAD023" },
  { flag: 0xb1, key: "FSYS_ARRIVE_ROAD024" },
  { flag: 0xb2, key: "FSYS_ARRIVE_ROAD025" },
  { flag: 0xb3, key: "FSYS_ARRIVE_TOWN001" },
  { flag: 0xb4, key: "FSYS_ARRIVE_TOWN002" },
  { flag: 0xb5, key: "FSYS_ARRIVE_TOWN003" },
  { flag: 0xb6, key: "FSYS_ARRIVE_TOWN004" },
  { flag: 0xb7, key: "FSYS_ARRIVE_TOWN005" },
  { flag: 0xb8, key: "FSYS_ARRIVE_TOWN006" },
  { flag: 0xb9, key: "FSYS_ARRIVE_TOWN007" },
  { flag: 0xba, key: "FSYS_ARRIVE_TOWN008" },
  { flag: 0xbb, key: "FSYS_ARRIVE_TOWN009" },
  { flag: 0xbc, key: "FSYS_ARRIVE_TOWN010" },
  { flag: 0xbd, key: "FSYS_ARRIVE_TOWN011" },
];

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

function eventFlag(data: Uint8Array, index: number): boolean {
  const off = EVENT_WORK + EW_FLAG_START + (index >> 3);
  if (off >= data.length) return false;
  return ((data[off]! >> (index & 7)) & 1) === 1;
}

function readBag(data: Uint8Array): ParsedInventory {
  const bag: ParsedBagItem[] = [];
  for (const pouch of POUCHES) {
    for (let i = 0; i < pouch.slots; i++) {
      const off = pouch.offset + i * 4;
      if (off + 4 > data.length) break;
      const value = readU32LE(data, off);
      if (value === 0) continue;
      // InventoryItem7b: 11-bit id, 10-bit count << 15, bit30 = IsNew
      const id = value & 0x7ff;
      const quantity = (value >>> 15) & 0x3ff;
      if (id === 0 || quantity === 0) continue;
      const name = itemName(id);
      if (!name || name.startsWith("Item #")) continue;
      bag.push({
        id,
        name,
        quantity,
        pocket: pouch.pocket,
      });
    }
  }
  return { bag, pc: [] };
}

function bitSet(data: Uint8Array, base: number, bitIndex: number): boolean {
  const off = base + (bitIndex >> 3);
  if (off >= data.length) return false;
  return ((data[off]! >> (bitIndex & 7)) & 1) === 1;
}

function readDex(data: Uint8Array): ParsedDex {
  if (readU32LE(data, ZUKAN) !== ZUKAN_MAGIC) {
    return emptyDex(REGIONAL_DEX);
  }
  const ownedBits = new Set<number>();
  const seenBits = new Set<number>();
  for (let i = 0; i < REGIONAL_DEX; i++) {
    if (bitSet(data, ZUKAN + ZUKAN_OFS_CAUGHT, i)) ownedBits.add(i + 1);
    for (let r = 0; r < ZUKAN_SEEN_REGIONS; r++) {
      const base = ZUKAN + ZUKAN_OFS_SEEN + r * ZUKAN_BIT_SEEN_SIZE;
      if (bitSet(data, base, i)) {
        seenBits.add(i + 1);
        break;
      }
    }
  }
  // Meltan/Melmetal use national ids 808/809 but regional bits 151/152.
  const toSpecies = (bit1: number): number => {
    if (bit1 <= 151) return bit1;
    if (bit1 === 152) return 808;
    if (bit1 === 153) return 809;
    return bit1;
  };

  const owned = [...ownedBits].map(toSpecies);
  const seen = [...seenBits].map(toSpecies);
  const sampleIds = [...new Set([...seen, ...owned])]
    .sort((a, b) => a - b)
    .slice(0, 24);
  const ownedSet = new Set(owned);
  const seenSet = new Set(seen);

  return {
    seen: seenSet.size,
    owned: ownedSet.size,
    regionalTotal: REGIONAL_DEX,
    entries: sampleIds.map((speciesId) => ({
      speciesId,
      speciesName: speciesName(speciesId),
      seen: seenSet.has(speciesId) || ownedSet.has(speciesId),
      owned: ownedSet.has(speciesId),
    })),
  };
}

function readGymBadgeMask(data: Uint8Array): number {
  let mask = 0;
  for (let i = 0; i < 8; i++) {
    if (eventFlag(data, GYM_FLAG_ROCK + i)) mask |= 1 << i;
  }
  return mask;
}

function readLocation(data: Uint8Array): {
  location: string;
  locationMapId: number | null;
} {
  const arrived: string[] = [];
  for (const { flag, key } of ARRIVE_FLAGS) {
    if (eventFlag(data, flag)) arrived.push(key);
  }
  const fromFlags = lgpeLocationFromArriveFlags(arrived);
  return { location: fromFlags.name, locationMapId: fromFlags.mapId };
}

function enrichMetLocation(mon: ParsedPokemon): ParsedPokemon {
  if (mon.metLocationId == null || mon.metLocationId === 0) return mon;
  const name = lgpeMetLocationName(mon.metLocationId);
  if (!name || mon.metLocation === name) return mon;
  return { ...mon, metLocation: name };
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
  const partyIndexSet = new Set(
    partyIndexes.filter((idx) => idx < MAX_SLOTS && idx !== SLOT_EMPTY)
  );
  const storedCount = readU16LE(data, POKE_LIST_HEADER + 14);

  const boxes = makeBoxes(BOX_COUNT, BOX_SLOTS);
  const byIndex = new Map<number, ParsedPokemon>();

  const limit = Math.min(MAX_SLOTS, Math.max(storedCount, 0));
  for (let i = 0; i < limit; i++) {
    const off = STORAGE + i * PK6_PARTY;
    if (off + PK6_PARTY > data.length) break;
    const mon = parsePk6(
      data.subarray(off, off + PK6_PARTY),
      i % BOX_SLOTS,
      MAX_SPECIES
    );
    if (!mon) continue;
    const enriched = enrichMetLocation(mon);
    byIndex.set(i, enriched);

    // Party members share the storage list — keep them out of the PC grid.
    if (partyIndexSet.has(i)) continue;

    const box = Math.floor(i / BOX_SLOTS);
    const slot = i % BOX_SLOTS;
    if (box < BOX_COUNT) {
      boxes[box]!.pokemon[slot] = { ...enriched, slot };
    }
  }

  const partySlots: Array<ParsedPokemon | null> = [];
  for (let p = 0; p < 6; p++) {
    const idx = partyIndexes[p]!;
    if (idx >= MAX_SLOTS || idx === SLOT_EMPTY) continue;
    const mon = byIndex.get(idx);
    if (mon) partySlots.push({ ...mon, slot: p });
  }

  const { location, locationMapId } = readLocation(data);

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
    dex: readDex(data),
    badges: badgesFromBitmask(game, readGymBadgeMask(data)),
    playTimeSeconds,
    location,
    locationMapId,
    inventory: readBag(data),
  });
}
