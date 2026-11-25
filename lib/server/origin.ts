/**
 * Refuse state-changing requests sent from other websites (CSRF).
 *
 * Browsers attach Origin to cross-site POST/PUT/PATCH/DELETE requests, and
 * Sec-Fetch-Site on all requests. A request is refused when either header
 * says it came from another site. Requests without them (curl, server code)
 * carry no browser cookies by accident, so they pass.
 */
const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

export function isCrossSite(request: Request): boolean {
  if (SAFE_METHODS.has(request.method)) return false;
  const site = request.headers.get("sec-fetch-site");
  if (site && site !== "same-origin" && site !== "none") return true;
  const origin = request.headers.get("origin");
  if (!origin) return false;
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  try {
    return new URL(origin).host !== host;
  } catch {
    return true;
  }
}
