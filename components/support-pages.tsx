"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState, type FormEvent, type ReactNode } from "react";
import type { DemoState, Profile } from "@/lib/demo-data";
import {
  canManageCase,
  canViewCase,
  caseStatuses,
  createSupportCase,
  eligibleCaseAssignees,
  escalateSupportCase,
  markNotificationRead,
  replyToCase,
  supportCategories,
  updateSupportCase,
  type CaseStatus,
  type SupportCategory,
  type SupportContext,
} from "@/lib/operations";
import { useDemo } from "./demo-provider";
import { EmptyState, Icon, LoadingPage, Notice, PageIntro } from "./primitives";
import "./support.css";

const stamp = (value: string) => new Intl.DateTimeFormat("en-GB", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "Asia/Almaty",
}).format(new Date(value));

function categoryLabel(value: SupportCategory) {
  return supportCategories.find((category) => category.value === value)?.label ?? value;
}

function CaseBadge({ status }: { status: CaseStatus }) {
  return <span className={`support-status support-status-${status.toLowerCase().replaceAll(" ", "-")}`}>{status}</span>;
}

function SupportShell({ children, title, description, action }: {
  children: ReactNode;
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <main className="workspace support-workspace">
      <PageIntro eyebrow="BiletFlow support" title={title} description={description} action={action} />
      <div className="support-demo-note">
        <Icon name="mail" size={17} />
        <p>Browser demo. Cases, replies, and in-app notifications are saved in this browser. Email delivery and server-backed access are not connected yet.</p>
      </div>
      {children}
    </main>
  );
}

export function SupportLink({ eventId, orderId, ticketId, label = "Get support" }: {
  eventId?: string;
  orderId?: string;
  ticketId?: string;
  label?: string;
}) {
  const query = new URLSearchParams();
  if (eventId) query.set("event", eventId);
  if (orderId) query.set("order", orderId);
  if (ticketId) query.set("ticket", ticketId);
  const suffix = query.toString();
  return (
    <Link className="btn btn-secondary support-launch" href={`/support/new${suffix ? `?${suffix}` : ""}`}>
      <Icon name="mail" size={16} />{label}
    </Link>
  );
}

function SupportInbox() {
  const { state, user, update } = useDemo();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [scope, setScope] = useState("all");
  const [error, setError] = useState("");
  if (!user) return null;
  const accessible = state.operations.cases.filter((item) => canViewCase(state, user, item));
  const query = search.trim().toLowerCase();
  const cases = accessible.filter((item) => {
    const requester = state.profiles.find((profile) => profile.id === item.requesterId);
    return (status === "all" || item.status === status)
      && (scope === "all" || (scope === "mine" ? item.requesterId === user.id : item.escalated))
      && `${item.id} ${item.subject} ${categoryLabel(item.category)} ${requester?.name ?? ""}`.toLowerCase().includes(query);
  }).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  const notifications = state.operations.notifications.filter((item) => {
    if (item.userId !== user.id || item.read) return false;
    return !item.caseId || accessible.some((supportCase) => supportCase.id === item.caseId);
  });

  function markRead(id: string) {
    try {
      update((current) => markNotificationRead(current, id));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not update this notification.");
    }
  }

  return (
    <SupportShell
      title="A little help, a better night."
      description="Your requests and the cases you are authorized to handle. Replies stay here so you can pick up the conversation whenever you return."
      action={user.role !== "platform_admin" && <Link className="btn btn-primary" href="/support/new"><Icon name="plus" size={16} />New support request</Link>}
    >
      {error && <Notice error>{error}</Notice>}
      {notifications.length > 0 && (
        <section className="support-notifications" aria-label="Unread support notifications">
          <h2>New in your inbox <span>{notifications.length}</span></h2>
          {notifications.map((item) => (
            <div className="support-notification" key={item.id}>
              <div>{item.caseId ? <Link href={`/support/${encodeURIComponent(item.caseId)}`}>{item.message}</Link> : <p>{item.message}</p>}<time dateTime={item.createdAt}>{stamp(item.createdAt)}</time></div>
              <button type="button" onClick={() => markRead(item.id)} className="text-link" aria-label={`Mark notification as read: ${item.message}`}>Mark read</button>
            </div>
          ))}
        </section>
      )}
      <div className="support-filters">
        <label className="support-search">Search cases<input type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Subject, reference or requester" /></label>
        <label>Status<select value={status} onChange={(event) => setStatus(event.target.value)}><option value="all">All statuses</option>{caseStatuses.map((value) => <option key={value}>{value}</option>)}</select></label>
        <label>Show<select value={scope} onChange={(event) => setScope(event.target.value)}><option value="all">All accessible cases</option><option value="mine">My requests</option><option value="escalated">Escalated cases</option></select></label>
      </div>
      <p className="support-results" role="status">{cases.length} {cases.length === 1 ? "case" : "cases"}</p>
      {cases.length ? (
        <div className="support-case-list">
          {cases.map((item) => {
            const requester = state.profiles.find((profile) => profile.id === item.requesterId);
            const assignee = state.profiles.find((profile) => profile.id === item.assigneeId);
            return (
              <Link className="support-case-card" key={item.id} href={`/support/${encodeURIComponent(item.id)}`}>
                <div className="support-case-main">
                  <div className="support-case-meta"><span>{item.id}</span><span>{categoryLabel(item.category)}</span>{item.escalated && <span className="support-escalated">Escalated</span>}</div>
                  <h2>{item.subject}</h2>
                  <p>{requester?.name ?? "Requester"} · {item.audience === "organizer" ? "Platform support" : "Attendee support"}{assignee ? ` · Assigned to ${assignee.name}` : " · Unassigned"}</p>
                </div>
                <div className="support-case-side"><CaseBadge status={item.status} /><time dateTime={item.updatedAt}>{stamp(item.updatedAt)}</time><span>{item.messages.length} {item.messages.length === 1 ? "message" : "messages"}<Icon name="arrow" size={15} /></span></div>
              </Link>
            );
          })}
        </div>
      ) : <EmptyState icon="mail" title={accessible.length ? "No matching cases." : "Your inbox is clear."} description={accessible.length ? "Try a different status or search." : "Open a support request when you need a hand. Only your requests and authorized support cases appear here."} />}
    </SupportShell>
  );
}

