/**
 * Let's Go Pikachu / Eevee location names (text_gg_00000) and arrive-flag areas.
 */

const MET: Record<number, string> = {
  1: "Mystery Zone",
  2: "Faraway place",
  3: "Route 1",
  4: "Route 2",
  5: "Route 3",
  6: "Route 4",
  7: "Route 5",
  8: "Route 6",
  9: "Route 7",
  10: "Route 8",
  11: "Route 9",
  12: "Route 10",
  13: "Route 11",
  14: "Route 12",
  15: "Route 13",
  16: "Route 14",
  17: "Route 15",
  18: "Route 16",
  19: "Route 17",
  20: "Route 18",
  21: "Route 19",
  22: "Route 20",
  23: "Route 21",
  24: "Route 22",
  25: "Route 23",
  26: "Route 24",
  27: "Route 25",
  28: "Pallet Town",
  29: "Viridian City",
  30: "Pewter City",
  31: "Cerulean City",
  32: "Lavender Town",
  33: "Vermilion City",
  34: "Celadon City",
  35: "Fuchsia City",
  36: "Cinnabar Island",
  37: "Indigo Plateau",
  38: "Saffron City",
  39: "Viridian Forest",
  40: "Mt. Moon",
  41: "Rock Tunnel",
  42: "Power Plant",
  43: "Diglett's Cave",
  44: "Seafoam Islands",
  45: "Victory Road",
  46: "Cerulean Cave",
  47: "Pokémon Tower",
  48: "S.S. Anne",
  49: "Team Rocket Hideout",
  50: "GO Park complex",
  51: "Pokémon Mansion",
  52: "Silph Co.",
  53: "Pokémon League",
};

/** FSYS_ARRIVE_* suffixes → display name (from FlagsEditorEX LGPE DB). */
const ARRIVE: Record<string, string> = {
  ROAD001: "Route 1",
  ROAD002: "Route 2",
  ROAD003: "Route 3",
  ROAD004: "Route 4",
  ROAD005: "Route 5",
  ROAD006: "Route 6",
  ROAD007: "Route 7",
  ROAD008: "Route 8",
  ROAD009: "Route 9",
  ROAD010: "Route 10",
  ROAD011: "Route 11",
  ROAD012: "Route 12",
  ROAD013: "Route 13",
  ROAD014: "Route 14",
  ROAD015: "Route 15",
  ROAD016: "Route 16",
  ROAD017: "Route 17",
  ROAD018: "Route 18",
  ROAD019: "Route 19",
  ROAD020: "Route 20",
  ROAD021: "Route 21",
  ROAD022: "Route 22",
  ROAD023: "Route 23",
  ROAD024: "Route 24",
  ROAD025: "Route 25",
  TOWN001: "Pallet Town",
  TOWN002: "Viridian City",
  TOWN003: "Pewter City",
  TOWN004: "Cerulean City",
  TOWN005: "Lavender Town",
  TOWN006: "Vermilion City",
  TOWN007: "Celadon City",
  TOWN008: "Fuchsia City",
  TOWN009: "Cinnabar Island",
  TOWN010: "Indigo Plateau",
  TOWN011: "Saffron City",
};

export function lgpeMetLocationName(id: number): string {
  if (id <= 0) return "";
  return MET[id] ?? `Location #${id}`;
}

/** Story order, not the save's town index. Saffron is town 11 but not the last city. */
const TOWN_STORY: Record<string, number> = {
  TOWN001: 1,
  TOWN003: 2,
  TOWN004: 3,
  TOWN006: 4,
  TOWN005: 5,
  TOWN007: 6,
  TOWN011: 7,
  TOWN008: 8,
  TOWN009: 9,
  TOWN002: 10,
  TOWN010: 11,
};

/**
 * Pick a display location from set FSYS_ARRIVE_* flag names.
 * Towns always outrank routes, so Route 25 cannot hide a city already reached.
 */
export function lgpeLocationFromArriveFlags(
  flagNames: string[]
): { name: string; mapId: number | null } {
  let best: { name: string; rank: number; mapId: number } | null = null;
  for (const raw of flagNames) {
    const key = raw.replace(/^FSYS_ARRIVE_/, "");
    const name = ARRIVE[key];
    if (!name) continue;
    const num = Number(key.replace(/\D/g, "")) || 0;
    const isTown = key.startsWith("TOWN");
    const rank = isTown ? 1000 + (TOWN_STORY[key] ?? num) : num;
    if (!best || rank > best.rank) {
      best = { name, rank, mapId: isTown ? 27 + num : 2 + num };
    }
  }
  if (!best) return { name: "", mapId: null };
  return { name: best.name, mapId: best.mapId };
}
