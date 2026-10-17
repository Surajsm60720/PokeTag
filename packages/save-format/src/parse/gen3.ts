/**
 * Generation III save parser (RS / Emerald / FRLG).
 * Dual 14-section banks; signature 0x08012025; PK3 decrypt.
 * Layouts: Bulbapedia Save data structure (Generation III).
 */

import type { DetectionResult, GameVersion } from "../types.js";
import { badgesFromBitmask } from "./badges.js";
import { decodeGen3String, encodeGen3String } from "./charset.js";
import { itemName } from "./items.js";
import { locationName } from "./locations.js";
import { parsePk3 } from "./pkm.js";
import type {
  ParsedBagItem,
  ParsedBox,
  ParsedInventory,
  ParsedPokemon,
  ParsedSave,
  ParsedStoryProgress,
} from "./types.js";
import {
  baseSave,
  compactParty,
  countDexBits,
  emptyInventory,
  makeBoxes,
  readU16LE,
  readU32LE,
  writeU16LE,
  writeU32LE,
} from "./util.js";

const SECTION_SIZE = 0x1000;
const SECTION_COUNT = 14;
const BANK_SIZE = SECTION_SIZE * SECTION_COUNT; // 0xE000
const SIGNATURE = 0x08012025;
const FOOTER_ID = 0xff4;
const FOOTER_CHK = 0xff6;
const FOOTER_SIG = 0xff8;
const FOOTER_IDX = 0xffc;

/** Bytes included in section checksum by section ID. */
const SECTION_CHK_SIZE = [
  3884, 3968, 3968, 3968, 3848, 3968, 3968, 3968, 3968, 3968, 3968, 3968, 3968,
  2000,
] as const;

type Gen3Variant = "rs" | "e" | "frlg";

function variantFor(game: GameVersion): Gen3Variant {
  if (game === "firered" || game === "leafgreen") return "frlg";
  if (game === "emerald") return "e";
  return "rs";
}

interface PocketDef {
  offset: number;
  count: number;
  pocket: ParsedBagItem["pocket"];
  /** XOR quantity with security key (bag pockets yes; PC no). */
  xorQty: boolean;
}

interface SectionOffsets {
  teamSize: number;
  team: number;
  money: number;
  securityKey: number | null;
  /** Badge flag byte offset within section 2 (bitmask of 8 gym badges). */
  badgesSection2: number;
  dexOwned: number;
  dexSeen: number;
  regionalTotal: number;
  /** SaveBlock1 map group / map number (section 1). */
  mapGroup: number;
  mapNum: number;
  pockets: PocketDef[];
  /** Approximate flag offsets in section 2 for E4 / Champion (best-effort). */
  flagEliteFour?: number;
  flagChampion?: number;
}

function offsets(v: Gen3Variant): SectionOffsets {
  if (v === "frlg") {
    return {
      teamSize: 0x0034,
      team: 0x0038,
      money: 0x0290,
      securityKey: 0x0af8,
      badgesSection2: 0xee0,
      dexOwned: 0x0028,
      dexSeen: 0x005c,
      regionalTotal: 151,
      mapGroup: 0x0004,
      mapNum: 0x0005,
      pockets: [
        { offset: 0x0298, count: 30, pocket: "pc", xorQty: false },
        { offset: 0x0310, count: 42, pocket: "items", xorQty: true },
        { offset: 0x03b8, count: 30, pocket: "key", xorQty: true },
        { offset: 0x0430, count: 13, pocket: "balls", xorQty: true },
        { offset: 0x0464, count: 58, pocket: "tmhm", xorQty: true },
        { offset: 0x054c, count: 43, pocket: "berries", xorQty: true },
      ],
      // Approximate — FRLG badge/story flags differ; leave null unless confident.
    };
  }
  if (v === "e") {
    return {
      teamSize: 0x0234,
      team: 0x0238,
      money: 0x0490,
      securityKey: 0x00ac,
      badgesSection2: 0x10c4,
      dexOwned: 0x0028,
      dexSeen: 0x005c,
      regionalTotal: 202,
      mapGroup: 0x0004,
      mapNum: 0x0005,
      pockets: [
        { offset: 0x0498, count: 50, pocket: "pc", xorQty: false },
        { offset: 0x0560, count: 30, pocket: "items", xorQty: true },
        { offset: 0x05d8, count: 30, pocket: "key", xorQty: true },
        { offset: 0x0650, count: 16, pocket: "balls", xorQty: true },
        { offset: 0x0690, count: 64, pocket: "tmhm", xorQty: true },
        { offset: 0x0790, count: 46, pocket: "berries", xorQty: true },
      ],
      // Emerald flag region in SaveBlock1/section 2 — approximate champion/E4.
      // Documented as best-effort; may be null when bit looks unset/unreliable.
      flagEliteFour: 0x10c5,
      flagChampion: 0x10c6,
    };
  }
  // Ruby / Sapphire
  return {
    teamSize: 0x0234,
    team: 0x0238,
    money: 0x0490,
    securityKey: null,
    badgesSection2: 0x0c00,
    dexOwned: 0x0028,
    dexSeen: 0x005c,
    regionalTotal: 202,
    mapGroup: 0x0004,
    mapNum: 0x0005,
    pockets: [
      { offset: 0x0498, count: 50, pocket: "pc", xorQty: false },
      { offset: 0x0560, count: 20, pocket: "items", xorQty: false },
      { offset: 0x05b0, count: 20, pocket: "key", xorQty: false },
      { offset: 0x0600, count: 16, pocket: "balls", xorQty: false },
      { offset: 0x0640, count: 64, pocket: "tmhm", xorQty: false },
      { offset: 0x0740, count: 46, pocket: "berries", xorQty: false },
    ],
  };
}

