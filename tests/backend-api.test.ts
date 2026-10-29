import { test } from "node:test";
import assert from "node:assert/strict";
import { ApiError, createApiClient, type ApiEvent, type ApiOrganizerProfile, type ApiTicketType, type EventCreateInput, type TicketTypeCreateInput } from "../lib/api";
import config from "../next.config";

const accountId = "287ba5f0-41da-45f8-8b87-7d22e9983d23";
const organizerId = "9f49e576-9146-4263-8e47-96ac01398a30";
const eventId = "299dbbab-ea04-48b6-b1aa-3b4810b83cac";
const ticketId = "4f26d826-7d3b-46d7-b21f-3c6e60c4fe68";
const organizer: ApiOrganizerProfile = { id: organizerId, user_id: accountId, display_name: "BiletFlow Live", verification_status: "pending" };
const event: ApiEvent = {
  id: eventId, organizer_profile_id: organizerId, title: "A night in Almaty", description: null,
  visibility: "public", seating_type: "general_admission", start_at: "2026-12-01T19:00:00+05:00", end_at: "2026-12-01T22:00:00+05:00",
  capacity: 250, venue_name: "City Hall", venue_address: "1 Abai Avenue", city: "Almaty", category: "Concerts", status: "draft", paid_sales_activated_at: null, created_at: "2026-10-29T12:00:00Z",
};
const ticket: ApiTicketType = { id: ticketId, event_id: eventId, name: "General admission", description: "Main floor", price_kzt: 5000, quantity: 200, max_per_order: 4, sale_start: null, sale_end: null, is_hidden: false, created_at: "2026-10-29T12:00:00Z" };
const json = (value: unknown, status = 200) => new Response(JSON.stringify(value), { status, headers: { "Content-Type": "application/json" } });

test("profile and organizer updates match the supported fields and cannot self-verify", async () => {
  const calls: { path: string; init?: RequestInit }[] = [];
  const client = createApiClient({ fetch: async (path, init) => {
    calls.push({ path: String(path), init });
    return json(String(path).includes("/users/") ? { id: accountId, full_name: "Дулат Жанбыршын", email: "dulat@example.com", created_at: event.created_at } : { ...organizer, payout_details: "private" });
  } });
  assert.equal((await client.users.update(accountId, { full_name: "Дулат Жанбыршын" })).full_name, "Дулат Жанбыршын");
  assert.deepEqual(await client.organizers.create(accountId, { display_name: organizer.display_name }), organizer);
  assert.deepEqual(await client.organizers.get(organizerId), organizer);
  const untrusted = { display_name: organizer.display_name, verification_status: "verified" };
  assert.deepEqual(await client.organizers.update(organizerId, untrusted), organizer);
  assert.deepEqual(calls.map((call) => [call.path, call.init?.method]), [
    [`/api/backend/users/${accountId}`, "PATCH"], [`/api/backend/organizers/${accountId}`, "POST"],
    [`/api/backend/organizers/${organizerId}`, "GET"], [`/api/backend/organizers/${organizerId}`, "PATCH"],
  ]);
  assert.deepEqual(JSON.parse(String(calls[3].init?.body)), { display_name: organizer.display_name });
});

test("event creation, update, publication and cancellation use explicit server contracts", async () => {
  const calls: { path: string; init?: RequestInit }[] = [];
  const client = createApiClient({ fetch: async (path, init) => { calls.push({ path: String(path), init }); return json({ ...event, secret: "excluded" }); } });
  const input: EventCreateInput = { organizer_profile_id: organizerId, title: event.title, description: event.description, visibility: event.visibility, seating_type: event.seating_type, start_at: event.start_at, end_at: event.end_at, capacity: event.capacity, venue_name: event.venue_name, venue_address: event.venue_address, city: event.city, category: event.category };
  assert.deepEqual(await client.events.create(input), event);
  assert.deepEqual(await client.events.get(eventId), event);
  await client.events.update(eventId, { description: "", venue_address: "", capacity: 300 });
  await client.events.publish(eventId);
  await client.events.cancel(eventId);
  assert.deepEqual(calls.map((call) => [call.path, call.init?.method]), [
    ["/api/backend/events", "POST"], [`/api/backend/events/${eventId}`, "GET"], [`/api/backend/events/${eventId}`, "PATCH"],
    [`/api/backend/events/${eventId}/publish`, "POST"], [`/api/backend/events/${eventId}/cancel`, "POST"],
  ]);
  assert.deepEqual(JSON.parse(String(calls[2].init?.body)), { description: "", venue_address: "", capacity: 300 });
  for (const call of calls) { assert.equal(call.init?.credentials, "omit"); assert.equal(call.init?.cache, "no-store"); assert.equal(new Headers(call.init?.headers).has("Authorization"), false); }
  for (const call of calls.slice(3)) { assert.equal(call.init?.body, undefined); assert.equal(new Headers(call.init?.headers).has("Content-Type"), false); }
});

