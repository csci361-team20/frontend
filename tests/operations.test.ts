import { test } from "node:test";
import assert from "node:assert/strict";
import {
  canCheckIn,
  canManage,
  checkIn,
  initialState,
  isEventVisible,
  migrateDemoState,
  placeOrder,
  saveEvent,
  type DemoState,
  type Profile,
} from "../lib/demo-data";
import {
  canManageCase,
  canViewCase,
  createSupportCase,
  eligibleCaseAssignees,
  escalateSupportCase,
  markNotificationRead,
  operationalCsv,
  replyToCase,
  reportEvent,
  reviewEventReport,
  savePlatformSettings,
  suspendEvent,
  suspendUser,
  updateSupportCase,
  type ReportKind,
} from "../lib/operations";

function fixture(actor = "dana"): DemoState {
  const state = structuredClone(initialState);
  state.currentUserId = actor;
  state.events.forEach((event) => { event.date = "2099-11-01T18:00:00+05:00"; });
  state.profiles.push(
    { id: "charlie", name: "Charlie Guest", email: "charlie@example.com", role: "attendee" },
    { id: "beket", name: "Beket Organizer", email: "beket@example.com", role: "organizer" },
    { id: "other-support", name: "Other Support", email: "other-support@example.com", role: "attendee", supportOrganizerIds: ["beket"] },
  );
  state.events.push({ ...structuredClone(state.events[0]), id: "other-event", ownerId: "beket", title: "Another organizer's event", staff: [] });
  state.orders.push({
    ...structuredClone(state.orders[0]),
    id: "other-order",
    userId: "charlie",
    eventId: "other-event",
    lines: [{ ...state.orders[0].lines[0], admissions: [{ id: "other-ticket", checkedIn: false }] }],
  });
  return state;
}

function profile(state: DemoState, id: string): Profile {
  const value = state.profiles.find((item) => item.id === id);
  assert.ok(value);
  return value;
}

function supportCase(state: DemoState, id = "SC-1042") {
  const value = state.operations.cases.find((item) => item.id === id);
  assert.ok(value);
  return value;
}

const caseInput = {
  subject: "Please help with my ticket",
  category: "ticket_delivery" as const,
  body: "I need help locating the ticket I purchased.",
};
const contact = { name: "Demo Guest", email: "guest@example.com" };

test("ticket-origin support automatically includes its owner, order, event and correct organizer", () => {
  const state = fixture();
  const next = createSupportCase(state, { ...caseInput, context: { ticketId: "TE-1042-B" } }, "SC-created");
  const item = supportCase(next, "SC-created");
  assert.equal(item.requesterId, "dana");
  assert.equal(item.organizerId, "arman");
  assert.equal(item.audience, "attendee");
  assert.deepEqual(item.context, { eventId: "concert", orderId: "TE-2026-1042", ticketId: "TE-1042-B" });
  assert.equal(item.messages[0].senderId, "dana");
  assert.equal(item.history[0].actorId, "dana");
  assert.equal(state.operations.cases.length + 1, next.operations.cases.length);
  const recipients = next.operations.notifications.filter((notice) => notice.caseId === item.id).map((notice) => notice.userId).sort();
  assert.deepEqual(recipients, ["admin", "arman", "support"]);
});

test("support context rejects another attendee's order or ticket and mismatched event context", () => {
  const state = fixture();
  for (const context of [
    { orderId: "other-order" },
    { ticketId: "other-ticket" },
    { orderId: "TE-2026-1042", ticketId: "other-ticket" },
    { orderId: "TE-2026-1042", eventId: "other-event" },
    { eventId: "missing-event" },
  ]) assert.throws(() => createSupportCase(state, { ...caseInput, context }), /unavailable|does not match/);
  state.events[0].status = "draft";
  assert.throws(() => createSupportCase(state, { ...caseInput, context: { eventId: "concert" } }), /unavailable/);
  assert.doesNotThrow(() => createSupportCase(state, { ...caseInput, context: { orderId: "TE-2026-1042" } }));
});

test("attendee cases are visible only to their requester, organizer team and platform administrators", () => {
  const state = fixture();
  const item = supportCase(state);
  for (const id of ["dana", "arman", "support", "admin"]) assert.equal(canViewCase(state, profile(state, id), item), true, id);
  for (const id of ["charlie", "beket", "other-support"]) assert.equal(canViewCase(state, profile(state, id), item), false, id);
  assert.equal(canViewCase(state, undefined, item), false);
  assert.equal(canManageCase(state, profile(state, "dana"), item), false);
});

