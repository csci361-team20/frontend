import { test } from "node:test";
import assert from "node:assert/strict";
import { createApiClient } from "../lib/api";
import {
  cardStatus,
  categoryLabel,
  categoryValue,
  eventDate,
  eventTime,
  mediaUrl,
  normaliseWhen,
  posterInfo,
  ticketBlock,
  whenRange,
  type ListedEvent,
  type TicketType,
} from "../lib/events";

const event: ListedEvent = {
  id: "fee68e97-87bb-45ab-883e-2f09c734c5e9",
  organizer_profile_id: "fcff758a-975e-4fdf-94ec-9c682ac362a0",
  title: "Jazz on the Left Bank",
  subtitle: null,
  description: null,
  cover_image_url: null,
  refund_policy: null,
  status: "published",
  lifecycle: "upcoming",
  visibility: "public",
  seating_type: "general_admission",
  start_at: "2026-11-30T16:00:00Z",
  end_at: "2026-11-30T19:00:00Z",
  timezone: "Asia/Almaty",
  capacity: 60,
  registration_opens_at: null,
  registration_closes_at: null,
  paid_sales_open: true,
  is_suspended: false,
  venue_name: "Riverside Jazz Club",
  venue_address: null,
  city: "Astana",
  category: "concert",
  published_at: null,
  created_at: "2026-11-01T00:00:00Z",
  organizer_name: "Astana Stage House",
  price_from_kzt: 7000,
  tickets_available: 60,
  sale_state: "on_sale",
};

const ticket: TicketType = {
  id: "0b8e2a7c-2f41-4d0b-9d8c-2f1d6a1e4c11",
  event_id: event.id,
  name: "Table seat",
  description: null,
  price_kzt: 7000,
  quantity: 60,
  max_per_order: 8,
  sale_start: null,
  sale_end: null,
  is_hidden: false,
  seat_category: null,
  available: 60,
  sale_status: "on_sale",
};

test("categories accept stored values and the labels used in older links", () => {
  assert.equal(categoryValue("Concerts"), "concert");
  assert.equal(categoryValue("concert"), "concert");
  assert.equal(categoryValue("Festivals"), "festival");
  assert.equal(categoryValue("All events"), "");
  assert.equal(categoryLabel("cinema"), "Cinema");
  assert.equal(categoryLabel("workshop"), "Workshop");
  assert.equal(categoryLabel(null), "Event");
});

test("dates are shown in the event's own time zone", () => {
  assert.equal(eventTime(event.start_at, "Asia/Almaty"), "21:00");
  assert.equal(eventDate(event.start_at, "Asia/Almaty"), "30 Nov");
  // Unknown zones fall back to Almaty instead of throwing
  assert.equal(eventTime(event.start_at, "Not/AZone"), "21:00");
});

test("uploaded images go through the proxy; outside links stay as they are", () => {
  assert.equal(mediaUrl("/api/v1/media/events/a.jpg"), "/api/backend/media/events/a.jpg");
  assert.equal(
    mediaUrl("http://localhost:8000/api/v1/media/events/a.jpg"),
    "/api/backend/media/events/a.jpg",
  );
  assert.equal(mediaUrl("https://cdn.example.com/a.jpg"), "https://cdn.example.com/a.jpg");
  assert.equal(mediaUrl("javascript:alert(1)"), null);
  assert.equal(mediaUrl(null), null);
  assert.equal(posterInfo(event).poster, "concert");
  assert.equal(posterInfo({ ...event, category: "cinema" }).poster, "cine");
});

test("event cards explain why tickets cannot be bought", () => {
  assert.deepEqual(cardStatus(event), { label: "from ₸7,000", action: "Get tickets" });
  assert.equal(cardStatus({ ...event, price_from_kzt: 0 }).label, "Free");
  assert.equal(cardStatus({ ...event, sale_state: "sold_out" }).label, "Sold out");
  assert.equal(cardStatus({ ...event, sale_state: "scheduled" }).label, "On sale soon");
  assert.equal(cardStatus({ ...event, paid_sales_open: false }).label, "Sales open soon");
  assert.equal(cardStatus({ ...event, price_from_kzt: null, sale_state: null }).label, "Tickets soon");
  assert.equal(cardStatus({ ...event, lifecycle: "cancelled" }).label, "Cancelled");
});

test("ticket types are blocked for the right reason", () => {
  const now = Date.parse("2026-11-15T00:00:00Z");
  assert.equal(ticketBlock(ticket, event, now), null);
  assert.equal(ticketBlock({ ...ticket, available: 0, sale_status: "sold_out" }, event, now), "Sold out");
  assert.equal(ticketBlock(ticket, { ...event, paid_sales_open: false }, now), "Paid sales are not open yet");
  assert.equal(ticketBlock({ ...ticket, price_kzt: 0 }, { ...event, paid_sales_open: false }, now), null);
  assert.equal(
    ticketBlock({ ...ticket, sale_status: "scheduled", sale_start: "2026-11-20T05:00:00Z" }, event, now),
    "On sale 20 Nov, 10:00",
  );
  assert.equal(ticketBlock(ticket, { ...event, lifecycle: "cancelled" }, now), "Event cancelled");
});

test("date filters cover the right days in Kazakhstan time", () => {
  // Wednesday 18 Nov 2026, 10:00 in Almaty
  const now = Date.parse("2026-11-18T05:00:00Z");
  assert.deepEqual(whenRange("any", now), {});
  assert.deepEqual(whenRange("today", now), { starts_to: "2026-11-18T19:00:00.000Z" });
  assert.deepEqual(whenRange("weekend", now), {
    starts_from: "2026-11-20T19:00:00.000Z",
    starts_to: "2026-11-22T19:00:00.000Z",
  });
  // On a Sunday the current weekend is used
  const sunday = Date.parse("2026-11-22T10:00:00Z");
  assert.equal(whenRange("weekend", sunday).starts_from, "2026-11-20T19:00:00.000Z");
  assert.equal(normaliseWhen("weekend"), "weekend");
  assert.equal(normaliseWhen("someday"), "any");
});

test("event list requests send only the filters that are set", async () => {
  const calls: string[] = [];
  const client = createApiClient({
    fetch: async (input) => {
      calls.push(String(input));
      return new Response("[]", { headers: { "Content-Type": "application/json" } });
    },
  });
  await client.events.list({ q: "jazz", city: "", category: "concert" });
  await client.events.ticketTypes(event.id);
  assert.equal(calls[0], "/api/backend/events/?limit=200&q=jazz&category=concert");
  assert.equal(calls[1], `/api/backend/events/${event.id}/ticket-types`);
  assert.equal(client.events.calendarFile(event.id), `/api/backend/events/${event.id}/calendar.ics`);
});