export function gen3SectionChecksum(data: Uint8Array, byteCount: number): number {
  let sum = 0;
  const words = byteCount >> 2;
  for (let i = 0; i < words; i++) {
    sum = (sum + readU32LE(data, i * 4)) >>> 0;
  }
  return ((sum >>> 16) + (sum & 0xffff)) & 0xffff;
}

interface ParsedSection {
  id: number;
  checksum: number;
  saveIndex: number;
  data: Uint8Array;
  valid: boolean;
}

function readSection(bank: Uint8Array, index: number): ParsedSection {
  const base = index * SECTION_SIZE;
  const section = bank.subarray(base, base + SECTION_SIZE);
  const id = readU16LE(section, FOOTER_ID);
  const checksum = readU16LE(section, FOOTER_CHK);
  const sig = readU32LE(section, FOOTER_SIG);
  const saveIndex = readU32LE(section, FOOTER_IDX);
  const data = section.subarray(0, 3968);
  if (sig !== SIGNATURE || id > 13) {
    return { id, checksum, saveIndex, data, valid: false };
  }
  const expect = gen3SectionChecksum(data, SECTION_CHK_SIZE[id]!);
  return { id, checksum, saveIndex, data, valid: expect === checksum };
}

function collectBank(
  save: Uint8Array,
  bankOffset: number
): { sections: Map<number, ParsedSection>; saveIndex: number; ok: boolean } {
  const bank = save.subarray(bankOffset, bankOffset + BANK_SIZE);
  const sections = new Map<number, ParsedSection>();
  let saveIndex = 0;
  let ok = true;
  for (let i = 0; i < SECTION_COUNT; i++) {
    const sec = readSection(bank, i);
    if (!sec.valid) ok = false;
    sections.set(sec.id, sec);
    saveIndex = sec.saveIndex;
  }
  for (let id = 0; id < SECTION_COUNT; id++) {
    if (!sections.has(id)) ok = false;
  }
  return { sections, saveIndex, ok };
}

function pickActiveBank(save: Uint8Array): {
  sections: Map<number, ParsedSection>;
  saveIndex: number;
} {
  if (save.length < BANK_SIZE) {
    throw new Error("Gen 3 save too small for dual-bank layout");
  }
  const a = collectBank(save, 0);
  const b =
    save.length >= BANK_SIZE * 2
      ? collectBank(save, BANK_SIZE)
      : { sections: new Map(), saveIndex: -1, ok: false };

  if (a.ok && b.ok) {
    return a.saveIndex > b.saveIndex
      ? { sections: a.sections, saveIndex: a.saveIndex }
      : { sections: b.sections, saveIndex: b.saveIndex };
  }
  if (a.ok) return { sections: a.sections, saveIndex: a.saveIndex };
  if (b.ok) return { sections: b.sections, saveIndex: b.saveIndex };
  throw new Error("Gen 3 checksum validation failed for both save banks");
}

function sectionData(
  sections: Map<number, ParsedSection>,
  id: number
): Uint8Array {
  const s = sections.get(id);
  if (!s) throw new Error(`Gen 3 missing section ${id}`);
  return s.data;
}

function readBadgeMask(sec2: Uint8Array, off: number): number {
  if (off + 1 > sec2.length) return 0;
  return sec2[off]!;
}