function draftContext(state: DemoState, user: Profile, query: Record<string, string>) {
  const context: SupportContext = {};
  let order = query.order ? state.orders.find((item) => item.id === query.order && item.userId === user.id) : undefined;
  if (query.order && !order) return { error: "This order is not available to your profile." };
  if (query.ticket) {
    const ticketOrder = state.orders.find((item) => item.userId === user.id && item.lines.some((line) => line.admissions.some((ticket) => ticket.id === query.ticket)));
    if (!ticketOrder || (order && ticketOrder.id !== order.id)) return { error: "This ticket is not available to your profile." };
    order = ticketOrder;
    context.ticketId = query.ticket;
  }
  if (order) {
    if (query.event && query.event !== order.eventId) return { error: "The selected event does not match this order." };
    context.orderId = order.id;
    context.eventId = order.eventId;
  } else if (query.event) context.eventId = query.event;
  if (context.eventId) {
    const event = state.events.find((item) => item.id === context.eventId);
    if (!event || (!order && event.ownerId !== user.id && event.status !== "published")) return { error: "This event is not available to your profile." };
    if (user.role === "organizer" && event.ownerId !== user.id && !order) return { error: "Select one of your own events for platform support." };
  }
  return { context };
}

function ContextCard({ state, requester, context, audience }: {
  state: DemoState;
  requester: Profile | undefined;
  context: SupportContext;
  audience: "attendee" | "organizer";
}) {
  const event = state.events.find((item) => item.id === context.eventId);
  return (
    <section className="support-context" aria-label="Included request context">
      <h2>Included with this request</h2>
      <dl>
        <div><dt>Requester</dt><dd>{requester?.name ?? "Account unavailable"}{requester && <small>{requester.email}</small>}</dd></div>
        <div><dt>Support team</dt><dd>{audience === "organizer" ? "BiletFlow platform support" : event ? "Event organizer support" : "BiletFlow support"}</dd></div>
        {context.eventId && <div><dt>Event</dt><dd>{event?.title ?? context.eventId}<small>{context.eventId}</small></dd></div>}
        {context.orderId && <div><dt>Order</dt><dd>{context.orderId}</dd></div>}
        {context.ticketId && <div><dt>Ticket</dt><dd>{context.ticketId}</dd></div>}
      </dl>
      <p>Your request keeps these references with its message history.</p>
    </section>
  );
}

