/**
 * Minimal species → types / abilities for Gen 3 enrichment (starters, legendaries, commons).
 */

import { abilityName } from "./abilities.js";

const SPECIES_TYPES: Record<number, [string, string?]> = {
  1: ["Grass", "Poison"],
  2: ["Grass", "Poison"],
  3: ["Grass", "Poison"],
  4: ["Fire"],
  5: ["Fire"],
  6: ["Fire", "Flying"],
  7: ["Water"],
  8: ["Water"],
  9: ["Water"],
  16: ["Normal", "Flying"],
  19: ["Normal"],
  25: ["Electric"],
  26: ["Electric"],
  63: ["Psychic"],
  66: ["Fighting"],
  74: ["Rock", "Ground"],
  92: ["Ghost", "Poison"],
  94: ["Ghost", "Poison"],
  129: ["Water"],
  130: ["Water", "Flying"],
  133: ["Normal"],
  143: ["Normal"],
  150: ["Psychic"],
  151: ["Psychic"],
  152: ["Grass"],
  155: ["Fire"],
  158: ["Water"],
  249: ["Psychic", "Flying"],
  250: ["Fire", "Flying"],
  251: ["Psychic", "Grass"],
  252: ["Grass"],
  253: ["Grass"],
  254: ["Grass"],
  255: ["Fire"],
  256: ["Fire", "Fighting"],
  257: ["Fire", "Fighting"],
  258: ["Water"],
  259: ["Water", "Ground"],
  260: ["Water", "Ground"],
  280: ["Psychic", "Fairy"],
  281: ["Psychic", "Fairy"],
  282: ["Psychic", "Fairy"],
  303: ["Steel", "Fairy"],
  306: ["Steel", "Rock"],
  373: ["Dragon", "Flying"],
  376: ["Steel", "Psychic"],
  380: ["Dragon", "Psychic"],
  381: ["Dragon", "Psychic"],
  382: ["Water"],
  383: ["Ground"],
  384: ["Dragon", "Flying"],
  385: ["Steel", "Psychic"],
  386: ["Psychic"],
};

/** speciesId → [ability0, ability1] (Gen 3 dual ability slots). */
const SPECIES_ABILITIES: Record<number, [number, number]> = {
  1: [65, 65],
  2: [65, 65],
  3: [65, 65],
  4: [66, 66],
  5: [66, 66],
  6: [66, 66],
  7: [67, 67],
  8: [67, 67],
  9: [67, 67],
  16: [51, 51],
  19: [50, 62],
  25: [9, 9],
  26: [9, 9],
  63: [28, 39],
  66: [62, 62],
  74: [69, 5],
  92: [26, 26],
  94: [26, 26],
  129: [33, 33],
  130: [22, 22],
  133: [50, 50],
  143: [17, 47],
  150: [46, 46],
  151: [28, 28],
  152: [65, 65],
  155: [66, 66],
  158: [67, 67],
  249: [46, 46],
  250: [46, 46],
  251: [30, 30],
  252: [65, 65],
  253: [65, 65],
  254: [65, 65],
  255: [66, 66],
  256: [66, 66],
  257: [66, 66],
  258: [67, 67],
  259: [67, 67],
  260: [67, 67],
  280: [28, 36],
  281: [28, 36],
  282: [28, 36],
  303: [52, 22],
  306: [5, 69],
  373: [22, 22],
  376: [29, 29],
  380: [26, 26],
  381: [26, 26],
  382: [2, 2],
  383: [70, 70],
  384: [76, 76],
  385: [32, 32],
  386: [46, 46],
};

export function speciesTypes(speciesId: number): string[] {
  const t = SPECIES_TYPES[speciesId];
  if (!t) return [];
  return t[1] ? [t[0], t[1]] : [t[0]];
}

export function speciesAbilityName(
  speciesId: number,
  abilitySlot: 0 | 1
): string {
  const pair = SPECIES_ABILITIES[speciesId];
  if (!pair) return abilitySlot === 0 ? "Ability 1" : "Ability 2";
  return abilityName(pair[abilitySlot]!) || `Ability ${abilitySlot + 1}`;
}
