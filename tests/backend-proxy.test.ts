import { test } from "node:test";
import assert from "node:assert/strict";
import { NextRequest } from "next/server";
import { DELETE, GET, PATCH, POST } from "../app/api/backend/[...path]/route";

const origin = "http://localhost:3000";
const token = "test.header.signature";
const accountId = "287ba5f0-41da-45f8-8b87-7d22e9983d23";
const ctx = (...path: string[]) => ({ params: Promise.resolve({ path }) });
const request = (path: string, method: string, headers: HeadersInit = {}, body?: string) => new NextRequest(`${origin}/api/backend/${path}`, { method, headers, body });

async function withUpstream(transport: typeof fetch, work: () => Promise<void>) {
  const saved = globalThis.fetch;
  globalThis.fetch = transport;
  try { await work(); } finally { globalThis.fetch = saved; }
}

test("login translates credentials to FastAPI form encoding and returns only an HttpOnly cookie", async () => {
  await withUpstream(async (url, init) => {
    assert.equal(new URL(String(url)).pathname, "/api/v1/auth/login");
    assert.equal(init?.method, "POST");
    assert.equal(new Headers(init?.headers).get("Content-Type"), "application/x-www-form-urlencoded");
    assert.deepEqual(Object.fromEntries(init?.body as URLSearchParams), { username: "qa@example.test", password: "QA&example=123" });
    return Response.json({ access_token: token, token_type: "bearer" });
  }, async () => {
    const result = await POST(request("auth/login", "POST", { origin, "Content-Type": "application/json" }, JSON.stringify({ email: "qa@example.test", password: "QA&example=123" })), ctx("auth", "login"));
    assert.equal(result.status, 204);
    assert.match(result.headers.get("set-cookie") ?? "", /biletflow-session=test\.header\.signature;.*HttpOnly.*SameSite=strict/i);
    assert.equal(await result.text(), "");
    assert.match(result.headers.get("cache-control") ?? "", /no-store/);
  });
});

test("unsafe cross-origin requests and unsigned writes never reach the backend", async () => {
  let calls = 0;
  await withUpstream(async () => { calls++; return Response.json({}); }, async () => {
    const path = `users/${accountId}`;
    const headers = { "Content-Type": "application/json", Cookie: `biletflow-session=${token}` };
    assert.equal((await PATCH(request(path, "PATCH", { ...headers, origin: "https://foreign.example.test" }, "{}"), ctx("users", accountId))).status, 403);
    assert.equal((await PATCH(request(path, "PATCH", { origin }, "{}"), ctx("users", accountId))).status, 401);
    assert.equal((await PATCH(request(`organizers/${accountId}/verification`, "PATCH", { ...headers, origin }, "{}"), ctx("organizers", accountId, "verification"))).status, 404);
    assert.equal(await (await GET(request("session", "GET"), ctx("session"))).json(), null);
    assert.equal(calls, 0);
  });
});

test("sessions use the current-user endpoint, expire on 401, and sign out locally", async () => {
  let expired = false;
  await withUpstream(async (url, init) => {
    assert.equal(new URL(String(url)).pathname, "/api/v1/users/me");
    assert.equal(new Headers(init?.headers).get("Authorization"), `Bearer ${token}`);
    assert.equal(init?.redirect, "error");
    return expired ? Response.json({ detail: "Expired" }, { status: 401 }) : Response.json({ id: accountId });
  }, async () => {
    const headers = { Cookie: `biletflow-session=${token}` };
    assert.deepEqual(await (await GET(request("session", "GET", headers), ctx("session"))).json(), { id: accountId });
    expired = true;
    const result = await GET(request("session", "GET", headers), ctx("session"));
    assert.equal(await result.json(), null);
    assert.match(result.headers.get("set-cookie") ?? "", /Max-Age=0/);
    const logout = await DELETE(request("session", "DELETE", { ...headers, origin }), ctx("session"));
    assert.equal(logout.status, 204);
    assert.match(logout.headers.get("set-cookie") ?? "", /Path=\/api\/backend.*Max-Age=0/i);
  });
});

test("public filters and protected writes keep the FastAPI paths and never forward browser auth headers", async () => {
  const calls: { path: string; auth: string | null; cookie: string | null }[] = [];
  await withUpstream(async (url, init) => {
    const parsed = new URL(String(url));
    const headers = new Headers(init?.headers);
    calls.push({ path: parsed.pathname + parsed.search, auth: headers.get("Authorization"), cookie: headers.get("Cookie") });
    return Response.json({});
  }, async () => {
    const headers = { Cookie: `biletflow-session=${token}`, Authorization: "Bearer untrusted-browser-token" };
    await GET(request("events?skip=0&limit=24&ignored=1", "GET", headers), ctx("events"));
    await GET(request("events/mine", "GET", headers), ctx("events", "mine"));
    await POST(request("organizers", "POST", { ...headers, origin, "Content-Type": "application/json" }, "{}"), ctx("organizers"));
    const published = await POST(request(`events/${accountId}/publish`, "POST", { ...headers, origin, "Content-Type": "text/plain" }, ""), ctx("events", accountId, "publish"));
    assert.equal(published.status, 200);
    assert.deepEqual(calls, [
      { path: "/api/v1/events/?skip=0&limit=24", auth: null, cookie: null },
      { path: "/api/v1/events/mine", auth: `Bearer ${token}`, cookie: null },
      { path: "/api/v1/organizers/", auth: `Bearer ${token}`, cookie: null },
      { path: `/api/v1/events/${accountId}/publish`, auth: `Bearer ${token}`, cookie: null },
    ]);
  });
});
