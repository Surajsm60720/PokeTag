/**
 * Generation IX save parser (Scarlet / Violet) via SCBlock map.
 * Tolerates missing DLC blocks (Kitakami / Blueberry).
 */

import type { DetectionResult, GameVersion } from "../types.js";
import { emptyBadges } from "./badges.js";
import {
  BLOCK_KEYS,
  blockUint,
  fnv1a32,
  parseSCBlockStream,
  scBlockMap,
  type SCBlock,
} from "./scblock.js";
import { speciesName } from "./species.js";
import type { ParsedPokemon, ParsedSave } from "./types.js";
import { parsePk8Shallow } from "./pkm.js";
import {
  baseSave,
  emptyDex,
  emptyTrainer,
  makeBoxes,
  pokemonExtras,
  readU16LE,
  readU32LE,
} from "./util.js";

/** Optional DLC-related keys — absence is OK. */
const K_BLUEBERRY_POINTS = fnv1a32("BlueberryPoints");
const K_KITAKAMI = fnv1a32("EncountWild_Kitakami");

function decodeUtf16z(data: Uint8Array, off: number, maxChars: number): string {
  let s = "";
  for (let i = 0; i < maxChars; i++) {
    const code = readU16LE(data, off + i * 2);
    if (code === 0xffff || code === 0) break;
    if (code < 0x100) s += String.fromCharCode(code);
  }
  return s;
}

function tryBlockMap(bytes: Uint8Array): Map<number, SCBlock> {
  if (bytes.length > 32) {
    const maybe = bytes.subarray(0, bytes.length - 32);
    const blocks = parseSCBlockStream(maybe);
    if (blocks.length > 0) return scBlockMap(blocks);
  }
  return scBlockMap(parseSCBlockStream(bytes));
}

export function parseGen9(
  bytes: Uint8Array,
  detection: DetectionResult
): ParsedSave {
  const game =
    detection.gameVersion === "unknown" ? "scarlet" : detection.gameVersion;

  const map = tryBlockMap(bytes);
  // Presence of DLC keys is informational only — never required.
  void map.get(K_BLUEBERRY_POINTS);
  void map.get(K_KITAKAMI);

  if (map.size === 0) {
    return baseSave(game, {
      trainer: emptyTrainer(),
      party: [],
      boxes: makeBoxes(32, 30),
      dex: emptyDex(1025),
      badges: emptyBadges(game),
      playTimeSeconds: 0,
    });
  }

  const money = blockUint(map.get(BLOCK_KEYS.MONEY)) ?? 0;
  const myStatus = map.get(fnv1a32("MyStatus")) ?? map.get(BLOCK_KEYS.MY_STATUS_SWSH);
  let name = "";
  let tid = 0;
  let sid = 0;
  let gender: "M" | "F" = "M";
  if (myStatus && myStatus.data.length >= 0x30) {
    name = decodeUtf16z(myStatus.data, 0x10, 12);
    const id32 = readU32LE(myStatus.data, 0x28);
    tid = id32 & 0xffff;
    sid = (id32 >>> 16) & 0xffff;
    gender = myStatus.data[0x20] === 1 ? "F" : "M";
  }

  const party: ParsedPokemon[] = [];
  const partyBlock = map.get(BLOCK_KEYS.PARTY) ?? map.get(fnv1a32("Party"));
  if (partyBlock) {
    const slotSize = 0x158;
    const count = Math.floor(partyBlock.data.length / slotSize);
    for (let i = 0; i < Math.min(6, count); i++) {
      const slice = partyBlock.data.subarray(i * slotSize, (i + 1) * slotSize);
      const mon = parsePk8Shallow(slice, party.length);
      if (!mon) {
        const speciesId = readU16LE(slice, 0x08);
        if (!speciesId) continue;
        party.push({
          slot: party.length,
          speciesId,
          speciesName: speciesName(speciesId),
          nickname: decodeUtf16z(slice, 0x58, 12) || speciesName(speciesId),
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
        });
        continue;
      }
      mon.nickname =
        decodeUtf16z(slice, 0x58, 12) || mon.speciesName;
      mon.slot = party.length;
      party.push(mon);
    }
  }

  return baseSave(game, {
    trainer: {
      name,
      trainerId: tid,
      secretId: sid,
      money,
      gender,
    },
    party,
    boxes: makeBoxes(32, 30),
    dex: emptyDex(1025),
    badges: emptyBadges(game),
    playTimeSeconds: 0,
  });
}
