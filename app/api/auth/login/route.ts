import { NextResponse, type NextRequest } from "next/server";
import {
  BACKEND_URL,
  isTokenPair,
  setSessionCookies,
  unavailable,
} from "@/lib/server/backend";
import { isCrossSite } from "@/lib/server/origin";

/** Sign in: the backend's tokens go into httpOnly cookies, never to the page. */
export async function POST(request: NextRequest) {
  if (isCrossSite(request))
    return Response.json({ detail: "Cross-site request refused." }, { status: 403 });
  const input: unknown = await request.json().catch(() => null);
  if (
    typeof input !== "object" ||
    input === null ||
    !("email" in input) ||
    !("password" in input) ||
    typeof input.email !== "string" ||
    typeof input.password !== "string"
  )
    return Response.json({ detail: "Enter your email and password." }, { status: 400 });

  let backend: Response;
  try {
    backend = await fetch(`${BACKEND_URL}/auth/login`, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Accept: "application/json",
      },
      body: new URLSearchParams({ username: input.email, password: input.password }),
      cache: "no-store",
    });
  } catch {
    return unavailable();
  }
  const body: unknown = await backend.json().catch(() => null);
  if (!backend.ok || !isTokenPair(body))
    return Response.json(body ?? { detail: "Could not sign in." }, {
      status: backend.ok ? 502 : backend.status,
    });

  const response = NextResponse.json({ signedIn: true });
  setSessionCookies(response, body);
  return response;
}
