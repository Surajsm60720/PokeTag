export type {
  ConvertTarget,
  ConvertResult,
} from "./convert.js";
export { convertSave, suggestedFilename } from "./convert.js";
export { detectSave } from "./detect.js";
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
