import {
  desmumePayloadLength,
  hasDesmumeFooter,
} from "./desmume.js";
import type {
  DetectionResult,
  GameVersion,
  Generation,
  SaveFormat,
} from "./types.js";

const GBA_SIZES = new Set([0x8000, 0x10000, 0x20000]);
const DS_SIZES = new Set([0x40000, 0x80000, 0x100000]);

/** Gen 3 section game codes (ASCII) at known offsets inside save sections. */
const GEN3_GAME_CODES: Record<string, GameVersion> = {
  AXVE: "ruby",
  AXPE: "sapphire",
  BPEE: "emerald",
  BPRE: "firered",
  BPGE: "leafgreen",
};

const GEN3 = new Set<GameVersion>([
  "ruby",
  "sapphire",
  "emerald",
  "firered",
  "leafgreen",
]);
const GEN4 = new Set<GameVersion>([
  "diamond",
  "pearl",
  "platinum",
  "heartgold",
  "soulsilver",
]);
const GEN5 = new Set<GameVersion>(["black", "white", "black2", "white2"]);
const GEN6 = new Set<GameVersion>(["x", "y", "omegaruby", "alphasapphire"]);
const GEN7 = new Set<GameVersion>(["sun", "moon", "ultrasun", "ultramoon"]);
const GEN8 = new Set<GameVersion>([
  "sword",
  "shield",
  "brilliantdiamond",
  "shiningpearl",
  "legendsarceus",
]);
const GEN9 = new Set<GameVersion>(["scarlet", "violet"]);

function extensionFormat(filename?: string): SaveFormat | null {
  if (!filename) return null;
  const ext = filename.toLowerCase().split(".").pop();
  if (ext === "sav" || ext === "dsv" || ext === "srm" || ext === "zip") {
    return ext;
  }
  return null;
}

/** Longer / more specific needles first so "ultrasun" wins over "sun". */
const FILENAME_GAMES: Array<{ needle: string; game: GameVersion }> = [
  { needle: "firered", game: "firered" },
  { needle: "fire-red", game: "firered" },
  { needle: "leafgreen", game: "leafgreen" },
  { needle: "leaf-green", game: "leafgreen" },
  { needle: "omegaruby", game: "omegaruby" },
  { needle: "omega-ruby", game: "omegaruby" },
  { needle: "omega_ruby", game: "omegaruby" },
  { needle: "alphasapphire", game: "alphasapphire" },
  { needle: "alpha-sapphire", game: "alphasapphire" },
  { needle: "alpha_sapphire", game: "alphasapphire" },
  { needle: "ultrasun", game: "ultrasun" },
  { needle: "ultra-sun", game: "ultrasun" },
  { needle: "ultra_sun", game: "ultrasun" },
  { needle: "ultramoon", game: "ultramoon" },
  { needle: "ultra-moon", game: "ultramoon" },
  { needle: "ultra_moon", game: "ultramoon" },
  { needle: "brilliantdiamond", game: "brilliantdiamond" },
  { needle: "brilliant-diamond", game: "brilliantdiamond" },
  { needle: "brilliant_diamond", game: "brilliantdiamond" },
  { needle: "shiningpearl", game: "shiningpearl" },
  { needle: "shining-pearl", game: "shiningpearl" },
  { needle: "shining_pearl", game: "shiningpearl" },
  { needle: "legendsarceus", game: "legendsarceus" },
  { needle: "legends-arceus", game: "legendsarceus" },
  { needle: "legends_arceus", game: "legendsarceus" },
  { needle: "arceus", game: "legendsarceus" },
  { needle: "heartgold", game: "heartgold" },
  { needle: "heart-gold", game: "heartgold" },
  { needle: "soulsilver", game: "soulsilver" },
  { needle: "soul-silver", game: "soulsilver" },
  { needle: "black2", game: "black2" },
  { needle: "black-2", game: "black2" },
  { needle: "white2", game: "white2" },
  { needle: "white-2", game: "white2" },
  { needle: "emerald", game: "emerald" },
  { needle: "platinum", game: "platinum" },
  { needle: "sapphire", game: "sapphire" },
  { needle: "ruby", game: "ruby" },
  { needle: "diamond", game: "diamond" },
  { needle: "pearl", game: "pearl" },
  { needle: "scarlet", game: "scarlet" },
  { needle: "violet", game: "violet" },
  { needle: "sword", game: "sword" },
  { needle: "shield", game: "shield" },
  { needle: "black", game: "black" },
  { needle: "white", game: "white" },
  { needle: "sun", game: "sun" },
  { needle: "moon", game: "moon" },
  { needle: "-x-", game: "x" },
  { needle: "_x_", game: "x" },
  { needle: "pokemonx", game: "x" },
  { needle: "pokemon-x", game: "x" },
  { needle: "-y-", game: "y" },
  { needle: "_y_", game: "y" },
  { needle: "pokemony", game: "y" },
  { needle: "pokemon-y", game: "y" },
];

function guessGameFromFilename(filename?: string): GameVersion | null {
  if (!filename) return null;
  const base = filename.toLowerCase().replace(/\.[^.]+$/, "");
  // Exact single-letter dumps: x.sav / y.sav
  if (base === "x") return "x";
  if (base === "y") return "y";
  for (const { needle, game } of FILENAME_GAMES) {
    if (base.includes(needle)) return game;
  }
  return null;
}

