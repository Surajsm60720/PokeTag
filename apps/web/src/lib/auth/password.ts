import { randomBytes, scrypt, timingSafeEqual } from "node:crypto";

const SCRYPT_N = 16384;
const SCRYPT_R = 8;
const SCRYPT_P = 1;
const KEY_LEN = 64;

function scryptAsync(
  password: string,
  salt: Buffer,
  keylen: number,
  options: { N: number; r: number; p: number }
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scrypt(password, salt, keylen, options, (err, derived) => {
      if (err) reject(err);
      else resolve(derived as Buffer);
    });
  });
}

/**
 * Encoded form (colon-separated so .env loaders do not eat `$` vars):
 *   scrypt:N:r:p:salt:hash
 * Also accepts legacy scrypt$N$r$p$salt$hash.
 */
export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const derived = await scryptAsync(password, salt, KEY_LEN, {
    N: SCRYPT_N,
    r: SCRYPT_R,
    p: SCRYPT_P,
  });
  return [
    "scrypt",
    String(SCRYPT_N),
    String(SCRYPT_R),
    String(SCRYPT_P),
    salt.toString("base64url"),
    derived.toString("base64url"),
  ].join(":");
}

function parseEncoded(
  encoded: string
): { N: number; r: number; p: number; salt: Buffer; expected: Buffer } | null {
  const delim = encoded.includes(":") && !encoded.includes("$") ? ":" : "$";
  const parts = encoded.split(delim);
  if (parts.length !== 6 || parts[0] !== "scrypt") return null;
  const N = Number(parts[1]);
  const r = Number(parts[2]);
  const p = Number(parts[3]);
  if (!Number.isFinite(N) || !Number.isFinite(r) || !Number.isFinite(p)) {
    return null;
  }
  try {
    const salt = Buffer.from(parts[4]!, "base64url");
    const expected = Buffer.from(parts[5]!, "base64url");
    if (salt.length === 0 || expected.length === 0) return null;
    return { N, r, p, salt, expected };
  } catch {
    return null;
  }
}

export async function verifyPassword(
  password: string,
  encoded: string
): Promise<boolean> {
  const parsed = parseEncoded(encoded.trim());
  if (!parsed) return false;

  const derived = await scryptAsync(
    password,
    parsed.salt,
    parsed.expected.length,
    {
      N: parsed.N,
      r: parsed.r,
      p: parsed.p,
    }
  );
  if (derived.length !== parsed.expected.length) return false;
  return timingSafeEqual(derived, parsed.expected);
}

export function safeEqualString(a: string, b: string): boolean {
  const aBuf = Buffer.from(a);
  const bBuf = Buffer.from(b);
  if (aBuf.length !== bBuf.length) {
    const dummy = Buffer.alloc(aBuf.length);
    timingSafeEqual(aBuf, dummy);
    return false;
  }
  return timingSafeEqual(aBuf, bBuf);
}