test("support access follows canonical current roles and assignments rather than stale or forged profile objects", () => {
  const state = fixture();
  const staleSupport = structuredClone(profile(state, "support"));
  profile(state, "support").supportOrganizerIds = [];
  assert.equal(canViewCase(state, staleSupport, supportCase(state)), false);
  const forgedAdmin: Profile = { ...profile(state, "charlie"), role: "platform_admin" };
  assert.equal(canManageCase(state, forgedAdmin, supportCase(state)), false);
  assert.equal(canViewCase(state, forgedAdmin, supportCase(state)), false);
});

test("an organizer's support staff cannot access another organizer's attendee cases", () => {
  const state = fixture("charlie");
  const next = createSupportCase(state, { ...caseInput, context: { eventId: "other-event" } }, "SC-other-team");
  const item = supportCase(next, "SC-other-team");
  for (const id of ["charlie", "beket", "other-support", "admin"]) assert.equal(canViewCase(next, profile(next, id), item), true, id);
  for (const id of ["dana", "arman", "support"]) assert.equal(canViewCase(next, profile(next, id), item), false, id);
  assert.deepEqual(eligibleCaseAssignees(next, item).map((user) => user.id).sort(), ["admin", "beket", "other-support"]);
});

test("organizer platform-support cases stay between that organizer and platform administrators", () => {
  const state = fixture("arman");
  const next = createSupportCase(state, { ...caseInput, category: "activation", context: { eventId: "fest" } }, "SC-platform");
  const item = supportCase(next, "SC-platform");
  assert.equal(item.audience, "organizer");
  assert.equal(item.escalated, true);
  assert.deepEqual(eligibleCaseAssignees(next, item).map((user) => user.id), ["admin"]);
  for (const id of ["arman", "admin"]) assert.equal(canViewCase(next, profile(next, id), item), true);
  for (const id of ["support", "dana", "beket", "other-support"]) assert.equal(canViewCase(next, profile(next, id), item), false);
  assert.throws(() => createSupportCase(state, { ...caseInput, context: { eventId: "other-event" } }), /owned by/);
  assert.throws(() => createSupportCase({ ...state, currentUserId: "dana" }, { ...caseInput, audience: "organizer" }), /organizer profile/);
});

test("an organizer purchasing another organizer's event receives attendee support for their own order and ticket", () => {
  const state = fixture("arman");
  state.orders.find((order) => order.id === "other-order")!.userId = "arman";
  for (const [index, context] of [{ orderId: "other-order" }, { ticketId: "other-ticket" }].entries()) {
    const id = `SC-organizer-purchaser-${index}`;
    const next = createSupportCase(state, { ...caseInput, context }, id);
    const item = supportCase(next, id);
    assert.equal(item.requesterId, "arman");
    assert.equal(item.audience, "attendee");
    assert.equal(item.organizerId, "beket");
    assert.equal(item.escalated, false);
    assert.equal(item.context.eventId, "other-event");
    assert.equal(item.context.orderId, "other-order");
    assert.equal(item.context.ticketId, "ticketId" in context ? "other-ticket" : undefined);
    assert.deepEqual(eligibleCaseAssignees(next, item).map((user) => user.id).sort(), ["admin", "beket", "other-support"]);
    assert.equal(canViewCase(next, profile(next, "other-support"), item), true);
    assert.equal(canViewCase(next, profile(next, "support"), item), false);
    assert.equal(canManageCase(next, profile(next, "arman"), item), false);
    const recipients = next.operations.notifications.filter((notice) => notice.caseId === id).map((notice) => notice.userId).sort();
    assert.deepEqual(recipients, ["admin", "beket", "other-support"]);
  }
  assert.throws(() => createSupportCase(state, { ...caseInput, audience: "organizer", context: { orderId: "other-order" } }), /owned by/);
});

test("case mutations enforce access even when called outside the visible support screen", () => {
  const state = fixture("charlie");
  assert.throws(() => replyToCase(state, "SC-1042", "Unauthorized reply"), /unavailable/);
  assert.throws(() => updateSupportCase(state, "SC-1042", { status: "Resolved" }), /unavailable/);
  assert.throws(() => escalateSupportCase(state, "SC-1042"), /unavailable/);
  assert.throws(() => createSupportCase({ ...state, currentUserId: null }, caseInput), /demo profile/);
});

