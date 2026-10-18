import * as Minio from "minio";

export type StorageDriver = "minio" | "r2" | "memory";

export interface StorageConfig {
  driver: StorageDriver;
  endPoint: string;
  port: number;
  useSSL: boolean;
  accessKey: string;
  secretKey: string;
  bucket: string;
  region: string;
  /** When false, missing buckets are an error (R2). Local MinIO may create. */
  autoCreateBucket: boolean;
}

let client: Minio.Client | null = null;
let cachedConfig: StorageConfig | null = null;
let bucketReady: Promise<void> | null = null;

/** In-process object store backing the "memory" driver (tests / throwaway runs). */
const memoryObjects = new Map<string, Buffer>();

function env(name: string, fallback?: string): string | undefined {
  const value = process.env[name];
  if (value != null && value !== "") return value;
  return fallback;
}

export function getStorageDriver(): StorageDriver {
  const explicit = env("STORAGE_DRIVER")?.toLowerCase();
  if (explicit === "r2" || explicit === "minio" || explicit === "memory") {
    return explicit;
  }
  if (env("R2_ACCOUNT_ID") || env("R2_ACCESS_KEY_ID")) return "r2";
  return "minio";
}

export function getStorageConfig(): StorageConfig {
  if (cachedConfig) return cachedConfig;

  const driver = getStorageDriver();

  if (driver === "memory") {
    cachedConfig = {
      driver: "memory",
      endPoint: "memory",
      port: 0,
      useSSL: false,
      accessKey: "",
      secretKey: "",
      bucket: "poketag-memory",
      region: "local",
      autoCreateBucket: true,
    };
    return cachedConfig;
  }

  if (driver === "r2") {
    const accountId = env("R2_ACCOUNT_ID");
    const accessKey = env("R2_ACCESS_KEY_ID");
    const secretKey = env("R2_SECRET_ACCESS_KEY");
    if (!accountId || !accessKey || !secretKey) {
      throw new Error(
        "R2 storage requires R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, and R2_SECRET_ACCESS_KEY"
      );
    }
    const endPoint =
      env("R2_ENDPOINT") || `${accountId}.r2.cloudflarestorage.com`;
    cachedConfig = {
      driver: "r2",
      endPoint,
      port: Number(env("R2_PORT", "443")),
      useSSL: env("R2_USE_SSL", "true") !== "false",
      accessKey,
      secretKey,
      bucket: env("R2_BUCKET", "poketag-saves")!,
      region: env("R2_REGION", "auto")!,
      autoCreateBucket: env("R2_AUTO_CREATE_BUCKET") === "true",
    };
    return cachedConfig;
  }

  cachedConfig = {
    driver: "minio",
    endPoint: env("MINIO_ENDPOINT", "127.0.0.1")!,
    port: Number(env("MINIO_PORT", "9000")),
    useSSL: env("MINIO_USE_SSL") === "true",
    accessKey: env("MINIO_ACCESS_KEY", "poketag")!,
    secretKey: env("MINIO_SECRET_KEY", "poketagsecret")!,
    bucket: env("MINIO_BUCKET", "poketag-saves")!,
    region: env("MINIO_REGION", "us-east-1")!,
    autoCreateBucket: env("MINIO_AUTO_CREATE_BUCKET", "true") !== "false",
  };
  return cachedConfig;
}

/** Describe the active store for logs/scripts (no secrets). */
export function describeStorage(): string {
  const c = getStorageConfig();
  if (c.driver === "memory") return `memory in-process (${c.bucket})`;
  const scheme = c.useSSL ? "https" : "http";
  const portPart =
    (c.useSSL && c.port === 443) || (!c.useSSL && c.port === 80)
      ? ""
      : `:${c.port}`;
  return `${c.driver} ${scheme}://${c.endPoint}${portPart}/${c.bucket}`;
}

export function getStorageClient(): Minio.Client {
  if (client) return client;
  const c = getStorageConfig();
  if (c.driver === "memory") {
    throw new Error("The memory storage driver has no MinIO client.");
  }
  client = new Minio.Client({
    endPoint: c.endPoint,
    port: c.port,
    useSSL: c.useSSL,
    accessKey: c.accessKey,
    secretKey: c.secretKey,
    region: c.region,
  });
  return client;
}

export function getBucket(): string {
  return getStorageConfig().bucket;
}

export async function ensureBucket(): Promise<void> {
  if (getStorageConfig().driver === "memory") return;
  if (!bucketReady) {
    bucketReady = (async () => {
      const c = getStorageConfig();
      const minio = getStorageClient();
      const exists = await minio.bucketExists(c.bucket);
      if (exists) return;
      if (!c.autoCreateBucket) {
        throw new Error(
          `Bucket "${c.bucket}" does not exist on ${c.driver}. Create it in the Cloudflare dashboard (or set R2_AUTO_CREATE_BUCKET=true).`
        );
      }
      await minio.makeBucket(c.bucket, c.region);
    })();
  }
  await bucketReady;
}

export async function putObject(
  key: string,
  data: Buffer,
  contentType = "application/octet-stream"
): Promise<void> {
  if (getStorageConfig().driver === "memory") {
    memoryObjects.set(key, Buffer.from(data));
    return;
  }
  await ensureBucket();
  await getStorageClient().putObject(getBucket(), key, data, data.length, {
    "Content-Type": contentType,
  });
}

export async function getObject(key: string): Promise<Buffer> {
  if (getStorageConfig().driver === "memory") {
    const stored = memoryObjects.get(key);
    if (!stored) throw new Error(`Object not found: ${key}`);
    return Buffer.from(stored);
  }
  await ensureBucket();
  const stream = await getStorageClient().getObject(getBucket(), key);
  const chunks: Buffer[] = [];
  for await (const chunk of stream) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks);
}

export async function deleteObject(key: string): Promise<void> {
  if (getStorageConfig().driver === "memory") {
    memoryObjects.delete(key);
    return;
  }
  await ensureBucket();
  await getStorageClient().removeObject(getBucket(), key);
}

/** Keys currently held by the memory driver (tests / diagnostics). */
export function listMemoryObjects(): string[] {
  return [...memoryObjects.keys()];
}

/** Drop every object held by the memory driver (tests). */
export function clearMemoryObjects(): void {
  memoryObjects.clear();
}

/** Reset cached client (tests / scripts that reload env). */
export function resetStorageClient(): void {
  client = null;
  cachedConfig = null;
  bucketReady = null;
}
