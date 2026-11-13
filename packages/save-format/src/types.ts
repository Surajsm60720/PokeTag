export type SaveFormat =
  | "sav"
  | "dsv"
  | "srm"
  | "zip"
  | "main"
  | "np"
  | "unknown";

export type Generation = 3 | 4 | 5 | 6 | 7 | 8 | 9 | null;

export type GameVersion =
  | "ruby"
  | "sapphire"
  | "emerald"
  | "firered"
  | "leafgreen"
  | "diamond"
  | "pearl"
  | "platinum"
  | "heartgold"
  | "soulsilver"
  | "black"
  | "white"
  | "black2"
  | "white2"
  | "x"
  | "y"
  | "omegaruby"
  | "alphasapphire"
  | "sun"
  | "moon"
  | "ultrasun"
  | "ultramoon"
  | "sword"
  | "shield"
  | "brilliantdiamond"
  | "shiningpearl"
  | "legendsarceus"
  | "scarlet"
  | "violet"
  | "pokkentournamentdx"
  | "unknown";

export interface DetectionResult {
  format: SaveFormat;
  generation: Generation;
  gameVersion: GameVersion;
  recognized: boolean;
  sizeBytes: number;
  hasDesmumeFooter: boolean;
  rawPayloadSize: number;
  label: string;
  notes: string[];
}