test("authorized staff assignment and status changes append history and notify only participants", () => {
  const state = fixture("support");
  const before = supportCase(state);
  const next = updateSupportCase(state, before.id, { status: "In Progress", assigneeId: "arman" });
  const item = supportCase(next);
  assert.equal(item.status, "In Progress");
  assert.equal(item.assigneeId, "arman");
  assert.equal(item.history.length, before.history.length + 1);
  assert.deepEqual(item.history.slice(0, before.history.length), before.history);
  assert.match(item.history.at(-1)!.action, /Changed status to In Progress; Assigned to Arman/);
  assert.equal(item.history.at(-1)!.actorId, "support");
  const notices = next.operations.notifications.filter((notice) => !state.operations.notifications.some((old) => old.id === notice.id));
  assert.deepEqual(notices.map((notice) => notice.userId).sort(), ["admin", "arman", "dana"]);
  assert.ok(notices.every((notice) => notice.caseId === item.id && notice.read === false));
  assert.strictEqual(updateSupportCase(next, item.id, { status: item.status, assigneeId: item.assigneeId }), next);
});

test("requesters cannot assign or resolve cases and staff cannot assign an unrelated profile", () => {
  const state = fixture();
  assert.throws(() => updateSupportCase(state, "SC-1042", { status: "Resolved" }), /authorized support staff/);
  assert.throws(() => updateSupportCase(state, "SC-1042", { assigneeId: "dana" }), /authorized support staff/);
  state.currentUserId = "support";
  for (const assigneeId of ["dana", "other-support", "beket", "missing-user"]) assert.throws(() => updateSupportCase(state, "SC-1042", { assigneeId }), /authorized for this case/);
  const next = updateSupportCase(state, "SC-1042", { assigneeId: null });
  assert.equal(supportCase(next).assigneeId, undefined);
  assert.match(supportCase(next).history.at(-1)!.action, /Removed case assignment/);
});

test("requester replies preserve the full thread and reopen resolved cases with an audit trail", () => {
  let state = fixture("support");
  state = updateSupportCase(state, "SC-1042", { status: "Resolved" });
  const before = supportCase(state);
  state.currentUserId = "dana";
  const next = replyToCase(state, "SC-1042", "I still cannot find the second ticket.");
  const item = supportCase(next);
  assert.equal(item.status, "Open");
  assert.deepEqual(item.messages.slice(0, before.messages.length), before.messages);
  assert.equal(item.messages.at(-1)!.senderId, "dana");
  assert.equal(item.history.length, before.history.length + 1);
  assert.match(item.history.at(-1)!.action, /Reopened/);
  assert.throws(() => replyToCase(next, item.id, " "), /Write a message/);
  assert.throws(() => replyToCase(next, item.id, "x".repeat(4001)), /Write a message/);
});

test("escalation preserves history and notification reads are restricted to their recipient", () => {
  const state = fixture("support");
  const next = escalateSupportCase(state, "SC-1042");
  const item = supportCase(next);
  assert.equal(item.escalated, true);
  assert.equal(item.assigneeId, undefined);
  assert.match(item.history.at(-1)!.action, /Escalated to platform support/);
  assert.strictEqual(escalateSupportCase(next, item.id), next);
  assert.throws(() => markNotificationRead(next, "notice-1"), /unavailable/);
  next.currentUserId = "dana";
  const read = markNotificationRead(next, "notice-1");
  assert.equal(read.operations.notifications.find((notice) => notice.id === "notice-1")!.read, true);
  assert.equal(next.operations.notifications.find((notice) => notice.id === "notice-1")!.read, false);
});

test("only active platform administrators can suspend users/events or configure and export operations", () => {
  const state = fixture();
  for (const id of ["dana", "arman", "support", "charlie"]) {
    state.currentUserId = id;
    assert.throws(() => suspendUser(state, "charlie", true), /administrator access/);
    assert.throws(() => suspendEvent(state, "fest", true), /administrator access/);
    assert.throws(() => savePlatformSettings(state, state.operations.settings), /administrator access/);
    assert.throws(() => operationalCsv(state, "users"), /administrator access/);
  }
  state.currentUserId = "admin";
  profile(state, "admin").suspended = true;
  assert.throws(() => operationalCsv(state, "payments"), /administrator access/);
  profile(state, "admin").suspended = false;
  assert.throws(() => suspendUser(state, "admin", true), /cannot be suspended/);
});

