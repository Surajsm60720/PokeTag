/** Read-only parse snapshot shapes (Phase 2). Demo or PKHeX later fills these. */

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
  moveDetails: ParsedMove[];
  heldItemId: number | null;
  ball: string | null;
  metLevel: number | null;
  metLocation: string | null;
  metLocationId: number | null;
  originGame: string | null;
  originKind: "wild" | "egg" | "trade" | "gift" | "fateful" | "unknown";
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

export interface ParsedSnapshot {
  versionId: string;
  gameVersion: string;
  parserVersion: string;
  isDemo: boolean;
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

/** Fill enrichment fields missing from older demo / DB rows. */
export function withPokemonDefaults(
  p: Partial<ParsedPokemon> &
    Pick<
      ParsedPokemon,
      | "slot"
      | "speciesId"
      | "speciesName"
      | "nickname"
      | "level"
      | "currentHp"
      | "maxHp"
      | "gender"
      | "shiny"
      | "ability"
      | "nature"
      | "heldItem"
      | "moves"
      | "types"
      | "friendship"
    >
): ParsedPokemon {
  return {
    ...p,
    moveDetails:
      p.moveDetails ??
      (p.moves ?? []).map((name) => ({
        id: 0,
        name,
        pp: null,
        type: "unknown",
        power: null,
        accuracy: null,
        category: "unknown" as const,
      })),
    heldItemId: p.heldItemId ?? null,
    ball: p.ball ?? null,
    metLevel: p.metLevel ?? null,
    metLocation: p.metLocation ?? null,
    metLocationId: p.metLocationId ?? null,
    originGame: p.originGame ?? null,
    originKind: p.originKind ?? "unknown",
    caughtAt: p.caughtAt ?? null,
    otName: p.otName ?? "",
  };
}

export function formatPlayTime(seconds: number | null | undefined): string {
  if (seconds == null || Number.isNaN(seconds) || seconds < 0) return "—";
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${h}:${pad(m)}:${pad(s)}`;
}

/** Compact play time for tight cartridge labels (no seconds). */
export function formatPlayTimeShort(
  seconds: number | null | undefined
): string {
  if (seconds == null || Number.isNaN(seconds) || seconds < 0) return "—";
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const pad = (n: number) => String(n).padStart(2, "0");
  if (h >= 100) return `${h}h`;
  return `${h}:${pad(m)}`;
}

export function formatMoney(amount: number | null | undefined): string {
  if (amount == null || Number.isNaN(amount)) return "—";
  return `₽${amount.toLocaleString("en-US")}`;
}

export function hpTone(current: number, max: number): "green" | "yellow" | "red" {
  if (max <= 0) return "red";
  const ratio = current / max;
  if (ratio > 0.5) return "green";
  if (ratio > 0.2) return "yellow";
  return "red";
}

export function badgeCount(badges: ParsedBadge[] | null | undefined): number {
  if (!badges?.length) return 0;
  return badges.filter((b) => b.earned).length;
}
