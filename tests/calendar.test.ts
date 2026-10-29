import { test } from "node:test";
import assert from "node:assert/strict";
import { calendarLinks, calendarUid, createCalendarFile, foldCalendarLine, publicEventUrl, type CalendarEvent } from "../lib/calendar";

const event: CalendarEvent = {
  id: "event-123",
  title: "Алматы: көктем кеші",
  startAt: "2026-11-05T19:00:00+05:00",
  endAt: "2026-11-05T21:30:00+05:00",
  venue: "Republic Palace",
  address: "56 Dostyk Avenue, Almaty",
  description: "An evening together.",
  url: "https://biletflow.example/events/event-123",
  updatedAt: "2026-10-29T10:00:00Z",
};
const now = new Date("2026-10-29T11:00:00Z");
const unfold = (value: string) => value.replace(/\r\n /g, "");

test("calendar contains actual UTC times, public context and the configured zone", () => {
  const calendar = unfold(createCalendarFile(event, now));
  assert.ok(calendar.includes("DTSTART:20261105T140000Z\r\n"));
  assert.ok(calendar.includes("DTEND:20261105T163000Z\r\n"));
  assert.ok(calendar.includes("X-WR-TIMEZONE:Asia/Almaty\r\n"));
  assert.ok(calendar.includes("LOCATION:Republic Palace\\, 56 Dostyk Avenue\\, Almaty"));
  assert.ok(calendar.includes(`SUMMARY:${event.title}`));
  assert.ok(calendar.includes(`URL:${event.url}`));
  assert.equal(calendar.replace(/\r\n/g, "").includes("\n"), false);
});

test("calendar updates and cancellations retain identity and carry cancellation metadata", () => {
  const original = createCalendarFile(event, now);
  const changed = createCalendarFile({ ...event, title: "Rescheduled", startAt: "2026-12-01T19:00:00+05:00", endAt: undefined, updatedAt: "2026-10-30T11:00:00Z" }, now);
  const cancelled = createCalendarFile({ ...event, status: "cancelled", updatedAt: "2026-10-31T11:00:00Z" }, now);
  const uid = `UID:${calendarUid(event.id)}\r\n`;
  for (const value of [original, changed, cancelled]) assert.ok(value.includes(uid));
  assert.ok(cancelled.includes("METHOD:CANCEL\r\n"));
  assert.ok(cancelled.includes("STATUS:CANCELLED\r\n"));
  const sequence = (value: string) => Number(value.match(/SEQUENCE:(\d+)/)![1]);
  assert.ok(sequence(changed) > sequence(original));
  assert.ok(sequence(cancelled) > sequence(changed));
});

test("missing duration does not create a made-up end or provider calendar event", () => {
  const openEnded = { ...event, endAt: undefined };
  assert.equal(createCalendarFile(openEnded, now).includes("DTEND:"), false);
  assert.equal(calendarLinks(openEnded), null);
  assert.equal(calendarLinks({ ...event, status: "cancelled" }), null);
});

test("calendar text escapes property injection and punctuation", () => {
  const calendar = unfold(createCalendarFile({ ...event, title: "One, two; three\\four\r\nBEGIN:VEVENT" }, now));
  assert.ok(calendar.includes("SUMMARY:One\\, two\\; three\\\\four\\nBEGIN:VEVENT\r\n"));
  assert.equal(calendar.match(/\r\nBEGIN:VEVENT\r\n/g)?.length, 1);
});

test("folding respects the 75 UTF-8 octet limit without breaking Kazakh or emoji characters", () => {
  const value = `DESCRIPTION:${"ӘҒҚҢӨҰҮҺІ Қазақша 🎟️ ".repeat(20)}`;
  const folded = foldCalendarLine(value);
  assert.equal(unfold(folded), value);
  for (const line of folded.split("\r\n")) assert.ok(new TextEncoder().encode(line).length <= 75);
  assert.equal(folded.includes("�"), false);
});

test("provider links include actual start/end and omit URL queries with personal context", () => {
  const links = calendarLinks({ ...event, url: `${event.url}?email=private%40example.com&order=123#ticket` })!;
  const google = new URL(links.google);
  const outlook = new URL(links.outlook);
  assert.equal(google.searchParams.get("dates"), "20261105T140000Z/20261105T163000Z");
  assert.equal(google.searchParams.get("ctz"), "Asia/Almaty");
  assert.equal(outlook.searchParams.get("enddt"), "2026-11-05T16:30:00.000Z");
  for (const value of [links.google, links.outlook, createCalendarFile({ ...event, url: `${event.url}?email=private%40example.com` }, now)]) {
    assert.equal(decodeURIComponent(value).includes("private@example.com"), false);
  }
});

test("unsafe event links and invalid times cannot generate calendar exports", () => {
  assert.throws(() => publicEventUrl("javascript:alert(1)"));
  assert.throws(() => publicEventUrl("https://user:password@example.com/event"));
  assert.throws(() => createCalendarFile({ ...event, startAt: "not-a-date" }, now));
  assert.throws(() => createCalendarFile({ ...event, endAt: event.startAt }, now));
});
