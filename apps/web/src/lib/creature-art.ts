import { pixelDataUri } from "./pixel";

/** Type-tinted original glyph when official sprites are unavailable / public mode. */
const TYPE_COLORS: Record<string, { hi: string; mid: string; lo: string }> = {
  Normal: { hi: "#e0d8c8", mid: "#a8a090", lo: "#585040" },
  Fire: { hi: "#f8a878", mid: "#f08030", lo: "#a04010" },
  Water: { hi: "#98d0f8", mid: "#6890f0", lo: "#2848a0" },
  Grass: { hi: "#a8e080", mid: "#78c850", lo: "#287020" },
  Electric: { hi: "#f8e878", mid: "#f8d030", lo: "#a08010" },
  Ice: { hi: "#d0f8f8", mid: "#98d8d8", lo: "#387088" },
  Fighting: { hi: "#e89078", mid: "#c03028", lo: "#681818" },
  Poison: { hi: "#d8a0e8", mid: "#a040a0", lo: "#501850" },
  Ground: { hi: "#ecd8a0", mid: "#e0c068", lo: "#786028" },
  Flying: { hi: "#c8b8f8", mid: "#a890f0", lo: "#504088" },
  Psychic: { hi: "#f8b0c0", mid: "#f85888", lo: "#882848" },
  Bug: { hi: "#d0e868", mid: "#a8b820", lo: "#486010" },
  Rock: { hi: "#d8c878", mid: "#b8a038", lo: "#584818" },
  Ghost: { hi: "#a890c0", mid: "#705898", lo: "#302050" },
  Dragon: { hi: "#a890f8", mid: "#7038f8", lo: "#301888" },
  Dark: { hi: "#908878", mid: "#705848", lo: "#282018" },
  Steel: { hi: "#d8d8e8", mid: "#b8b8d0", lo: "#484868" },
  Fairy: { hi: "#f8c8e0", mid: "#ee99ac", lo: "#884060" },
};

const BODY = [
  "................",
  "......OOOO......",
  "....OOKKKKOO....",
  "...OKMMMMMMKO...",
  "..OKMHHHHHHMKO..",
  "..OKMHHYYHHMKO..",
  ".OKMHHYEEYHHMKO.",
  ".OKMHHYEEYHHMKO.",
  ".OKMHHHHHHHHMKO.",
  ".OKMMHHHHHHMMKO.",
  "..OKKMMMMMMKKO..",
  "...OOKKKKKKOO...",
  "....OO....OO....",
  "...OKO....OKO...",
  "...OO......OO...",
  "................",
];

export function creatureGlyphUri(
  speciesId: number,
  types: string[] = ["Normal"]
): string {
  const primary = TYPE_COLORS[types[0] || "Normal"] || TYPE_COLORS.Normal;
  const secondary =
    TYPE_COLORS[types[1] || ""] ||
    (speciesId % 2 === 0 ? primary : TYPE_COLORS.Normal);

  return pixelDataUri(BODY, {
    O: "#1a1a22",
    K: "#0e0e14",
    M: primary.lo,
    H: primary.mid,
    Y: secondary.hi,
    E: "#1a1a22",
  });
}

/** Private-build sprite URLs (PokeAPI community mirrors). Not used in PUBLIC_MODE. */
export function pokeApiSpriteUrl(
  speciesId: number,
  shiny = false,
  variant: "pixel" | "art" = "pixel"
): string | null {
  if (!speciesId || speciesId < 1) return null;
  const base =
    "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon";
  if (variant === "art") {
    return `${base}/other/official-artwork/${speciesId}.png`;
  }
  return shiny
    ? `${base}/shiny/${speciesId}.png`
    : `${base}/${speciesId}.png`;
}
