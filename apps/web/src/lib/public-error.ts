/**
 * Text that is safe to show in the browser. Infrastructure failures stay
 * on the server log.
 */
export function publicError(err: unknown, fallback: string): string {
  const message = err instanceof Error ? err.message.trim() : "";
  if (!message || message.length > 240 || /[\r\n]/.test(message)) {
    return fallback;
  }
  if (
    /https?:|libsql|turso|cloudflare|\bR2\b|secret|token|ENOENT|ECONN|\/Users\/|node_modules|stack/i.test(
      message
    )
  ) {
    return fallback;
  }
  return message;
}
