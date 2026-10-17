/** Known per-game UI themes (Gen 3–9). Matches `data-theme` in CSS. */
export const GAME_THEMES = [
  "firered",
  "leafgreen",
  "emerald",
  "ruby",
  "sapphire",
  "diamond",
  "pearl",
  "platinum",
  "heartgold",
  "soulsilver",
  "black",
  "white",
  "black2",
  "white2",
  "x",
  "y",
  "omegaruby",
  "alphasapphire",
  "sun",
  "moon",
  "ultrasun",
  "ultramoon",
  "sword",
  "shield",
  "brilliantdiamond",
  "shiningpearl",
  "legendsarceus",
  "scarlet",
  "violet",
] as const;

export type GameTheme = (typeof GAME_THEMES)[number];
export type ThemeId = GameTheme | "unknown";
export type ThemeEra =
  | "gen3"
  | "gen4-sinnoh"
  | "gen4-johto"
  | "gen5"
  | "gen6-kalos"
  | "gen6-hoenn"
  | "gen7-alola"
  | "gen8-galar"
  | "gen8-sinnoh"
  | "gen8-hisui"
  | "gen9-paldea"
  | "unknown";
/** Hardware era dial — drives pixel intensity, corners, glass, motion. */
export type ThemePlatform = "gba" | "ds" | "3ds" | "switch" | "unknown";
export type CartForm = "gba" | "ds" | "3ds" | "switch";

const THEME_SET = new Set<string>(GAME_THEMES);

export const DEFAULT_THEME: GameTheme = "firered";

export function resolveTheme(
  gameVersion: string | null | undefined
): ThemeId {
  if (gameVersion && THEME_SET.has(gameVersion)) {
    return gameVersion as GameTheme;
  }
  return "unknown";
}

export function themeEra(theme: string): ThemeEra {
  switch (theme) {
    case "firered":
    case "leafgreen":
    case "emerald":
    case "ruby":
    case "sapphire":
      return "gen3";
    case "diamond":
    case "pearl":
    case "platinum":
      return "gen4-sinnoh";
    case "heartgold":
    case "soulsilver":
      return "gen4-johto";
    case "black":
    case "white":
    case "black2":
    case "white2":
      return "gen5";
    case "x":
    case "y":
      return "gen6-kalos";
    case "omegaruby":
    case "alphasapphire":
      return "gen6-hoenn";
    case "sun":
    case "moon":
    case "ultrasun":
    case "ultramoon":
      return "gen7-alola";
    case "sword":
    case "shield":
      return "gen8-galar";
    case "brilliantdiamond":
    case "shiningpearl":
      return "gen8-sinnoh";
    case "legendsarceus":
      return "gen8-hisui";
    case "scarlet":
    case "violet":
      return "gen9-paldea";
    default:
      return "unknown";
  }
}

export function themePlatform(theme: string): ThemePlatform {
  const era = themeEra(theme);
  if (era === "gen3") return "gba";
  if (era === "gen4-sinnoh" || era === "gen4-johto" || era === "gen5") {
    return "ds";
  }
  if (
    era === "gen6-kalos" ||
    era === "gen6-hoenn" ||
    era === "gen7-alola"
  ) {
    return "3ds";
  }
  if (
    era === "gen8-galar" ||
    era === "gen8-sinnoh" ||
    era === "gen8-hisui" ||
    era === "gen9-paldea"
  ) {
    return "switch";
  }
  return "unknown";
}

export function cartForm(
  generation: number | null,
  theme: string
): CartForm {
  if (generation === 6 || generation === 7) return "3ds";
  if (generation === 8 || generation === 9) return "switch";
  if (generation === 4 || generation === 5) return "ds";
  const platform = themePlatform(theme);
  if (platform === "3ds" || platform === "switch" || platform === "ds") {
    return platform;
  }
  return "gba";
}

export interface DocumentThemeState {
  theme: string;
  era: string;
  platform: string;
}

/** Snapshot current `<html>` theme datasets. */
export function readDocumentTheme(): DocumentThemeState {
  const root = document.documentElement;
  return {
    theme: root.dataset.theme || DEFAULT_THEME,
    era: root.dataset.era || "gen3",
    platform: root.dataset.platform || "gba",
  };
}

/** Apply a game theme to `<html>` for scene + UI tokens. */
export function applyThemeToDocument(
  gameVersion: string | null | undefined
): DocumentThemeState {
  const theme = resolveTheme(gameVersion);
  const resolved = theme === "unknown" ? DEFAULT_THEME : theme;
  const root = document.documentElement;
  const prev = readDocumentTheme();
  root.dataset.theme = resolved;
  root.dataset.era = themeEra(resolved);
  root.dataset.platform = themePlatform(resolved);
  return prev;
}

/** Restore a previously snapshotted document theme. */
export function restoreDocumentTheme(state: DocumentThemeState): void {
  const root = document.documentElement;
  root.dataset.theme = state.theme || DEFAULT_THEME;
  root.dataset.era = state.era || "gen3";
  root.dataset.platform = state.platform || "gba";
}
