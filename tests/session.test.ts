import assert from "node:assert/strict";
import { afterEach, beforeEach, test } from "node:test";
import { api, ApiError, type ApiUser } from "../lib/api";
import { currentSession, refreshSession, signIn, signOut } from "../components/session-provider";

const oldUser: ApiUser = { id: "287ba5f0-41da-45f8-8b87-7d22e9983d23", full_name: "Earlier Account", email: "earlier@example.com", created_at: "2026-11-01T00:00:00Z", is_email_verified: true, is_platform_admin: false, preferred_language: "en" };
const newUser: ApiUser = { ...oldUser, id: "327ba5f0-41da-45f8-8b87-7d22e9983d23", full_name: "Current Account", email: "current@example.com" };
const original = { me: api.users.me, organizer: api.organizers.me, request: api.request, signIn: api.auth.signIn, signOut: api.auth.signOut };

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((done, fail) => { resolve = done; reject = fail; });
  return { promise, resolve, reject };
}

beforeEach(async () => {
  api.auth.signOut = async () => {};
  api.auth.signIn = async () => {};
  api.users.me = async () => newUser;
  api.organizers.me = async () => { throw new ApiError("Not an organizer", 404); };
  api.request = async <T>() => [] as T;
  await signOut();
});

afterEach(async () => {
  await signOut();
  api.users.me = original.me;
  api.organizers.me = original.organizer;
  api.request = original.request;
  api.auth.signIn = original.signIn;
  api.auth.signOut = original.signOut;
});

test("a profile response arriving after sign-out cannot restore the old account", async () => {
  const earlier = deferred<ApiUser>();
  api.users.me = () => earlier.promise;
  const restore = refreshSession();
  await signOut();
  earlier.resolve(oldUser);
  await restore;
  assert.deepEqual(currentSession(), { status: "signed-out" });
});

test("sign-in starts a fresh account load instead of reusing an older in-flight restore", async () => {
  const earlier = deferred<ApiUser>();
  let reads = 0;
  api.users.me = () => ++reads === 1 ? earlier.promise : Promise.resolve(newUser);
  const restore = refreshSession();
  const login = signIn(newUser.email, "correct-password");
  await new Promise((resolve) => setTimeout(resolve, 0));
  earlier.resolve(oldUser);
  await Promise.all([restore, login]);
  const session = currentSession();
  assert.equal(reads, 2);
  assert.equal(session.status, "signed-in");
  if (session.status === "signed-in") assert.equal(session.user.id, newUser.id);
});

test("an old unauthorized result cannot sign out a newer account", async () => {
  const earlier = deferred<ApiUser>();
  let reads = 0;
  api.users.me = () => ++reads === 1 ? earlier.promise : Promise.resolve(newUser);
  const restore = refreshSession();
  const login = signIn(newUser.email, "correct-password");
  await new Promise((resolve) => setTimeout(resolve, 0));
  earlier.reject(new ApiError("Expired old token", 401));
  await Promise.all([restore, login]);
  const session = currentSession();
  assert.equal(session.status, "signed-in");
  if (session.status === "signed-in") assert.equal(session.user.id, newUser.id);
});

test("organizer data arriving after sign-out cannot publish a completed session", async () => {
  const organizer = deferred<{ id: string; display_name: string }>();
  api.users.me = async () => oldUser;
  api.organizers.me = () => organizer.promise;
  const restore = refreshSession();
  await new Promise((resolve) => setTimeout(resolve, 0));
  await signOut();
  organizer.resolve({ id: "earlier-organizer", display_name: "Earlier organizer" });
  await restore;
  assert.deepEqual(currentSession(), { status: "signed-out" });
});

test("a restore started during sign-out cannot reinstate the signed-out account", async () => {
  const logout = deferred<void>();
  const profile = deferred<ApiUser>();
  api.auth.signOut = () => logout.promise;
  api.users.me = () => profile.promise;
  const leaving = signOut();
  const restore = refreshSession();
  logout.resolve(undefined);
  await leaving;
  profile.resolve(oldUser);
  await restore;
  assert.deepEqual(currentSession(), { status: "signed-out" });
});

test("a later sign-in waits for an earlier sign-out response before changing cookies", async () => {
  const logout = deferred<void>();
  const calls: string[] = [];
  api.auth.signOut = async () => { calls.push("logout:start"); await logout.promise; calls.push("logout:done"); };
  api.auth.signIn = async () => { calls.push("login"); };
  const leaving = signOut();
  const entering = signIn(newUser.email, "correct-password");
  await new Promise((resolve) => setTimeout(resolve, 0));
  try {
    assert.deepEqual(calls, ["logout:start"]);
  } finally {
    logout.resolve(undefined);
  }
  await Promise.all([leaving, entering]);
  assert.deepEqual(calls, ["logout:start", "logout:done", "login"]);
  const session = currentSession();
  assert.equal(session.status, "signed-in");
  if (session.status === "signed-in") assert.equal(session.user.id, newUser.id);
});

test("a later sign-out waits for an earlier sign-in response before clearing cookies", async () => {
  const login = deferred<void>();
  const calls: string[] = [];
  api.auth.signIn = async () => { calls.push("login:start"); await login.promise; calls.push("login:done"); };
  api.auth.signOut = async () => { calls.push("logout"); };
  const entering = signIn(newUser.email, "correct-password");
  const leaving = signOut();
  await new Promise((resolve) => setTimeout(resolve, 0));
  try {
    assert.deepEqual(calls, ["login:start"]);
  } finally {
    login.resolve(undefined);
  }
  await Promise.all([entering, leaving]);
  assert.deepEqual(calls, ["login:start", "login:done", "logout"]);
  assert.deepEqual(currentSession(), { status: "signed-out" });
});

test("a failed auth mutation does not block a later queued sign-in", async () => {
  api.auth.signOut = async () => { throw new ApiError("Sign-out connection failed", 0); };
  const leaving = signOut();
  const entering = signIn(newUser.email, "correct-password");
  await assert.rejects(leaving, /Sign-out connection failed/);
  await entering;
  const session = currentSession();
  assert.equal(session.status, "signed-in");
  if (session.status === "signed-in") assert.equal(session.user.id, newUser.id);
  api.auth.signOut = async () => {};
});
