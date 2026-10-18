/**
 * @deprecated Import from `./storage` instead. Kept so existing vault/parse imports keep working.
 */
export {
  deleteObject,
  ensureBucket,
  getBucket,
  getObject,
  getStorageClient as getMinio,
  putObject,
} from "./storage";