function scanGen3GameCode(data: Buffer): GameVersion | null {
  const limit = Math.min(data.length, 0x20000);
  for (let i = 0; i < limit - 4; i++) {
    const code = data.toString("ascii", i, i + 4);
    if (GEN3_GAME_CODES[code]) {
      return GEN3_GAME_CODES[code];
    }
  }
  return null;
}

function generationForGame(game: GameVersion): Generation {
  if (GEN3.has(game)) return 3;
  if (GEN4.has(game)) return 4;
  if (GEN5.has(game)) return 5;
  if (GEN6.has(game)) return 6;
  if (GEN7.has(game)) return 7;
  if (GEN8.has(game)) return 8;
  if (GEN9.has(game)) return 9;
  return null;
}

function guessGeneration(payloadSize: number, game: GameVersion): Generation {
  const fromGame = generationForGame(game);
  if (fromGame != null) return fromGame;
  if (GBA_SIZES.has(payloadSize) || GBA_SIZES.has(payloadSize - 16)) {
    return 3;
  }
  if (DS_SIZES.has(payloadSize)) {
    return 4;
  }
  return null;
}

function gameLabel(game: GameVersion, generation: Generation): string {
  const names: Record<GameVersion, string> = {
    ruby: "Pokémon Ruby",
    sapphire: "Pokémon Sapphire",
    emerald: "Pokémon Emerald",
    firered: "Pokémon FireRed",
    leafgreen: "Pokémon LeafGreen",
    diamond: "Pokémon Diamond",
    pearl: "Pokémon Pearl",
    platinum: "Pokémon Platinum",
    heartgold: "Pokémon HeartGold",
    soulsilver: "Pokémon SoulSilver",
    black: "Pokémon Black",
    white: "Pokémon White",
    black2: "Pokémon Black 2",
    white2: "Pokémon White 2",
    x: "Pokémon X",
    y: "Pokémon Y",
    omegaruby: "Pokémon Omega Ruby",
    alphasapphire: "Pokémon Alpha Sapphire",
    sun: "Pokémon Sun",
    moon: "Pokémon Moon",
    ultrasun: "Pokémon Ultra Sun",
    ultramoon: "Pokémon Ultra Moon",
    sword: "Pokémon Sword",
    shield: "Pokémon Shield",
    brilliantdiamond: "Pokémon Brilliant Diamond",
    shiningpearl: "Pokémon Shining Pearl",
    legendsarceus: "Pokémon Legends: Arceus",
    scarlet: "Pokémon Scarlet",
    violet: "Pokémon Violet",
    unknown: generation
      ? `Gen ${generation} save (game unclear)`
      : "Unrecognized save",
  };
  return names[game];
}

export function detectSave(
  data: Buffer,
  filename?: string
): DetectionResult {
  const notes: string[] = [];
  const ext = extensionFormat(filename);
  const dsvFooter = hasDesmumeFooter(data);
  const payloadSize = dsvFooter ? desmumePayloadLength(data) : data.length;

  let format: SaveFormat = "unknown";
  if (dsvFooter || ext === "dsv") {
    format = "dsv";
    if (dsvFooter) notes.push("DeSmuME-style footer detected.");
  } else if (ext === "srm") {
    format = "srm";
  } else if (ext === "zip") {
    format = "zip";
    notes.push("Zip archives are stored as-is in Phase 1.");
  } else if (
    ext === "sav" ||
    GBA_SIZES.has(payloadSize) ||
    DS_SIZES.has(payloadSize)
  ) {
    format = "sav";
  }

  if (GBA_SIZES.has(payloadSize - 16)) {
    notes.push("Possible GBA RTC trailing bytes.");
  }

  const gen3 =
    format === "zip" ? null : scanGen3GameCode(data.subarray(0, payloadSize));
  const fromName = guessGameFromFilename(filename);
  const gameVersion: GameVersion = gen3 ?? fromName ?? "unknown";
  if (!gen3 && fromName) {
    notes.push(`Game inferred from filename (${fromName}).`);
  }
  const generation = guessGeneration(payloadSize, gameVersion);
  const modernKnown =
    gameVersion !== "unknown" &&
    generation != null &&
    generation >= 6;

  const sizeOk =
    GBA_SIZES.has(payloadSize) ||
    GBA_SIZES.has(payloadSize - 16) ||
    DS_SIZES.has(payloadSize) ||
    dsvFooter ||
    modernKnown;

  if (modernKnown && format === "unknown" && ext === "sav") {
    format = "sav";
  }

  const recognized =
    format !== "unknown" &&
    format !== "zip" &&
    sizeOk &&
    (gameVersion !== "unknown" || generation !== null);

  if (!recognized) {
    notes.push("File can still be vaulted as unrecognized.");
  }

  return {
    format: format === "unknown" && ext ? ext : format,
    generation,
    gameVersion,
    recognized,
    sizeBytes: data.length,
    hasDesmumeFooter: dsvFooter,
    rawPayloadSize: payloadSize,
    label: gameLabel(gameVersion, generation),
    notes,
  };
}
