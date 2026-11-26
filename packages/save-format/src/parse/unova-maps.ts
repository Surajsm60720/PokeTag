/**
 * Unova overworld map-header IDs (SDSME / PlayerPosition5.M) → place names.
 *
 * Outdoor headers are documented from romhacking notes (Nuvema = 389 in BW,
 * Aspertia = 427 in B2W2). Contiguous interiors after an outdoor header share
 * that town's name until the next known outdoor map.
 *
 * Met-location indexes (Pokédex / summary) use a different numbering and live
 * in {@link unovaLocationName}.
 */

/** Met-location / map-name table indexes shared by BW and B2W2. */
const UNOVA_LOCATIONS: readonly string[] = [
  "", // 0
  "Mystery Zone",
  "Faraway place",
  "", // dynamic "X's Y"
  "Nuvema Town",
  "Accumula Town",
  "Striaton City",
  "Nacrene City",
  "Castelia City",
  "Nimbasa City",
  "Driftveil City",
  "Mistralton City",
  "Icirrus City",
  "Opelucid City",
  "Route 1",
  "Route 2",
  "Route 3",
  "Route 4",
  "Route 5",
  "Route 6",
  "Route 7",
  "Route 8",
  "Route 9",
  "Route 10",
  "Route 11",
  "Route 12",
  "Route 13",
  "Route 14",
  "Route 15",
  "Route 16",
  "Route 17",
  "Route 18",
  "Dreamyard",
  "Pinwheel Forest",
  "Desert Resort",
  "Relic Castle",
  "Battle Subway", // 36 — approximate; table continues in-game
  "Weather Systems",
  "Mistralton Cave",
  "Celestial Tower",
  "Chargestone Cave",
  "Twist Mountain",
  "Dragonspiral Tower",
  "Moor of Icirrus",
  "Challenger's Cave",
  "Victory Road",
  "Giant Chasm",
  "Liberty Garden",
  "P2 Laboratory",
  "Undella Town",
  "Lacunosa Town",
  "Village Bridge",
  "Marvelous Bridge",
  "Tubeline Bridge",
  "Driftveil Drawbridge",
  "Pokémon League",
  "N's Castle",
  "Royal Unova",
  "Gear Station",
  "Battle Company",
  "Castelia Sewers",
  "Relic Passage",
  "Clay Tunnel",
  "Underground Ruins",
  "Rocky Mountain Room",
  "Glacier Room",
  "Iron Room",
  "Twist Mountain",
  "Dragonspiral Tower",
  "Giant Chasm",
  "National Park",
  "Lostlorn Forest",
  "Trial Chamber",
  "Guidance Chamber",
  "Entree Forest",
  "Nimbasa City",
  "Driftveil City",
  "Mistralton City",
  "Icirrus City",
  "Opelucid City",
  "Nuvema Town",
  "White Forest",
  "Black City",
  "Cold Storage",
  "Chargestone Cave",
  "Twist Mountain",
  "Dragonspiral Tower",
  "Giant Chasm",
  "Driftveil Drawbridge",
  "Tubeline Bridge",
  "Village Bridge",
  "Marvelous Bridge",
  // 92–116 gates / ruins (sparse; filled below when needed)
];

// Extend with B2W2-exclusive met locations (117+).
const B2W2_EXTRA: Record<number, string> = {
  117: "Aspertia City",
  118: "Virbank City",
  119: "Humilau City",
  120: "Pokéstar Studios",
  121: "Join Avenue",
  122: "Floccesy Town",
  123: "Lentimas Town",
  124: "Route 19",
  125: "Route 20",
  126: "Route 21",
  127: "Route 22",
  128: "Route 23",
  129: "Castelia Sewers",
  130: "Floccesy Ranch",
  131: "Virbank Complex",
  132: "Reversal Mountain",
  133: "Strange House",
  134: "Victory Road",
  135: "Plasma Frigate",
  136: "Relic Passage",
  137: "Clay Tunnel",
  139: "White Treehollow",
  140: "Black Tower",
  141: "Seaside Cave",
  142: "Cave of Being",
  143: "Hidden Grotto",
  144: "Marine Tube",
  145: "Virbank Gate",
  146: "Aspertia Gate",
  147: "Nature Preserve",
  148: "Medal Office",
  149: "Underground Ruins",
  153: "Pledge Grove",
};

/**
 * Known SDSME map-header IDs for outdoor hubs. Interiors between two hubs
 * inherit the earlier hub's name (SDSME lists interiors under the same label).
 */
const MAP_HEADER_OUTDOOR: Array<{ id: number; name: string }> = [
  // Black / White — Nuvema is header 389; early interiors follow it.
  { id: 389, name: "Nuvema Town" },
  // Black 2 / White 2 — Aspertia outdoor is header 427.
  { id: 427, name: "Aspertia City" },
];

const HEADER_CACHE = new Map<number, string>();
/** SDSME lists a town's interiors immediately after its outdoor header. */
const INTERIOR_SPAN = 24;

function buildHeaderCache(): void {
  if (HEADER_CACHE.size > 0) return;
  for (const { id, name } of MAP_HEADER_OUTDOOR) {
    for (let i = 0; i < INTERIOR_SPAN; i++) {
      HEADER_CACHE.set(id + i, name);
    }
  }
}

/** Resolve PlayerPosition5.M (map header id) to a place name. */
export function unovaMapName(mapId: number): string {
  if (mapId <= 0) return "";
  buildHeaderCache();
  return HEADER_CACHE.get(mapId) || `Map ${mapId}`;
}

/** Resolve a met-location / map-name table index (summary screen). */
export function unovaLocationName(locationId: number): string {
  if (locationId <= 0) return "";
  if (B2W2_EXTRA[locationId]) return B2W2_EXTRA[locationId]!;
  const name = UNOVA_LOCATIONS[locationId];
  if (name) return name;
  return `Location #${locationId}`;
}
