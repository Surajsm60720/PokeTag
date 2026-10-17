export interface PathHint {
  id: string;
  platform: string;
  emulator: string;
  path: string;
  note?: string;
}

export const PATH_HINTS: PathHint[] = [
  {
    id: "drastic-android",
    platform: "Android",
    emulator: "DraStic",
    path: "Android/data/com.dsemu.drastic/files/backup/",
    note: "Scoped storage; use the system file picker if the path is hidden.",
  },
  {
    id: "melonds-macos",
    platform: "macOS",
    emulator: "melonDS",
    path: "~/Library/Application Support/melonDS/",
  },
  {
    id: "melonds-linux",
    platform: "Linux",
    emulator: "melonDS",
    path: "~/.config/melonDS/",
  },
  {
    id: "melonds-windows",
    platform: "Windows",
    emulator: "melonDS",
    path: "%APPDATA%\\melonDS\\",
  },
  {
    id: "desmume-macos",
    platform: "macOS",
    emulator: "DeSmuME",
    path: "~/Library/Application Support/DeSmuME/Battery/",
  },
  {
    id: "desmume-windows",
    platform: "Windows",
    emulator: "DeSmuME",
    path: "Battery\\ (next to the DeSmuME executable, or configured path)",
  },
  {
    id: "mgba-macos",
    platform: "macOS",
    emulator: "mGBA",
    path: "Same folder as the ROM, or ~/Library/Application Support/mgba/",
  },
  {
    id: "mgba-windows",
    platform: "Windows",
    emulator: "mGBA",
    path: "Same folder as the ROM, or %APPDATA%\\mgba\\",
  },
  {
    id: "retroarch-gba",
    platform: "Cross-platform",
    emulator: "RetroArch (GBA)",
    path: "RetroArch/saves/ — often .srm next to the core saves dir",
  },
  {
    id: "myboy-android",
    platform: "Android",
    emulator: "My Boy! / common GBA",
    path: "Varies by app; look for a Saves or .sav folder in app storage.",
  },
];
