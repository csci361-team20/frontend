import { test } from "node:test";
import assert from "node:assert/strict";
import { createApiClient } from "../lib/api";
import { holdLeft, orderTab, parseSelection, ticketCount, type Order } from "../lib/orders";

const typeId = "1cd855aa-ef8f-4819-951c-a05dd69c8f13";
const seatId = "0b8e2a7c-2f41-4d0b-9d8c-2f1d6a1e4c11";

test("the ticket choice from the event page is read safely", () => {
  assert.deepEqual(parseSelection(JSON.stringify({ [typeId]: 2 })), {
    items: [{ ticket_type_id: typeId, quantity: 2 }],
    seat_ids: [],
  });
  // Bad ids, zero, negative and fractional quantities are dropped
  assert.deepEqual(parseSelection(JSON.stringify({ x: 2, [typeId]: 0, [seatId]: 1.5 })).items, []);
  assert.deepEqual(parseSelection("not json").items, []);
  assert.deepEqual(parseSelection(undefined, `${seatId},nope`).seat_ids, [seatId]);
  assert.equal(ticketCount(parseSelection(JSON.stringify({ [typeId]: 3 }))), 3);
  assert.equal(ticketCount(parseSelection(undefined, `${seatId},${typeId}`)), 2);
});

test("orders land in the right My tickets tab", () => {
  const now = Date.parse("2026-11-17T00:00:00Z");
  const order = { status: "confirmed", event_start_at: "2026-11-30T16:00:00Z" } as Order;
  assert.equal(orderTab(order, now), "upcoming");
  assert.equal(orderTab({ ...order, status: "pending" }, now), "upcoming");
  assert.equal(orderTab({ ...order, event_start_at: "2026-11-01T16:00:00Z" }, now), "past");
  for (const status of ["cancelled", "refunded", "expired"] as const)
    assert.equal(orderTab({ ...order, status }, now), "closed");
});

test("the checkout hold counts down and then ends", () => {
  const now = Date.parse("2026-11-17T10:00:00Z");
  assert.equal(holdLeft("2026-11-17T10:09:30Z", now), "9:30");
  assert.equal(holdLeft("2026-11-17T10:00:05Z", now), "0:05");
  assert.equal(holdLeft("2026-11-17T09:59:59Z", now), null);
  assert.equal(holdLeft(null, now), null);
});

test("checkout sends the backend's order and payment bodies", async () => {
  const calls: { path: string; body: unknown }[] = [];
  const client = createApiClient({
    fetch: async (input, init) => {
      calls.push({ path: String(input), body: init?.body ? JSON.parse(String(init.body)) : null });
      return new Response("{}", { headers: { "Content-Type": "application/json" } });
    },
  });
  const selection = { items: [{ ticket_type_id: typeId, quantity: 2 }], seat_ids: [] };
  await client.orders.create("evt", selection, { promo_code: "AUTUMN" });
  await client.orders.pay("ord");
  await client.orders.pay("ord", "failure");
  await client.events.quote("evt", { items: [], seat_ids: [seatId] });
  assert.deepEqual(calls[0], {
    path: "/api/backend/events/evt/orders",
    body: { ...selection, promo_code: "AUTUMN" },
  });
  assert.deepEqual(calls[1].body, { outcome: "success" });
  assert.equal((calls[2].body as { outcome: string }).outcome, "failure");
  assert.deepEqual(calls[3].body, { items: [], seat_ids: [seatId], promo_code: null });
  assert.equal(client.orders.pdf("ord"), "/api/backend/orders/ord/tickets.pdf");
});
