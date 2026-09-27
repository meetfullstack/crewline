/**
 * Only follow same-site relative paths after login, so a crafted
 * `?next=https://evil.example` link can't bounce users off-site.
 */
export function safeNextPath(next: string | null, fallback = "/dashboard") {
  if (!next || !next.startsWith("/") || next.startsWith("//")) return fallback;
  if (next.startsWith("/\\")) return fallback;
  return next;
}
