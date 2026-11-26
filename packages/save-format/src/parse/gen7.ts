/**
 * Generation VII save parser (SM / USUM) using PKHeX block offsets + PK6/7 crypto.
 */

import type { DetectionResult, GameVersion } from "../types.js";
import { badgesFromBitmask, emptyBadges } from "./badges.js";
import { itemName } from "./items.js";
import {
  gen7LocationName,
  gen7SituationLocation,
} from "./locations-gen7.js";
import { parsePk6, PK6_PARTY, PK6_STORED } from "./pk6.js";
import type {
  ParsedBagItem,
  ParsedInventory,
  ParsedPokemon,
  ParsedSave,
  ParsedStoryProgress,
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

const GAME_BYTE: Record<number, GameVersion> = {
  30: "sun",
  31: "moon",
  32: "ultrasun",
  33: "ultramoon",
};

interface Gen7Layout {
  bag: number;
  situation: number;
  myStatus: number;
  pokeDex: number;
  misc: number;
  money: number;
  stamps: number;
  playTime: number;
  party: number;
  box: number;
  boxCount: number;
  hallOfFame: number;
  pouchItems: number;
  pouchKey: number;
  pouchTmhm: number;
  pouchMedicine: number;
  pouchBerry: number;
  pouchZ: number;
  pouchRotom: number | null;
  bagSlots: {
    items: number;
    key: number;
    tmhm: number;
    medicine: number;
    berry: number;
    z: number;
    rotom: number;
  };
  maxSpecies: number;
}

/** PKHeX SaveBlockAccessor7SM offsets. */
const SM: Gen7Layout = {
  bag: 0x00000,
  situation: 0x00e00,
  myStatus: 0x01200,
  pokeDex: 0x02a00,
  misc: 0x04000,
  money: 0x04004,
  stamps: 0x04008,
  playTime: 0x40c00,
  party: 0x01400,
  box: 0x04e00,
  boxCount: 32,
  hallOfFame: 0x25c0,
  pouchItems: 0x000,
  pouchKey: 0x6b8,
  pouchTmhm: 0x998,
  pouchMedicine: 0xb48,
  pouchBerry: 0xc48,
  pouchZ: 0xd68,
  pouchRotom: null,
  bagSlots: {
    items: 430,
    key: 184,
    tmhm: 108,
    medicine: 64,
    berry: 72,
    z: 30,
    rotom: 0,
  },
  maxSpecies: 802,
};

/** PKHeX SaveBlockAccessor7USUM offsets. */
const USUM: Gen7Layout = {
  bag: 0x00000,
  situation: 0x01000,
  myStatus: 0x01400,
  pokeDex: 0x02c00,
  misc: 0x04400,
  money: 0x04404,
  stamps: 0x04408,
  playTime: 0x41000,
  party: 0x01600,
  box: 0x05200,
  boxCount: 32,
  hallOfFame: 0x27c0,
  pouchItems: 0x000,
  pouchKey: 0x6ac,
  pouchTmhm: 0x9c4,
  pouchMedicine: 0xb74,
  pouchBerry: 0xc64,
  pouchZ: 0xd70,
  pouchRotom: 0xdfc,
  bagSlots: {
    items: 427,
    key: 198,
    tmhm: 108,
    medicine: 60,
    berry: 67,
    z: 35,
    rotom: 11,
  },
  maxSpecies: 807,
};

function readF32LE(data: Uint8Array, off: number): number {
  if (off + 4 > data.length) return 0;
  const view = new DataView(data.buffer, data.byteOffset + off, 4);
  return view.getFloat32(0, true);
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

function isUltra(game: GameVersion, size: number): boolean {
  return (
    game === "ultrasun" ||
    game === "ultramoon" ||
    size === 0x6cc00
  );
}

function layoutFor(game: GameVersion, size: number): Gen7Layout {
  return isUltra(game, size) ? USUM : SM;
}

function resolveGame(
  bytes: Uint8Array,
  detection: DetectionResult,
  layout: Gen7Layout
): GameVersion {
  const gameByte = bytes[layout.myStatus + 0x04];
  if (gameByte != null && GAME_BYTE[gameByte]) {
    return GAME_BYTE[gameByte]!;
  }
  if (detection.gameVersion !== "unknown") return detection.gameVersion;
  return bytes.length === 0x6cc00 ? "ultrasun" : "sun";
}

function readPlayTimeSeconds(bytes: Uint8Array, off: number): number {
  if (off + 4 > bytes.length) return 0;
  const hours = readU16LE(bytes, off);
  const minutes = bytes[off + 2] ?? 0;
  const seconds = bytes[off + 3] ?? 0;
  return hours * 3600 + minutes * 60 + seconds;
}

/** PKHeX SAV7 getCaught / getSeen bitfields. */
function parseDex(
  bytes: Uint8Array,
  pokeDex: number,
  maxSpecies: number
): ReturnType<typeof countDexBits> {
  const flags = pokeDex + 0x88;
  const brSize = 0x8c;
  const byteCount = Math.ceil(maxSpecies / 8);
  if (flags + brSize * 4 + byteCount > bytes.length) {
    return emptyDex(maxSpecies);
  }

  const owned = new Uint8Array(byteCount);
  const seen = new Uint8Array(byteCount);
  for (let i = 0; i < maxSpecies; i++) {
    const bd = i >> 3;
    const mask = 1 << (i & 7);
    if ((bytes[flags + bd]! & mask) !== 0) {
      owned[bd]! |= mask;
      seen[bd]! |= mask;
    }
    for (let region = 1; region <= 4; region++) {
      const at = flags + bd + region * brSize;
      if (at < bytes.length && (bytes[at]! & mask) !== 0) {
        seen[bd]! |= mask;
        break;
      }
    }
  }
  return countDexBits(owned, seen, maxSpecies, maxSpecies);
}

type PocketKind = ParsedBagItem["pocket"];

/**
 * Gen 7 Free Space pouches are u16 id + u16 qty. Unowned catalog slots use
 * high bits on the id (0xDxxx) — only clean ids with a real stack count count.
 */
function readPouch(
  bytes: Uint8Array,
  start: number,
  slots: number,
  pocket: PocketKind
): ParsedBagItem[] {
  const out: ParsedBagItem[] = [];
  for (let i = 0; i < slots; i++) {
    const off = start + i * 4;
    if (off + 4 > bytes.length) break;
    const id = readU16LE(bytes, off);
    const quantity = readU16LE(bytes, off + 2);
    if (id === 0 || id >= 0x800) continue;
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
  layout: Gen7Layout
): ParsedInventory {
  const bag: ParsedBagItem[] = [
    ...readPouch(
      bytes,
      layout.bag + layout.pouchItems,
      layout.bagSlots.items,
      "items"
    ),
    ...readPouch(
      bytes,
      layout.bag + layout.pouchKey,
      layout.bagSlots.key,
      "key"
    ),
    ...readPouch(
      bytes,
      layout.bag + layout.pouchTmhm,
      layout.bagSlots.tmhm,
      "tmhm"
    ),
    ...readPouch(
      bytes,
      layout.bag + layout.pouchMedicine,
      layout.bagSlots.medicine,
      "medicine"
    ),
    ...readPouch(
      bytes,
      layout.bag + layout.pouchBerry,
      layout.bagSlots.berry,
      "berries"
    ),
    ...readPouch(
      bytes,
      layout.bag + layout.pouchZ,
      layout.bagSlots.z,
      "items"
    ),
  ];
  if (layout.pouchRotom != null) {
    bag.push(
      ...readPouch(
        bytes,
        layout.bag + layout.pouchRotom,
        layout.bagSlots.rotom,
        "items"
      )
    );
  }
  return { bag, pc: [] };
}

/** PKHeX Misc.Stamps — 15 island-challenge bits packed above the low nibble. */
function readStampMask(bytes: Uint8Array, stampsOff: number): number {
  if (stampsOff + 4 > bytes.length) return 0;
  const word = readU32LE(bytes, stampsOff);
  return (word << 13) >>> 17;
}

function parseStoryProgress(
  bytes: Uint8Array,
  layout: Gen7Layout,
  stampMask: number
): ParsedStoryProgress {
  let hofOccupied = false;
  if (layout.hallOfFame + 4 <= bytes.length) {
    const head = readU32LE(bytes, layout.hallOfFame);
    hofOccupied = head !== 0 && head !== 0xffffffff;
  }
  const stamps = popcount15(stampMask);
  const championDefeated = hofOccupied;
  let note = "";
  if (championDefeated) {
    note = "Hall of Fame set — Champion cleared.";
  } else if (stamps > 0) {
    note = `${stamps} island challenge stamp${stamps === 1 ? "" : "s"} earned.`;
  } else {
    note = "Island challenge not started — Champion still open.";
  }
  return {
    eliteFourDefeated: championDefeated,
    championDefeated,
    note,
  };
}

function popcount15(mask: number): number {
  let n = 0;
  for (let i = 0; i < 15; i++) if ((mask >>> i) & 1) n++;
  return n;
}

function enrichAlolaMon(mon: ParsedPokemon): ParsedPokemon {
  const metId = mon.metLocationId;
  if (metId == null || metId === 0) return mon;
  const name = gen7LocationName(metId);
  if (!name || mon.metLocation === name) return mon;
  return { ...mon, metLocation: name };
}

export function parseGen7(
  bytes: Uint8Array,
  detection: DetectionResult
): ParsedSave {
  const provisional =
    detection.gameVersion === "unknown"
      ? bytes.length === 0x6cc00
        ? "ultrasun"
        : "sun"
      : detection.gameVersion;
  const layout = layoutFor(provisional, bytes.length);
  const game = resolveGame(bytes, detection, layout);

  const status = layout.myStatus;
  const tid = status + 2 <= bytes.length ? readU16LE(bytes, status) : 0;
  const sid = status + 4 <= bytes.length ? readU16LE(bytes, status + 2) : 0;
  const genderByte = bytes[status + 5] ?? 0;
  const name =
    status + 0x38 + 24 <= bytes.length
      ? decodeUtf16z(bytes, status + 0x38, 12)
      : "";
  const money =
    layout.money + 4 <= bytes.length ? readU32LE(bytes, layout.money) : 0;
  const stampMask = readStampMask(bytes, layout.stamps);

  const mapId =
    layout.situation + 2 <= bytes.length
      ? readU16LE(bytes, layout.situation)
      : 0;
  const x = readF32LE(bytes, layout.situation + 0x08);
  // PKHeX Situation Y (horizontal) is Map-Dex Z.
  const y = readF32LE(bytes, layout.situation + 0x10);
  const { locationId, name: location } = gen7SituationLocation(mapId, x, y);

  const partyCountOff = layout.party + 6 * PK6_PARTY;
  const partyCount =
    partyCountOff < bytes.length
      ? Math.min(6, bytes[partyCountOff] ?? 0)
      : 0;

  const partySlots: Array<ParsedPokemon | null> = [];
  const slotsToRead = partyCount > 0 ? partyCount : 6;
  for (let i = 0; i < slotsToRead; i++) {
    const base = layout.party + i * PK6_PARTY;
    if (base + PK6_PARTY > bytes.length) break;
    const mon = parsePk6(
      bytes.subarray(base, base + PK6_PARTY),
      i,
      layout.maxSpecies
    );
    if (mon) partySlots.push(enrichAlolaMon(mon));
  }

  const boxes = makeBoxes(layout.boxCount, 30);
  for (let i = 0; i < layout.boxCount * 30; i++) {
    const off = layout.box + i * PK6_STORED;
    if (off + PK6_STORED > bytes.length) break;
    const mon = parsePk6(
      bytes.subarray(off, off + PK6_STORED),
      i % 30,
      layout.maxSpecies
    );
    if (mon) {
      boxes[Math.floor(i / 30)]!.pokemon[i % 30] = enrichAlolaMon(mon);
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
    dex: parseDex(bytes, layout.pokeDex, layout.maxSpecies),
    badges: stampMask
      ? badgesFromBitmask(game, stampMask)
      : emptyBadges(game),
    playTimeSeconds: readPlayTimeSeconds(bytes, layout.playTime),
    location,
    locationMapId: locationId || mapId || null,
    inventory: parseInventory(bytes, layout),
    progress: parseStoryProgress(bytes, layout, stampMask),
  });
}
