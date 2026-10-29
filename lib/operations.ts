import type { DemoState, Profile } from "./demo-data";

export const supportCategories = [
  { value: "ticket_delivery", label: "Ticket delivery" },
  { value: "payment", label: "Payment" },
  { value: "refund", label: "Refund" },
  { value: "seating", label: "Seating" },
  { value: "event_information", label: "Event information" },
  { value: "check_in", label: "Check-in" },
  { value: "account", label: "Account" },
  { value: "activation", label: "Paid-sales activation" },
  { value: "technical", label: "Technical problem" },
] as const;
export type SupportCategory = (typeof supportCategories)[number]["value"];
export const caseStatuses = ["Open", "In Progress", "Waiting for Customer", "Resolved"] as const;
export type CaseStatus = (typeof caseStatuses)[number];
export type SupportContext = { eventId?: string; orderId?: string; ticketId?: string };
export type SupportMessage = { id: string; senderId: string; body: string; createdAt: string };
export type CaseHistory = { id: string; actorId: string; action: string; createdAt: string };
export type SupportCase = {
  id: string;
  requesterId: string;
  audience: "attendee" | "organizer";
  organizerId?: string;
  category: SupportCategory;
  subject: string;
  status: CaseStatus;
  context: SupportContext;
  assigneeId?: string;
  escalated?: boolean;
  createdAt: string;
  updatedAt: string;
  messages: SupportMessage[];
  history: CaseHistory[];
};
export type AppNotification = { id: string; userId: string; caseId?: string; message: string; createdAt: string; read: boolean };
export type Payment = { id: string; userId: string; orderId?: string; eventId?: string; amount: number; status: "paid" | "failed" | "refunded" | "disputed"; createdAt: string; failureReason?: string };
export type Refund = { id: string; paymentId: string; orderId: string; amount: number; status: "pending" | "completed" | "rejected"; reason: string; createdAt: string };
export type Dispute = { id: string; paymentId: string; orderId: string; amount: number; status: "open" | "won" | "lost"; reason: string; createdAt: string };
export type ActivationRecord = { id: string; eventId: string; organizerId: string; amount: number; status: "active" | "pending" | "rejected"; createdAt: string };
export type EventReport = { id: string; eventId: string; reporterId: string; reason: string; status: "pending" | "dismissed" | "actioned"; createdAt: string; reviewedAt?: string; reviewerId?: string };
export type PromoActivity = { id: string; code: string; userId: string; eventId: string; orderId?: string; discount: number; createdAt: string };
export type PlatformSettings = { activationFee: number; supportEmail: string; bookingsEnabled: boolean };
export type AuditEntry = { id: string; actorId: string; action: string; targetId: string; details: string; createdAt: string };
export type OperationsState = {
  cases: SupportCase[];
  notifications: AppNotification[];
  payments: Payment[];
  refunds: Refund[];
  disputes: Dispute[];
  activations: ActivationRecord[];
  reports: EventReport[];
  promotions: PromoActivity[];
  settings: PlatformSettings;
  audit: AuditEntry[];
};

