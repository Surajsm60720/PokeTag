/**
 * Generation VI save parser (XY / ORAS) using PKHeX block offsets + PK6 crypto.
 */

import type { DetectionResult, GameVersion } from "../types.js";
import { badgesFromBitmask, emptyBadges } from "./badges.js";
import { itemName } from "./items.js";
import { gen6SituationLocation } from "./locations-gen6.js";
import { parsePk6, PK6_PARTY, PK6_STORED } from "./pk6.js";
import type {
  ParsedBagItem,
  ParsedInventory,
  ParsedPokemon,
  ParsedSave,
} from "./types.js";
import {
  baseSave,
  compactParty,
  countDexBits,
  emptyDex,
  makeBoxes,
  readU16LE,
  readU32LE,
} from "./util.js";

/** PKHeX GameVersion bytes stored in MyStatus. */
const GAME_BYTE: Record<number, GameVersion> = {
  24: "x",
  25: "y",
  26: "alphasapphire",
  27: "omegaruby",
};

const MAX_SPECIES = 721;
const DEX_BR_SIZE = 0x60;
/** XY foreign-owned flag block relative to owned bitfield start. */
const XY_FOREIGN_OWNED = 0x644;

interface Gen6Layout {
  bag: number;
  situation: number;
  myStatus: number;
  misc: number;
  money: number;
  badges: number;
  playTime: number;
  party: number;
  pokeDex: number;
  box: number;
  boxCount: number;
  /** MyItem pouch starts relative to Bag. */
  pouchItems: number;
  pouchKey: number;
  pouchTmhm: number;
  pouchMedicine: number;
  pouchBerry: number;
  bagEnd: number;
}

const XY: Gen6Layout = {
  bag: 0x00400,
  situation: 0x01400,
  myStatus: 0x14000,
  misc: 0x4200,
  money: 0x4208,
  badges: 0x420c,
  playTime: 0x1800,
  party: 0x14200,
  pokeDex: 0x15000,
  box: 0x22600,
  boxCount: 31,
  pouchItems: 0x000,
  pouchKey: 0x640,
  pouchTmhm: 0x7c0,
  pouchMedicine: 0x968,
  pouchBerry: 0xa68,
  bagEnd: 0xb88,
};

