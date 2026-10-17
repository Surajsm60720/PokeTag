import {
  appendDesmumeFooter,
  hasDesmumeFooter,
  stripDesmumeFooter,
} from "./desmume.js";
import { detectSave } from "./detect.js";
import type { SaveFormat } from "./types.js";

export type ConvertTarget = "sav" | "dsv" | "srm";

export interface ConvertResult {
  data: Buffer;
  format: ConvertTarget;
  filename: string;
}

function basenameWithoutExt(name: string): string {
  const base = name.replace(/^.*[/\\]/, "");
  return base.replace(/\.(sav|dsv|srm|zip)$/i, "") || "save";
}

/**
 * Convert between emulator save wrappers.
 * Never rewrites Pokémon data blocks — only strips/adds known footers.
 * .srm for GBA/DS is treated as raw payload (same bytes as .sav).
 */
export function convertSave(
  data: Buffer,
  target: ConvertTarget,
  originalFilename = "save.sav"
): ConvertResult {
  const detected = detectSave(data, originalFilename);
  const base = basenameWithoutExt(originalFilename);
  let payload = data;

  if (hasDesmumeFooter(data) || detected.format === "dsv") {
    payload = stripDesmumeFooter(data);
  }

  if (target === "sav" || target === "srm") {
    return {
      data: Buffer.from(payload),
      format: target,
      filename: `${base}.${target}`,
    };
  }

  // target === "dsv"
  if (hasDesmumeFooter(data) && detected.format === "dsv") {
    return {
      data: Buffer.from(data),
      format: "dsv",
      filename: `${base}.dsv`,
    };
  }

  return {
    data: appendDesmumeFooter(payload),
    format: "dsv",
    filename: `${base}.dsv`,
  };
}

export function suggestedFilename(
  romBasename: string,
  format: SaveFormat | ConvertTarget
): string {
  const clean = romBasename
    .trim()
    .replace(/[/\\?%*:|"<>]/g, "_")
    .replace(/\.(gba|nds|sav|dsv|srm)$/i, "");
  const ext = format === "unknown" || format === "zip" ? "sav" : format;
  return `${clean || "save"}.${ext}`;
}