const seedDate = "2026-10-28T10:00:00+05:00";
export const initialOperations: OperationsState = {
  cases: [
    {
      id: "SC-1042", requesterId: "dana", audience: "attendee", organizerId: "arman",
      category: "ticket_delivery", subject: "Help finding my second ticket", status: "Waiting for Customer",
      context: { eventId: "concert", orderId: "TE-2026-1042", ticketId: "TE-1042-B" }, assigneeId: "support",
      createdAt: seedDate, updatedAt: seedDate,
      messages: [
        { id: "msg-1", senderId: "dana", body: "I booked two places. Where can I find the ticket for my friend?", createdAt: seedDate },
        { id: "msg-2", senderId: "support", body: "Open your order and scroll to Your tickets. Each guest has a separate download. Can you see both references?", createdAt: seedDate },
      ],
      history: [{ id: "history-1", actorId: "support", action: "Assigned to Mira and changed status to Waiting for Customer", createdAt: seedDate }],
    },
    {
      id: "SC-2001", requesterId: "arman", audience: "organizer", organizerId: "arman", category: "activation",
      subject: "Check the activation for Desht Electronic", status: "Open", context: { eventId: "fest" }, assigneeId: "admin", escalated: true,
      createdAt: seedDate, updatedAt: seedDate,
      messages: [{ id: "msg-3", senderId: "arman", body: "Could the platform team confirm the activation record for our festival?", createdAt: seedDate }],
      history: [{ id: "history-2", actorId: "arman", action: "Opened a platform support case", createdAt: seedDate }],
    },
  ],
  notifications: [{ id: "notice-1", userId: "dana", caseId: "SC-1042", message: "Mira replied to your ticket-delivery case.", createdAt: seedDate, read: false }],
  payments: [
    { id: "PAY-1042", userId: "dana", orderId: "TE-2026-1042", eventId: "concert", amount: 19000, status: "paid", createdAt: seedDate },
    { id: "PAY-1043", userId: "dana", eventId: "fest", amount: 16000, status: "failed", failureReason: "Card authorization declined", createdAt: seedDate },
    { id: "PAY-1044", userId: "dana", orderId: "TE-2026-1042", eventId: "concert", amount: 9500, status: "disputed", createdAt: seedDate },
  ],
  refunds: [{ id: "REF-101", paymentId: "PAY-1042", orderId: "TE-2026-1042", amount: 9500, status: "pending", reason: "One guest can no longer attend", createdAt: seedDate }],
  disputes: [{ id: "DSP-101", paymentId: "PAY-1044", orderId: "TE-2026-1042", amount: 9500, status: "open", reason: "Cardholder requested a payment review", createdAt: seedDate }],
  activations: [
    { id: "ACT-101", eventId: "concert", organizerId: "arman", amount: 2500, status: "active", createdAt: seedDate },
    { id: "ACT-102", eventId: "fest", organizerId: "arman", amount: 2500, status: "pending", createdAt: seedDate },
  ],
  reports: [{ id: "RPT-101", eventId: "fest", reporterId: "dana", reason: "Please verify the advertised venue and accessibility information.", status: "pending", createdAt: seedDate }],
  promotions: [{ id: "PROMO-101", code: "STEPPE10", userId: "dana", eventId: "concert", orderId: "TE-2026-1042", discount: 1900, createdAt: seedDate }],
  settings: { activationFee: 2500, supportEmail: "support@biletflow.example", bookingsEnabled: true },
  audit: [],
};

export const getOperations = (state: DemoState) => state.operations ?? initialOperations;
const stamp = () => new Date().toISOString();
const uid = () => crypto.randomUUID();

function actor(state: DemoState) {
  const user = state.profiles.find((p) => p.id === state.currentUserId);
  if (!user) throw new Error("Open a demo profile to continue.");
  return user;
}

function administrator(state: DemoState) {
  const user = actor(state);
  if (user.role !== "platform_admin" || user.suspended) throw new Error("Platform administrator access is required.");
  return user;
}

function audited(state: DemoState, action: string, targetId: string, details: string): DemoState {
  const user = actor(state);
  const ops = getOperations(state);
  return { ...state, operations: { ...ops, audit: [{ id: uid(), actorId: user.id, action, targetId, details, createdAt: stamp() }, ...ops.audit] } };
}

export function canManageCase(state: DemoState, user: Profile | undefined, item: SupportCase): boolean {
  const current = state.profiles.find((p) => p.id === user?.id);
  if (!current || current.suspended) return false;
  if (current.role === "platform_admin") return true;
  if (item.audience !== "attendee" || !item.organizerId || item.requesterId === current.id) return false;
  return (current.role === "organizer" && current.id === item.organizerId) || !!current.supportOrganizerIds?.includes(item.organizerId);
}

export function canViewCase(state: DemoState, user: Profile | undefined, item: SupportCase): boolean {
  return !!user && state.profiles.some((p) => p.id === user.id) && (item.requesterId === user.id || canManageCase(state, user, item));
}

export function eligibleCaseAssignees(state: DemoState, item: SupportCase) {
  return state.profiles.filter((p) => canManageCase(state, p, item));
}

function accessibleCase(state: DemoState, id: string) {
  const user = actor(state);
  const item = getOperations(state).cases.find((c) => c.id === id);
  if (!item || !canViewCase(state, user, item)) throw new Error("This support case is unavailable to this profile.");
  return { user, item };
}

function notify(state: DemoState, item: SupportCase, message: string): AppNotification[] {
  return state.profiles
    .filter((p) => p.id !== state.currentUserId && canViewCase(state, p, item))
    .map((p) => ({ id: uid(), userId: p.id, caseId: item.id, message, createdAt: stamp(), read: false }));
}

