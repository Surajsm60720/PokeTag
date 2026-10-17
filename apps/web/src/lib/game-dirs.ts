/**
 * Title IDs and typical save directories for 3DS / Switch dumps & emulators.
 * USA/EU IDs listed; JP often differs. Paths are hints, not guarantees.
 */

export interface GameDirInfo {
  gameVersion: string;
  platform: "gba" | "ds" | "3ds" | "switch";
  /** Nintendo title ID when applicable. */
  titleId?: string;
  /** Lower 8 hex digits used under 3DS title/00040000/. */
  titleIdLow?: string;
  /** Short product code / cart code when useful. */
  productCode?: string;
  /** Human-readable save locations. */
  paths: Array<{
    label: string;
    path: string;
    note?: string;
  }>;
}

const CITRA_BASE =
  "~/Library/Application Support/Citra/sdmc/Nintendo 3DS/<ID0>/<ID1>/title/00040000";
const LIME_BASE =
  "~/.local/share/lime3ds-emu/sdmc/Nintendo 3DS/<ID0>/<ID1>/title/00040000";

function citraPaths(low: string, name: string): GameDirInfo["paths"] {
  const lowUpper = low.toUpperCase();
  return [
    {
      label: "Citra (macOS)",
      path: `${CITRA_BASE}/${low}/data/00000001/`,
      note: `${name} — look for main / saveData in this folder.`,
    },
    {
      label: "Citra (Windows)",
      path: `%APPDATA%\\Citra\\sdmc\\Nintendo 3DS\\<ID0>\\<ID1>\\title\\00040000\\${low}\\data\\00000001\\`,
    },
    {
      label: "Lime3DS / Citra (Linux)",
      path: `${LIME_BASE}/${low}/data/00000001/`,
    },
    {
      label: "Azahar / PabloMK7 Citra (Android)",
      path: `Android/data/<citra-package>/files/sdmc/Nintendo 3DS/<ID0>/<ID1>/title/00040000/${low}/data/00000001/`,
    },
    {
      label: "Checkpoint (3DS SD)",
      path: `sdmc:/3ds/Checkpoint/saves/0x00040000${lowUpper} ${name}/`,
    },
    {
      label: "JKSM (3DS SD)",
      path: `sdmc:/JKSV/${name}/`,
      note: "Exported save dumps — copy back via the same app.",
    },
  ];
}

function switchPaths(titleId: string, name: string): GameDirInfo["paths"] {
  const tid = titleId.toUpperCase();
  const tidLow = tid.toLowerCase();
  return [
    {
      label: "Checkpoint (Switch SD)",
      path: `sdmc:/switch/Checkpoint/saves/0x${tid} ${name}/`,
    },
    {
      label: "JKSV (Switch SD)",
      path: `sdmc:/JKSV/${name}/`,
    },
    {
      label: "Ryujinx (macOS)",
      path: `~/Library/Application Support/Ryujinx/bis/user/save/`,
      note: `Look under the user save tree for title ${tid}.`,
    },
    {
      label: "Ryujinx (Windows)",
      path: `%APPDATA%\\Ryujinx\\bis\\user\\save\\`,
      note: `Title ${tid} under the user save tree.`,
    },
    {
      label: "Ryujinx (Linux)",
      path: `~/.config/Ryujinx/bis/user/save/`,
      note: `Title ${tid} under the user save tree.`,
    },
    {
      label: "Yuzu / Suyu (macOS)",
      path: `~/Library/Application Support/yuzu/nand/user/save/0000000000000000/<user>/${tidLow}/`,
    },
    {
      label: "Yuzu / Suyu (Windows)",
      path: `%APPDATA%\\yuzu\\nand\\user\\save\\0000000000000000\\<user>\\${tidLow}\\`,
    },
    {
      label: "Yuzu / Suyu (Linux)",
      path: `~/.local/share/yuzu/nand/user/save/0000000000000000/<user>/${tidLow}/`,
    },
    {
      label: "Atmosphere contents",
      path: `sdmc:/atmosphere/contents/${tid}/`,
      note: "Mods / LayeredFS — not the raw save, but the title folder.",
    },
  ];
}

