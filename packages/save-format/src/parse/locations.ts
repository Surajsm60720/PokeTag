/**
 * Gen 3 map bank/num → location name (Hoenn + Kanto common routes/cities).
 * Fallback: Map B/N
 */

type LocMap = Record<number, Record<number, string>>;

/** Hoenn (RS/E): bank → mapNum → name. Common entries only. */
const HOENN: LocMap = {
  0: {
    0: "Littleroot Town",
    1: "Oldale Town",
    2: "Dewford Town",
    3: "Lavaridge Town",
    4: "Fallarbor Town",
    5: "Verdanturf Town",
    6: "Pacifidlog Town",
    7: "Petalburg City",
    8: "Slateport City",
    9: "Mauville City",
    10: "Rustboro City",
    11: "Fortree City",
    12: "Lilycove City",
    13: "Mossdeep City",
    14: "Sootopolis City",
    15: "Ever Grande City",
    16: "Route 101",
    17: "Route 102",
    18: "Route 103",
    19: "Route 104",
    20: "Route 105",
    21: "Route 106",
    22: "Route 107",
    23: "Route 108",
    24: "Route 109",
    25: "Route 110",
    26: "Route 111",
    27: "Route 112",
    28: "Route 113",
    29: "Route 114",
    30: "Route 115",
    31: "Route 116",
    32: "Route 117",
    33: "Route 118",
    34: "Route 119",
    35: "Route 120",
    36: "Route 121",
    37: "Route 122",
    38: "Route 123",
    39: "Route 124",
    40: "Route 125",
    41: "Route 126",
    42: "Route 127",
    43: "Route 128",
    44: "Route 129",
    45: "Route 130",
    46: "Route 131",
    47: "Route 132",
    48: "Route 133",
    49: "Route 134",
    50: "Underwater",
  },
  1: {
    0: "Petalburg Woods",
    1: "Rusturf Tunnel",
    2: "Island Cave",
    3: "Granite Cave",
    4: "Mt. Chimney",
    5: "Safari Zone",
    6: "Battle Tower / Frontier",
    7: "Petalburg Gym",
    8: "Rustboro Gym",
  },
  24: {
    0: "Meteor Falls",
    1: "Mt. Chimney",
    2: "Jagged Pass",
    3: "Fiery Path",
    4: "Mt. Pyre",
    5: "Team Aqua Hideout",
    6: "Shoal Cave",
    7: "Seafloor Cavern",
    8: "Underwater",
    9: "Victory Road",
    10: "Mirage Island",
    11: "Cave of Origin",
    12: "Southern Island",
    13: "Fake Ship",
    14: "Sealed Chamber",
    15: "Underwater",
    16: "Scorched Slab",
    17: "Island Cave",
    18: "Desert Ruins",
    19: "Ancient Tomb",
    20: "Inside of Truck",
    21: "Sky Pillar",
    22: "Secret Base",
    23: "Secret Base",
  },
};

/** Kanto (FRLG): bank → mapNum. */
const KANTO: LocMap = {
  3: {
    0: "Pallet Town",
    1: "Viridian City",
    2: "Pewter City",
    3: "Cerulean City",
    4: "Lavender Town",
    5: "Vermilion City",
    6: "Celadon City",
    7: "Fuchsia City",
    8: "Cinnabar Island",
    9: "Indigo Plateau",
    10: "Saffron City",
    11: "Route 1",
    12: "Route 2",
    13: "Route 3",
    14: "Route 4",
    15: "Route 5",
    16: "Route 6",
    17: "Route 7",
    18: "Route 8",
    19: "Route 9",
    20: "Route 10",
    21: "Route 11",
    22: "Route 12",
    23: "Route 13",
    24: "Route 14",
    25: "Route 15",
    26: "Route 16",
    27: "Route 17",
    28: "Route 18",
    29: "Route 19",
    30: "Route 20",
    31: "Route 21",
    32: "Route 22",
    33: "Route 23",
    34: "Route 24",
    35: "Route 25",
  },
  1: {
    0: "Viridian Forest",
    1: "Mt. Moon",
    2: "S.S. Anne",
    3: "Underground Path",
    4: "Underground Path",
    5: "Diglett's Cave",
    6: "Victory Road",
    7: "Rocket Hideout",
    8: "Silph Co.",
    9: "Pokémon Mansion",
    10: "Safari Zone",
    11: "Pokémon League",
    12: "Rock Tunnel",
    13: "Seafoam Islands",
    14: "Pokémon Tower",
    15: "Cerulean Cave",
    16: "Power Plant",
  },
};

function lookup(table: LocMap, bank: number, num: number): string | null {
  return table[bank]?.[num] ?? null;
}

/**
 * Resolve a display name for a Gen 3 (or later) map coordinate.
 * `gameVersion` selects Hoenn vs Kanto tables.
 */
export function locationName(
  gameVersion: string,
  mapBank: number,
  mapNum: number
): string {
  const g = gameVersion.toLowerCase();
  const isKanto =
    g === "firered" || g === "leafgreen" || g === "frlg" || g.includes("kanto");
  const named = isKanto
    ? lookup(KANTO, mapBank, mapNum) ?? lookup(HOENN, mapBank, mapNum)
    : lookup(HOENN, mapBank, mapNum) ?? lookup(KANTO, mapBank, mapNum);
  return named ?? `Map ${mapBank}/${mapNum}`;
}
