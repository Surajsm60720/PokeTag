const COOKIE_NAME = "poketag_session";
const DEFAULT_TTL_SECONDS = 60 * 60 * 24 * 14; // 14 days

export interface SessionPayload {
  sub: string;
  exp: number;
}

function getSessionSecret(): string {
  const secret = process.env.AUTH_SESSION_SECRET?.trim();
  if (!secret || secret.length < 32) {
    throw new Error(
      "AUTH_SESSION_SECRET must be set to a random string of at least 32 characters"
    );
  }
  return secret;
}

function getTtlSeconds(): number {
  const raw = process.env.AUTH_SESSION_TTL_SECONDS;
  if (!raw) return DEFAULT_TTL_SECONDS;
  const n = Number(raw);
  return Number.isFinite(n) && n > 60 ? Math.floor(n) : DEFAULT_TTL_SECONDS;
}

function bytesToBase64Url(bytes: ArrayBuffer | Uint8Array): string {
  const view = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let binary = "";
  for (let i = 0; i < view.length; i++) binary += String.fromCharCode(view[i]!);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function base64UrlToBytes(value: string): Uint8Array {
  const padded = value.replace(/-/g, "+").replace(/_/g, "/");
  const pad = padded.length % 4 === 0 ? "" : "=".repeat(4 - (padded.length % 4));
  const binary = atob(padded + pad);
  const out = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) out[i] = binary.charCodeAt(i);
  return out;
}

async function hmacKey(secret: string): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"]
  );
}

async function signPayload(payloadB64: string, secret: string): Promise<string> {
  const key = await hmacKey(secret);
  const sig = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(payloadB64)
  );
  return bytesToBase64Url(sig);
}

export async function createSessionToken(username: string): Promise<{
  token: string;
  maxAge: number;
}> {
  const maxAge = getTtlSeconds();
  const payload: SessionPayload = {
    sub: username,
    exp: Math.floor(Date.now() / 1000) + maxAge,
  };
  const payloadB64 = bytesToBase64Url(
    new TextEncoder().encode(JSON.stringify(payload))
  );
  const sig = await signPayload(payloadB64, getSessionSecret());
  return { token: `${payloadB64}.${sig}`, maxAge };
}

export async function verifySessionToken(
  token: string | undefined | null
): Promise<SessionPayload | null> {
  if (!token) return null;
  const parts = token.split(".");
  if (parts.length !== 2) return null;
  const [payloadB64, sigB64] = parts;
  if (!payloadB64 || !sigB64) return null;

  let secret: string;
  try {
    secret = getSessionSecret();
  } catch {
    return null;
  }

  const key = await hmacKey(secret);
  const ok = await crypto.subtle.verify(
    "HMAC",
    key,
    base64UrlToBytes(sigB64) as BufferSource,
    new TextEncoder().encode(payloadB64)
  );
  if (!ok) return null;

  try {
    const json = new TextDecoder().decode(base64UrlToBytes(payloadB64));
    const payload = JSON.parse(json) as SessionPayload;
    if (!payload?.sub || typeof payload.exp !== "number") return null;
    if (payload.exp * 1000 <= Date.now()) return null;
    return payload;
  } catch {
    return null;
  }
}

export function sessionCookieName(): string {
  return COOKIE_NAME;
}

export function buildSessionCookie(
  token: string,
  maxAge: number
): string {
  const secure = process.env.AUTH_COOKIE_SECURE === "true" ||
    process.env.NODE_ENV === "production";
  const parts = [
    `${COOKIE_NAME}=${token}`,
    "Path=/",
    `Max-Age=${maxAge}`,
    "HttpOnly",
    "SameSite=Strict",
  ];
  if (secure) parts.push("Secure");
  return parts.join("; ");
}

export function clearSessionCookie(): string {
  const secure = process.env.AUTH_COOKIE_SECURE === "true" ||
    process.env.NODE_ENV === "production";
  const parts = [
    `${COOKIE_NAME}=`,
    "Path=/",
    "Max-Age=0",
    "HttpOnly",
    "SameSite=Strict",
  ];
  if (secure) parts.push("Secure");
  return parts.join("; ");
}
