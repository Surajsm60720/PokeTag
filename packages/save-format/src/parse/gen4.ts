/**
 * Generation IV save parser (DP / Pt / HGSS).
 *
 * Each partition is 0x40000. The general and storage blocks have a 0x10-byte
 * footer; CRC-16-CCITT covers everything before that footer, and the checksum
 * is the last two bytes. HeartGold and SoulSilver leave a 0xD8 gap between
 * the general block (0xF628) and the storage block (0xF700).
 */

import type { DetectionResult, GameVersion } from "../types.js";
import { badgesFromBitmask } from "./badges.js";
import { decodeGen4String } from "./charset.js";
import { hgssMapName } from "./hgss-maps.js";
import { itemName } from "./items.js";
import { crc16Ccitt, parsePk4Box } from "./pkm.js";
import type { ParsedBagItem, ParsedInventory, ParsedPokemon, ParsedSave } from "./types.js";
import {
  baseSave,
  compactParty,
  countDexBits,
  emptyDex,
  makeBoxes,
  readU16LE,
  readU32LE,
} from "./util.js";

const PARTITION = 0x40000;
const FOOTER = 0x10;
const STORED = 136;
const PARTY = 236;
const BOX_STRIDE = 0x1000;

interface BagSpans {
  items: [number, number];
  key: [number, number];
  tmhm: [number, number];
  medicine: [number, number];
  berries: [number, number];
  balls: [number, number];
}

interface Gen4Layout {
  id: "diamond" | "platinum" | "hgss";
  generalSize: number;
  storageStart: number;
  storageSize: number;
  trainer: number;
  party: number;
  /** First boxed Pokémon inside the storage block. */
  boxOrigin: number;
  /** 0 = packed slots. HGSS pads every box to 0x1000. */
  boxStride: number;
  boxCount: number;
  slotsPerBox: number;
  bag: BagSpans | null;
  dexOwned: number | null;
  dexSeen: number | null;
  map: number | null;
  kantoBadges: number | null;
}

const DIAMOND: Gen4Layout = {
  id: "diamond",
  generalSize: 0xc100,
  storageStart: 0xc100,
  storageSize: 0x121e0,
  trainer: 0x64,
  party: 0x98,
  boxOrigin: 4,
  boxStride: 0,
  boxCount: 18,
  slotsPerBox: 30,
  bag: null,
  dexOwned: null,
  dexSeen: null,
  map: null,
  kantoBadges: null,
};

const PLATINUM: Gen4Layout = {
  id: "platinum",
  generalSize: 0xcf2c,
  storageStart: 0xcf2c,
  storageSize: 0x121e4,
  trainer: 0x68,
  party: 0xa0,
  boxOrigin: 4,
  boxStride: 0,
  boxCount: 18,
  slotsPerBox: 30,
  bag: null,
  dexOwned: null,
  dexSeen: null,
  map: null,
  kantoBadges: null,
};

const HGSS: Gen4Layout = {
  id: "hgss",
  generalSize: 0xf628,
  storageStart: 0xf700,
  storageSize: 0x12310,
  trainer: 0x64,
  party: 0x98,
  boxOrigin: 0,
  boxStride: BOX_STRIDE,
  boxCount: 18,
  slotsPerBox: 30,
  bag: {
    items: [0x644, 0x8d8],
    key: [0x8d8, 0x9a0],
    tmhm: [0x9a0, 0xb34],
    medicine: [0xb64, 0xc04],
    berries: [0xc04, 0xd04],
    balls: [0xd04, 0xd64],
  },
  dexOwned: 0x12bc,
  dexSeen: 0x12fc,
  map: 0x1234,
  kantoBadges: 0x83,
};

function layoutsFor(game: GameVersion): Gen4Layout[] {
  const preferred =
    game === "heartgold" || game === "soulsilver"
      ? HGSS
      : game === "platinum"
        ? PLATINUM
        : DIAMOND;
  return [preferred, HGSS, PLATINUM, DIAMOND].filter(
    (layout, index, all) => all.indexOf(layout) === index
  );
}

const MAGIC_INTL = 0x20060623;
const MAGIC_KOREAN = 0x20070903;

