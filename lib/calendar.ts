export type CalendarEvent = {
  id: string;
  title: string;
  startAt: string;
  endAt?: string;
  venue?: string;
  address?: string;
  description?: string;
  url: string;
  status?: "cancelled" | "published" | "draft" | "completed";
  updatedAt?: string;
};

export const CALENDAR_TIME_ZONE = "Asia/Almaty";

function timestamp(value: string | Date): string {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) throw new Error("The event time is unavailable.");
  return date.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
}

function textValue(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/\r\n|\r|\n/g, "\\n").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, "");
}

export function foldCalendarLine(line: string): string {
  const encoder = new TextEncoder();
  let result = "";
  let width = 0;
  for (const character of line) {
    const size = encoder.encode(character).length;
    if (width + size > 75) {
      result += "\r\n ";
      width = 1;
    }
    result += character;
    width += size;
  }
  return result;
}

export function publicEventUrl(value: string): string {
  const url = new URL(value);
  if (!["https:", "http:"].includes(url.protocol) || url.username || url.password) throw new Error("A public event URL is required.");
  url.search = "";
  url.hash = "";
  return url.href;
}

function eventTimes(event: CalendarEvent) {
  const start = timestamp(event.startAt);
  const end = event.endAt ? timestamp(event.endAt) : undefined;
  if (end && new Date(event.endAt!).getTime() <= new Date(event.startAt).getTime()) throw new Error("The event end must be after its start.");
  return { start, end };
}

export function calendarUid(id: string): string {
  if (!id.trim()) throw new Error("An event reference is required.");
  return `${encodeURIComponent(id)}@biletflow.events`;
}

export function createCalendarFile(event: CalendarEvent, now = new Date()): string {
  const { start, end } = eventTimes(event);
  const modifiedAt = event.updatedAt ? new Date(event.updatedAt) : now;
  const cancelled = event.status === "cancelled";
  const sequence = Math.min(2147483647, Math.max(0, Math.floor((modifiedAt.getTime() - Date.UTC(2000, 0, 1)) / 1000)) + Number(cancelled));
  const location = [event.venue, event.address].filter(Boolean).join(", ");
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//BiletFlow//Event Calendar//EN",
    "CALSCALE:GREGORIAN",
    `METHOD:${cancelled ? "CANCEL" : "PUBLISH"}`,
    `X-WR-TIMEZONE:${CALENDAR_TIME_ZONE}`,
    "BEGIN:VEVENT",
    `UID:${calendarUid(event.id)}`,
    `DTSTAMP:${timestamp(now)}`,
    `LAST-MODIFIED:${timestamp(modifiedAt)}`,
    `SEQUENCE:${sequence}`,
    `DTSTART:${start}`,
    ...(end ? [`DTEND:${end}`] : []),
    `SUMMARY:${textValue(event.title)}`,
    ...(location ? [`LOCATION:${textValue(location)}`] : []),
    ...(event.description ? [`DESCRIPTION:${textValue(event.description)}`] : []),
    `URL:${publicEventUrl(event.url)}`,
    `STATUS:${cancelled ? "CANCELLED" : event.status === "draft" ? "TENTATIVE" : "CONFIRMED"}`,
    "END:VEVENT",
    "END:VCALENDAR",
  ];
  return `${lines.map(foldCalendarLine).join("\r\n")}\r\n`;
}

export function calendarLinks(event: CalendarEvent): { google: string; outlook: string } | null {
  const { start, end } = eventTimes(event);
  if (!end || event.status === "cancelled") return null;
  const url = publicEventUrl(event.url);
  const details = [event.description, url].filter(Boolean).join("\n\n");
  const location = [event.venue, event.address].filter(Boolean).join(", ");
  const google = new URL("https://calendar.google.com/calendar/render");
  google.search = new URLSearchParams({ action: "TEMPLATE", text: event.title, dates: `${start}/${end}`, ctz: CALENDAR_TIME_ZONE, details, location }).toString();
  const outlook = new URL("https://outlook.live.com/calendar/0/deeplink/compose");
  outlook.search = new URLSearchParams({ path: "/calendar/action/compose", rru: "addevent", subject: event.title, startdt: new Date(event.startAt).toISOString(), enddt: new Date(event.endAt!).toISOString(), body: details, location }).toString();
  return { google: google.href, outlook: outlook.href };
}

export function calendarFilename(event: CalendarEvent): string {
  return `biletflow-event-${event.id.replace(/[^a-z0-9_-]/gi, "-")}${event.status === "cancelled" ? "-cancelled" : ""}.ics`;
}
