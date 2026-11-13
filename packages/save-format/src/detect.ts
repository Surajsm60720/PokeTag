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

/**
 * Decrypted 3DS / Switch "main" (and close cousins) sizes used by PKHeX / Citra /
 * Azahar / JKSV dumps. Size alone identifies the generation family; X vs Y etc.
 * still needs a filename or hint.
 */
const MODERN_SAVE_SIZES: Array<{
  size: number;
  generation: Generation;
  /** Soft default when the pair is ambiguous (XY, ORAS, …). */
  softGame?: GameVersion;
  note: string;
}> = [
  { size: 0x65600, generation: 6, softGame: "x", note: "Gen 6 XY-sized main" },
  {
    size: 0x76000,
    generation: 6,
    softGame: "omegaruby",
    note: "Gen 6 ORAS-sized main",
  },
  { size: 0x6be00, generation: 7, softGame: "sun", note: "Gen 7 SM-sized main" },
  {
    size: 0x6cc00,
    generation: 7,
    softGame: "ultrasun",
    note: "Gen 7 USUM-sized main",
  },
];

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
const SPINOFF = new Set<GameVersion>(["pokkentournamentdx"]);

function extensionFormat(filename?: string): SaveFormat | null {
  if (!filename) return null;
  const base = filename.toLowerCase().replace(/^.*[/\\]/, "");
  if (base === "main" || base === "main.bak") return "main";
  const ext = base.split(".").pop();
  if (
    ext === "sav" ||
    ext === "dsv" ||
    ext === "srm" ||
    ext === "zip" ||
    ext === "np"
  ) {
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
  { needle: "omega ruby", game: "omegaruby" },
  { needle: "alphasapphire", game: "alphasapphire" },
  { needle: "alpha-sapphire", game: "alphasapphire" },
  { needle: "alpha_sapphire", game: "alphasapphire" },
  { needle: "alpha sapphire", game: "alphasapphire" },
  { needle: "ultrasun", game: "ultrasun" },
  { needle: "ultra-sun", game: "ultrasun" },
  { needle: "ultra_sun", game: "ultrasun" },
  { needle: "ultra sun", game: "ultrasun" },
  { needle: "ultramoon", game: "ultramoon" },
  { needle: "ultra-moon", game: "ultramoon" },
  { needle: "ultra_moon", game: "ultramoon" },
  { needle: "ultra moon", game: "ultramoon" },
  { needle: "brilliantdiamond", game: "brilliantdiamond" },
  { needle: "brilliant-diamond", game: "brilliantdiamond" },
  { needle: "brilliant_diamond", game: "brilliantdiamond" },
  { needle: "brilliant diamond", game: "brilliantdiamond" },
  { needle: "shiningpearl", game: "shiningpearl" },
  { needle: "shining-pearl", game: "shiningpearl" },
  { needle: "shining_pearl", game: "shiningpearl" },
  { needle: "shining pearl", game: "shiningpearl" },
  { needle: "legendsarceus", game: "legendsarceus" },
  { needle: "legends-arceus", game: "legendsarceus" },
  { needle: "legends_arceus", game: "legendsarceus" },
  { needle: "legends arceus", game: "legendsarceus" },
  { needle: "arceus", game: "legendsarceus" },
  { needle: "pokkentournamentdx", game: "pokkentournamentdx" },
  { needle: "pokken tournament dx", game: "pokkentournamentdx" },
  { needle: "pokkén tournament dx", game: "pokkentournamentdx" },
  { needle: "pokken dx", game: "pokkentournamentdx" },
  { needle: "pokken", game: "pokkentournamentdx" },
  { needle: "pokkén", game: "pokkentournamentdx" },
  { needle: "heartgold", game: "heartgold" },
  { needle: "heart-gold", game: "heartgold" },
  { needle: "heart gold", game: "heartgold" },
  { needle: "soulsilver", game: "soulsilver" },
  { needle: "soul-silver", game: "soulsilver" },
  { needle: "soul silver", game: "soulsilver" },
  { needle: "black2", game: "black2" },
  { needle: "black-2", game: "black2" },
  { needle: "black 2", game: "black2" },
  { needle: "white2", game: "white2" },
  { needle: "white-2", game: "white2" },
  { needle: "white 2", game: "white2" },
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
  { needle: "pokemon x", game: "x" },
  { needle: "pokémon x", game: "x" },
  { needle: "pokemon y", game: "y" },
  { needle: "pokémon y", game: "y" },
  { needle: "-x-", game: "x" },
  { needle: "_x_", game: "x" },
  { needle: "pokemonx", game: "x" },
  { needle: "pokemon-x", game: "x" },
  { needle: "-y-", game: "y" },
  { needle: "_y_", game: "y" },
  { needle: "pokemony", game: "y" },
  { needle: "pokemon-y", game: "y" },
];

function normalizeHint(text: string): string {
  return text.toLowerCase().normalize("NFKD").replace(/\p{M}/gu, "");
}

function guessGameFromText(text?: string): GameVersion | null {
  if (!text) return null;
  const base = normalizeHint(text).replace(/\.[^.]+$/, "");
  // Exact single-letter dumps: x.sav / y.sav
  if (base === "x") return "x";
  if (base === "y") return "y";
  for (const { needle, game } of FILENAME_GAMES) {
    if (base.includes(normalizeHint(needle))) return game;
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

function modernSizeMatch(payloadSize: number) {
  return MODERN_SAVE_SIZES.find((m) => m.size === payloadSize);
}

/** PKHeX GameVersion byte at MyStatus+0x04 for Gen 6 decrypted mains. */
const GEN6_GAME_BYTE: Record<number, GameVersion> = {
  24: "x",
  25: "y",
  26: "alphasapphire",
  27: "omegaruby",
};

function peekGen6GameByte(
  data: Buffer,
  payloadSize: number
): GameVersion | null {
  if (payloadSize !== 0x65600 && payloadSize !== 0x76000) return null;
  if (data.length < 0x14005) return null;
  return GEN6_GAME_BYTE[data[0x14004]!] ?? null;
}

function generationForGame(game: GameVersion): Generation {
  if (GEN3.has(game)) return 3;
  if (GEN4.has(game)) return 4;
  if (GEN5.has(game)) return 5;
  if (GEN6.has(game)) return 6;
  if (GEN7.has(game)) return 7;
  if (GEN8.has(game)) return 8;
  if (GEN9.has(game)) return 9;
  if (SPINOFF.has(game)) return null;
  return null;
}

function guessGeneration(payloadSize: number, game: GameVersion): Generation {
  const fromGame = generationForGame(game);
  if (fromGame != null) return fromGame;
  if (SPINOFF.has(game)) return null;
  const modern = modernSizeMatch(payloadSize);
  if (modern) return modern.generation;
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
    pokkentournamentdx: "Pokkén Tournament DX",
    unknown: generation
      ? `Gen ${generation} save (game unclear)`
      : "Unrecognized save",
  };
  return names[game];
}

export interface DetectSaveOptions {
  /** Extra text to scan for a game name (run label, folder, title id…). */
  hint?: string;
}

export function detectSave(
  data: Buffer,
  filename?: string,
  options?: DetectSaveOptions
): DetectionResult {
  const notes: string[] = [];
  const ext = extensionFormat(filename);
  const dsvFooter = hasDesmumeFooter(data);
  const payloadSize = dsvFooter ? desmumePayloadLength(data) : data.length;
  const modern = modernSizeMatch(payloadSize);

  let format: SaveFormat = "unknown";
  if (dsvFooter || ext === "dsv") {
    format = "dsv";
    if (dsvFooter) notes.push("DeSmuME-style footer detected.");
  } else if (ext === "srm") {
    format = "srm";
  } else if (ext === "zip") {
    format = "zip";
    notes.push("Zip archives are stored as-is in Phase 1.");
  } else if (ext === "np") {
    format = "np";
  } else if (ext === "main") {
    format = "main";
  } else if (
    ext === "sav" ||
    GBA_SIZES.has(payloadSize) ||
    DS_SIZES.has(payloadSize) ||
    modern
  ) {
    format = modern ? "main" : "sav";
  }

  if (GBA_SIZES.has(payloadSize - 16)) {
    notes.push("Possible GBA RTC trailing bytes.");
  }

  const gen3 =
    format === "zip" ? null : scanGen3GameCode(data.subarray(0, payloadSize));
  const fromName = guessGameFromText(filename);
  const fromHint = guessGameFromText(options?.hint);
  let gameVersion: GameVersion = gen3 ?? fromName ?? fromHint ?? "unknown";
  if (!gen3 && fromName) {
    notes.push(`Game inferred from filename (${fromName}).`);
  } else if (!gen3 && !fromName && fromHint) {
    notes.push(`Game inferred from label (${fromHint}).`);
  }

  // Decrypted Gen 6/7 mains store the PKHeX GameVersion byte in MyStatus.
  const fromStatus = peekGen6GameByte(data, payloadSize);
  if (fromStatus) {
    if (gameVersion === "unknown" || gameVersion !== fromStatus) {
      if (gameVersion !== "unknown" && gameVersion !== fromStatus) {
        notes.push(
          `Filename/label said ${gameVersion}, but save header is ${fromStatus}.`
        );
      } else if (gameVersion === "unknown") {
        notes.push(`Game read from save header (${fromStatus}).`);
      }
      gameVersion = fromStatus;
    }
  } else if (gameVersion === "unknown" && modern?.softGame) {
    // Size can pin the family when the name is just "main".
    gameVersion = modern.softGame;
    notes.push(
      `${modern.note}; defaulting to ${modern.softGame} until a filename/label says otherwise.`
    );
  }

  if (gameVersion === "unknown" && format === "np") {
    gameVersion = "pokkentournamentdx";
    notes.push("`.np` treated as Pokkén Tournament DX (Switch).");
  }

  const generation = guessGeneration(payloadSize, gameVersion);
  const spinoff = SPINOFF.has(gameVersion);
  const modernKnown =
    gameVersion !== "unknown" &&
    ((generation != null && generation >= 6) || spinoff);

  const sizeOk =
    GBA_SIZES.has(payloadSize) ||
    GBA_SIZES.has(payloadSize - 16) ||
    DS_SIZES.has(payloadSize) ||
    Boolean(modern) ||
    dsvFooter ||
    modernKnown ||
    format === "np";

  if (modernKnown && format === "unknown") {
    format = spinoff ? "np" : "main";
  }

  const recognized =
    format !== "unknown" &&
    format !== "zip" &&
    sizeOk &&
    (gameVersion !== "unknown" || generation !== null || spinoff);

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