function replaceCase(state: DemoState, item: SupportCase, message: string): DemoState {
  const ops = getOperations(state);
  return { ...state, operations: { ...ops, cases: ops.cases.map((c) => c.id === item.id ? item : c), notifications: [...notify(state, item, message), ...ops.notifications] } };
}

function supportContext(state: DemoState, user: Profile, context: SupportContext, audience: SupportCase["audience"]) {
  let order = context.orderId ? state.orders.find((o) => o.id === context.orderId && o.userId === user.id) : undefined;
  if (context.orderId && !order) throw new Error("This order is unavailable to this profile.");
  if (context.ticketId) {
    const ticketOrder = state.orders.find((o) => o.userId === user.id && o.lines.some((l) => l.admissions.some((a) => a.id === context.ticketId)));
    if (!ticketOrder || (order && order.id !== ticketOrder.id)) throw new Error("This ticket is unavailable to this profile.");
    order = ticketOrder;
  }
  if (order && context.eventId && order.eventId !== context.eventId) throw new Error("The event does not match this order.");
  const eventId = order?.eventId ?? context.eventId;
  const event = eventId ? state.events.find((e) => e.id === eventId) : undefined;
  if (eventId && (!event || (!order && event.status !== "published" && event.ownerId !== user.id))) throw new Error("This event is unavailable to this profile.");
  if (audience === "organizer" && event && event.ownerId !== user.id) throw new Error("Choose an event owned by your organizer profile.");
  return { context: { ...(eventId ? { eventId } : {}), ...(order ? { orderId: order.id } : {}), ...(context.ticketId ? { ticketId: context.ticketId } : {}) }, organizerId: event?.ownerId };
}

export function createSupportCase(state: DemoState, input: { subject: string; category: SupportCategory; body: string; context?: SupportContext; audience?: SupportCase["audience"] }, id = `SC-${uid()}`): DemoState {
  const user = actor(state);
  const audience = input.audience ?? (input.context?.orderId || input.context?.ticketId ? "attendee" : user.role === "organizer" ? "organizer" : "attendee");
  if (audience !== "attendee" && audience !== "organizer") throw new Error("Choose a valid support audience.");
  if (audience === "organizer" && user.role !== "organizer") throw new Error("An organizer profile is required for platform support.");
  if (!supportCategories.some((c) => c.value === input.category)) throw new Error("Choose an issue category.");
  const subject = input.subject.trim();
  const body = input.body.trim();
  if (subject.length < 5 || subject.length > 140) throw new Error("Use 5–140 characters for the subject.");
  if (body.length < 10 || body.length > 4000) throw new Error("Use 10–4,000 characters to describe the issue.");
  const details = supportContext(state, user, input.context ?? {}, audience);
  const ops = getOperations(state);
  const existing = ops.cases.find((c) => c.id === id);
  if (existing) {
    if (existing.requesterId !== user.id) throw new Error("This case reference is already in use.");
    return state;
  }
  const createdAt = stamp();
  const item: SupportCase = {
    id, requesterId: user.id, audience, ...details, subject, category: input.category,
    status: "Open", escalated: audience === "organizer", createdAt, updatedAt: createdAt,
    messages: [{ id: uid(), senderId: user.id, body, createdAt }],
    history: [{ id: uid(), actorId: user.id, action: "Opened the case", createdAt }],
  };
  return { ...state, operations: { ...ops, cases: [item, ...ops.cases], notifications: [...notify(state, item, `New case: ${subject}`), ...ops.notifications] } };
}

export function replyToCase(state: DemoState, id: string, text: string): DemoState {
  const { user, item } = accessibleCase(state, id);
  const body = text.trim();
  if (!body || body.length > 4000) throw new Error("Write a message of 1–4,000 characters.");
  const createdAt = stamp();
  const reopened = item.status === "Resolved";
  const next: SupportCase = {
    ...item, updatedAt: createdAt, status: reopened ? "Open" : item.status,
    messages: [...item.messages, { id: uid(), senderId: user.id, body, createdAt }],
    history: reopened ? [...item.history, { id: uid(), actorId: user.id, action: "Reopened the case with a new reply", createdAt }] : item.history,
  };
  return replaceCase(state, next, `New reply: ${item.subject}`);
}

