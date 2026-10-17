/** Shared parse snapshot shapes for Gen 3–9 native parsers. */

export interface ParsedMove {
  id: number;
  name: string;
  pp: number | null;
  type: string;
  power: number | null;
  accuracy: number | null;
  category: "physical" | "special" | "status" | "unknown";
}

export interface ParsedPokemon {
  slot: number;
  speciesId: number;
  speciesName: string;
  nickname: string;
  level: number;
  currentHp: number;
  maxHp: number;
  gender: "M" | "F" | "U";
  shiny: boolean;
  ability: string;
  nature: string;
  heldItem: string | null;
  moves: string[];
  types: string[];
  friendship: number;
  origin?: string;
  /** Parallel to moves[]; moves[] stays as names for compat. */
  moveDetails: ParsedMove[];
  heldItemId: number | null;
  ball: string | null;
  metLevel: number | null;
  metLocation: string | null;
  metLocationId: number | null;
  originGame: string | null;
  originKind: "wild" | "egg" | "trade" | "gift" | "fateful" | "unknown";
  /** Display string or null if gen has no date. */
  caughtAt: string | null;
  otName: string;
}

export interface ParsedBagItem {
  id: number;
  name: string;
  quantity: number;
  pocket: "items" | "key" | "balls" | "tmhm" | "berries" | "medicine" | "other" | "pc";
}

export interface ParsedInventory {
  bag: ParsedBagItem[];
  pc: ParsedBagItem[];
}

export interface ParsedStoryProgress {
  eliteFourDefeated: boolean | null;
  championDefeated: boolean | null;
  note: string;
}

export interface ParsedTrainer {
  name: string;
  trainerId: number;
  secretId: number;
  money: number;
  gender: "M" | "F";
}

export interface ParsedBadge {
  id: string;
  name: string;
  earned: boolean;
}

export interface ParsedBox {
  index: number;
  name: string;
  wallpaper: string;
  /** Fixed-length grid; null = empty cell. */
  pokemon: Array<ParsedPokemon | null>;
}

export interface ParsedDexEntry {
  speciesId: number;
  speciesName: string;
  seen: boolean;
  owned: boolean;
}

export interface ParsedDex {
  seen: number;
  owned: number;
  regionalTotal: number;
  /** Sample strip for the dashboard (not every national entry). */
  entries: ParsedDexEntry[];
}

export interface ParsedSave {
  gameVersion: string;
  parserVersion: string;
  isDemo: false;
  trainer: ParsedTrainer;
  party: ParsedPokemon[];
  boxes: ParsedBox[];
  dex: ParsedDex;
  badges: ParsedBadge[];
  playTimeSeconds: number;
  location: string;
  locationMapId: number | null;
  inventory: ParsedInventory;
  progress: ParsedStoryProgress;
}

export const PARSER_VERSION = "0.2.0";

export function emptyInventory(): ParsedInventory {
  return { bag: [], pc: [] };
}

export function emptyProgress(note = ""): ParsedStoryProgress {
  return {
    eliteFourDefeated: null,
    championDefeated: null,
    note,
  };
}
