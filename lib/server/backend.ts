/**
 * Server-only helpers for talking to the FastAPI backend.
 *
 * The browser never sees the backend tokens: the access and refresh tokens
 * live in httpOnly cookies, and every request goes through the
 * `/api/backend/*` route handler, which adds the Authorization header.
 */
import type { NextResponse } from "next/server";

export const BACKEND_URL = (
  process.env.BACKEND_API_URL ?? "http://127.0.0.1:8000/api/v1"
).replace(/\/$/, "");

export const ACCESS_COOKIE = "bf_access";
export const REFRESH_COOKIE = "bf_refresh";

const secure = process.env.NODE_ENV === "production";

export type TokenPair = {
  access_token: string;
  refresh_token?: string | null;
  expires_in?: number | null;
};

export function isTokenPair(value: unknown): value is TokenPair {
  return (
    typeof value === "object" &&
    value !== null &&
    "access_token" in value &&
    typeof value.access_token === "string"
  );
}

/** Store a token pair from /auth/login, /auth/refresh or /auth/change-password. */
export function setSessionCookies(response: NextResponse, tokens: TokenPair) {
  response.cookies.set(ACCESS_COOKIE, tokens.access_token, {
    httpOnly: true,
    sameSite: "lax",
    secure,
    path: "/",
    // Kept a little past expiry so an expired token can still trigger a refresh
    maxAge: (tokens.expires_in ?? 1800) + 300,
  });
  if (tokens.refresh_token)
    response.cookies.set(REFRESH_COOKIE, tokens.refresh_token, {
      httpOnly: true,
      sameSite: "lax",
      secure,
      path: "/",
      maxAge: 14 * 24 * 3600,
    });
}

export function clearSessionCookies(response: NextResponse) {
  response.cookies.set(ACCESS_COOKIE, "", { path: "/", maxAge: 0 });
  response.cookies.set(REFRESH_COOKIE, "", { path: "/", maxAge: 0 });
}

/** Trade a refresh token for a new pair; null when it is no longer valid. */
export async function refreshTokens(refreshToken: string): Promise<TokenPair | null> {
  try {
    const response = await fetch(`${BACKEND_URL}/auth/refresh`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ refresh_token: refreshToken }),
      cache: "no-store",
    });
    if (!response.ok) return null;
    const body: unknown = await response.json();
    return isTokenPair(body) ? body : null;
  } catch {
    return null;
  }
}

export function unavailable() {
  return Response.json(
    { detail: "The BiletFlow service is unavailable. Please try again later." },
    { status: 502 },
  );
}