const ORAS: Gen6Layout = {
  bag: 0x00400,
  situation: 0x01400,
  myStatus: 0x14000,
  misc: 0x4200,
  money: 0x4208,
  badges: 0x420c,
  playTime: 0x1800,
  party: 0x14200,
  pokeDex: 0x15000,
  box: 0x33000,
  boxCount: 31,
  pouchItems: 0x000,
  pouchKey: 0x640,
  pouchTmhm: 0x7c0,
  pouchMedicine: 0x970,
  pouchBerry: 0xa70,
  bagEnd: 0xb90,
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

function layoutFor(game: GameVersion, size: number): Gen6Layout {
  if (game === "omegaruby" || game === "alphasapphire" || size === 0x76000) {
    return ORAS;
  }
  return XY;
}

function resolveGame(
  bytes: Uint8Array,
  detection: DetectionResult,
  layout: Gen6Layout
): GameVersion {
  const gameByte = bytes[layout.myStatus + 0x04];
  if (gameByte != null && GAME_BYTE[gameByte]) {
    return GAME_BYTE[gameByte]!;
  }
  if (detection.gameVersion !== "unknown") return detection.gameVersion;
  return sizeHintGame(bytes.length);
}

function sizeHintGame(size: number): GameVersion {
  if (size === 0x76000) return "omegaruby";
  return "x";
}

function isOras(game: GameVersion): boolean {
  return game === "omegaruby" || game === "alphasapphire";
}

function readPlayTimeSeconds(bytes: Uint8Array, off: number): number {
  if (off + 4 > bytes.length) return 0;
  const hours = readU16LE(bytes, off);
  const minutes = bytes[off + 2] ?? 0;
  const seconds = bytes[off + 3] ?? 0;
  return hours * 3600 + minutes * 60 + seconds;
}

/** PKHeX SAV6 GetCaught / GetSeen bitfields. */
function parseDex(
  bytes: Uint8Array,
  pokeDex: number,
  oras: boolean
): ReturnType<typeof countDexBits> {
  const flags = pokeDex + 0x08;
  const byteCount = Math.ceil(MAX_SPECIES / 8);
  if (flags + DEX_BR_SIZE * 4 + byteCount > bytes.length) {
    return emptyDex(MAX_SPECIES);
  }

  const owned = new Uint8Array(byteCount);
  const seen = new Uint8Array(byteCount);
  for (let i = 0; i < MAX_SPECIES; i++) {
    const bd = i >> 3;
    const mask = 1 << (i & 7);
    if ((bytes[flags + bd]! & mask) !== 0) {
      owned[bd]! |= mask;
    } else if (!oras && i < 649) {
      const foreign = flags + bd + XY_FOREIGN_OWNED;
      if (foreign < bytes.length && (bytes[foreign]! & mask) !== 0) {
        owned[bd]! |= mask;
      }
    }
    for (let region = 1; region <= 4; region++) {
      if ((bytes[flags + bd + region * DEX_BR_SIZE]! & mask) !== 0) {
        seen[bd]! |= mask;
        break;
      }
    }
  }
  return countDexBits(owned, seen, MAX_SPECIES);
}

type PocketKind = ParsedBagItem["pocket"];

function readPouch(
  bytes: Uint8Array,
  start: number,
  end: number,
  pocket: PocketKind
): ParsedBagItem[] {
  const out: ParsedBagItem[] = [];
  for (let off = start; off + 4 <= end && off + 4 <= bytes.length; off += 4) {
    const id = readU16LE(bytes, off);
    const quantity = readU16LE(bytes, off + 2);
    if (id === 0) continue;
    if (quantity === 0 || quantity > 999) continue;
    out.push({
      id,
      name: itemName(id) || `Item #${id}`,
      quantity,
      pocket,
    });
  }
  return out;
}

function parseInventory(
  bytes: Uint8Array,
  layout: Gen6Layout
): ParsedInventory {
  const bagBase = layout.bag;
  if (bagBase + layout.bagEnd > bytes.length) {
    return { bag: [], pc: [] };
  }
  const bag: ParsedBagItem[] = [
    ...readPouch(
      bytes,
      bagBase + layout.pouchItems,
      bagBase + layout.pouchKey,
      "items"
    ),
    ...readPouch(
      bytes,
      bagBase + layout.pouchKey,
      bagBase + layout.pouchTmhm,
      "key"
    ),
    ...readPouch(
      bytes,
      bagBase + layout.pouchTmhm,
      bagBase + layout.pouchMedicine,
      "tmhm"
    ),
    ...readPouch(
      bytes,
      bagBase + layout.pouchMedicine,
      bagBase + layout.pouchBerry,
      "medicine"
    ),
    ...readPouch(
      bytes,
      bagBase + layout.pouchBerry,
      bagBase + layout.bagEnd,
      "berries"
    ),
  ];
  return { bag, pc: [] };
}

export function parseGen6(
  bytes: Uint8Array,
  detection: DetectionResult
): ParsedSave {
  const provisional =
    detection.gameVersion === "unknown"
      ? sizeHintGame(bytes.length)
      : detection.gameVersion;
  const layout = layoutFor(provisional, bytes.length);
  const game = resolveGame(bytes, detection, layout);
  const oras = isOras(game);

  const status = layout.myStatus;
  const tid = status + 2 <= bytes.length ? readU16LE(bytes, status) : 0;
  const sid = status + 4 <= bytes.length ? readU16LE(bytes, status + 2) : 0;
  const genderByte = bytes[status + 5] ?? 0;
  const name =
    status + 0x48 + 24 <= bytes.length
      ? decodeUtf16z(bytes, status + 0x48, 12)
      : "";
  const money =
    layout.money + 4 <= bytes.length ? readU32LE(bytes, layout.money) : 0;
  const badgeMask =
    layout.badges < bytes.length ? (bytes[layout.badges] ?? 0) : 0;

  // Situation.M is a zonedata entry for XY (not a location index).
  const zoneOff = layout.situation + 0x02;
  const zoneId = zoneOff + 2 <= bytes.length ? readU16LE(bytes, zoneOff) : 0;
  const { locationId, name: location } = gen6SituationLocation(
    zoneId,
    oras ? "oras" : "xy"
  );
  const locationMapId = locationId || null;

  const partyCountOff = layout.party + 6 * PK6_PARTY;
  const partyCount =
    partyCountOff + 4 <= bytes.length
      ? Math.min(6, readU32LE(bytes, partyCountOff))
      : 6;

  const partySlots: Array<ParsedPokemon | null> = [];
  for (let i = 0; i < partyCount; i++) {
    const base = layout.party + i * PK6_PARTY;
    if (base + PK6_PARTY > bytes.length) break;
    const mon = parsePk6(bytes.subarray(base, base + PK6_PARTY), i);
    if (mon) partySlots.push(mon);
  }

  const boxes = makeBoxes(layout.boxCount, 30);
  for (let i = 0; i < layout.boxCount * 30; i++) {
    const off = layout.box + i * PK6_STORED;
    if (off + PK6_STORED > bytes.length) break;
    const mon = parsePk6(bytes.subarray(off, off + PK6_STORED), i % 30);
    if (mon) {
      boxes[Math.floor(i / 30)]!.pokemon[i % 30] = mon;
    }
  }

  return baseSave(game, {
    trainer: {
      name,
      trainerId: tid,
      secretId: sid,
      money,
      gender: genderByte === 1 ? "F" : "M",
    },
    party: compactParty(partySlots),
    boxes,
    dex: parseDex(bytes, layout.pokeDex, oras),
    badges: badgeMask
      ? badgesFromBitmask(game, badgeMask)
      : emptyBadges(game),
    playTimeSeconds: readPlayTimeSeconds(bytes, layout.playTime),
    location,
    locationMapId,
    inventory: parseInventory(bytes, layout),
  });
}