export function updateSupportCase(state: DemoState, id: string, patch: { status?: CaseStatus; assigneeId?: string | null }): DemoState {
  const { user, item } = accessibleCase(state, id);
  if (!canManageCase(state, user, item)) throw new Error("Only authorized support staff can assign cases or change their status.");
  if (patch.status && !caseStatuses.includes(patch.status)) throw new Error("Choose a valid case status.");
  if (patch.assigneeId && !eligibleCaseAssignees(state, item).some((p) => p.id === patch.assigneeId)) throw new Error("Choose a staff member authorized for this case.");
  const changes: string[] = [];
  if (patch.status && patch.status !== item.status) changes.push(`Changed status to ${patch.status}`);
  const hasAssignee = Object.prototype.hasOwnProperty.call(patch, "assigneeId");
  const assigneeId = hasAssignee ? patch.assigneeId || undefined : item.assigneeId;
  if (hasAssignee && assigneeId !== item.assigneeId) changes.push(assigneeId ? `Assigned to ${state.profiles.find((p) => p.id === assigneeId)?.name}` : "Removed case assignment");
  if (!changes.length) return state;
  const createdAt = stamp();
  return replaceCase(state, { ...item, status: patch.status ?? item.status, assigneeId, updatedAt: createdAt, history: [...item.history, { id: uid(), actorId: user.id, action: changes.join("; "), createdAt }] }, `${changes.join("; ")}: ${item.subject}`);
}

export function escalateSupportCase(state: DemoState, id: string): DemoState {
  const { user, item } = accessibleCase(state, id);
  if (!canManageCase(state, user, item)) throw new Error("Only authorized support staff can escalate a case.");
  if (item.escalated) return state;
  const createdAt = stamp();
  return replaceCase(state, { ...item, escalated: true, assigneeId: undefined, updatedAt: createdAt, history: [...item.history, { id: uid(), actorId: user.id, action: "Escalated to platform support", createdAt }] }, `Escalated: ${item.subject}`);
}

export function markNotificationRead(state: DemoState, id: string): DemoState {
  const user = actor(state);
  const ops = getOperations(state);
  const notification = ops.notifications.find((n) => n.id === id && n.userId === user.id);
  if (!notification) throw new Error("This notification is unavailable to this profile.");
  return { ...state, operations: { ...ops, notifications: ops.notifications.map((n) => n.id === id ? { ...n, read: true } : n) } };
}

export function suspendUser(state: DemoState, id: string, suspended: boolean): DemoState {
  administrator(state);
  const target = state.profiles.find((p) => p.id === id);
  if (!target) throw new Error("User not found.");
  if (target.role === "platform_admin") throw new Error("Platform administrator profiles cannot be suspended here.");
  if (!!target.suspended === suspended) return state;
  return audited({ ...state, profiles: state.profiles.map((p) => p.id === id ? { ...p, suspended } : p) }, suspended ? "Suspend user" : "Restore user", id, target.email);
}

export function suspendEvent(state: DemoState, id: string, suspended: boolean): DemoState {
  administrator(state);
  const target = state.events.find((e) => e.id === id);
  if (!target) throw new Error("Event not found.");
  if (!!target.suspended === suspended) return state;
  return audited({ ...state, events: state.events.map((e) => e.id === id ? { ...e, suspended } : e) }, suspended ? "Suspend event" : "Restore event", id, target.title);
}

export function reportEvent(state: DemoState, eventId: string, reason: string): DemoState {
  const user = actor(state);
  const event = state.events.find((e) => e.id === eventId && e.status === "published");
  if (!event) throw new Error("Event not found.");
  if (reason.trim().length < 10 || reason.trim().length > 1000) throw new Error("Describe the report in 10–1,000 characters.");
  const ops = getOperations(state);
  return { ...state, operations: { ...ops, reports: [{ id: `RPT-${uid()}`, eventId, reporterId: user.id, reason: reason.trim(), status: "pending", createdAt: stamp() }, ...ops.reports] } };
}

export function reviewEventReport(state: DemoState, id: string, decision: "dismiss" | "suspend"): DemoState {
  const user = administrator(state);
  if (decision !== "dismiss" && decision !== "suspend") throw new Error("Choose a valid review decision.");
  const report = getOperations(state).reports.find((r) => r.id === id);
  if (!report || report.status !== "pending") throw new Error("This report has already been reviewed or is unavailable.");
  const next = decision === "suspend" ? suspendEvent(state, report.eventId, true) : state;
  const ops = getOperations(next);
  return audited({ ...next, operations: { ...ops, reports: ops.reports.map((r) => r.id === id ? { ...r, status: decision === "dismiss" ? "dismissed" : "actioned", reviewedAt: stamp(), reviewerId: user.id } : r) } }, "Review event report", id, decision);
}

