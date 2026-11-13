export type {
  ConvertTarget,
  ConvertResult,
} from "./convert.js";
export { convertSave, suggestedFilename } from "./convert.js";
export { detectSave } from "./detect.js";
export type { DetectSaveOptions } from "./detect.js";
export {
  DESMUME_MAGIC,
  appendDesmumeFooter,
  hasDesmumeFooter,
  stripDesmumeFooter,
} from "./desmume.js";
export type {
  DetectionResult,
  GameVersion,
  Generation,
  SaveFormat,
} from "./types.js";
export { parseSave, PARSER_VERSION } from "./parse/index.js";
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
} from "./parse/types.js";
export { emptyInventory, emptyProgress } from "./parse/types.js";

