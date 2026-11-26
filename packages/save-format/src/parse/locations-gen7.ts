/**
 * Gen 7 Alola locations.
 *
 * Met-location indexes: Bulbapedia SM/USUM location list.
 * Situation.M map ids + fly-point coordinates: Project Pokémon SM Map Dex
 * (PKHeX Situation X/Y map to Map-Dex X/Z; Situation Z is height).
 */

const GEN7_MET: Record<number, string> = {
  2: "Mystery Zone",
  4: "Faraway Place",
  6: "Route 1",
  7: "Hau'oli Outskirts",
  8: "Route 1",
  10: "Route 3",
  12: "Route 2",
  14: "Kala'e Bay",
  16: "Melemele Sea",
  18: "Hau'oli City",
  19: "Beachfront",
  20: "Hau'oli City",
  21: "Shopping District",
  22: "Hau'oli City",
  23: "Marina",
  24: "Iki Town",
  26: "Mahalo Trail",
  28: "Mahalo Trail",
  29: "Plank Bridge",
  30: "Ruins of Conflict",
  32: "Ruins of Conflict",
  34: "Ten Carat Hill",
  36: "Ten Carat Hill",
  37: "Farthest Hollow",
  38: "Hau'oli Cemetery",
  40: "Melemele Meadow",
  42: "Seaward Cave",
  44: "Berry Fields",
  46: "Verdant Cavern",
  47: "Trial Site",
  48: "Verdant Cavern",
  49: "Totem's Den",
  50: "Route 4",
  52: "Route 5",
  54: "Route 6",
  56: "Route 7",
  58: "Route 8",
  60: "Route 9",
  62: "Hano Grand Resort",
  64: "Hano Beach",
  66: "Akala Meadow",
  68: "Paniola Town",
  70: "Heahea City",
  72: "Konikoni City",
  74: "Royal Avenue",
  76: "Memorial Hill",
  78: "Paniola Ranch",
  82: "Wela Volcano Park",
  84: "Wela Volcano Park",
  85: "Totem's Den",
  86: "Brooklet Hill",
  88: "Brooklet Hill",
  89: "Totem's Den",
  90: "Lush Jungle",
  92: "Ruins of Life",
  94: "Akala Outskirts",
  100: "Diglett's Tunnel",
  102: "Hano Grand Resort",
  104: "Battle Royal Dome",
  106: "Route 10",
  108: "Route 11",
  110: "Secluded Shore",
  112: "Route 13",
  114: "Tapu Village",
  116: "Route 15",
  118: "Route 16",
  120: "Route 17",
  122: "Route 12",
  124: "Haina Desert",
  126: "Route 14",
  128: "Ula'ula Meadow",
  130: "Po Town",
  132: "Malie City",
  134: "Malie Garden",
  136: "Mount Hokulani",
  138: "Blush Mountain",
  140: "Ruins of Abundance",
  142: "Lake of the Sunne",
  144: "Lake of the Moone",
  146: "Mount Lanakila",
  148: "Shady House",
  150: "Thrifty Megamart",
  151: "Abandoned Site",
  152: "Hokulani Observatory",
  154: "Pokémon League",
  156: "Poni Meadow",
  158: "Poni Wilds",
  160: "Ancient Poni Path",
  162: "Poni Breaker Coast",
  164: "Poni Grove",
  166: "Poni Plains",
  168: "Poni Coast",
  170: "Poni Gauntlet",
  172: "Seafolk Village",
  174: "Vast Poni Canyon",
  176: "Altar of the Sunne",
  178: "Altar of the Moone",
  180: "Ruins of Hope",
  182: "Resolution Cave",
  184: "Exeggutor Island",
  186: "Battle Tree",
  188: "Aether Paradise",
  190: "Ultra Space",
  192: "Malie City",
  193: "Outer Cape",
  194: "Melemele",
  195: "Akala",
  196: "Ula'ula",
  197: "Poni",
  198: "Big Wave Beach",
  200: "Sandy Cave",
  202: "Heahea Beach",
  204: "Poni Beach",
  206: "Ultra Megalopolis",
  208: "Megalo Tower",
  210: "Ultra Plant",
  212: "Ultra Crater",
  214: "Ultra Desert",
  216: "Ultra Forest",
  218: "Ultra Jungle",
  220: "Ultra Ruin",
  222: "Ultra Space Wilds",
  224: "Team Rocket's Castle",
  226: "Plains Grotto",
  228: "Pikachu Valley",
  230: "Route 1",
  231: "Trainers' School",
  232: "Dividing Peak Tunnel",
  30015: "the Alola region",
  30016: "Poké Pelago",
};

