import { stripDesmumeFooter } from "../desmume.js";
import type { DetectionResult } from "../types.js";
import { parseGen3 } from "./gen3.js";
import { parseGen4 } from "./gen4.js";
import { parseGen5 } from "./gen5.js";
import { parseGen6 } from "./gen6.js";
import { parseGen7 } from "./gen7.js";
import { parseGen8 } from "./gen8.js";
import { parseGen9 } from "./gen9.js";
import type { ParsedSave } from "./types.js";

export type {
  ParsedBadge,
  ParsedBagItem,
  ParsedBox,
  ParsedDex,
  ParsedDexEntry,
  ParsedInventory,
  ParsedMove,
  ParsedPokemon,
  ParsedSave,
  ParsedStoryProgress,
  ParsedTrainer,
} from "./types.js";
export {
  PARSER_VERSION,
  emptyInventory,
  emptyProgress,
} from "./types.js";


function toBuffer(bytes: Uint8Array): Buffer {
  return Buffer.isBuffer(bytes) ? bytes : Buffer.from(bytes);
}

/**
 * Parse a Pokémon save into the shared ParsedSave shape.
 * Routes by `detection.generation`. Throws on unrecognized generation or
 * failed checksum validation inside a generation parser.
 */
export function parseSave(
  bytes: Uint8Array,
  detection: DetectionResult
): ParsedSave {
  let payload = bytes;
  const buf = toBuffer(bytes);
  if (detection.hasDesmumeFooter) {
    payload = stripDesmumeFooter(buf);
  }

  const gen = detection.generation;
  if (gen == null) {
    throw new Error(
      "Unrecognized save generation — cannot parse (detection.generation is null)"
    );
  }

  switch (gen) {
    case 3:
      return parseGen3(payload, detection);
    case 4:
      return parseGen4(payload, detection);
    case 5:
      return parseGen5(payload, detection);
    case 6:
      return parseGen6(payload, detection);
    case 7:
      return parseGen7(payload, detection);
    case 8:
      return parseGen8(payload, detection);
    case 9:
      return parseGen9(payload, detection);
    default:
      throw new Error(`Unsupported save generation: ${String(gen)}`);
  }
}