function gbaPaths(filename: string): GameDirInfo["paths"] {
  const srm = filename.replace(/\.sav$/i, ".srm");
  return [
    {
      label: "mGBA (macOS)",
      path: `Same folder as the ROM → ${filename}`,
      note: "Or ~/Library/Application Support/mgba/ if configured.",
    },
    {
      label: "mGBA (Windows)",
      path: `Same folder as the ROM → ${filename}`,
      note: "Or %APPDATA%\\mgba\\",
    },
    {
      label: "mGBA (Linux)",
      path: `Same folder as the ROM → ${filename}`,
      note: "Or ~/.config/mgba/",
    },
    {
      label: "VBA-M / VisualBoyAdvance",
      path: `Same folder as the ROM → ${filename}`,
    },
    {
      label: "OpenEmu (macOS)",
      path: `~/Library/Application Support/OpenEmu/Game Library/Battery Saves/ → ${filename}`,
    },
    {
      label: "RetroArch (cross-platform)",
      path: `RetroArch/saves/ → ${srm}`,
      note: "Core often writes .srm; rename to .sav for some carts.",
    },
    {
      label: "My Boy! (Android)",
      path: `Android/data/com.fastemulator.gba/files/ → ${filename}`,
      note: "Path varies by version; use the in-app file browser if scoped storage hides it.",
    },
    {
      label: "Pizza Boy GBA (Android)",
      path: `Android/data/it.dbtecno.pizzaboygba/files/saves/ → ${filename}`,
    },
  ];
}

function dsPaths(filename: string): GameDirInfo["paths"] {
  return [
    {
      label: "melonDS (macOS)",
      path: `~/Library/Application Support/melonDS/ → ${filename}`,
    },
    {
      label: "melonDS (Windows)",
      path: `%APPDATA%\\melonDS\\ → ${filename}`,
    },
    {
      label: "melonDS (Linux)",
      path: `~/.config/melonDS/ → ${filename}`,
    },
    {
      label: "DeSmuME (macOS)",
      path: `~/Library/Application Support/DeSmuME/Battery/ → ${filename}`,
    },
    {
      label: "DeSmuME (Windows)",
      path: `Battery\\ next to the exe → ${filename}`,
    },
    {
      label: "RetroArch (DS)",
      path: `RetroArch/saves/ → ${filename.replace(/\.sav$/i, ".srm")}`,
    },
    {
      label: "DraStic (Android)",
      path: `Android/data/com.dsemu.drastic/files/backup/ → ${filename}`,
    },
  ];
}

