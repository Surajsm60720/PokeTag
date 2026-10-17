/**
 * Approximate US release order for shelf sorting (oldest → newest).
 * Same-day pairs keep version-id alphabetical within the pair.
 */
const RELEASE_ORDER: Record<string, number> = {
  ruby: 10,
  sapphire: 20,
  firered: 30,
  leafgreen: 40,
  emerald: 50,
  diamond: 60,
  pearl: 70,
  platinum: 80,
  heartgold: 90,
  soulsilver: 100,
  black: 110,
  white: 120,
  black2: 130,
  white2: 140,
  x: 150,
  y: 160,
  omegaruby: 170,
  alphasapphire: 180,
  sun: 190,
  moon: 200,
  ultrasun: 210,
  ultramoon: 220,
  sword: 230,
  shield: 240,
  brilliantdiamond: 250,
  shiningpearl: 260,
  legendsarceus: 270,
  scarlet: 280,
  violet: 290,
};

export function releaseRank(gameVersion: string): number {
  return RELEASE_ORDER[gameVersion] ?? 9999;
}

export function sortByReleaseDate<T extends { gameVersion: string }>(
  slots: T[]
): T[] {
  return [...slots].sort((a, b) => {
    const diff = releaseRank(a.gameVersion) - releaseRank(b.gameVersion);
    if (diff !== 0) return diff;
    return a.gameVersion.localeCompare(b.gameVersion);
  });
}