function NewSupportCase({ query }: { query: Record<string, string> }) {
  const { state, user, update } = useDemo();
  const router = useRouter();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const submitting = useRef(false);
  if (!user) return null;
  const draft = draftContext(state, user, query);
  const audience = user.role === "organizer" && !draft.context?.orderId && !draft.context?.ticketId
    ? "organizer"
    : "attendee";
  const choices = supportCategories.filter((category) => audience === "organizer"
    ? ["account", "activation", "payment", "technical"].includes(category.value)
    : category.value !== "activation");
  const initialCategory = choices.some((item) => item.value === query.category) ? query.category : audience === "organizer" ? "account" : "ticket_delivery";

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting.current || !draft.context) return;
    const form = event.currentTarget;
    const data = new FormData(form);
    setError("");
    submitting.current = true;
    setBusy(true);
    try {
      const id = `SC-${crypto.randomUUID()}`;
      update((current) => createSupportCase(current, {
        subject: String(data.get("subject")),
        category: String(data.get("category")) as SupportCategory,
        body: String(data.get("body")),
        context: draft.context,
        audience,
      }, id));
      router.push(`/support/${encodeURIComponent(id)}`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not open this support request.");
      submitting.current = false;
      setBusy(false);
    }
  }

  return (
    <SupportShell title="Tell us what happened." description={audience === "organizer" ? "Ask the BiletFlow team about your account, activation, payments, or a technical issue." : "Send the relevant support team a message. Your event, order, and ticket details are included when available."} action={<Link className="text-link" href="/support"><Icon name="back" size={16} />All support cases</Link>}>
      {draft.error ? <><Notice error>{draft.error}</Notice><Link className="btn btn-secondary" href="/support/new">Start without this context</Link></> : user.role === "platform_admin" ? <EmptyState icon="mail" title="Handle requests in the support inbox." description="Use an attendee or organizer demo profile to open a customer request." href="/support" label="Open support inbox" /> : (
        <div className="support-compose-layout">
          <form className="stack-form support-compose" onSubmit={submit} aria-busy={busy}>
            <label>Issue category<select name="category" defaultValue={initialCategory} required disabled={busy}>{choices.map((category) => <option key={category.value} value={category.value}>{category.label}</option>)}</select></label>
            <label>Subject<input name="subject" placeholder="A short description of the issue" minLength={5} maxLength={140} required disabled={busy} /></label>
            <label>What can we help with?<textarea name="body" placeholder="Tell us what happened and what you need help with." rows={7} minLength={10} maxLength={4000} required disabled={busy} /><span className="field-hint">10–4,000 characters. Avoid sharing passwords or payment card details.</span></label>
            {error && <Notice error>{error}</Notice>}
            <button className="btn btn-primary" disabled={busy}>{busy ? "Opening request…" : "Open support request"}<Icon name="arrow" size={16} /></button>
          </form>
          <ContextCard state={state} requester={user} context={draft.context ?? {}} audience={audience} />
        </div>
      )}
    </SupportShell>
  );
}

