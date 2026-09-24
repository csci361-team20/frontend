import { test } from "node:test";
import assert from "node:assert/strict";
import {
  available,
  canCheckIn,
  canManage,
  checkIn,
  initialState,
  placeOrder,
  saveEvent,
  soldCount,
  type DemoState,
} from "../lib/demo-data";

function fixture(): DemoState {
  const state = structuredClone(initialState);
  state.currentUserId = "dana";
  state.events.forEach((e) => {
    e.date = "2099-10-24T21:00:00+05:00";
  });
  return state;
}
const contact = { name: "Test Guest", email: "guest@example.com" };
test("a booking creates one unique admission per guest and reduces available inventory", () => {
  const state = fixture();
  const next = placeOrder(
    state,
    "concert",
    { "concert-general": 2, "concert-balcony": 1 },
    contact,
    "order-test",
  );
  assert.equal(next.orders[0].total, 33500);
  assert.equal(next.orders[0].lines.flatMap((l) => l.admissions).length, 3);
  assert.equal(
    new Set(next.orders[0].lines.flatMap((l) => l.admissions.map((a) => a.id)))
      .size,
    3,
  );
  assert.equal(available(next, next.events[0], next.events[0].tickets[0]), 176);
  assert.equal(state.orders.length, 1);
});
test("checkout rejects signed-out users, drafts, unknown tickets, and expired events", () => {
  const state = fixture();
  assert.throws(
    () =>
      placeOrder(
        { ...state, currentUserId: null },
        "concert",
        { "concert-general": 1 },
        contact,
        "a",
      ),
    /Sign in/,
  );
  assert.throws(
    () => placeOrder(state, "concert", { unknown: 1 }, contact, "a"),
    /no longer available/,
  );
  state.events[0].status = "draft";
  assert.throws(
    () => placeOrder(state, "concert", { "concert-general": 1 }, contact, "a"),
    /no longer accepting/,
  );
  state.events[0].status = "published";
  state.events[0].date = "2000-01-01T00:00:00Z";
  assert.throws(
    () => placeOrder(state, "concert", { "concert-general": 1 }, contact, "a"),
    /no longer accepting/,
  );
});
test("quantities cannot be negative, fractional, empty, or exceed remaining capacity", () => {
  const state = fixture();
  for (const count of [-1, 0.5, 9, NaN])
    assert.throws(
      () =>
        placeOrder(
          state,
          "concert",
          { "concert-general": count },
          contact,
          "a",
        ),
      /between 0 and 8/,
    );
  assert.throws(
    () => placeOrder(state, "concert", {}, contact, "a"),
    /at least one/,
  );
  state.events[0].tickets[0].capacity = 3;
  const next = placeOrder(
    state,
    "concert",
    { "concert-general": 1 },
    contact,
    "first",
  );
  assert.throws(
    () =>
      placeOrder(next, "concert", { "concert-general": 1 }, contact, "second"),
    /Only 0/,
  );
});
test("paid sales gate applies only to paid tickets; free registration still works", () => {
  const state = fixture();
  state.events[0].paidSales = false;
  assert.throws(
    () => placeOrder(state, "concert", { "concert-general": 1 }, contact, "a"),
    /paused/,
  );
  state.events.find((e) => e.id === "comedy")!.paidSales = false;
  const next = placeOrder(
    state,
    "comedy",
    { "comedy-general": 1 },
    contact,
    "free",
  );
  assert.equal(next.orders[0].total, 0);
});
test("repeated booking submission is idempotent and existing prices remain snapshots", () => {
  const state = fixture();
  const next = placeOrder(
    state,
    "concert",
    { "concert-general": 1 },
    contact,
    "same",
  );
  assert.equal(
    placeOrder(next, "concert", { "concert-general": 1 }, contact, "same")
      .orders.length,
    2,
  );
  next.currentUserId = "arman";
  const updated = saveEvent(next, {
    ...next.events[0],
    tickets: next.events[0].tickets.map((t) => ({ ...t, price: 20000 })),
  });
  assert.equal(updated.orders[0].total, 9500);
});
test("only the owning organizer can change an event", () => {
  const state = fixture();
  const event = state.events[0];
  assert.equal(canManage(state.profiles[0], event), false);
  assert.throws(() => saveEvent(state, event), /Only the event organizer/);
  state.currentUserId = "arman";
  assert.throws(
    () => saveEvent(state, { ...event, ownerId: "dana" }),
    /Only the event organizer/,
  );
  assert.equal(
    saveEvent(state, { ...event, title: "A new title" }).events[0].title,
    "A new title",
  );
});
test("ticket inventory cannot be reduced below booked quantities or removed after a sale", () => {
  const state = fixture();
  state.currentUserId = "arman";
  assert.throws(
    () =>
      saveEvent(state, {
        ...state.events[0],
        tickets: [{ ...state.events[0].tickets[0], capacity: 1 }],
      }),
    /cannot be lower/,
  );
  assert.throws(
    () =>
      saveEvent(state, {
        ...state.events[0],
        tickets: [state.events[0].tickets[1]],
      }),
    /cannot be removed/,
  );
});
test("assigned staff have event-specific check-in access, revoked staff cannot check in", () => {
  const state = fixture();
  assert.equal(canCheckIn(state.profiles[0], state.events[0]), true);
  assert.equal(canCheckIn(state.profiles[0], state.events[1]), false);
  const next = checkIn(state, "concert", "TE-1042-A");
  assert.equal(next.orders[0].lines[0].admissions[0].checkedIn, true);
  assert.equal(next.orders[0].lines[0].admissions[1].checkedIn, false);
  assert.throws(
    () => checkIn(next, "concert", "TE-1042-A"),
    /already been checked in/,
  );
  assert.throws(
    () => checkIn(next, "cine", "TE-1042-B"),
    /do not have check-in access/,
  );
  next.events[0].staff = [];
  assert.throws(
    () => checkIn(next, "concert", "TE-1042-B"),
    /do not have check-in access/,
  );
});
test("cancelled orders release capacity and cannot be checked in", () => {
  const state = fixture();
  state.orders[0].status = "cancelled";
  assert.equal(soldCount(state.orders, "concert"), 0);
  assert.throws(
    () => checkIn(state, "concert", "TE-1042-A"),
    /Ticket not found/,
  );
});

test("past events can be unpublished without allowing a new event in the past", () => {
  const state = fixture();
  state.currentUserId = "arman";
  state.events[0].date = "2000-01-01T19:00:00+05:00";
  assert.equal(
    saveEvent(state, { ...state.events[0], status: "draft" }).events[0].status,
    "draft",
  );
  assert.throws(
    () => saveEvent(state, { ...state.events[0], id: "new-past-event" }),
    /future event date/,
  );
});
