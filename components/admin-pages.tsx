"use client";

import Link from "next/link";
import { useState, type FormEvent, type ReactNode } from "react";
import { money, type DemoState } from "@/lib/demo-data";
import {
  operationalCsv,
  reviewEventReport,
  savePlatformSettings,
  suspendEvent,
  suspendUser,
  type PlatformSettings,
} from "@/lib/operations";
import { useDemo } from "./demo-provider";
import { EmptyState, Icon, LoadingPage, Notice, PageIntro } from "./primitives";
import "./admin.css";

type ExportKind = Parameters<typeof operationalCsv>[1];
type PaymentFilter = "all" | "paid" | "failed" | "refunded" | "disputed";
type PendingAction = { id: string; kind: "user" | "event"; suspended: boolean };
type TableRow = { id: string; cells: ReactNode[] };

const views = [
  ["overview", "Overview"],
  ["users", "Users"],
  ["events", "Events"],
  ["orders", "Orders"],
  ["payments", "Payments"],
  ["reviews", "Event reviews"],
  ["activations", "Paid-sales activations"],
  ["support", "Escalated support"],
  ["promotions", "Promotional codes"],
  ["settings", "Platform settings"],
  ["audit", "Activity history"],
];

const exportOptions: [ExportKind, string][] = [
  ["users", "Users"],
  ["events", "Events"],
  ["orders", "Orders"],
  ["payments", "Payments"],
  ["support", "Support cases"],
  ["activations", "Paid-sales activations"],
  ["refunds", "Refunds"],
  ["disputes", "Disputes"],
  ["promotions", "Promotional-code activity"],
];

function dateTime(value: string) {
  return new Date(value).toLocaleString("en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Almaty",
  });
}

function Status({ value }: { value: string }) {
  const normalized = value.toLowerCase();
  const tone = ["suspended", "failed", "disputed", "rejected", "lost"].includes(normalized)
    ? "danger"
    : ["paid", "active", "completed", "resolved", "won", "published"].includes(normalized)
      ? "success"
      : "neutral";
  return <span className={`admin-badge admin-badge-${tone}`}>{value}</span>;
}

function RecordName({ title, reference }: { title: string; reference?: string }) {
  return <span className="admin-record-name">{title}{reference && <small>{reference}</small>}</span>;
}

function DataTable({ caption, headings, rows, empty = "No matching records." }: {
  caption: string;
  headings: string[];
  rows: TableRow[];
  empty?: string;
}) {
  return rows.length ? (
    <div className="admin-table-scroll" role="region" aria-label={caption} tabIndex={0}>
      <table className="admin-table">
        <caption className="admin-visually-hidden">{caption}</caption>
        <thead><tr>{headings.map((heading) => <th key={heading} scope="col">{heading}</th>)}</tr></thead>
        <tbody>{rows.map((row) => (
          <tr key={row.id}>{row.cells.map((cell, index) => <td key={index}>{cell}</td>)}</tr>
        ))}</tbody>
      </table>
    </div>
  ) : <p className="admin-empty">{empty}</p>;
}

function Stat({ label, value, href, detail }: { label: string; value: number; href: string; detail: string }) {
  return <Link href={href} className="admin-stat">
    <span>{label}<Icon name="arrow" size={16} /></span>
    <strong>{value}</strong><small>{detail}</small>
  </Link>;
}

function SettingsForm({ settings, onSave }: { settings: PlatformSettings; onSave: (value: PlatformSettings) => void }) {
  const [bookingsEnabled, setBookingsEnabled] = useState(settings.bookingsEnabled);
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    onSave({
      activationFee: Number(data.get("activationFee")),
      supportEmail: String(data.get("supportEmail")).trim(),
      bookingsEnabled,
    });
  }
  return <form className="stack-form admin-settings" onSubmit={submit}>
    <label>Paid-sales activation fee (KZT)
      <input name="activationFee" type="number" min={0} max={1000000} step={1} required defaultValue={settings.activationFee} />
      <span className="field-hint">Applies to future demo activation records. Existing records keep their original fee.</span>
    </label>
    <label>Platform support email
      <input name="supportEmail" type="email" maxLength={255} required defaultValue={settings.supportEmail} />
    </label>
    <label className="admin-setting-toggle">
      <input name="bookingsEnabled" type="checkbox" checked={bookingsEnabled} onChange={(event) => setBookingsEnabled(event.target.checked)} />
      <span><strong>Accept new demo bookings</strong><small>When paused, existing orders and support cases remain available.</small></span>
    </label>
    <button className="btn btn-primary">Save platform settings <Icon name="check" size={16} /></button>
  </form>;
}

