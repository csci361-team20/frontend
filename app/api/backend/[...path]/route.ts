import { NextResponse, type NextRequest } from "next/server";
import {
  ACCESS_COOKIE,
  BACKEND_URL,
  REFRESH_COOKIE,
  clearSessionCookies,
  isTokenPair,
  refreshTokens,
  setSessionCookies,
  unavailable,
  type TokenPair,
} from "@/lib/server/backend";
import { isCrossSite } from "@/lib/server/origin";

/**
 * Same-origin proxy for every backend endpoint: /api/backend/<path> →
 * BACKEND_API_URL/<path>. Adds the signed-in user's token, renews it once
 * when it has expired, and passes files (PDF, .ics, CSV, images) through.
 */

// Response headers worth passing back to the browser
const PASS_HEADERS = ["content-type", "content-disposition", "cache-control", "etag", "last-modified"];
// Auth responses whose tokens belong in cookies, not in the page
const TOKEN_PATHS = new Set(["auth/change-password", "auth/refresh"]);

async function send(
  method: string,
  url: string,
  headers: Headers,
  body: ArrayBuffer | undefined,
  token: string | undefined,
) {
  const outgoing = new Headers(headers);
  if (token) outgoing.set("Authorization", `Bearer ${token}`);
  else outgoing.delete("Authorization");
  let target = url;
  // FastAPI redirects /events to /events/ (and back); follow it here so the
  // browser never leaves this origin. Two hops at most.
  for (let hop = 0; hop < 3; hop++) {
    const response = await fetch(target, {
      method,
      headers: outgoing,
      body,
      redirect: "manual",
      cache: "no-store",
    });
    const location = response.headers.get("location");
    if ((response.status === 307 || response.status === 308) && location) {
      const next = new URL(location, target);
      if (next.href.startsWith(BACKEND_URL)) {
        target = next.href;
        continue;
      }
    }
    return response;
  }
  throw new Error("Too many redirects");
}

async function proxy(request: NextRequest, ctx: { params: Promise<{ path: string[] }> }) {
  if (isCrossSite(request))
    return Response.json({ detail: "Cross-site request refused." }, { status: 403 });
  const { path } = await ctx.params;
  const joined = path.map(encodeURIComponent).join("/");
  const url = `${BACKEND_URL}/${joined}${request.nextUrl.search}`;

  const headers = new Headers();
  for (const name of ["content-type", "accept", "accept-language"]) {
    const value = request.headers.get(name);
    if (value) headers.set(name, value);
  }
  const body =
    request.method === "GET" || request.method === "HEAD"
      ? undefined
      : await request.arrayBuffer();

  let access = request.cookies.get(ACCESS_COOKIE)?.value;
  const refresh = request.cookies.get(REFRESH_COOKIE)?.value;
  let renewed: TokenPair | null = null;
  let expired = false;

  let backend: Response;
  try {
    if (!access && refresh) {
      renewed = await refreshTokens(refresh);
      access = renewed?.access_token;
      expired = !renewed;
    }
    backend = await send(request.method, url, headers, body, access);
    if (backend.status === 401 && access && refresh && !renewed) {
      renewed = await refreshTokens(refresh);
      if (renewed) backend = await send(request.method, url, headers, body, renewed.access_token);
      else expired = true;
    }
  } catch {
    return unavailable();
  }
  if (backend.status === 401 && access) expired = true;

  // Token-returning auth calls: keep the tokens server-side
  if (TOKEN_PATHS.has(path.join("/")) && backend.ok) {
    const tokens: unknown = await backend.json().catch(() => null);
    const response = NextResponse.json({ ok: true }, { status: backend.status });
    if (isTokenPair(tokens)) setSessionCookies(response, tokens);
    return response;
  }

  const outHeaders = new Headers();
  for (const name of PASS_HEADERS) {
    const value = backend.headers.get(name);
    if (value) outHeaders.set(name, value);
  }
  const response = new NextResponse(
    backend.status === 204 || request.method === "HEAD" ? null : backend.body,
    { status: backend.status, headers: outHeaders },
  );
  if (renewed) setSessionCookies(response, renewed);
  else if (expired) clearSessionCookies(response);
  return response;
}

export const GET = proxy;
export const POST = proxy;
export const PUT = proxy;
export const PATCH = proxy;
export const DELETE = proxy;
export const HEAD = proxy;