function blockValid(block: Uint8Array): boolean {
  if (block.length <= FOOTER) return false;
  const stored = readU16LE(block, block.length - 2);
  return crc16Ccitt(block.subarray(0, block.length - FOOTER)) === stored;
}

/**
 * A block the game would accept, or one whose footer still identifies the
 * layout. Cheat devices and some editors rewrite the body and leave a stale
 * CRC; the size and magic fields still name the block.
 */
function blockUsable(block: Uint8Array): boolean {
  if (blockValid(block)) return true;
  const magic = readU32LE(block, block.length - 8);
  const size = readU32LE(block, block.length - 12);
  return (magic === MAGIC_INTL || magic === MAGIC_KOREAN) && size === block.length;
}

function saveCount(block: Uint8Array): number {
  return readU32LE(block, block.length - 0x10);
}

function sliceBlock(
  save: Uint8Array,
  offset: number,
  length: number
): Uint8Array | null {
  if (offset < 0 || save.length < offset + length) return null;
  return save.subarray(offset, offset + length);
}

/** Newer copy wins. A copy with a bad checksum is ignored. */
function pickBlock(
  save: Uint8Array,
  start: number,
  length: number
): Uint8Array | null {
  const primary = sliceBlock(save, start, length);
  const backup = sliceBlock(save, start + PARTITION, length);
  const primaryOk = primary ? blockUsable(primary) : false;
  const backupOk = backup ? blockUsable(backup) : false;
  if (!primaryOk && !backupOk) return null;
  if (primaryOk && backupOk && primary && backup) {
    const primaryValid = blockValid(primary);
    const backupValid = blockValid(backup);
    if (primaryValid !== backupValid) return primaryValid ? primary : backup;
    return saveCount(primary) >= saveCount(backup) ? primary : backup;
  }
  return primaryOk ? primary : backup;
}

function readPouch(
  general: Uint8Array,
  start: number,
  end: number,
  pocket: ParsedBagItem["pocket"]
): ParsedBagItem[] {
  const out: ParsedBagItem[] = [];
  for (let off = start; off + 4 <= end && off + 4 <= general.length; off += 4) {
    const id = readU16LE(general, off);
    const quantity = readU16LE(general, off + 2);
    if (id === 0 || quantity === 0 || quantity > 65000) continue;
    out.push({
      id,
      name: itemName(id, 4) || `Item #${id}`,
      quantity,
      pocket,
    });
  }
  return out;
}

function parseInventory(general: Uint8Array, bag: BagSpans): ParsedInventory {
  return {
    bag: [
      ...readPouch(general, bag.items[0], bag.items[1], "items"),
      ...readPouch(general, bag.key[0], bag.key[1], "key"),
      ...readPouch(general, bag.tmhm[0], bag.tmhm[1], "tmhm"),
      ...readPouch(general, bag.medicine[0], bag.medicine[1], "medicine"),
      ...readPouch(general, bag.berries[0], bag.berries[1], "berries"),
      ...readPouch(general, bag.balls[0], bag.balls[1], "balls"),
    ],
    pc: [],
  };
}

function parseDex(general: Uint8Array, layout: Gen4Layout) {
  if (layout.dexOwned == null || layout.dexSeen == null) return emptyDex(493);
  const owned = general.subarray(layout.dexOwned, layout.dexOwned + 62);
  const seen = new Uint8Array(62);
  const sources = [layout.dexSeen, 0x133c, 0x137c];
  for (const src of sources) {
    for (let i = 0; i < 62 && src + i < general.length; i++) {
      seen[i] = (seen[i] ?? 0) | (general[src + i] ?? 0) | (owned[i] ?? 0);
    }
  }
  return countDexBits(owned, seen, 493, 493);
}

function gameFromLayout(
  layout: Gen4Layout,
  detection: DetectionResult,
  general: Uint8Array
): GameVersion {
  if (layout.id !== "hgss") {
    return layout.id === "platinum" ? "platinum" : detection.gameVersion === "pearl" ? "pearl" : "diamond";
  }
  if (detection.gameVersion === "heartgold" || detection.gameVersion === "soulsilver") {
    return detection.gameVersion;
  }
  // HG/SS share a layout. The ROM code sits 0x1C bytes into the trainer block.
  const code = general[layout.trainer + 0x1c] ?? 0;
  if (code === 8) return "soulsilver";
  return "heartgold";
}