function parseInventory(
  s1: Uint8Array,
  pockets: PocketDef[],
  securityKey: number
): ParsedInventory {
  const bag: ParsedBagItem[] = [];
  const pc: ParsedBagItem[] = [];
  for (const pocket of pockets) {
    for (let i = 0; i < pocket.count; i++) {
      const off = pocket.offset + i * 4;
      if (off + 4 > s1.length) break;
      const id = readU16LE(s1, off);
      let qty = readU16LE(s1, off + 2);
      if (id === 0) continue;
      if (pocket.xorQty && securityKey) {
        qty = (qty ^ (securityKey & 0xffff)) & 0xffff;
      }
      if (qty === 0 || qty > 999) continue;
      const entry: ParsedBagItem = {
        id,
        name: itemName(id) || `Item #${id}`,
        quantity: qty,
        pocket: pocket.pocket,
      };
      if (pocket.pocket === "pc") pc.push(entry);
      else bag.push(entry);
    }
  }
  return { bag, pc };
}

function parseStoryProgress(
  s2: Uint8Array,
  off: SectionOffsets
): ParsedStoryProgress {
  // Approximate flag bytes — Gen 3 story flags are bitfields; we only set
  // booleans when a dedicated byte looks like a clear yes (non-zero low bit).
  // Otherwise null + note. Do not invent completion from badge counts alone.
  let eliteFourDefeated: boolean | null = null;
  let championDefeated: boolean | null = null;
  const notes: string[] = [
    "E4/Champion flags are approximate Gen 3 section-2 probes; treat as best-effort.",
  ];
  if (off.flagEliteFour != null && off.flagEliteFour < s2.length) {
    const b = s2[off.flagEliteFour]!;
    // Only claim true if bit looks set; never false with confidence.
    if (b & 0x01) eliteFourDefeated = true;
    else eliteFourDefeated = null;
  }
  if (off.flagChampion != null && off.flagChampion < s2.length) {
    const b = s2[off.flagChampion]!;
    if (b & 0x01) championDefeated = true;
    else championDefeated = null;
  }
  if (eliteFourDefeated == null && championDefeated == null) {
    notes.push("No confident E4/Champion flag bits found.");
  }
  return {
    eliteFourDefeated,
    championDefeated,
    note: notes.join(" "),
  };
}

function parsePcBoxes(
  sections: Map<number, ParsedSection>,
  gameVersion: string,
  trainerOtId: number
): ParsedBox[] {
  const parts: Uint8Array[] = [];
  for (let id = 5; id <= 13; id++) {
    const d = sectionData(sections, id);
    const len = id === 13 ? 2000 : 3968;
    parts.push(d.subarray(0, len));
  }
  let total = 0;
  for (const p of parts) total += p.length;
  const pc = new Uint8Array(total);
  let o = 0;
  for (const p of parts) {
    pc.set(p, o);
    o += p.length;
  }

  const boxes = makeBoxes(14, 30);
  const namesOff = 0x8344;
  for (let b = 0; b < 14; b++) {
    if (namesOff + b * 9 + 9 <= pc.length) {
      boxes[b]!.name =
        decodeGen3String(pc.subarray(namesOff + b * 9, namesOff + b * 9 + 9)) ||
        `Box ${b + 1}`;
    }
  }

  const listOff = 4;
  for (let i = 0; i < 420; i++) {
    const off = listOff + i * 80;
    if (off + 80 > pc.length) break;
    const mon = parsePk3(pc.subarray(off, off + 80), i % 30, {
      gameVersion,
      trainerOtId,
    });
    const box = Math.floor(i / 30);
    const slot = i % 30;
    boxes[box]!.pokemon[slot] = mon;
  }
  return boxes;
}

