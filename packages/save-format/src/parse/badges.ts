import type { GameVersion } from "../types.js";
import type { ParsedBadge } from "./types.js";

const HOENN = [
  "Stone",
  "Knuckle",
  "Dynamo",
  "Heat",
  "Balance",
  "Feather",
  "Mind",
  "Rain",
] as const;

const KANTO = [
  "Boulder",
  "Cascade",
  "Thunder",
  "Rainbow",
  "Soul",
  "Marsh",
  "Volcano",
  "Earth",
] as const;

const SINNOH = [
  "Coal",
  "Forest",
  "Cobble",
  "Fen",
  "Relic",
  "Mine",
  "Icicle",
  "Beacon",
] as const;

const JOHTO = [
  "Zephyr",
  "Hive",
  "Plain",
  "Fog",
  "Storm",
  "Mineral",
  "Glacier",
  "Rising",
] as const;

const UNOVA = [
  "Trio",
  "Basic",
  "Insect",
  "Bolt",
  "Quake",
  "Jet",
  "Legend",
  "Wave",
] as const;

const KALOS = [
  "Bug",
  "Cliff",
  "Rumble",
  "Plant",
  "Voltage",
  "Fairy",
  "Psychic",
  "Iceberg",
] as const;

const ALOLA = [
  "Normalium Z",
  "Fightinium Z",
  "Waterium Z",
  "Firium Z",
  "Grassium Z",
  "Rockium Z",
  "Electrium Z",
  "Ghostium Z",
] as const;

const GALAR = [
  "Grass",
  "Water",
  "Fire",
  "Fighting",
  "Ghost",
  "Fairy",
  "Rock",
  "Ice",
  "Dark",
  "Dragon",
] as const;

const PALDEA = [
  "Bug",
  "Grass",
  "Electric",
  "Water",
  "Normal",
  "Ghost",
  "Psychic",
  "Ice",
  "Fighting",
  "Dark",
  "Rock",
  "Fire",
  "Fairy",
  "Ice (Snow)",
  "Steel",
  "Dark (Team Star)",
  "Flying",
  "Dragon",
] as const;

function listForGame(game: GameVersion): readonly string[] {
  switch (game) {
    case "ruby":
    case "sapphire":
    case "emerald":
    case "omegaruby":
    case "alphasapphire":
      return HOENN;
    case "firered":
    case "leafgreen":
      return KANTO;
    case "diamond":
    case "pearl":
    case "platinum":
    case "brilliantdiamond":
    case "shiningpearl":
      return SINNOH;
    case "heartgold":
    case "soulsilver":
      return [...JOHTO, ...KANTO];
    case "black":
    case "white":
    case "black2":
    case "white2":
      return UNOVA;
    case "x":
    case "y":
      return KALOS;
    case "sun":
    case "moon":
    case "ultrasun":
    case "ultramoon":
      return ALOLA;
    case "sword":
    case "shield":
      return GALAR;
    case "scarlet":
    case "violet":
      return PALDEA;
    case "legendsarceus":
    case "pokkentournamentdx":
      return [];
    default:
      return HOENN;
  }
}

/** Build badge list from a bitmask (bit 0 = first badge). */
export function badgesFromBitmask(
  game: GameVersion,
  mask: number,
  count?: number
): ParsedBadge[] {
  const names = listForGame(game);
  const n = count ?? names.length;
  const out: ParsedBadge[] = [];
  for (let i = 0; i < n; i++) {
    const name = names[i] ?? `Badge ${i + 1}`;
    out.push({
      id: `badge-${i + 1}`,
      name,
      earned: ((mask >>> i) & 1) === 1,
    });
  }
  return out;
}

/** Empty / unearned badge list for a game. */
export function emptyBadges(game: GameVersion): ParsedBadge[] {
  return badgesFromBitmask(game, 0);
}
