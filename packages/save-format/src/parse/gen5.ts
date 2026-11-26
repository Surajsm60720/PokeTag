/**
 * Generation V save parser (BW / B2W2).
 *
 * Dual partitions (BW 0x24000, B2W2 0x26000) with per-block CRC footers.
 * PK5 box size matches PK4 (136); party slots are 220 bytes.
 */

import type { DetectionResult, GameVersion } from "../types.js";
import { badgesFromBitmask } from "./badges.js";
import { itemName } from "./items.js";
import { parsePk5Box } from "./pkm.js";
import type {
  ParsedBagItem,
  ParsedInventory,
  ParsedPokemon,
  ParsedSave,
} from "./types.js";
import { unovaLocationName, unovaMapName } from "./unova-maps.js";
import {
  baseSave,
  compactParty,
  countDexBits,
  makeBoxes,
  readU16LE,
  readU32LE,
} from "./util.js";

const STORED = 136;
const PARTY = 220;
const BOX_SLOTS = 30;
const BOX_COUNT = 24;
/** 0x10 pad after each box's 0xFF0 of Pokémon data. */
const BOX_PAD = 0x10;

interface Gen5Layout {
  partition: number;
  trainerName: number;
  tid: number;
  gender: number;
  playHours: number;
  money: number;
  badges: number;
  partyCount: number;
  party: number;
  inventory: number;
  /** Absolute offset of the Zukan block (magic + flags). */
  dex: number;
  position: number;
  adventure: number;
  boxStart: number;
  boxCount: number;
}

const BW: Gen5Layout = {
  partition: 0x24000,
  trainerName: 0x19404,
  tid: 0x19414,
  gender: 0x19421,
  playHours: 0x19424,
  money: 0x21200,
  badges: 0x21204,
  partyCount: 0x18e04,
  party: 0x18e08,
  inventory: 0x18400,
  dex: 0x21600,
  position: 0x19500,
  adventure: 0x1d900,
  boxStart: 0x400,
  boxCount: BOX_COUNT,
};

const B2W2: Gen5Layout = {
  partition: 0x26000,
  trainerName: 0x19404,
  tid: 0x19414,
  gender: 0x19421,
  playHours: 0x19424,
  money: 0x21100,
  badges: 0x21104,
  partyCount: 0x18e04,
  party: 0x18e08,
  inventory: 0x18400,
  dex: 0x21400,
  position: 0x19500,
  adventure: 0x1d900,
  boxStart: 0x400,
  boxCount: BOX_COUNT,
};

/** PKHeX GameVersion byte at Trainer Data + 0x1F. */
const GAME_BYTE: Record<number, GameVersion> = {
  20: "white",
  21: "black",
  22: "white2",
  23: "black2",
};

type BagSpan = [number, number, ParsedBagItem["pocket"]];

/** Pouch starts relative to the Inventory block (PKHeX PlayerBag5). */
const BAG_POUCHES: BagSpan[] = [
  [0x000, 0x4d8, "items"],
  [0x4d8, 0x624, "key"],
  [0x624, 0x7d8, "tmhm"],
  [0x7d8, 0x898, "medicine"],
  [0x898, 0x9c0, "berries"],
];