test("user suspension stops bookings and check-in while preserving access to an account-support appeal", () => {
  let state = suspendUser(fixture("admin"), "dana", true);
  state.currentUserId = "dana";
  assert.throws(() => placeOrder(state, "concert", { "concert-general": 1 }, contact, "blocked-order"), /suspended/);
  assert.throws(() => checkIn(state, "concert", "TE-1042-A"), /check-in access/);
  assert.doesNotThrow(() => createSupportCase(state, { ...caseInput, category: "account" }));
  assert.equal(canManageCase(state, profile(state, "dana"), supportCase(state)), false);
  state.currentUserId = "admin";
  state = suspendUser(state, "dana", false);
  state.currentUserId = "dana";
  assert.doesNotThrow(() => placeOrder(state, "concert", { "concert-general": 1 }, contact, "restored-order"));
});

test("event suspension stops discovery, bookings and check-in until an administrator restores it", () => {
  let state = suspendEvent(fixture("admin"), "concert", true);
  const event = state.events.find((item) => item.id === "concert")!;
  assert.equal(isEventVisible(state, event), false);
  assert.equal(canCheckIn(profile(state, "dana"), event), false);
  assert.equal(canManage(profile(state, "arman"), event), false);
  state.currentUserId = "dana";
  assert.throws(() => placeOrder(state, event.id, { "concert-general": 1 }, contact, "suspended-event"), /no longer accepting/);
  assert.throws(() => checkIn(state, event.id, "TE-1042-A"), /check-in access/);
  state.currentUserId = "admin";
  state = suspendEvent(state, "concert", false);
  assert.equal(isEventVisible(state, state.events.find((item) => item.id === "concert")!), true);
});

test("suspending an organizer removes their events from discovery and prevents their new bookings", () => {
  const state = suspendUser(fixture("admin"), "arman", true);
  const event = state.events.find((item) => item.id === "concert")!;
  assert.equal(isEventVisible(state, event), false);
  assert.equal(canManage(profile(state, "arman"), event), false);
  assert.equal(canCheckIn(profile(state, "dana"), event, state), false);
  state.currentUserId = "dana";
  assert.throws(() => placeOrder(state, event.id, { "concert-general": 1 }, contact, "owner-suspended"), /no longer accepting/);
  assert.throws(() => checkIn(state, event.id, "TE-1042-A"), /check-in access/);
});

test("reported-event moderation records the reviewer and audit actions without erasing the report", () => {
  const state = fixture("admin");
  const next = reviewEventReport(state, "RPT-101", "suspend");
  const report = next.operations.reports.find((item) => item.id === "RPT-101")!;
  assert.equal(report.status, "actioned");
  assert.equal(report.reviewerId, "admin");
  assert.ok(report.reviewedAt);
  assert.equal(next.events.find((event) => event.id === report.eventId)!.suspended, true);
  assert.deepEqual(next.operations.audit.map((entry) => entry.action), ["Review event report", "Suspend event"]);
  assert.ok(next.operations.audit.every((entry) => entry.actorId === "admin"));
  assert.throws(() => reviewEventReport(next, report.id, "dismiss"), /already been reviewed/);
  const dismissed = reviewEventReport(state, report.id, "dismiss");
  assert.equal(dismissed.operations.reports[0].status, "dismissed");
  assert.equal(dismissed.events.find((event) => event.id === report.eventId)!.suspended, undefined);
});

test("event reports require a real event and useful text", () => {
  const state = fixture();
  assert.throws(() => reportEvent(state, "missing", "Please investigate this event."), /Event not found/);
  assert.throws(() => reportEvent(state, "fest", "short"), /10–1,000/);
  const next = reportEvent(state, "fest", "Please verify that the venue information is accurate.");
  assert.equal(next.operations.reports.length, state.operations.reports.length + 1);
  assert.equal(next.operations.reports[0].reporterId, "dana");
  assert.equal(next.operations.reports[0].status, "pending");
});

test("settings validate fees and contact details and actually pause new bookings", () => {
  const state = fixture("admin");
  for (const activationFee of [-1, 0.5, NaN, 1000001]) assert.throws(() => savePlatformSettings(state, { ...state.operations.settings, activationFee }), /Activation fee/);
  assert.throws(() => savePlatformSettings(state, { ...state.operations.settings, supportEmail: "invalid" }), /valid support email/);
  const paused = savePlatformSettings(state, { ...state.operations.settings, bookingsEnabled: false });
  paused.currentUserId = "dana";
  assert.throws(() => placeOrder(paused, "concert", { "concert-general": 1 }, contact, "paused-order"), /temporarily paused/);
  assert.equal(paused.operations.audit[0].action, "Update platform settings");
  paused.currentUserId = "admin";
  const resumed = savePlatformSettings(paused, { ...paused.operations.settings, bookingsEnabled: true });
  resumed.currentUserId = "dana";
  assert.doesNotThrow(() => placeOrder(resumed, "concert", { "concert-general": 1 }, contact, "resumed-order"));
});

