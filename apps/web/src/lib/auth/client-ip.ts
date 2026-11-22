/**
 * Address used only for login lockout.
 * Prefer the platform's own client header. If that is missing, use the last
 * hop in X-Forwarded-For (the one a proxy appends), not the first, which a
 * caller can set themselves.
 */
export function clientAddress(headers: Headers): string {
  const real = headers.get("x-real-ip")?.trim();
  if (real && !real.includes(",")) return real.slice(0, 64);

  const forwarded = headers.get("x-forwarded-for");
  if (forwarded) {
    const parts = forwarded
      .split(",")
      .map((part) => part.trim())
      .filter(Boolean);
    const last = parts[parts.length - 1];
    if (last) return last.slice(0, 64);
  }

  return "unknown";
}