export function parseGen4(
  bytes: Uint8Array,
  detection: DetectionResult
): ParsedSave {
  const hinted =
    detection.gameVersion === "unknown" ? "diamond" : detection.gameVersion;
  let layout: Gen4Layout | null = null;
  let general: Uint8Array | null = null;
  for (const candidate of layoutsFor(hinted)) {
    const block = pickBlock(bytes, 0, candidate.generalSize);
    if (!block) continue;
    layout = candidate;
    general = block;
    break;
  }
  if (!layout || !general) {
    throw new Error("Gen 4 checksum validation failed for general blocks");
  }

  const storage = pickBlock(bytes, layout.storageStart, layout.storageSize);
  const game = gameFromLayout(layout, detection, general);
  const trainer = layout.trainer;
  const name = decodeGen4String(general, trainer, 8);
  const tid = readU16LE(general, trainer + 0x10);
  const sid = readU16LE(general, trainer + 0x12);
  const money = readU32LE(general, trainer + 0x14);
  const genderByte = general[trainer + 0x18] ?? 0;
  const johto = general[trainer + 0x1a] ?? 0;
  const kanto =
    layout.kantoBadges != null ? (general[layout.kantoBadges] ?? 0) : 0;
  const badgeMask = layout.kantoBadges != null ? (kanto << 8) | johto : johto;
  const hours = readU16LE(general, trainer + 0x22);
  const minutes = general[trainer + 0x24] ?? 0;
  const seconds = general[trainer + 0x25] ?? 0;
  const progress = general[trainer + 0x1d] ?? 0;
  const secondsToFame = readU32LE(general, 0x3c);
  const champion = (progress & 1) === 1 || secondsToFame > 0;
  const partyCount = Math.min(6, general[layout.party - 4] ?? 0);

  const partySlots: Array<ParsedPokemon | null> = [];
  for (let i = 0; i < partyCount; i++) {
    const base = layout.party + i * PARTY;
    if (base + PARTY > general.length) break;
    const mon = parsePk4Box(general.subarray(base, base + PARTY), i);
    if (mon) partySlots.push(mon);
  }

  const boxes = makeBoxes(layout.boxCount, layout.slotsPerBox);
  if (storage) {
    for (let box = 0; box < layout.boxCount; box++) {
      const nameOff =
        layout.id === "hgss" ? 0x12008 + box * 40 : -1;
      if (nameOff >= 0 && nameOff + 16 <= storage.length) {
        const label = decodeGen4String(storage, nameOff, 8);
        if (label) boxes[box]!.name = label;
      }
      for (let slot = 0; slot < layout.slotsPerBox; slot++) {
        const off =
          layout.boxOrigin +
          (layout.boxStride
            ? box * layout.boxStride + slot * STORED
            : (box * layout.slotsPerBox + slot) * STORED);
        if (off + STORED > storage.length - FOOTER) break;
        boxes[box]!.pokemon[slot] = parsePk4Box(
          storage.subarray(off, off + STORED),
          slot
        );
      }
    }
  }

  const mapId =
    layout.map != null && layout.map + 2 <= general.length
      ? readU16LE(general, layout.map)
      : 0;

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
    dex: parseDex(general, layout),
    badges: badgesFromBitmask(
      game,
      badgeMask,
      layout.kantoBadges != null ? 16 : 8
    ),
    playTimeSeconds: hours * 3600 + minutes * 60 + seconds,
    location: layout.id === "hgss" ? hgssMapName(mapId) : mapId ? `Map ${mapId}` : "",
    locationMapId: mapId || null,
    inventory: layout.bag ? parseInventory(general, layout.bag) : { bag: [], pc: [] },
    progress: {
      eliteFourDefeated: champion ? true : null,
      championDefeated: champion,
      note: champion
        ? "Game clear flag or Hall of Fame time is set."
        : "No game-clear flag yet.",
    },
  });
}