function CaseThread({ id }: { id: string }) {
  const { state, user, update } = useDemo();
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const supportCase = state.operations.cases.find((item) => item.id === id);
  if (!user || !supportCase || !canViewCase(state, user, supportCase)) return (
    <SupportShell title="Case unavailable." description="This case does not exist or is not available to your profile.">
      <EmptyState icon="mail" title="Return to your support inbox." description="Your requests and the cases you are authorized to handle are listed there." href="/support" label="All support cases" />
    </SupportShell>
  );
  const requester = state.profiles.find((profile) => profile.id === supportCase.requesterId);
  const manager = canManageCase(state, user, supportCase);
  const assignees = manager ? eligibleCaseAssignees(state, supportCase) : [];
  const assignee = state.profiles.find((profile) => profile.id === supportCase.assigneeId);

  function mutate(action: (current: DemoState) => DemoState, message: string) {
    setError("");
    setNotice("");
    try {
      update(action);
      setNotice(message);
      return true;
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not update this case.");
      return false;
    }
  }

  function reply(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const body = String(new FormData(form).get("body"));
    if (mutate((current) => replyToCase(current, id, body), "Your reply was added. The other participants will see an in-app notification.")) form.reset();
  }

  function manage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    mutate((current) => updateSupportCase(current, id, {
      status: String(data.get("status")) as CaseStatus,
      assigneeId: String(data.get("assignee")) || null,
    }), "Case updated. The change is recorded in its history.");
  }

  return (
    <SupportShell title={supportCase.subject} description={`${supportCase.id} · ${categoryLabel(supportCase.category)}`} action={<Link className="text-link" href="/support"><Icon name="back" size={16} />All support cases</Link>}>
      <div className="support-thread-heading"><CaseBadge status={supportCase.status} />{supportCase.escalated && <span className="support-escalated">Escalated to platform support</span>}<span>Opened {stamp(supportCase.createdAt)}</span></div>
      {error && <Notice error>{error}</Notice>}
      {notice && <Notice>{notice}</Notice>}
      <div className="support-thread-layout">
        <div>
          <section className="support-messages" role="log" aria-label="Case messages" aria-live="polite" aria-relevant="additions">
            {supportCase.messages.map((message) => {
              const sender = state.profiles.find((profile) => profile.id === message.senderId);
              return (
                <article className={`support-message ${message.senderId === user.id ? "support-message-own" : ""}`} key={message.id}>
                  <header><strong>{sender?.name ?? "Previous participant"}{message.senderId === user.id ? " (you)" : ""}</strong><time dateTime={message.createdAt}>{stamp(message.createdAt)}</time></header>
                  <p>{message.body}</p>
                </article>
              );
            })}
          </section>
          <form className="stack-form support-reply" onSubmit={reply}>
            <label>Add a reply<textarea name="body" rows={4} required minLength={1} maxLength={4000} placeholder="Write your reply…" /></label>
            <p className="field-hint">Replies are asynchronous. You can leave this page and return later.</p>
            <button className="btn btn-primary">Send reply<Icon name="arrow" size={16} /></button>
          </form>
          <details className="support-history">
            <summary>Case history <span>{supportCase.history.length} entries</span></summary>
            <ol>{supportCase.history.map((entry) => <li key={entry.id}><span>{entry.action}</span><small>{state.profiles.find((profile) => profile.id === entry.actorId)?.name ?? "System"} · <time dateTime={entry.createdAt}>{stamp(entry.createdAt)}</time></small></li>)}</ol>
          </details>
        </div>
        <aside className="support-case-aside">
          <ContextCard state={state} requester={requester} context={supportCase.context} audience={supportCase.audience} />
          <section className="support-assignment">
            <h2>Case handling</h2>
            <p>{assignee ? `Assigned to ${assignee.name}` : "Waiting for a team member to pick up this case."}</p>
            {manager && <form key={`${supportCase.status}-${supportCase.assigneeId ?? ""}`} className="stack-form" onSubmit={manage}>
              <label>Status<select name="status" defaultValue={supportCase.status}>{caseStatuses.map((status) => <option key={status}>{status}</option>)}</select></label>
              <label>Assigned to<select name="assignee" defaultValue={supportCase.assigneeId ?? ""}><option value="">Unassigned</option>{assignees.map((profile) => <option key={profile.id} value={profile.id}>{profile.name}</option>)}</select></label>
              <button className="btn btn-secondary">Save case changes</button>
            </form>}
            {manager && !supportCase.escalated && supportCase.audience === "attendee" && user.role !== "platform_admin" && <button className="btn btn-secondary support-escalate-button" onClick={() => mutate((current) => escalateSupportCase(current, id), "Case escalated to the BiletFlow platform team.")}>Escalate to platform support</button>}
          </section>
        </aside>
      </div>
    </SupportShell>
  );
}

export function SupportPage({ id, query = {} }: { id?: string; query?: Record<string, string> }) {
  const { user, ready } = useDemo();
  if (!ready) return <LoadingPage />;
  if (!user) return <div className="workspace"><EmptyState icon="mail" title="Keep the conversation together." description="Choose a demo profile to open a support request or view the cases available to that profile." href="/sign-in?next=%2Fsupport" label="Choose a demo profile" /></div>;
  if (id === "new") return <NewSupportCase key={new URLSearchParams(query).toString()} query={query} />;
  if (id) return <CaseThread key={`${user.id}-${id}`} id={id} />;
  return <SupportInbox key={user.id} />;
}