export function parseGen3(
  bytes: Uint8Array,
  detection: DetectionResult
): ParsedSave {
  const game =
    detection.gameVersion === "unknown" ? "emerald" : detection.gameVersion;
  const v = variantFor(game);
  const off = offsets(v);
  const { sections } = pickActiveBank(bytes);

  const s0 = sectionData(sections, 0);
  const s1 = sectionData(sections, 1);
  const s2 = sectionData(sections, 2);

  const name = decodeGen3String(s0.subarray(0, 7));
  const gender: "M" | "F" = s0[8] === 1 ? "F" : "M";
  const fullId = readU32LE(s0, 0x0a);
  const trainerId = fullId & 0xffff;
  const secretId = (fullId >>> 16) & 0xffff;
  const hours = readU16LE(s0, 0x0e);
  const minutes = s0[0x10] ?? 0;
  const seconds = s0[0x11] ?? 0;
  const playTimeSeconds = hours * 3600 + minutes * 60 + seconds;

  let securityKey = 0;
  if (off.securityKey != null) {
    securityKey = readU32LE(s0, off.securityKey);
  }

  let money = readU32LE(s1, off.money);
  if (off.securityKey != null) money = (money ^ securityKey) >>> 0;

  const mapGroup = s1[off.mapGroup] ?? 0;
  const mapNum = s1[off.mapNum] ?? 0;
  const location = locationName(game, mapGroup, mapNum);
  const locationMapId = (mapGroup << 8) | mapNum;

  const inventory =
    off.pockets.length > 0
      ? parseInventory(s1, off.pockets, securityKey)
      : emptyInventory();
  const progress = parseStoryProgress(s2, off);

  const teamSize =
    v === "frlg" ? s1[off.teamSize]! : readU32LE(s1, off.teamSize);
  const partySlots: Array<ParsedPokemon | null> = [];
  const count = Math.min(6, teamSize >>> 0);
  for (let i = 0; i < count; i++) {
    const base = off.team + i * 100;
    const mon = parsePk3(s1.subarray(base, base + 100), i, {
      gameVersion: game,
      trainerOtId: fullId,
    });
    if (mon) partySlots.push(mon);
  }

  const badgeMask = readBadgeMask(s2, off.badgesSection2);
  const badges = badgesFromBitmask(game, badgeMask, 8);

  const owned = s0.subarray(off.dexOwned, off.dexOwned + 49);
  const seen = s0.subarray(off.dexSeen, off.dexSeen + 49);
  const dex = countDexBits(owned, seen, off.regionalTotal);

  let boxes: ParsedBox[] = [];
  try {
    boxes = parsePcBoxes(sections, game, fullId);
  } catch {
    boxes = makeBoxes(14, 30);
  }

  return baseSave(game, {
    trainer: {
      name,
      trainerId,
      secretId,
      money,
      gender,
    },
    party: compactParty(partySlots),
    boxes,
    dex,
    badges,
    playTimeSeconds,
    location,
    locationMapId,
    inventory,
    progress,
  });
}

/** Build a minimal dual-bank Gen 3 save for tests (active bank A, party count 0). */
export function buildMinimalGen3Save(opts: {
  trainerName: string;
  game?: GameVersion;
  saveIndex?: number;
  corruptChecksum?: boolean;
}): Uint8Array {
  const game = opts.game ?? "emerald";
  const v = variantFor(game);
  const off = offsets(v);
  const saveIndex = opts.saveIndex ?? 1;
  const save = new Uint8Array(0x20000);

  const sectionPayloads: Uint8Array[] = [];
  for (let id = 0; id < SECTION_COUNT; id++) {
    sectionPayloads.push(new Uint8Array(3968));
  }

  const s0 = sectionPayloads[0]!;
  s0.set(encodeGen3String(opts.trainerName, 7), 0);
  s0[8] = 0; // male
  writeU32LE(s0, 0x0a, 0x12345678); // TID 0x5678, SID 0x1234
  writeU16LE(s0, 0x0e, 1); // 1 hour
  s0[0x10] = 2;
  s0[0x11] = 3;
  if (off.securityKey != null) writeU32LE(s0, off.securityKey, 0);

  const s1 = sectionPayloads[1]!;
  if (v === "frlg") s1[off.teamSize] = 0;
  else writeU32LE(s1, off.teamSize, 0);
  writeU32LE(s1, off.money, 3000);

  for (let id = 0; id < SECTION_COUNT; id++) {
    const base = id * SECTION_SIZE;
    const data = sectionPayloads[id]!;
    save.set(data, base);
    writeU16LE(save, base + FOOTER_ID, id);
    let chk = gen3SectionChecksum(data, SECTION_CHK_SIZE[id]!);
    if (opts.corruptChecksum && id === 0) chk ^= 0xffff;
    writeU16LE(save, base + FOOTER_CHK, chk);
    writeU32LE(save, base + FOOTER_SIG, SIGNATURE);
    writeU32LE(save, base + FOOTER_IDX, saveIndex);
  }

  const bankB = BANK_SIZE;
  for (let id = 0; id < SECTION_COUNT; id++) {
    const base = bankB + id * SECTION_SIZE;
    const data = new Uint8Array(3968);
    save.set(data, base);
    writeU16LE(save, base + FOOTER_ID, id);
    let chk = gen3SectionChecksum(data, SECTION_CHK_SIZE[id]!);
    if (opts.corruptChecksum) chk ^= 0xffff;
    writeU16LE(save, base + FOOTER_CHK, chk);
    writeU32LE(save, base + FOOTER_SIG, SIGNATURE);
    writeU32LE(save, base + FOOTER_IDX, saveIndex - 1);
  }

  save.set([0x42, 0x50, 0x45, 0x45], 0x1f000); // "BPEE"

  return save;
}