export const GAME_DIRS: Record<string, GameDirInfo> = {
  firered: {
    gameVersion: "firered",
    platform: "gba",
    productCode: "BPRE",
    paths: gbaPaths("Pokemon - FireRed Version.sav"),
  },
  leafgreen: {
    gameVersion: "leafgreen",
    platform: "gba",
    productCode: "BPGE",
    paths: gbaPaths("Pokemon - LeafGreen Version.sav"),
  },
  ruby: {
    gameVersion: "ruby",
    platform: "gba",
    productCode: "AXVE",
    paths: gbaPaths("Pokemon - Ruby Version.sav"),
  },
  sapphire: {
    gameVersion: "sapphire",
    platform: "gba",
    productCode: "AXPE",
    paths: gbaPaths("Pokemon - Sapphire Version.sav"),
  },
  emerald: {
    gameVersion: "emerald",
    platform: "gba",
    productCode: "BPEE",
    paths: gbaPaths("Pokemon - Emerald Version.sav"),
  },
  diamond: {
    gameVersion: "diamond",
    platform: "ds",
    productCode: "ADAE",
    paths: dsPaths("Pokemon Diamond.sav"),
  },
  pearl: {
    gameVersion: "pearl",
    platform: "ds",
    productCode: "APAE",
    paths: dsPaths("Pokemon Pearl.sav"),
  },
  platinum: {
    gameVersion: "platinum",
    platform: "ds",
    productCode: "CPUE",
    paths: dsPaths("Pokemon Platinum.sav"),
  },
  heartgold: {
    gameVersion: "heartgold",
    platform: "ds",
    productCode: "IPKE",
    paths: dsPaths("Pokemon HeartGold.sav"),
  },
  soulsilver: {
    gameVersion: "soulsilver",
    platform: "ds",
    productCode: "IPGE",
    paths: dsPaths("Pokemon SoulSilver.sav"),
  },
  black: {
    gameVersion: "black",
    platform: "ds",
    productCode: "IRBO",
    paths: dsPaths("Pokemon Black.sav"),
  },
  white: {
    gameVersion: "white",
    platform: "ds",
    productCode: "IRAO",
    paths: dsPaths("Pokemon White.sav"),
  },
  black2: {
    gameVersion: "black2",
    platform: "ds",
    productCode: "IREO",
    paths: dsPaths("Pokemon Black 2.sav"),
  },
  white2: {
    gameVersion: "white2",
    platform: "ds",
    productCode: "IRDO",
    paths: dsPaths("Pokemon White 2.sav"),
  },
  x: {
    gameVersion: "x",
    platform: "3ds",
    titleId: "0004000000055D00",
    titleIdLow: "00055d00",
    productCode: "EKJE",
    paths: citraPaths("00055d00", "Pokémon X"),
  },
  y: {
    gameVersion: "y",
    platform: "3ds",
    titleId: "0004000000055E00",
    titleIdLow: "00055e00",
    productCode: "EK2E",
    paths: citraPaths("00055e00", "Pokémon Y"),
  },
  omegaruby: {
    gameVersion: "omegaruby",
    platform: "3ds",
    titleId: "000400000011C400",
    titleIdLow: "0011c400",
    productCode: "ECRA",
    paths: citraPaths("0011c400", "Pokémon Omega Ruby"),
  },
  alphasapphire: {
    gameVersion: "alphasapphire",
    platform: "3ds",
    titleId: "000400000011C500",
    titleIdLow: "0011c500",
    productCode: "ECLA",
    paths: citraPaths("0011c500", "Pokémon Alpha Sapphire"),
  },
  sun: {
    gameVersion: "sun",
    platform: "3ds",
    titleId: "0004000000164800",
    titleIdLow: "00164800",
    productCode: "BNDA",
    paths: citraPaths("00164800", "Pokémon Sun"),
  },
  moon: {
    gameVersion: "moon",
    platform: "3ds",
    titleId: "0004000000175E00",
    titleIdLow: "00175e00",
    productCode: "BMEA",
    paths: citraPaths("00175e00", "Pokémon Moon"),
  },
  ultrasun: {
    gameVersion: "ultrasun",
    platform: "3ds",
    titleId: "00040000001B5000",
    titleIdLow: "001b5000",
    productCode: "A2AA",
    paths: citraPaths("001b5000", "Pokémon Ultra Sun"),
  },
  ultramoon: {
    gameVersion: "ultramoon",
    platform: "3ds",
    titleId: "00040000001B5100",
    titleIdLow: "001b5100",
    productCode: "A2BA",
    paths: citraPaths("001b5100", "Pokémon Ultra Moon"),
  },
  sword: {
    gameVersion: "sword",
    platform: "switch",
    titleId: "0100ABF008968000",
    paths: switchPaths("0100ABF008968000", "Pokémon Sword"),
  },
  shield: {
    gameVersion: "shield",
    platform: "switch",
    titleId: "01008DB008C2C000",
    paths: switchPaths("01008DB008C2C000", "Pokémon Shield"),
  },
  brilliantdiamond: {
    gameVersion: "brilliantdiamond",
    platform: "switch",
    titleId: "0100000011D90000",
    paths: switchPaths("0100000011D90000", "Pokémon Brilliant Diamond"),
  },
  shiningpearl: {
    gameVersion: "shiningpearl",
    platform: "switch",
    titleId: "010018E011D92000",
    paths: switchPaths("010018E011D92000", "Pokémon Shining Pearl"),
  },
  legendsarceus: {
    gameVersion: "legendsarceus",
    platform: "switch",
    titleId: "01001F5010DFA000",
    paths: switchPaths("01001F5010DFA000", "Pokémon Legends Arceus"),
  },
  scarlet: {
    gameVersion: "scarlet",
    platform: "switch",
    titleId: "0100A3D008C5C000",
    paths: switchPaths("0100A3D008C5C000", "Pokémon Scarlet"),
  },
  violet: {
    gameVersion: "violet",
    platform: "switch",
    titleId: "01008F6008C5E000",
    paths: switchPaths("01008F6008C5E000", "Pokémon Violet"),
  },
};

export function getGameDir(gameVersion: string): GameDirInfo | null {
  return GAME_DIRS[gameVersion] ?? null;
}

/** Short display name without the "Pokémon " prefix for tight cartridge labels. */
export function shortGameName(gameVersion: string): string {
  const names: Record<string, string> = {
    firered: "FireRed",
    leafgreen: "LeafGreen",
    ruby: "Ruby",
    sapphire: "Sapphire",
    emerald: "Emerald",
    diamond: "Diamond",
    pearl: "Pearl",
    platinum: "Platinum",
    heartgold: "Heart Gold",
    soulsilver: "Soul Silver",
    black: "Black",
    white: "White",
    black2: "Black 2",
    white2: "White 2",
    x: "X",
    y: "Y",
    omegaruby: "Omega Ruby",
    alphasapphire: "Alpha Sapphire",
    sun: "Sun",
    moon: "Moon",
    ultrasun: "Ultra Sun",
    ultramoon: "Ultra Moon",
    sword: "Sword",
    shield: "Shield",
    brilliantdiamond: "Brilliant Diamond",
    shiningpearl: "Shining Pearl",
    legendsarceus: "Legends Arceus",
    scarlet: "Scarlet",
    violet: "Violet",
  };
  return names[gameVersion] ?? gameVersion;
}
