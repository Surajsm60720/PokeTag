import { themePlatform, type ThemePlatform } from "./theme";

export function formatBytes(bytes: number | null | undefined): string {
  if (bytes == null || Number.isNaN(bytes)) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

export function formatShortHash(hash: string | null | undefined): string {
  if (!hash) return "—";
  return `${hash.slice(0, 8)}…${hash.slice(-6)}`;
}

export function platformLabel(platform: ThemePlatform): string {
  switch (platform) {
    case "gba":
      return "Game Boy Advance";
    case "ds":
      return "Nintendo DS";
    case "3ds":
      return "Nintendo 3DS";
    case "switch":
      return "Nintendo Switch";
    default:
      return "Unknown hardware";
  }
}

export function platformForGame(gameVersion: string): ThemePlatform {
  return themePlatform(gameVersion);
}

export function gameDisplayName(gameVersion: string, fallback?: string): string {
  const names: Record<string, string> = {
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
  };
  return names[gameVersion] ?? fallback ?? gameVersion;
}

export function formatWhen(iso: string | null | undefined): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}
