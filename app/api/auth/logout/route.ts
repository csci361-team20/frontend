import { NextResponse, type NextRequest } from "next/server";
import { BACKEND_URL, REFRESH_COOKIE, clearSessionCookies } from "@/lib/server/backend";
import { isCrossSite } from "@/lib/server/origin";

/**
 * Sign out of this browser: the backend revokes this browser's refresh token
 * (other devices stay signed in), then the cookies are deleted.
 * "Sign out everywhere" calls POST /auth/logout instead.
 */
export async function POST(request: NextRequest) {
  if (isCrossSite(request))
    return Response.json({ detail: "Cross-site request refused." }, { status: 403 });
  const refresh = request.cookies.get(REFRESH_COOKIE)?.value;
  if (refresh) {
    try {
      await fetch(`${BACKEND_URL}/auth/logout-session`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ refresh_token: refresh }),
        cache: "no-store",
      });
    } catch {
      // The cookies are still deleted; the token lapses on its own
    }
  }
  const response = NextResponse.json({ signedIn: false });
  clearSessionCookies(response);
  return response;
}
