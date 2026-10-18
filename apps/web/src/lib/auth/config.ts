/**
 * Solo-operator gate. When AUTH_USERNAME is set (with hash + session secret),
 * every route except login requires a valid session cookie.
 */
export function isAuthConfigured(): boolean {
  const user = process.env.AUTH_USERNAME?.trim();
  const hash = process.env.AUTH_PASSWORD_HASH?.trim();
  const secret = process.env.AUTH_SESSION_SECRET?.trim();
  return Boolean(user && hash && secret && secret.length >= 32);
}

export function getAuthUsername(): string {
  return process.env.AUTH_USERNAME?.trim() || "";
}

export function getAuthPasswordHash(): string {
  return process.env.AUTH_PASSWORD_HASH?.trim() || "";
}
