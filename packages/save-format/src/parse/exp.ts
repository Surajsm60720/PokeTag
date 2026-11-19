/**
 * Experience → level for the six main-series growth groups.
 * Group ids match the usual personal-data order:
 * 0 medium-fast, 1 erratic, 2 fluctuating, 3 medium-slow, 4 fast, 5 slow.
 * Species 1–721 groups come from the public growth-rate lists.
 */

/** One digit per national dex number, index 0 = species 1. */
const GROWTH_1_TO_721 =
  "3333333330000003330000000000333333440044003330000000000005533333333333355333000000000000055333000000055000000055400000055000005555500000000005555555553333333333000044440550444400333344033334330000030400000030440035300005540045555000054000005455555555333333333300000000033333333005550022555111333224044345550055001232255220004443333311124400220011111103444454300033311154555555555555555533333333333300333333311110003300000004220043444000000430555533555500511555300500040003505040055555555555535533333333300333000000004433300333000043333330033333300000333330000000000000033443333330055500000000040000333555003335550000003300000055550055555555555555555333333333003330003300000000000000000000000550000000005555400000000555555";

export function growthGroup(speciesId: number): number {
  const digit = GROWTH_1_TO_721[speciesId - 1];
  if (digit == null) return 0;
  const group = digit.charCodeAt(0) - 48;
  return group >= 0 && group <= 5 ? group : 0;
}

/** Minimum experience required to be exactly `level` (1–100). */
export function expForLevel(level: number, group: number): number {
  if (level <= 1) return 0;
  const n = Math.min(100, level);
  const n3 = n * n * n;
  switch (group) {
    case 4:
      return Math.floor((n3 * 4) / 5);
    case 5:
      return Math.floor((n3 * 5) / 4);
    case 3:
      return Math.floor((n3 * 6) / 5) - 15 * n * n + 100 * n - 140;
    case 1:
      if (n < 50) return Math.floor((n3 * (100 - n)) / 50);
      if (n < 68) return Math.floor((n3 * (150 - n)) / 100);
      if (n < 98) {
        return Math.floor((n3 * Math.floor((1911 - 10 * n) / 3)) / 500);
      }
      return Math.floor((n3 * (160 - n)) / 100);
    case 2:
      if (n < 15) {
        return Math.floor((n3 * (Math.floor((n + 1) / 3) + 24)) / 50);
      }
      if (n < 36) return Math.floor((n3 * (n + 14)) / 50);
      return Math.floor((n3 * (Math.floor(n / 2) + 32)) / 50);
    default:
      return n3;
  }
}

/** Highest level whose threshold is still ≤ exp. */
export function levelFromExp(exp: number, group: number): number {
  if (exp <= 0) return 1;
  let level = 1;
  for (let next = 2; next <= 100; next++) {
    if (exp < expForLevel(next, group)) break;
    level = next;
  }
  return level;
}

export function levelFromSpeciesExp(speciesId: number, exp: number): number {
  return levelFromExp(exp, growthGroup(speciesId));
}