export function AdminPage({ view }: { view?: string }) {
  const { state, user, ready, update } = useDemo();
  const [search, setSearch] = useState("");
  const [paymentFilter, setPaymentFilter] = useState<PaymentFilter>("all");
  const [pendingAction, setPendingAction] = useState<PendingAction | null>(null);
  const [feedback, setFeedback] = useState<{ message: string; error: boolean } | null>(null);
  const [exportKind, setExportKind] = useState<ExportKind>("orders");

  if (!ready) return <LoadingPage />;
  if (user?.role !== "platform_admin" || user.suspended) return (
    <main className="workspace"><EmptyState icon="users" title="Platform administration."
      description={user?.suspended ? "This profile is suspended. Contact platform support for help." : "Open a platform administrator demo profile to review platform operations."}
      href={user?.suspended ? "/support" : "/sign-in?role=platform_admin"}
      label={user?.suspended ? "Contact support" : "Choose a demo profile"} /></main>
  );

  const operations = state.operations;
  const currentView = views.some(([key]) => key === view) ? view! : "overview";
  const matches = (...values: (string | number | undefined)[]) => values.some((value) => String(value ?? "").toLowerCase().includes(search.trim().toLowerCase()));
  const name = (id: string) => state.profiles.find((profile) => profile.id === id)?.name ?? id;
  const eventName = (id?: string) => state.events.find((event) => event.id === id)?.title ?? id ?? "—";
  const users = state.profiles.filter((profile) => matches(profile.id, profile.name, profile.email, profile.role, profile.suspended ? "suspended" : "active"));
  const events = state.events.filter((event) => matches(event.id, event.title, event.city, event.venue, name(event.ownerId), event.suspended ? "suspended" : event.status));
  const orders = state.orders.filter((order) => matches(order.id, order.name, order.email, order.eventId, order.eventTitle, order.status));
  const payments = operations.payments.filter((payment) => (currentView !== "payments" || paymentFilter === "all" || payment.status === paymentFilter) && matches(payment.id, payment.orderId, payment.userId, name(payment.userId), eventName(payment.eventId), payment.status, payment.failureReason));
  const support = operations.cases.filter((item) => (item.audience === "organizer" || item.escalated) && matches(item.id, item.subject, item.status, name(item.requesterId), item.category));
  const reports = operations.reports.filter((report) => matches(report.id, eventName(report.eventId), report.reason, report.status, name(report.reporterId)));
  const activations = operations.activations.filter((record) => matches(record.id, eventName(record.eventId), name(record.organizerId), record.status));
  const promotions = operations.promotions.filter((record) => matches(record.id, record.code, name(record.userId), eventName(record.eventId), record.orderId));
  const audit = operations.audit.filter((record) => matches(record.id, record.action, record.targetId, record.details, name(record.actorId)));
  const pendingReviews = operations.reports.filter((report) => report.status === "pending").length;
  const activeSupport = operations.cases.filter((item) => (item.audience === "organizer" || item.escalated) && item.status !== "Resolved").length;
  const failedPayments = operations.payments.filter((payment) => payment.status === "failed").length;

  function run(action: (value: DemoState) => DemoState, message: string) {
    try {
      update(action);
      setPendingAction(null);
      setFeedback({ message, error: false });
    } catch (error) {
      setFeedback({ message: error instanceof Error ? error.message : "This change could not be saved.", error: true });
    }
  }

  function suspensionButton(id: string, kind: "user" | "event", suspended: boolean, disabled = false) {
    const isPending = pendingAction?.id === id && pendingAction.kind === kind;
    return isPending ? <div className="admin-row-actions">
      <button className="btn btn-small btn-primary" onClick={() => run(
        (value) => kind === "user" ? suspendUser(value, id, !suspended) : suspendEvent(value, id, !suspended),
        `${kind === "user" ? "User" : "Event"} ${suspended ? "resumed" : "suspended"}.`,
      )}>Confirm {suspended ? "resume" : "suspend"}</button>
      <button className="btn btn-small btn-secondary" onClick={() => setPendingAction(null)}>Cancel</button>
    </div> : <button className="btn btn-small btn-secondary" disabled={disabled}
      onClick={() => setPendingAction({ id, kind, suspended })}>
      {suspended ? "Resume" : "Suspend"}
    </button>;
  }

  function exportReport() {
    try {
      const csv = operationalCsv(state, exportKind);
      const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `biletflow-demo-${exportKind}-${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      setTimeout(() => URL.revokeObjectURL(url), 0);
      setFeedback({ message: `${exportOptions.find(([key]) => key === exportKind)?.[1]} report downloaded.`, error: false });
    } catch (error) {
      setFeedback({ message: error instanceof Error ? error.message : "The report could not be exported.", error: true });
    }
  }

  const userRows = users.map((profile) => ({ id: profile.id, cells: [
    <RecordName key="name" title={profile.name} reference={profile.id} />,
    profile.email,
    profile.role === "platform_admin" ? "Platform administrator" : profile.supportOrganizerIds?.length ? "Organizer support staff" : profile.role,
    <Status key="status" value={profile.suspended ? "Suspended" : "Active"} />,
    suspensionButton(profile.id, "user", !!profile.suspended, profile.id === user.id || profile.role === "platform_admin"),
  ] }));
  const eventRows = events.map((event) => ({ id: event.id, cells: [
    <RecordName key="name" title={event.title} reference={event.id} />,
    name(event.ownerId),
    `${event.city} · ${event.venue}`,
    <Status key="status" value={event.suspended ? "Suspended" : event.status} />,
    suspensionButton(event.id, "event", !!event.suspended),
  ] }));
  const orderRows = orders.map((order) => ({ id: order.id, cells: [
    <RecordName key="reference" title={order.id} reference={dateTime(order.createdAt)} />,
    <RecordName key="user" title={order.name} reference={order.email} />,
    order.eventTitle,
    money(order.total),
    <Status key="status" value={order.status} />,
  ] }));
  const paymentRows = payments.map((payment) => ({ id: payment.id, cells: [
    <RecordName key="reference" title={payment.id} reference={dateTime(payment.createdAt)} />,
    <RecordName key="order" title={name(payment.userId)} reference={payment.orderId} />,
    eventName(payment.eventId),
    money(payment.amount),
    <Status key="status" value={payment.status} />,
    payment.failureReason ?? "—",
  ] }));

  return (
    <main className="workspace admin-workspace">
      <PageIntro eyebrow="BiletFlow / platform operations" title="A clear view of the whole house."
        description="Review activity, resolve exceptions, and keep the platform running."
        action={<Link className="btn btn-secondary" href="/support">Support inbox <Icon name="arrow" size={16} /></Link>} />
      <div className="admin-demo-note"><span className="status-dot" />Frontend demo · Operations persist in this browser. Backend administration and support services are not connected.</div>
      <nav className="admin-tabs" aria-label="Administration sections">
        {views.map(([key, label]) => <Link key={key} href={`/admin?view=${key}`} aria-current={currentView === key ? "page" : undefined}
          onClick={() => { setSearch(""); setPendingAction(null); setFeedback(null); }}>{label}</Link>)}
      </nav>
      {feedback && <Notice error={feedback.error}>{feedback.message}</Notice>}
      {currentView !== "settings" && <div className="admin-toolbar">
        <label className="admin-search"><Icon name="search" size={18} /><span className="admin-visually-hidden">Search {currentView === "overview" ? "users, events, orders, and payments" : views.find(([key]) => key === currentView)?.[1]}</span>
          <input type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder={currentView === "overview" ? "Search users, events, orders, and payments…" : "Search names, references, or status…"} />
        </label>
        {search && <button className="btn btn-small btn-secondary" onClick={() => setSearch("")}>Clear search</button>}
      </div>}

      {currentView === "overview" && <>
        <div className="admin-stats">
          <Stat label="Event reports" value={pendingReviews} href="/admin?view=reviews" detail="Awaiting review" />
          <Stat label="Support cases" value={activeSupport} href="/admin?view=support" detail="Escalated or organizer cases" />
          <Stat label="Payment failures" value={failedPayments} href="/admin?view=payments" detail="Demo payment records" />
          <Stat label="Suspended users" value={state.profiles.filter((profile) => profile.suspended).length} href="/admin?view=users" detail="Account access paused" />
        </div>
        {search ? <div className="admin-global-results">
          <section><h2>Users <span>{users.length}</span></h2><DataTable caption="User search results" headings={["User", "Email", "Role", "Status", "Action"]} rows={userRows} /></section>
          <section><h2>Events <span>{events.length}</span></h2><DataTable caption="Event search results" headings={["Event", "Organizer", "Venue", "Status", "Action"]} rows={eventRows} /></section>
          <section><h2>Orders <span>{orders.length}</span></h2><DataTable caption="Order search results" headings={["Order", "Purchaser", "Event", "Total", "Status"]} rows={orderRows} /></section>
          <section><h2>Payments <span>{payments.length}</span></h2><DataTable caption="Payment search results" headings={["Payment", "Purchaser / order", "Event", "Amount", "Status", "Failure reason"]} rows={paymentRows} /></section>
        </div> : <div className="admin-overview-grid">
          <section className="admin-panel"><h2>Attention, where it matters.</h2><p className="muted">Work through the queues without losing sight of the people behind each record.</p>
            <Link className="admin-queue-link" href="/admin?view=reviews"><span>Reported events<small>Review and dismiss reports or suspend an event.</small></span><strong>{pendingReviews}</strong><Icon name="arrow" size={17} /></Link>
            <Link className="admin-queue-link" href="/admin?view=support"><span>Platform support<small>Organizer requests and escalated attendee cases.</small></span><strong>{activeSupport}</strong><Icon name="arrow" size={17} /></Link>
            <Link className="admin-queue-link" href="/admin?view=payments"><span>Payment exceptions<small>Failures, refunds, and disputes in one place.</small></span><strong>{failedPayments + operations.refunds.filter((item) => item.status === "pending").length + operations.disputes.filter((item) => item.status === "open").length}</strong><Icon name="arrow" size={17} /></Link>
          </section>
          <section className="admin-panel"><h2>Platform at a glance.</h2><dl className="admin-summary-list">
            <div><dt>New bookings</dt><dd><Status value={operations.settings.bookingsEnabled ? "Active" : "Paused"} /></dd></div>
            <div><dt>Activation fee</dt><dd>{money(operations.settings.activationFee)}</dd></div>
            <div><dt>Support email</dt><dd>{operations.settings.supportEmail}</dd></div>
            <div><dt>Recorded orders</dt><dd>{state.orders.length}</dd></div>
          </dl><Link className="text-link" href="/admin?view=settings">Manage platform settings <Icon name="arrow" size={15} /></Link></section>
        </div>}
      </>}

      {currentView === "users" && <section><div className="admin-section-heading"><h2>Users</h2><span>{users.length} records</span></div><p className="admin-section-note">Suspending a user pauses booking and organizer actions. Your own administrator profile cannot be suspended here.</p><DataTable caption="Platform users" headings={["User", "Email", "Role", "Status", "Action"]} rows={userRows} /></section>}
      {currentView === "events" && <section><div className="admin-section-heading"><h2>Events</h2><span>{events.length} records</span></div><p className="admin-section-note">Suspended events are removed from discovery and cannot accept new bookings. Existing orders and support history remain available.</p><DataTable caption="Platform events" headings={["Event", "Organizer", "Venue", "Status", "Action"]} rows={eventRows} /></section>}
      {currentView === "orders" && <section><div className="admin-section-heading"><h2>Orders</h2><span>{orders.length} records</span></div><DataTable caption="Platform orders" headings={["Order", "Purchaser", "Event", "Total", "Status"]} rows={orderRows} /></section>}

      {currentView === "payments" && <>
        <section><div className="admin-section-heading"><h2>Payments and exceptions</h2><label className="admin-inline-filter">Payment status <select value={paymentFilter} onChange={(event) => setPaymentFilter(event.target.value as PaymentFilter)}>{["all", "paid", "failed", "refunded", "disputed"].map((status) => <option key={status} value={status}>{status === "all" ? "All payments" : status}</option>)}</select></label></div>
          <DataTable caption="Platform payments" headings={["Payment", "Purchaser / order", "Event", "Amount", "Status", "Failure reason"]} rows={paymentRows} />
        </section>
        <section className="admin-section"><h2>Refund monitor</h2><DataTable caption="Refund records" headings={["Refund", "Order / payment", "Amount", "Status", "Reason"]} rows={operations.refunds.filter((item) => matches(item.id, item.orderId, item.paymentId, item.reason, item.status)).map((item) => ({ id: item.id, cells: [<RecordName key="reference" title={item.id} reference={dateTime(item.createdAt)} />, <RecordName key="order" title={item.orderId} reference={item.paymentId} />, money(item.amount), <Status key="status" value={item.status} />, item.reason] }))} /></section>
        <section className="admin-section"><h2>Dispute monitor</h2><DataTable caption="Dispute records" headings={["Dispute", "Order / payment", "Amount", "Status", "Reason"]} rows={operations.disputes.filter((item) => matches(item.id, item.orderId, item.paymentId, item.reason, item.status)).map((item) => ({ id: item.id, cells: [<RecordName key="reference" title={item.id} reference={dateTime(item.createdAt)} />, <RecordName key="order" title={item.orderId} reference={item.paymentId} />, money(item.amount), <Status key="status" value={item.status} />, item.reason] }))} /></section>
      </>}

      {currentView === "reviews" && <section><div className="admin-section-heading"><h2>Reported events</h2><span>{pendingReviews} awaiting review</span></div>
        <DataTable caption="Reported events" headings={["Event / report", "Reported by", "Reason", "Status", "Review"]} rows={reports.map((report) => ({ id: report.id, cells: [
          <RecordName key="event" title={eventName(report.eventId)} reference={`${report.id} · ${dateTime(report.createdAt)}`} />,
          name(report.reporterId), report.reason, <Status key="status" value={report.status} />,
          report.status === "pending" ? <div className="admin-row-actions">
            <button className="btn btn-small btn-secondary" onClick={() => run((value) => reviewEventReport(value, report.id, "dismiss"), "Event report dismissed.")}>Dismiss report</button>
            <button className="btn btn-small btn-primary" onClick={() => run((value) => reviewEventReport(value, report.id, "suspend"), "Report reviewed and event suspended.")}>Suspend event</button>
          </div> : <RecordName key="reviewer" title={report.reviewerId ? name(report.reviewerId) : "Reviewed"} reference={report.reviewedAt ? dateTime(report.reviewedAt) : undefined} />,
        ] }))} />
      </section>}

      {currentView === "activations" && <section><div className="admin-section-heading"><h2>Paid-sales activation records</h2><span>{activations.length} records</span></div><p className="admin-section-note">Review each event&apos;s recorded activation status and fee. These records do not represent real charges.</p>
        <DataTable caption="Paid-sales activation records" headings={["Activation", "Event", "Organizer", "Fee (KZT)", "Status"]} rows={activations.map((record) => ({ id: record.id, cells: [<RecordName key="reference" title={record.id} reference={dateTime(record.createdAt)} />, eventName(record.eventId), name(record.organizerId), money(record.amount), <Status key="status" value={record.status} />] }))} />
      </section>}

      {currentView === "support" && <section><div className="admin-section-heading"><h2>Escalated and organizer support</h2><Link className="text-link" href="/support">Open support inbox <Icon name="arrow" size={15} /></Link></div>
        <DataTable caption="Platform support queue" headings={["Case", "Requester", "Category", "Status", "Assigned to"]} rows={support.map((item) => ({ id: item.id, cells: [<Link className="admin-case-link" key="case" href={`/support/${encodeURIComponent(item.id)}`}><RecordName title={item.subject} reference={`${item.id} · ${item.audience === "organizer" ? "Organizer" : "Escalated attendee"}`} /></Link>, name(item.requesterId), item.category.replaceAll("_", " "), <Status key="status" value={item.status} />, item.assigneeId ? name(item.assigneeId) : "Unassigned"] }))} />
      </section>}

      {currentView === "promotions" && <section><div className="admin-section-heading"><h2>Promotional-code activity</h2><span>{promotions.length} redemptions</span></div>
        <DataTable caption="Promotional-code activity" headings={["Code", "User", "Event", "Order", "Discount", "Used"]} rows={promotions.map((record) => ({ id: record.id, cells: [<RecordName key="code" title={record.code} reference={record.id} />, name(record.userId), eventName(record.eventId), record.orderId ?? "—", money(record.discount), dateTime(record.createdAt)] }))} />
      </section>}

      {currentView === "settings" && <section className="admin-panel"><h2>Platform settings</h2><p className="admin-section-note">Changes take effect in this browser&apos;s demonstration workspace.</p>
        <SettingsForm key={`${operations.settings.activationFee}-${operations.settings.supportEmail}-${operations.settings.bookingsEnabled}`} settings={operations.settings} onSave={(settings) => run((value) => savePlatformSettings(value, settings), "Platform settings saved.")} />
      </section>}

      {currentView === "audit" && <section><div className="admin-section-heading"><h2>Activity history</h2><span>{audit.length} records</span></div>
        <DataTable caption="Administration activity history" headings={["When", "Administrator", "Action", "Record", "Details"]} rows={audit.map((record) => ({ id: record.id, cells: [dateTime(record.createdAt), name(record.actorId), record.action, record.targetId, record.details] }))} />
      </section>}

      <section className="admin-export" aria-labelledby="admin-export-title"><div><h2 id="admin-export-title">Take a working copy.</h2><p>Export every demo record in the selected report as CSV.</p></div><label><span className="admin-visually-hidden">Operational report type</span><select value={exportKind} onChange={(event) => setExportKind(event.target.value as ExportKind)}>{exportOptions.map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label><button className="btn btn-secondary" onClick={exportReport}><Icon name="download" size={17} />Export CSV</button></section>
    </main>
  );
}