/** Situation.M → place when the whole island isn't one open map. */
const MAP_ID_NAME: Record<number, string> = {
  0: "Melemele Island",
  1: "Iki Town",
  2: "Iki Town",
  5: "Ruins of Conflict",
  16: "Player's House",
  49: "Akala Island",
  50: "Ruins of Life",
  88: "Paniola Ranch",
  97: "Ula'ula Island",
  101: "Lake of the Sunne",
  103: "Mount Hokulani",
  105: "Ruins of Abundance",
  119: "Mount Lanakila",
  132: "Thrifty Megamart",
  133: "Thrifty Megamart",
  168: "Poni Island",
  175: "Altar of the Sunne",
  180: "Ruins of Hope",
  185: "Exeggutor Island",
  196: "Aether Paradise",
  208: "Lusamine's Cryo Chamber",
  211: "Ultra Space",
};

/**
 * Fly / landmark points on shared overworld maps (Map-Dex X/Z).
 * Used to refine Situation.M when many towns share one map id.
 */
const FLY_POINTS: Array<{ map: number; x: number; z: number; name: string }> = [
  { map: 0, x: 28213, z: 18490, name: "Route 1" },
  { map: 0, x: 27579, z: 23024, name: "Route 1" },
  { map: 0, x: 25831, z: 19452, name: "Route 1" },
  { map: 0, x: 8532, z: 18201, name: "Hau'oli City" },
  { map: 0, x: 9249, z: 14015, name: "Route 2" },
  { map: 0, x: 13880, z: 7593, name: "Route 2" },
  { map: 0, x: 12630, z: 6491, name: "Route 2" },
  { map: 0, x: 19038, z: 6979, name: "Melemele Meadow" },
  { map: 0, x: 18122, z: 13725, name: "Iki Town" },
  { map: 49, x: 15253, z: 30525, name: "Heahea City" },
  { map: 49, x: 19373, z: 22274, name: "Paniola Town" },
  { map: 49, x: 18523, z: 16332, name: "Route 5" },
  { map: 49, x: 21419, z: 12238, name: "Route 5" },
  { map: 49, x: 23657, z: 24250, name: "Royal Avenue" },
  { map: 49, x: 25243, z: 21598, name: "Royal Avenue" },
  { map: 49, x: 28202, z: 17408, name: "Route 7" },
  { map: 49, x: 18487, z: 10386, name: "Route 8" },
  { map: 49, x: 11662, z: 39964, name: "Route 9" },
  { map: 49, x: 9274, z: 36830, name: "Konikoni City" },
  { map: 49, x: 25156, z: 30505, name: "Hano Grand Resort" },
  { map: 97, x: 25782, z: 18066, name: "Malie City" },
  { map: 97, x: 31307, z: 28675, name: "Route 12" },
  { map: 97, x: 12975, z: 35027, name: "Tapu Village" },
  { map: 97, x: 5835, z: 24175, name: "Route 16" },
  { map: 97, x: 9800, z: 9905, name: "Po Town" },
  { map: 168, x: 16025, z: 17539, name: "Seafolk Village" },
  { map: 168, x: 24717, z: 14276, name: "Vast Poni Canyon" },
  { map: 168, x: 31681, z: 11501, name: "Poni Meadow" },
  { map: 168, x: 25549, z: 3738, name: "Battle Tree" },
];

export function gen7LocationName(locationId: number): string {
  if (locationId <= 0) return "";
  return GEN7_MET[locationId] || `Location #${locationId}`;
}

export function gen7SituationLocation(
  mapId: number,
  x: number,
  y: number
): { locationId: number; name: string } {
  const onMap = FLY_POINTS.filter((p) => p.map === mapId);
  if (onMap.length > 0 && Number.isFinite(x) && Number.isFinite(y)) {
    let best = onMap[0]!;
    let bestDist = Number.POSITIVE_INFINITY;
    for (const p of onMap) {
      const dx = p.x - x;
      const dz = p.z - y;
      const d = dx * dx + dz * dz;
      if (d < bestDist) {
        bestDist = d;
        best = p;
      }
    }
    // Only trust the pin when we're reasonably close (open maps are huge).
    if (bestDist < 40_000_000) {
      return { locationId: mapId, name: best.name };
    }
  }
  const named = MAP_ID_NAME[mapId];
  if (named) return { locationId: mapId, name: named };
  if (mapId > 0) return { locationId: mapId, name: `Map ${mapId}` };
  return { locationId: 0, name: "" };
}
