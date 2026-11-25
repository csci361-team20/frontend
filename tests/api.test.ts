import { test } from "node:test";
import assert from "node:assert/strict";
import { ApiError, createApiClient } from "../lib/api";

const user = {
  id: "287ba5f0-41da-45f8-8b87-7d22e9983d23",
  full_name: "Dulat Zhanbyrshyn",
  email: "dulat@example.com",
  created_at: "2026-10-15T08:00:00Z",
};
const parsed = { ...user, is_email_verified: false, is_platform_admin: false, preferred_language: "en" };
const registration = { full_name: user.full_name, email: user.email, password: "test-password" };
const json = (value: unknown, status = 200) => new Response(JSON.stringify(value), {
  status,
  headers: { "Content-Type": "application/json" },
});

test("registration and profile reads use the shared client and actual user contracts", async () => {
  const calls: { path: string; init: RequestInit | undefined }[] = [];
  const client = createApiClient({ fetch: async (input, init) => {
    calls.push({ path: String(input), init });
    return json({ ...user, password_hash: "must-not-be-returned-by-client" });
  } });
  assert.deepEqual(await client.users.register(registration), parsed);
  assert.deepEqual(await client.users.get(user.id), parsed);
  assert.equal(calls[0].path, "/api/backend/users");
  assert.equal(calls[0].init?.method, "POST");
  assert.deepEqual(JSON.parse(String(calls[0].init?.body)), registration);
  assert.equal(new Headers(calls[0].init?.headers).get("Content-Type"), "application/json");
  assert.equal(calls[1].path, `/api/backend/users/${user.id}`);
  assert.equal(calls[1].init?.method, "GET");
  assert.equal(calls[1].init?.body, undefined);
  assert.equal(new Headers(calls[1].init?.headers).has("Content-Type"), false);
  for (const call of calls) {
    // Same-origin so the session cookie reaches the proxy; tokens never touch the page
    assert.equal(call.init?.credentials, "same-origin");
    assert.equal(call.init?.cache, "no-store");
    assert.equal(new Headers(call.init?.headers).has("Authorization"), false);
  }
});

test("duplicate registration shows the backend error and is never retried automatically", async () => {
  let calls = 0;
  const client = createApiClient({ fetch: async () => {
    calls++;
    return json({ detail: "User with this email already exists" }, 400);
  } });
  await assert.rejects(client.users.register(registration), (error: unknown) => {
    assert.ok(error instanceof ApiError);
    assert.equal(error.status, 400);
    assert.equal(error.message, "User with this email already exists");
    return true;
  });
  assert.equal(calls, 1);
});

test("FastAPI validation messages are readable without copying submitted password input", async () => {
  const client = createApiClient({ fetch: async () => json({ detail: [
    { loc: ["body", "full_name"], msg: "Value error, Full name must contain only alphabetic characters.", input: "bad-name-123" },
    { loc: ["body", "password"], msg: "String should have at least 8 characters", input: "secret" },
  ] }, 422) });
  await assert.rejects(client.users.register(registration), (error: unknown) => {
    assert.ok(error instanceof ApiError);
    assert.equal(error.status, 422);
    assert.match(error.message, /full name: Full name must contain/);
    assert.doesNotMatch(error.message, /Value error/);
    assert.match(error.message, /password: String should/);
    assert.doesNotMatch(error.message, /secret|bad-name-123/);
    return true;
  });
});

test("profile failures remain errors rather than falling back to a demo profile", async () => {
  for (const status of [404, 500]) {
    const client = createApiClient({ fetch: async () => new Response("<html>failure</html>", { status }) });
    await assert.rejects(client.users.get(user.id), (error: unknown) => {
      assert.ok(error instanceof ApiError);
      assert.equal(error.status, status);
      assert.doesNotMatch(error.message, /<html>/);
      return true;
    });
  }
});

test("malformed success responses cannot masquerade as a created account", async () => {
  for (const value of [null, {}, { ...user, id: "not-an-id" }, { ...user, created_at: "bad-date" }]) {
    const client = createApiClient({ fetch: async () => json(value) });
    await assert.rejects(client.users.register(registration), (error: unknown) => {
      assert.ok(error instanceof ApiError);
      assert.equal(error.status, 502);
      return true;
    });
  }
});

test("invalid profile IDs never become backend requests", async () => {
  let called = false;
  const client = createApiClient({ fetch: async () => { called = true; return json(user); } });
  for (const id of ["", "dana", "../users", "me", "auth/login"]) {
    await assert.rejects(client.users.get(id), /valid account ID/);
  }
  assert.equal(called, false);
});

test("network failures provide a connection error", async () => {
  const client = createApiClient({ fetch: async () => { throw new TypeError("fetch failed"); } });
  await assert.rejects(client.users.register(registration), /Could not reach BiletFlow/);
});

const waitForAbort: typeof fetch = async (_input, init) => new Promise<Response>((_resolve, reject) => {
  if (init?.signal?.aborted) return reject(new DOMException("Aborted", "AbortError"));
  init?.signal?.addEventListener("abort", () => reject(new DOMException("Aborted", "AbortError")), { once: true });
});

test("slow requests time out and cancelled profile reads remain cancellable", async () => {
  const client = createApiClient({ fetch: waitForAbort, timeoutMs: 10 });
  await assert.rejects(client.users.get(user.id), /took too long/);
  const controller = new AbortController();
  const pending = client.users.get(user.id, { signal: controller.signal });
  controller.abort();
  await assert.rejects(pending, (error: unknown) => error instanceof DOMException && error.name === "AbortError");
  await assert.rejects(client.users.get(user.id, { signal: controller.signal }), (error: unknown) => error instanceof DOMException && error.name === "AbortError");
});

test("sign-in posts to the cookie route, never to the backend directly", async () => {
  const calls: { path: string; init: RequestInit | undefined }[] = [];
  const client = createApiClient({ fetch: async (input, init) => {
    calls.push({ path: String(input), init });
    return json({ signedIn: true });
  } });
  await client.auth.signIn("dana@example.com", "correct-horse-42");
  await client.auth.signOut();
  assert.equal(calls[0].path, "/api/auth/login");
  assert.deepEqual(JSON.parse(String(calls[0].init?.body)), { email: "dana@example.com", password: "correct-horse-42" });
  assert.equal(calls[1].path, "/api/auth/logout");
  assert.equal(calls[1].init?.method, "POST");
});

test("wrong passwords show the backend message", async () => {
  const client = createApiClient({ fetch: async () => json({ detail: "Incorrect email or password" }, 401) });
  await assert.rejects(client.auth.signIn("a@b.kz", "nope"), /Incorrect email or password/);
});

test("queries skip empty values and repeat list values; 204 resolves to null", async () => {
  const paths: string[] = [];
  const client = createApiClient({ fetch: async (input) => {
    paths.push(String(input));
    return paths.length === 1 ? json([]) : new Response(null, { status: 204 });
  } });
  await client.request("/events", { query: { q: "jazz night", city: "", action: ["a", "b"], page: 2, skip: undefined } });
  assert.equal(paths[0], "/api/backend/events?q=jazz+night&action=a&action=b&page=2");
  assert.equal(await client.request("/x", { method: "DELETE" }), null);
  assert.equal(client.fileUrl("/tickets/1/pdf"), "/api/backend/tickets/1/pdf");
});
