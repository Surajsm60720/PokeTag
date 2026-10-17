/**
 * Generation VIII save parser (SwSh / BDSP / LA) via SCBlock map.
 * Tolerates missing blocks; full SwishCrypto XOR pad is caller-supplied / optional.
 */

import type { DetectionResult, GameVersion } from "../types.js";
import { badgesFromBitmask, emptyBadges } from "./badges.js";
import {
  BLOCK_KEYS,
  blockUint,
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
  // Prefer raw SCBlock stream (decrypted dump / synthetic). Trailing 32-byte
  // hash is stripped when present and the remainder parses to ≥1 block.
  if (bytes.length > 32) {
    const maybe = bytes.subarray(0, bytes.length - 32);
    const blocks = parseSCBlockStream(maybe);
    if (blocks.length > 0) return scBlockMap(blocks);
  }
  const blocks = parseSCBlockStream(bytes);
  if (blocks.length > 0) return scBlockMap(blocks);
  return new Map();
}

function trainerFromMyStatus(block: SCBlock | undefined): {
  name: string;
  tid: number;
  sid: number;
  gender: "M" | "F";
} {
  if (!block || block.data.length < 0x20) {
    return { name: "", tid: 0, sid: 0, gender: "M" };
  }
  const name = decodeUtf16z(block.data, 0, 12);
  const tid = readU32LE(block.data, 0x1c) & 0xffff;
  const sid = (readU32LE(block.data, 0x1c) >>> 16) & 0xffff;
  const gender: "M" | "F" = block.data[0x18] === 1 ? "F" : "M";
  return { name, tid, sid, gender };
}

export function parseGen8(
  bytes: Uint8Array,
  detection: DetectionResult
): ParsedSave {
  const game =
    detection.gameVersion === "unknown" ? "sword" : detection.gameVersion;
  const isLa = game === "legendsarceus";
  const isBdsp = game === "brilliantdiamond" || game === "shiningpearl";

  const map = tryBlockMap(bytes);
  if (map.size === 0 && bytes.length > 0x1000) {
    // Not an SCBlock stream — best-effort empty structure rather than inventing data.
    return baseSave(game, {
      trainer: emptyTrainer(),
      party: [],
      boxes: makeBoxes(isLa ? 32 : isBdsp ? 40 : 32, 30),
      dex: emptyDex(isLa ? 242 : 898),
      badges: emptyBadges(game),
      playTimeSeconds: 0,
    });
  }

  const money = blockUint(map.get(BLOCK_KEYS.MONEY)) ?? 0;
  const status =
    map.get(BLOCK_KEYS.MY_STATUS_SWSH) ??
    map.get(BLOCK_KEYS.PLAY_TIME);
  const t = trainerFromMyStatus(
    map.get(BLOCK_KEYS.MY_STATUS_SWSH) ?? status
  );

  // Party / boxes: incomplete without game-specific PK8 layout + keys.
  const boxes = makeBoxes(isLa ? 32 : isBdsp ? 40 : 32, 30);
  // LA party structure differs (not classic 6-slot boxes) — leave mostly empty.
  const party: ParsedPokemon[] = [];
  const partyBlock = map.get(BLOCK_KEYS.PARTY);
  if (partyBlock && !isLa) {
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
          level: slice[0x10c] ?? 1,
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
      mon.level = slice[0x10c] ?? mon.level;
      mon.slot = party.length;
      party.push(mon);
    }
  }

  return baseSave(game, {
    trainer: {
      name: t.name,
      trainerId: t.tid,
      secretId: t.sid,
      money,
      gender: t.gender,
    },
    party,
    boxes,
    dex: emptyDex(isLa ? 242 : 898),
    badges: isLa || isBdsp ? emptyBadges(game) : badgesFromBitmask(game, 0),
    playTimeSeconds: 0,
  });
}