function layoutFor(game: GameVersion): Gen5Layout {
  return game === "black2" || game === "white2" ? B2W2 : BW;
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

function trainerLooksLive(data: Uint8Array, layout: Gen5Layout): boolean {
  if (layout.trainerName + 16 > data.length) return false;
  const name = decodeUtf16z(data, layout.trainerName, 8);
  const tid = readU16LE(data, layout.tid);
  if (!name || tid === 0xffff) return false;
  const money = readU32LE(data, layout.money);
  return money !== 0xffffffff;
}

function pickActivePartition(
  save: Uint8Array,
  layout: Gen5Layout
): Uint8Array {
  const size = Math.min(layout.partition, save.length);
  const primary = save.subarray(0, size);
  const backup =
    save.length >= layout.partition + 0x100
      ? save.subarray(
          layout.partition,
          Math.min(save.length, layout.partition * 2)
        )
      : null;

  const primaryOk = trainerLooksLive(primary, layout);
  const backupOk = backup ? trainerLooksLive(backup, layout) : false;
  if (primaryOk && !backupOk) return primary;
  if (backupOk && !primaryOk && backup) return backup;
  // Prefer the side with a higher adventure "seconds to start" when both look live.
  if (primaryOk && backupOk && backup) {
    const a = readU32LE(primary, layout.adventure + 0x34);
    const b = readU32LE(backup, layout.adventure + 0x34);
    return b > a ? backup : primary;
  }
  return primaryOk ? primary : backupOk && backup ? backup : primary;
}

function readPouch(
  data: Uint8Array,
  base: number,
  start: number,
  end: number,
  pocket: ParsedBagItem["pocket"]
): ParsedBagItem[] {
  const out: ParsedBagItem[] = [];
  const absStart = base + start;
  const absEnd = Math.min(base + end, data.length);
  for (let off = absStart; off + 4 <= absEnd; off += 4) {
    const id = readU16LE(data, off);
    const quantity = readU16LE(data, off + 2);
    if (id === 0 || quantity === 0 || quantity > 65000) continue;
    out.push({
      id,
      name: itemName(id, 5) || `Item #${id}`,
      quantity,
      pocket,
    });
  }
  return out;
}

function parseInventory(data: Uint8Array, base: number): ParsedInventory {
  return {
    bag: BAG_POUCHES.flatMap(([start, end, pocket]) =>
      readPouch(data, base, start, end, pocket)
    ),
    pc: [],
  };
}

function parseDex(data: Uint8Array, dexOff: number) {
  // Zukan5: u32 magic, u32 packed, caught @ +0x8 (0x54 bytes), seen @ +0x5C.
  const caughtOff = dexOff + 0x8;
  const seenOff = dexOff + 0x5c;
  if (seenOff + 0x54 > data.length) {
    return countDexBits(new Uint8Array(0), new Uint8Array(0), 649);
  }
  const owned = data.subarray(caughtOff, caughtOff + 0x54);
  const seen = new Uint8Array(0x54);
  // Four gender/shiny seen regions; OR them together.
  for (let region = 0; region < 4; region++) {
    const src = seenOff + region * 0x54;
    for (let i = 0; i < 0x54 && src + i < data.length; i++) {
      seen[i] = (seen[i] ?? 0) | (data[src + i] ?? 0) | (owned[i] ?? 0);
    }
  }
  return countDexBits(owned, seen, 649, 649);
}

function boxOffset(layout: Gen5Layout, box: number): number {
  return layout.boxStart + box * (STORED * BOX_SLOTS + BOX_PAD);
}

function resolveGame(
  data: Uint8Array,
  detection: DetectionResult,
  layoutHint: Gen5Layout
): GameVersion {
  const codeOff = 0x1941f;
  if (codeOff < data.length) {
    const fromByte = GAME_BYTE[data[codeOff] ?? -1];
    if (fromByte) return fromByte;
  }
  if (
    detection.gameVersion === "black" ||
    detection.gameVersion === "white" ||
    detection.gameVersion === "black2" ||
    detection.gameVersion === "white2"
  ) {
    return detection.gameVersion;
  }
  return layoutHint === B2W2 ? "white2" : "black";
}

export function peekGen5GameByte(data: Uint8Array): GameVersion | null {
  for (const layout of [BW, B2W2]) {
    const part = pickActivePartition(data, layout);
    if (!trainerLooksLive(part, layout)) continue;
    const code = part[0x1941f];
    if (code != null && GAME_BYTE[code]) return GAME_BYTE[code]!;
  }
  return null;
}

export function parseGen5(
  bytes: Uint8Array,
  detection: DetectionResult
): ParsedSave {
  if (bytes.length < 0x20000) {
    throw new Error("Gen 5 save too small");
  }

  const hinted =
    detection.gameVersion === "unknown" ? "black" : detection.gameVersion;
  let layout = layoutFor(hinted);
  let data = pickActivePartition(bytes, layout);
  if (!trainerLooksLive(data, layout)) {
    const alt = layout === BW ? B2W2 : BW;
    const altData = pickActivePartition(bytes, alt);
    if (trainerLooksLive(altData, alt)) {
      layout = alt;
      data = altData;
    }
  }

  const game = resolveGame(data, detection, layout);
  layout = layoutFor(game);
  data = pickActivePartition(bytes, layout);

  const name = decodeUtf16z(data, layout.trainerName, 8);
  const tid = readU16LE(data, layout.tid);
  const sid = readU16LE(data, layout.tid + 2);
  const money = readU32LE(data, layout.money);
  const badgeMask = data[layout.badges] ?? 0;
  const genderByte = data[layout.gender] ?? 0;
  const hours = readU16LE(data, layout.playHours);
  const minutes = data[layout.playHours + 2] ?? 0;
  const seconds = data[layout.playHours + 3] ?? 0;
  const partyCount = Math.min(6, data[layout.partyCount] ?? 0);

  const partySlots: Array<ParsedPokemon | null> = [];
  for (let i = 0; i < partyCount; i++) {
    const base = layout.party + i * PARTY;
    if (base + PARTY > data.length) break;
    // Pass the full party structure so battle stats (HP) can decrypt.
    const mon = parsePk5Box(data.subarray(base, base + PARTY), i);
    if (mon) partySlots.push(mon);
  }

  const boxes = makeBoxes(layout.boxCount, BOX_SLOTS);
  for (let box = 0; box < layout.boxCount; box++) {
    const origin = boxOffset(layout, box);
    for (let slot = 0; slot < BOX_SLOTS; slot++) {
      const off = origin + slot * STORED;
      if (off + STORED > data.length) break;
      boxes[box]!.pokemon[slot] = parsePk5Box(
        data.subarray(off, off + STORED),
        slot
      );
    }
  }

  const mapId =
    layout.position + 0x80 + 4 <= data.length
      ? readU32LE(data, layout.position + 0x80) & 0xffff
      : 0;
  // Overworld State (0x1E200) mirrors the map header id at +0x10 and often
  // stores the map-name table index at +0x18 (reliable on BW; prefer header table).
  const overworld = 0x1e200;
  const nameIndex =
    overworld + 0x1a <= data.length ? data[overworld + 0x18] ?? 0 : 0;
  let location = mapId ? unovaMapName(mapId) : "";
  if ((!location || location.startsWith("Map ")) && nameIndex > 0) {
    const fromIndex = unovaLocationName(nameIndex);
    if (fromIndex && !fromIndex.startsWith("Location #")) {
      location = fromIndex;
    }
  }
  const secondsToFame =
    layout.adventure + 0x40 <= data.length
      ? readU32LE(data, layout.adventure + 0x3c)
      : 0;
  const champion = secondsToFame > 0 && secondsToFame < 0xffffffff;

  return baseSave(game, {
    trainer: {
      name,
      trainerId: tid,
      secretId: sid,
      money: money === 0xffffffff ? 0 : money,
      gender: genderByte === 1 ? "F" : "M",
    },
    party: compactParty(partySlots),
    boxes,
    dex: parseDex(data, layout.dex),
    badges: badgesFromBitmask(game, badgeMask, 8),
    playTimeSeconds: hours * 3600 + minutes * 60 + seconds,
    location,
    locationMapId: mapId || null,
    inventory: parseInventory(data, layout.inventory),
    progress: {
      eliteFourDefeated: champion,
      championDefeated: champion,
      note: champion
        ? "Hall of Fame time is set — Champion and Elite Four cleared."
        : "No Hall of Fame entry yet — Champion and Elite Four still open.",
    },
  });
}
