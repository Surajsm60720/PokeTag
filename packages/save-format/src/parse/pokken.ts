/**
 * Pokkén Tournament DX (Switch) — provisional parser.
 *
 * JKSV/Checkpoint dumps for title 0100B3F000BE2000 often surface as `.np`
 * (or a folder containing encrypted Save.dat blobs). A full field map is not
 * settled yet; this path keeps the file vaulted and returns a minimal snapshot
 * so the shelf can show the run without pretending we decoded fighters/ranks.
 */

import type { DetectionResult } from "../types.js";
import type { ParsedSave } from "./types.js";
import { baseSave, emptyDex } from "./util.js";

function looksLikePrintableAscii(buf: Uint8Array, off: number, len: number): string {
  let out = "";
  for (let i = 0; i < len && off + i < buf.length; i++) {
    const c = buf[off + i]!;
    if (c === 0) break;
    if (c < 0x20 || c > 0x7e) return "";
    out += String.fromCharCode(c);
  }
  return out.trim();
}

function scanPlayerTag(bytes: Uint8Array): string {
  // Best-effort: first short ASCII run that looks like a tag (3–16 chars).
  for (let i = 0; i < Math.min(bytes.length, 0x20000); i++) {
    const tag = looksLikePrintableAscii(bytes, i, 16);
    if (tag.length >= 3 && tag.length <= 16 && /[A-Za-z]/.test(tag)) {
      return tag;
    }
  }
  return "";
}

export function parsePokken(
  bytes: Uint8Array,
  _detection: DetectionResult
): ParsedSave {
  const tag = scanPlayerTag(bytes);
  return baseSave("pokkentournamentdx", {
    trainer: {
      name: tag || "Pokkén trainer",
      trainerId: 0,
      secretId: 0,
      money: 0,
      gender: "M",
    },
    party: [],
    boxes: [],
    dex: emptyDex(0),
    badges: [],
    playTimeSeconds: 0,
    location: "",
    progress: {
      eliteFourDefeated: null,
      championDefeated: null,
      note:
        "Pokkén Tournament DX support is provisional: the file is vaulted and " +
        "byte-identical on download. Fighter roster, ranks, and cosmetics are " +
        "not decoded yet (.np / Save.dat field map TBD).",
    },
  });
}
