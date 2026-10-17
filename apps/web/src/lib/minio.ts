import * as Minio from "minio";

let client: Minio.Client | null = null;
let bucketReady: Promise<void> | null = null;

export function getMinio(): Minio.Client {
  if (client) return client;
  client = new Minio.Client({
    endPoint: process.env.MINIO_ENDPOINT || "127.0.0.1",
    port: Number(process.env.MINIO_PORT || 9000),
    useSSL: process.env.MINIO_USE_SSL === "true",
    accessKey: process.env.MINIO_ACCESS_KEY || "poketag",
    secretKey: process.env.MINIO_SECRET_KEY || "poketagsecret",
  });
  return client;
}

export function getBucket(): string {
  return process.env.MINIO_BUCKET || "poketag-saves";
}

export async function ensureBucket(): Promise<void> {
  if (!bucketReady) {
    bucketReady = (async () => {
      const minio = getMinio();
      const bucket = getBucket();
      const exists = await minio.bucketExists(bucket);
      if (!exists) {
        await minio.makeBucket(bucket, "us-east-1");
      }
    })();
  }
  await bucketReady;
}

export async function putObject(
  key: string,
  data: Buffer,
  contentType = "application/octet-stream"
): Promise<void> {
  await ensureBucket();
  await getMinio().putObject(getBucket(), key, data, data.length, {
    "Content-Type": contentType,
  });
}

export async function getObject(key: string): Promise<Buffer> {
  await ensureBucket();
  const stream = await getMinio().getObject(getBucket(), key);
  const chunks: Buffer[] = [];
  for await (const chunk of stream) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks);
}
