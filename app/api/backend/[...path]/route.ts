import { NextRequest, NextResponse } from "next/server";
import { isUserId } from "@/lib/api";

const cookieName = "biletflow-session";
const responseHeaders = { "Cache-Control": "private, no-store" };
const cookieOptions = { httpOnly: true, sameSite: "strict" as const, path: "/api/backend", secure: process.env.NODE_ENV === "production" };
const json = (data: unknown, status = 200) => NextResponse.json(data, { status, headers: responseHeaders });
const fail = (status: number, detail: string) => json({ detail }, status);

type Access = "public" | "optional" | "required";
type Route = { path: string; access: Access; query?: string[] };
type Context = { params: Promise<{ path: string[] }> };

function routeFor(parts: string[], method: string): Route | undefined {
  const [resource, id, action] = parts;
  if (parts.length === 1) {
    if (resource === "users" && method === "POST") return { path: "/users/", access: "public" };
    if (resource === "organizers" && method === "POST") return { path: "/organizers/", access: "required" };
    if (resource === "events" && method === "GET") return { path: "/events/", access: "public", query: ["skip", "limit", "city", "category"] };
    if (resource === "events" && method === "POST") return { path: "/events/", access: "required" };
  }
  if (parts.length === 2) {
    if (resource === "organizers" && id === "me" && ["GET", "PATCH"].includes(method)) return { path: "/organizers/me", access: "required" };
    if (resource === "events" && id === "mine" && method === "GET") return { path: "/events/mine", access: "required" };
    if (!isUserId(id)) return;
    if (method === "GET" && ["users", "organizers", "ticket-types"].includes(resource)) return { path: `/${resource}/${id}`, access: "public" };
    if (method === "GET" && resource === "events") return { path: `/events/${id}`, access: "optional" };
    if (method === "PATCH" && ["users", "events", "ticket-types"].includes(resource)) return { path: `/${resource}/${id}`, access: "required" };
  }
  if (parts.length === 3 && resource === "events" && isUserId(id)) {
    if (action === "ticket-types" && method === "GET") return { path: `/events/${id}/ticket-types`, access: "optional", query: ["include_hidden"] };
    if (method === "POST" && ["ticket-types", "publish", "cancel"].includes(action)) return { path: `/events/${id}/${action}`, access: "required" };
  }
}

function isSameOrigin(request: NextRequest) {
  try {
    const origin = new URL(request.headers.get("origin") ?? "");
    const host = request.headers.get("host") ?? request.nextUrl.host;
    return ["http:", "https:"].includes(origin.protocol) && origin.host === host && request.headers.get("sec-fetch-site") !== "cross-site";
  } catch {
    return false;
  }
}

function upstream(request: NextRequest, path: string, init: RequestInit = {}) {
  const base = (process.env.BACKEND_API_URL ?? "http://127.0.0.1:8000/api/v1").replace(/\/+$/, "");
  return fetch(`${base}${path}`, { ...init, cache: "no-store", redirect: "error", signal: AbortSignal.any([request.signal, AbortSignal.timeout(14_000)]) });
}

function withoutSession(response: NextResponse) {
  response.cookies.set(cookieName, "", { ...cookieOptions, maxAge: 0 });
  return response;
}

function relay(response: Response) {
  if (response.status >= 500) return fail(response.status, "The backend service is unavailable. Please try again later.");
  return new NextResponse(response.body, { status: response.status, headers: { ...responseHeaders, "Content-Type": "application/json" } });
}

async function login(request: NextRequest) {
  const input = await request.json().catch(() => null);
  const email = input?.email;
  const password = input?.password;
  if (typeof email !== "string" || !email.trim() || email.length > 255 || typeof password !== "string" || !password || password.length > 128) return fail(400, "Enter a valid email and password.");
  const response = await upstream(request, "/auth/login", {
    method: "POST",
    headers: { Accept: "application/json", "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ username: email.trim(), password }),
  });
  if (!response.ok) return fail(response.status, response.status === 401 ? "Incorrect email or password." : "Could not sign in. Please try again.");
  const token = await response.json().catch(() => null);
  if (typeof token?.access_token !== "string" || token.access_token.length > 3800 || !/^[\w-]+\.[\w-]+\.[\w-]+$/.test(token.access_token) || token.token_type?.toLowerCase() !== "bearer") return fail(502, "The backend returned an invalid session.");
  const result = new NextResponse(null, { status: 204, headers: responseHeaders });
  result.cookies.set(cookieName, token.access_token, cookieOptions);
  return result;
}

async function handle(request: NextRequest, { params }: Context) {
  const { path } = await params;
  const method = request.method;
  if (method !== "GET" && !isSameOrigin(request)) return fail(403, "This request must come from BiletFlow.");
  const token = request.cookies.get(cookieName)?.value;
  try {
    if (path.length === 2 && path[0] === "auth" && path[1] === "login" && method === "POST") return await login(request);
    if (path.length === 1 && path[0] === "session") {
      if (method === "DELETE") return withoutSession(new NextResponse(null, { status: 204, headers: responseHeaders }));
      if (method === "GET") {
        if (!token) return json(null);
        const response = await upstream(request, "/users/me", { headers: { Accept: "application/json", Authorization: `Bearer ${token}` } });
        return response.status === 401 ? withoutSession(json(null)) : relay(response);
      }
    }
    const route = routeFor(path, method);
    if (!route) return fail(404, "This service is not available.");
    if (route.access === "required" && !token) return fail(401, "Sign in to continue.");
    const headers = new Headers({ Accept: "application/json" });
    if (route.access !== "public" && token) headers.set("Authorization", `Bearer ${token}`);
    const body = method === "GET" ? undefined : (await request.text()) || undefined;
    if (body !== undefined) {
      if (request.headers.get("content-type")?.split(";", 1)[0].trim().toLowerCase() !== "application/json") return fail(415, "Send the request as JSON.");
      headers.set("Content-Type", "application/json");
    }
    const query = new URLSearchParams();
    for (const name of route.query ?? []) {
      const value = request.nextUrl.searchParams.get(name);
      if (value !== null) query.set(name, value);
    }
    return relay(await upstream(request, `${route.path}${query.size ? `?${query}` : ""}`, { method, headers, body }));
  } catch {
    return fail(502, "The backend service is unavailable. Please try again later.");
  }
}

export const GET = handle;
export const POST = handle;
export const PATCH = handle;
export const DELETE = handle;