export function savePlatformSettings(state: DemoState, settings: PlatformSettings): DemoState {
  administrator(state);
  if (!Number.isInteger(settings.activationFee) || settings.activationFee < 0 || settings.activationFee > 1000000) throw new Error("Activation fee must be a whole amount between ₸0 and ₸1,000,000.");
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(settings.supportEmail) || settings.supportEmail.length > 255) throw new Error("Enter a valid support email address.");
  if (typeof settings.bookingsEnabled !== "boolean") throw new Error("Choose whether bookings are enabled.");
  const ops = getOperations(state);
  const clean = { activationFee: settings.activationFee, supportEmail: settings.supportEmail.trim(), bookingsEnabled: settings.bookingsEnabled };
  return audited({ ...state, operations: { ...ops, settings: clean } }, "Update platform settings", "platform", `Activation fee ₸${clean.activationFee}; bookings ${clean.bookingsEnabled ? "enabled" : "paused"}; ${clean.supportEmail}`);
}

export function recordActivation(state: DemoState, eventId: string): DemoState {
  const user = actor(state);
  const event = state.events.find((e) => e.id === eventId);
  if (!event || user.role !== "organizer" || user.suspended || event.suspended || event.ownerId !== user.id) throw new Error("Only the active event organizer can activate paid sales.");
  const ops = getOperations(state);
  return { ...state, operations: { ...ops, activations: [{ id: `ACT-${uid()}`, eventId, organizerId: user.id, amount: ops.settings.activationFee, status: "active", createdAt: stamp() }, ...ops.activations] } };
}

export type ReportKind = "users" | "events" | "orders" | "payments" | "support" | "activations" | "refunds" | "disputes" | "promotions";
export function operationalCsv(state: DemoState, kind: ReportKind): string {
  administrator(state);
  const ops = getOperations(state);
  const rows: Record<ReportKind, unknown[][]> = {
    users: [["ID", "Name", "Email", "Role", "Suspended"], ...state.profiles.map((p) => [p.id, p.name, p.email, p.role, !!p.suspended])],
    events: [["ID", "Title", "Organizer", "Date", "Status", "Suspended"], ...state.events.map((e) => [e.id, e.title, e.ownerId, e.date, e.status, !!e.suspended])],
    orders: [["ID", "User", "Event", "Amount KZT", "Status"], ...state.orders.map((o) => [o.id, o.userId, o.eventId, o.total, o.status])],
    payments: [["ID", "User", "Order", "Event", "Amount KZT", "Status", "Failure"], ...ops.payments.map((p) => [p.id, p.userId, p.orderId, p.eventId, p.amount, p.status, p.failureReason])],
    support: [["ID", "Subject", "Requester", "Audience", "Status", "Assignee", "Escalated", "Event", "Order", "Ticket"], ...ops.cases.map((c) => [c.id, c.subject, c.requesterId, c.audience, c.status, c.assigneeId, !!c.escalated, c.context.eventId, c.context.orderId, c.context.ticketId])],
    activations: [["ID", "Event", "Organizer", "Fee KZT", "Status", "Date"], ...ops.activations.map((a) => [a.id, a.eventId, a.organizerId, a.amount, a.status, a.createdAt])],
    refunds: [["ID", "Payment", "Order", "Amount KZT", "Status", "Reason"], ...ops.refunds.map((r) => [r.id, r.paymentId, r.orderId, r.amount, r.status, r.reason])],
    disputes: [["ID", "Payment", "Order", "Amount KZT", "Status", "Reason"], ...ops.disputes.map((d) => [d.id, d.paymentId, d.orderId, d.amount, d.status, d.reason])],
    promotions: [["ID", "Code", "User", "Event", "Order", "Discount KZT", "Date"], ...ops.promotions.map((p) => [p.id, p.code, p.userId, p.eventId, p.orderId, p.discount, p.createdAt])],
  };
  if (!rows[kind]) throw new Error("Choose an operational report.");
  return "\uFEFF" + rows[kind].map((row) => row.map((value) => {
    let text = String(value ?? "");
    if (/^\s*[=+\-@]/.test(text) || /^[\t\r\n]/.test(text)) text = "'" + text;
    return `"${text.replaceAll('"', '""')}"`;
  }).join(",")).join("\r\n");
}
