/**
 * Generation VI save parser (XY / ORAS) using PKHeX block offsets + PK6 crypto.
 */

import type { DetectionResult, GameVersion } from "../types.js";
import { badgesFromBitmask, emptyBadges } from "./badges.js";
import { parsePk6, PK6_PARTY, PK6_STORED } from "./pk6.js";
import type { ParsedPokemon, ParsedSave } from "./types.js";
import {
  baseSave,
  compactParty,
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

interface Gen6Layout {
  myStatus: number;
  misc: number;
  money: number;
  badges: number;
  playTime: number;
  party: number;
  box: number;
  boxCount: number;
}

const XY: Gen6Layout = {
  myStatus: 0x14000,
  misc: 0x4200,
  money: 0x4208,
  badges: 0x420c,
  playTime: 0x1800,
  party: 0x14200,
  box: 0x22600,
  boxCount: 31,
};

const ORAS: Gen6Layout = {
  myStatus: 0x14000,
  misc: 0x4200,
  money: 0x4208,
  badges: 0x420c,
  playTime: 0x1800,
  party: 0x14200,
  box: 0x33000,
  boxCount: 31,
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

function readPlayTimeSeconds(bytes: Uint8Array, off: number): number {
  if (off + 4 > bytes.length) return 0;
  const hours = readU16LE(bytes, off);
  const minutes = bytes[off + 2] ?? 0;
  const seconds = bytes[off + 3] ?? 0;
  return hours * 3600 + minutes * 60 + seconds;
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
    dex: emptyDex(721),
    badges: badgeMask
      ? badgesFromBitmask(game, badgeMask)
      : emptyBadges(game),
    playTimeSeconds: readPlayTimeSeconds(bytes, layout.playTime),
  });
}