test("paid-sales activation captures the configured fee without rewriting earlier records", () => {
  let state = fixture("admin");
  const previousRecords = structuredClone(state.operations.activations);
  state = savePlatformSettings(state, { ...state.operations.settings, activationFee: 9000 });
  state.currentUserId = "arman";
  const event = state.events.find((item) => item.id === "fest")!;
  state = saveEvent(state, { ...event, paidSales: false });
  state = saveEvent(state, { ...event, paidSales: true });
  assert.equal(state.operations.activations[0].amount, 9000);
  assert.equal(state.operations.activations[0].organizerId, "arman");
  assert.equal(state.operations.activations[0].eventId, "fest");
  assert.deepEqual(state.operations.activations.slice(1), previousRecords);
  state.currentUserId = "admin";
  state = savePlatformSettings(state, { ...state.operations.settings, activationFee: 12000 });
  assert.equal(state.operations.activations[0].amount, 9000);
  state.currentUserId = "arman";
  const current = state.events.find((item) => item.id === "fest")!;
  const unchanged = saveEvent(state, { ...current, subtitle: "Updated event information" });
  assert.equal(unchanged.operations.activations.length, state.operations.activations.length);
});

test("operational exports protect spreadsheet formulas and escape commas, quotes and newlines", () => {
  const state = fixture("admin");
  const names = ["=2+2", "+SUM(A1)", "-1+2", "@SUM(A1)", "  =HYPERLINK(A1)", "\t=2+2", 'A name, with "quotes"\nand a newline'];
  names.forEach((name, index) => state.profiles.push({ id: `csv-${index}`, name, email: `csv${index}@example.com`, role: "attendee" }));
  const csv = operationalCsv(state, "users");
  assert.ok(csv.startsWith("\uFEFF"));
  for (const name of names.slice(0, -1)) assert.ok(csv.includes(`"'${name}"`), name);
  assert.ok(csv.includes('"A name, with ""quotes""\nand a newline"'));
  for (const kind of ["events", "orders", "payments", "support", "activations", "refunds", "disputes", "promotions"] as ReportKind[]) assert.ok(operationalCsv(state, kind).startsWith("\uFEFF"), kind);
});

test("legacy demo migration preserves custom profiles, events, orders and selection while adding new sample roles", () => {
  const source = fixture("charlie");
  const legacy = {
    version: 1,
    profiles: source.profiles.filter((user) => user.id !== "admin" && user.id !== "support"),
    events: source.events,
    orders: source.orders,
    currentUserId: "charlie",
  };
  legacy.events[0].title = "My existing edited concert";
  const next = migrateDemoState(legacy);
  assert.equal(next.currentUserId, "charlie");
  assert.equal(profile(next, "charlie").name, "Charlie Guest");
  assert.equal(next.events[0].title, "My existing edited concert");
  assert.deepEqual(next.orders, legacy.orders);
  assert.equal(profile(next, "admin").role, "platform_admin");
  assert.deepEqual(profile(next, "support").supportOrganizerIds, ["arman"]);
  assert.equal(next.operations.settings.activationFee, 2500);
  assert.equal(new Set(next.profiles.map((user) => user.id)).size, next.profiles.length);
});

test("migration retains saved support threads and settings instead of replacing them with seed data", () => {
  const source = fixture("dana");
  const saved = replyToCase(source, "SC-1042", "I found both tickets now, thank you.");
  saved.operations.settings.activationFee = 7500;
  saved.operations.notifications = [];
  const next = migrateDemoState(saved);
  assert.deepEqual(next.operations.cases, saved.operations.cases);
  assert.equal(next.operations.settings.activationFee, 7500);
  assert.deepEqual(next.operations.notifications, []);
  assert.throws(() => migrateDemoState(null), /Invalid demo data/);
  assert.throws(() => migrateDemoState({ ...saved, operations: { ...saved.operations, cases: "invalid" } }), /Invalid operations data/);
  assert.equal(migrateDemoState({ ...saved, currentUserId: "missing-profile" }).currentUserId, null);
});
