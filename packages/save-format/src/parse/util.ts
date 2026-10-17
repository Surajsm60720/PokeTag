import type { GameVersion } from "../types.js";
import { emptyBadges } from "./badges.js";
import { speciesName } from "./species.js";
import {
  PARSER_VERSION,
  emptyInventory,
  emptyProgress,
  type ParsedBox,
  type ParsedDex,
  type ParsedPokemon,
  type ParsedSave,
  type ParsedTrainer,
} from "./types.js";

export { emptyInventory, emptyProgress } from "./types.js";

export function emptyTrainer(): ParsedTrainer {
  return {
    name: "",
    trainerId: 0,
    secretId: 0,
    money: 0,
    gender: "M",
  };
}

export function emptyDex(regionalTotal = 0): ParsedDex {
  return { seen: 0, owned: 0, regionalTotal, entries: [] };
}

/** Fill required ParsedPokemon enrichment fields with honest empties. */
export function pokemonExtras(
  partial: Partial<
    Pick<
      ParsedPokemon,
      | "moveDetails"
      | "heldItemId"
      | "ball"
      | "metLevel"
      | "metLocation"
      | "metLocationId"
      | "originGame"
      | "originKind"
      | "caughtAt"
      | "otName"
    >
  > = {}
): Pick<
  ParsedPokemon,
  | "moveDetails"
  | "heldItemId"
  | "ball"
  | "metLevel"
  | "metLocation"
  | "metLocationId"
  | "originGame"
  | "originKind"
  | "caughtAt"
  | "otName"
> {
  return {
    moveDetails: partial.moveDetails ?? [],
    heldItemId: partial.heldItemId ?? null,
    ball: partial.ball ?? null,
    metLevel: partial.metLevel ?? null,
    metLocation: partial.metLocation ?? null,
    metLocationId: partial.metLocationId ?? null,
    originGame: partial.originGame ?? null,
    originKind: partial.originKind ?? "unknown",
    caughtAt: partial.caughtAt ?? null,
    otName: partial.otName ?? "",
  };
}

export function makeBoxes(
  count: number,
  slotsPerBox: number,
  names?: string[]
): ParsedBox[] {
  const boxes: ParsedBox[] = [];
  for (let i = 0; i < count; i++) {
    boxes.push({
      index: i,
      name: names?.[i] ?? `Box ${i + 1}`,
      wallpaper: "default",
      pokemon: Array.from({ length: slotsPerBox }, () => null),
    });
  }
  return boxes;
}

export function countDexBits(
  owned: Uint8Array,
  seen: Uint8Array,
  maxSpecies: number,
  sampleLimit = 24
): ParsedDex {
  let ownedCount = 0;
  let seenCount = 0;
  const entries: ParsedDex["entries"] = [];
  for (let i = 0; i < maxSpecies; i++) {
    const byte = i >> 3;
    const bit = i & 7;
    const o = byte < owned.length ? ((owned[byte]! >> bit) & 1) === 1 : false;
    const s = byte < seen.length ? ((seen[byte]! >> bit) & 1) === 1 : false;
    if (o) ownedCount++;
    if (s) seenCount++;
    if ((o || s) && entries.length < sampleLimit) {
      const speciesId = i + 1;
      entries.push({
        speciesId,
        speciesName: speciesName(speciesId),
        seen: s || o,
        owned: o,
      });
    }
  }
  return {
    seen: seenCount,
    owned: ownedCount,
    regionalTotal: maxSpecies,
    entries,
  };
}

export function baseSave(
  gameVersion: GameVersion | string,
  partial: Partial<ParsedSave> & {
    trainer: ParsedTrainer;
  }
): ParsedSave {
  const game = String(gameVersion);
  return {
    gameVersion: game,
    parserVersion: PARSER_VERSION,
    isDemo: false,
    trainer: partial.trainer,
    party: partial.party ?? [],
    boxes: partial.boxes ?? [],
    dex: partial.dex ?? emptyDex(),
    badges: partial.badges ?? emptyBadges(game as GameVersion),
    playTimeSeconds: partial.playTimeSeconds ?? 0,
    location: partial.location ?? "",
    locationMapId: partial.locationMapId ?? null,
    inventory: partial.inventory ?? emptyInventory(),
    progress: partial.progress ?? emptyProgress(),
  };
}

export function readU16LE(data: Uint8Array, off: number): number {
  return data[off]! | (data[off + 1]! << 8);
}

export function readU32LE(data: Uint8Array, off: number): number {
  return (
    (data[off]! |
      (data[off + 1]! << 8) |
      (data[off + 2]! << 16) |
      (data[off + 3]! << 24)) >>>
    0
  );
}

export function writeU16LE(data: Uint8Array, off: number, value: number): void {
  data[off] = value & 0xff;
  data[off + 1] = (value >>> 8) & 0xff;
}

export function writeU32LE(data: Uint8Array, off: number, value: number): void {
  data[off] = value & 0xff;
  data[off + 1] = (value >>> 8) & 0xff;
  data[off + 2] = (value >>> 16) & 0xff;
  data[off + 3] = (value >>> 24) & 0xff;
}

/** Filter nulls and re-index party slots. */
export function compactParty(slots: Array<ParsedPokemon | null>): ParsedPokemon[] {
  const party: ParsedPokemon[] = [];
  for (const p of slots) {
    if (p) party.push({ ...p, slot: party.length });
  }
  return party;
}