test("public discovery encodes filters and pagination without inventing search or ownership parameters", async () => {
  let called = "";
  const client = createApiClient({ baseUrl: "https://example.test/api/", fetch: async (path) => { called = String(path); return json([event]); } });
  assert.deepEqual(await client.events.list({ skip: 24, limit: 24, city: " Алматы ", category: "Music & art" }), [event]);
  const url = new URL(called);
  assert.equal(url.pathname, "/api/events");
  assert.deepEqual(Object.fromEntries(url.searchParams), { skip: "24", limit: "24", city: "Алматы", category: "Music & art" });
});

test("ticket definitions preserve integer KZT amounts, scheduling clears and hidden flags", async () => {
  const calls: { path: string; init?: RequestInit }[] = [];
  const client = createApiClient({ fetch: async (path, init) => { calls.push({ path: String(path), init }); return json(String(path).includes("/events/") && init?.method === "GET" ? [ticket] : ticket); } });
  assert.deepEqual(await client.ticketTypes.list(eventId), [ticket]);
  assert.deepEqual(await client.ticketTypes.list(eventId, { includeHidden: true }), [ticket]);
  await client.ticketTypes.get(ticketId);
  const input: TicketTypeCreateInput = { name: ticket.name, description: ticket.description, price_kzt: ticket.price_kzt, quantity: ticket.quantity, max_per_order: ticket.max_per_order, sale_start: ticket.sale_start, sale_end: ticket.sale_end, is_hidden: ticket.is_hidden };
  assert.deepEqual(await client.ticketTypes.create(eventId, input), ticket);
  await client.ticketTypes.update(ticketId, { price_kzt: 12500, sale_start: null, sale_end: null, is_hidden: true });
  assert.equal(calls[0].path, `/api/backend/events/${eventId}/ticket-types`);
  assert.equal(calls[1].path, `/api/backend/events/${eventId}/ticket-types?include_hidden=true`);
  assert.equal(calls[2].path, `/api/backend/ticket-types/${ticketId}`);
  assert.equal(calls[3].init?.method, "POST");
  assert.deepEqual(JSON.parse(String(calls[4].init?.body)), { price_kzt: 12500, sale_start: null, sale_end: null, is_hidden: true });
});

test("invalid UUIDs and pagination are rejected before any network write", async () => {
  let count = 0;
  const client = createApiClient({ fetch: async () => { count++; return json(event); } });
  for (const id of ["../publish", "me", "undefined", "?include_hidden=true"]) {
    for (const request of [() => client.events.get(id), () => client.events.publish(id), () => client.events.cancel(id), () => client.organizers.create(id, { display_name: "Organizer" }), () => client.ticketTypes.list(id), () => client.ticketTypes.update(id, {})]) await assert.rejects(request, ApiError);
  }
  for (const query of [{ skip: -1 }, { limit: 101 }, { limit: 0 }, { skip: 0.5 }, { limit: NaN }]) await assert.rejects(client.events.list(query), /valid event page/);
  assert.equal(count, 0);
});

test("malformed event and ticket successes remain errors, including missing nullable fields", async () => {
  for (const value of [{ ...event, capacity: -1 }, { ...event, status: "open" }, { ...event, end_at: event.start_at }, { ...event, start_at: "not-a-date" }, { ...event, venue_address: undefined }, []]) {
    const client = createApiClient({ fetch: async () => json(value) });
    await assert.rejects(client.events.get(eventId), (error: unknown) => error instanceof ApiError && error.status === 502);
  }
  for (const value of [{ ...ticket, price_kzt: 15.5 }, { ...ticket, quantity: 0 }, { ...ticket, is_hidden: "false" }, null]) {
    const client = createApiClient({ fetch: async () => json([value]) });
    await assert.rejects(client.ticketTypes.list(eventId), (error: unknown) => error instanceof ApiError && error.status === 502);
  }
});

test("failed mutations are never automatically replayed or turned into local successes", async () => {
  let count = 0;
  const client = createApiClient({ fetch: async () => { count++; return json({ detail: "Event capacity exceeded" }, 400); } });
  await assert.rejects(client.ticketTypes.update(ticketId, { quantity: 500 }), /Event capacity exceeded/);
  assert.equal(count, 1);
  const unavailable = createApiClient({ fetch: async () => new Response("internal credentials", { status: 503 }) });
  await assert.rejects(unavailable.events.publish(eventId), (error: unknown) => error instanceof ApiError && error.status === 503 && !error.message.includes("credentials"));
});

test("proxy routes preserve collection slashes and every supported event action", async () => {
  const result = await config.rewrites?.();
  assert.ok(Array.isArray(result));
  const routes = new Map(result.map((entry) => [entry.source, entry.destination]));
  for (const collection of ["users", "events"]) assert.match(routes.get(`/api/backend/${collection}`)!, new RegExp(`/${collection}/$`));
  for (const route of ["users/:id", "organizers/:id", "events/:id", "events/:id/publish", "events/:id/cancel", "events/:id/ticket-types", "ticket-types/:id"]) assert.ok(routes.get(`/api/backend/${route}`)?.endsWith(`/${route}`));
  assert.equal([...routes.keys()].some((path) => /auth|login|checkout|orders|payments|refunds|support/.test(path)), false);
});
