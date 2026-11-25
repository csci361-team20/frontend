"use client";

/**
 * Platform administration (SRS 4.12) on the backend: search, users,
 * organizer verification, events, money monitors, reports, activations,
 * escalated support, promo activity, settings, audit history and CSV exports.
 */

import Link from "next/link";
import { useState, type FormEvent, type ReactNode } from "react";
import { api } from "@/lib/api";
import {
  EXPORTS,
  type ActivationRecord,
  type AdminEvent,
  type AdminOrder,
  type AdminOrganizer,
  type AdminPayment,
  type AdminRefund,
  type AdminSearch,
  type AdminUser,
  type AuditRow,
  type Dispute,
  type EventReport,
  type PlatformSettings,
  type PromoActivity,
} from "@/lib/admin";
import { caseRef, CATEGORY_LABELS, type CaseSummary } from "@/lib/support";
import { useSession } from "./session-provider";
import { useLoad } from "./use-load";
import { EmptyState, Icon, LoadingPage, Notice, PageIntro } from "./primitives";
import { useT } from "@/components/language";
import { formatDate, getLang, tk, tr } from "@/lib/i18n";
import "./admin.css";

type TableRow = { id: string; cells: ReactNode[] };

const VIEWS: [string, string][] = [
  ["overview", tk("Overview")],
  ["users", tk("Users")],
  ["organizers", tk("Organizer checks")],
  ["events", tk("Events")],
  ["orders", tk("Orders")],
  ["payments", tk("Payments")],
  ["reviews", tk("Event reports")],
  ["activations", tk("Paid-sales activations")],
  ["support", tk("Platform support")],
  ["promotions", tk("Promo codes")],
  ["settings", tk("Settings")],
  ["audit", tk("Activity history")],
];

const kzt = (value: number) => `₸${value.toLocaleString("en-US")}`;
const dateTime = (value: string) =>
  formatDate(getLang(), new Date(value), { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Almaty" });
const failure = (error: unknown) => (error instanceof Error && error.message ? error.message : tr("This change could not be saved."));

function Status({ value }: { value: string }) {
  const v = value.toLowerCase();
  const tone = ["suspended", "failed", "disputed", "rejected", "lost", "cancelled", "open"].includes(v)
    ? "danger"
    : ["paid", "succeeded", "active", "confirmed", "completed", "resolved", "won", "published", "verified", "actioned"].includes(v)
      ? "success"
      : "neutral";
  return <span className={`admin-badge admin-badge-${tone}`}>{value.replaceAll("_", " ")}</span>;
}

function RecordName({ title, reference }: { title: ReactNode; reference?: string }) {
  return (
    <span className="admin-record-name">
      {title}
      {reference && <small>{reference}</small>}
    </span>
  );
}

function DataTable({ caption, headings, rows, empty }: { caption: string; headings: string[]; rows: TableRow[]; empty?: string }) {
  const t = useT();
  return rows.length ? (
    <div className="admin-table-scroll" role="region" aria-label={caption} tabIndex={0}>
      <table className="admin-table">
        <caption className="admin-visually-hidden">{caption}</caption>
        <thead>
          <tr>
            {headings.map((h) => (
              <th key={h} scope="col">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id}>
              {row.cells.map((cell, i) => (
                <td key={i}>{cell}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  ) : (
    <p className="admin-empty">{empty ?? t("No matching records.")}</p>
  );
}

/** A list from the backend, with a loading state and errors in place. */
function Listed<T>({ data, children }: { data: { data?: T; status: string; error?: Error }; children: (value: T) => ReactNode }) {
  const t = useT();
  if (data.status === "error" && data.data === undefined) return <Notice error>{data.error?.message ?? t("Could not load this list.")}</Notice>;
  if (data.data === undefined) return <LoadingPage />;
  return <>{children(data.data)}</>;
}

function Stat({ label, value, href, detail }: { label: string; value: number | undefined; href: string; detail: string }) {
  return (
    <Link href={href} className="admin-stat">
      <span>
        {label}
        <Icon name="arrow" size={16} />
      </span>
      <strong>{value ?? "–"}</strong>
      <small>{detail}</small>
    </Link>
  );
}

/** A button that asks for a reason before it acts (suspensions and the like). */
function ReasonAction({
  label,
  confirm,
  minLength = 3,
  onConfirm,
}: {
  label: string;
  confirm: string;
  minLength?: number;
  onConfirm: (reason: string) => Promise<void>;
}) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  if (!open)
    return (
      <button className="btn btn-small btn-secondary" onClick={() => setOpen(true)}>
        {label}
      </button>
    );
  return (
    <form
      className="admin-row-actions"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        await onConfirm(String(new FormData(e.currentTarget).get("reason")).trim());
        setBusy(false);
        setOpen(false);
      }}
    >
      <input name="reason" required minLength={minLength} maxLength={500} placeholder={t("Reason (the owner is told)")} aria-label={t("Reason: {action}", { action: label })} autoFocus />
      <button className="btn btn-small btn-primary" disabled={busy}>{confirm}</button>
      <button type="button" className="btn btn-small btn-secondary" onClick={() => setOpen(false)}>{t("Cancel")}</button>
    </form>
  );
}

export function AdminPage({ view }: { view?: string }) {
  const t = useT();
  const { user, isAdmin, ready } = useSession();
  if (!ready) return <LoadingPage />;
  if (!user || !isAdmin)
    return (
      <main className="workspace">
        <EmptyState
          icon="users"
          title={t("Platform administration.")}
          description={user ? t("This area is for the BiletFlow platform team.") : t("Sign in with a platform administrator account.")}
          href={user ? "/" : "/sign-in?next=/admin"}
          label={user ? t("Back to BiletFlow") : t("Sign in")}
        />
      </main>
    );
  const current = VIEWS.some(([key]) => key === view) ? view! : "overview";
  return <AdminWorkspace key={current} view={current} me={user.id} />;
}

function AdminWorkspace({ view, me }: { view: string; me: string }) {
  const t = useT();
  const [q, setQ] = useState("");
  const [draft, setDraft] = useState("");
  const [filter, setFilter] = useState("");
  const [version, setVersion] = useState(0);
  const [feedback, setFeedback] = useState<{ message: string; error: boolean } | null>(null);
  const [exportKind, setExportKind] = useState("orders");
  const k = `${view}:${q}:${filter}:${version}`;
  const get = <T,>(path: string, query: Record<string, string | number | boolean | undefined> = {}) => (signal: AbortSignal) =>
    api.request<T>(path, { signal, query: { limit: 100, ...query } });

  async function act(action: () => Promise<unknown>, message: string) {
    setFeedback(null);
    try {
      await action();
      setVersion((v) => v + 1);
      setFeedback({ message, error: false });
    } catch (e) {
      setFeedback({ message: failure(e), error: true });
    }
  }

  const searchable = ["overview", "users", "organizers", "events", "orders", "payments"].includes(view);
  const placeholder = view === "overview" ? t("Search users, events, orders and payments (name, email or reference)…") : t("Search names, emails or references…");

  return (
    <main className="workspace admin-workspace">
      <PageIntro
        eyebrow={t("BiletFlow / platform operations")}
        title={t("A clear view of the whole house.")}
        description={t("Review activity, resolve exceptions and keep the platform running. Every action here is recorded in the activity history.")}
        action={
          <Link className="btn btn-secondary" href="/support">{t("Support inbox")}{" "}<Icon name="arrow" size={16} />
          </Link>
        }
      />
      <nav className="admin-tabs" aria-label={t("Administration sections")}>
        {VIEWS.map(([key, label]) => (
          <Link key={key} href={`/admin?view=${key}`} aria-current={view === key ? "page" : undefined}>
            {t(label)}
          </Link>
        ))}
      </nav>
      {feedback && <Notice error={feedback.error}>{feedback.message}</Notice>}
      {searchable && (
        <form
          className="admin-toolbar"
          onSubmit={(e: FormEvent<HTMLFormElement>) => {
            e.preventDefault();
            setQ(draft.trim());
          }}
        >
          <label className="admin-search">
            <Icon name="search" size={18} />
            <span className="admin-visually-hidden">{t("Search")}</span>
            <input type="search" value={draft} onChange={(e) => setDraft(e.target.value)} placeholder={placeholder} minLength={view === "overview" ? 2 : undefined} />
          </label>
          <button className="btn btn-small btn-secondary">{t("Search")}</button>
          {q && (
            <button
              type="button"
              className="btn btn-small btn-secondary"
              onClick={() => {
                setDraft("");
                setQ("");
              }}
            >{t("Clear")}</button>
          )}
        </form>
      )}

      {view === "overview" && <Overview q={q} k={k} get={get} act={act} me={me} />}
      {view === "users" && <Users k={k} q={q} get={get} act={act} me={me} />}
      {view === "organizers" && <Organizers k={k} q={q} filter={filter} setFilter={setFilter} get={get} act={act} />}
      {view === "events" && <Events k={k} q={q} get={get} act={act} />}
      {view === "orders" && <Orders k={k} q={q} get={get} />}
      {view === "payments" && <Payments k={k} q={q} filter={filter} setFilter={setFilter} get={get} act={act} />}
      {view === "reviews" && <Reports k={k} filter={filter} setFilter={setFilter} get={get} act={act} />}
      {view === "activations" && <Activations k={k} filter={filter} setFilter={setFilter} get={get} act={act} />}
      {view === "support" && <SupportQueue k={k} filter={filter} setFilter={setFilter} />}
      {view === "promotions" && <Promotions k={k} get={get} />}
      {view === "settings" && <Settings k={k} act={act} />}
      {view === "audit" && <Audit k={k} filter={filter} setFilter={setFilter} get={get} />}

      <section className="admin-export" aria-labelledby="admin-export-title">
        <div>
          <h2 id="admin-export-title">{t("Take a working copy.")}</h2>
          <p>{t("Download a CSV report built from live records. Spreadsheet formulas in cells are neutralised.")}</p>
        </div>
        <label>
          <span className="admin-visually-hidden">{t("Report")}</span>
          <select value={exportKind} onChange={(e) => setExportKind(e.target.value)}>
            {EXPORTS.map(([key, label]) => (
              <option key={key} value={key}>{t(label)}</option>
            ))}
          </select>
        </label>
        <a className="btn btn-secondary" href={`/api/backend/admin/exports/${exportKind}.csv`} download={`biletflow-${exportKind}.csv`}>
          <Icon name="download" size={17} />{t("Export CSV")}</a>
      </section>
    </main>
  );
}

// `useLoad` with a fixed signature, so the sections stay short
function useLoadList<T>(key: string, load: (signal: AbortSignal) => Promise<T>) {
  return useLoad<T>(key, load);
}

type Getter = <T>(path: string, query?: Record<string, string | number | boolean | undefined>) => (signal: AbortSignal) => Promise<T>;
type Act = (action: () => Promise<unknown>, message: string) => Promise<void>;
type FilterProps = { filter: string; setFilter: (v: string) => void };

function FilterSelect({ label, options, filter, setFilter }: FilterProps & { label: string; options: [string, string][] }) {
  return (
    <label className="admin-inline-filter">
      {label}
      <select value={filter} onChange={(e) => setFilter(e.target.value)}>
        {options.map(([value, text]) => (
          <option key={value} value={value}>{text}</option>
        ))}
      </select>
    </label>
  );
}

function userRows(list: AdminUser[], act: Act, me: string): TableRow[] {
  return list.map((u) => ({
    id: u.id,
    cells: [
      <RecordName key="n" title={u.full_name} reference={u.id.slice(0, 8).toUpperCase()} />,
      u.email,
      u.is_platform_admin ? tr("Platform admin") : u.is_email_verified ? tr("Verified email") : tr("Email not verified"),
      <span key="s">
        <Status value={u.is_suspended ? "suspended" : "active"} />
        {u.suspension_reason && <small className="admin-section-note"> {u.suspension_reason}</small>}
      </span>,
      u.id === me || u.is_platform_admin ? (
        "—"
      ) : u.is_suspended ? (
        <button key="a" className="btn btn-small btn-secondary" onClick={() => act(() => api.request(`/admin/users/${u.id}/restore`, { method: "POST" }), tr("{full_name} can sign in again.", { full_name: u.full_name }))}>{tr("Restore")}</button>
      ) : (
        <ReasonAction key="a" label={tr("Suspend")} confirm={tr("Confirm suspend")} onConfirm={(reason) => act(() => api.request(`/admin/users/${u.id}/suspend`, { body: { reason } }), tr("{full_name} is suspended and signed out everywhere.", { full_name: u.full_name }))} />
      ),
    ],
  }));
}

function eventRows(list: AdminEvent[], act: Act): TableRow[] {
  return list.map((e) => ({
    id: e.id,
    cells: [
      <RecordName key="n" title={<Link className="admin-case-link" href={`/events/${e.id}`}>{e.title}</Link>} reference={`${dateTime(e.start_at)}${e.city ? ` · ${e.city}` : ""}`} />,
      e.organizer_name,
      <span key="s">
        <Status value={e.is_suspended ? "suspended" : e.status} /> {e.lifecycle !== "upcoming" && e.lifecycle !== e.status && <Status value={e.lifecycle} />}
      </span>,
      e.paid_sales_open ? (
        <span key="p" className="admin-row-actions">{tr("Open")}<ReasonAction label={tr("Suspend paid sales")} confirm={tr("Suspend")} minLength={5} onConfirm={(reason) => act(() => api.request(`/admin/events/${e.id}/paid-sales/suspend`, { body: { reason } }), tr("Paid sales stopped for {title}. Resume them under Paid-sales activations.", { title: e.title }))} />
        </span>
      ) : (
        tr("Closed")
      ),
      e.is_suspended ? (
        <button key="a" className="btn btn-small btn-secondary" onClick={() => act(() => api.request(`/admin/events/${e.id}/restore`, { method: "POST" }), tr("{title} is back on sale.", { title: e.title }))}>{tr("Restore")}</button>
      ) : (
        <ReasonAction key="a" label={tr("Suspend")} confirm={tr("Confirm suspend")} onConfirm={(reason) => act(() => api.request(`/admin/events/${e.id}/suspend`, { body: { reason } }), tr("{title} is hidden and closed to new orders. The organizer was told.", { title: e.title }))} />
      ),
    ],
  }));
}

function OrdersTable({ data }: { data: { data?: AdminOrder[]; status: string; error?: Error } }) {
  const t = useT();
  return (
    <Listed data={data}>
      {(list) => (
        <DataTable
          caption={t("Orders")}
          headings={[t("Order"), t("Buyer"), t("Event"), t("Total"), t("Status")]}
          rows={list.map((o) => ({
            id: o.id,
            cells: [
              <RecordName key="r" title={o.id.slice(0, 8).toUpperCase()} reference={dateTime(o.created_at)} />,
              o.buyer_email,
              o.event_title,
              <RecordName key="t" title={kzt(o.total_kzt)} reference={o.promo_code ? `${o.promo_code} −${kzt(o.discount_kzt)}` : undefined} />,
              <Status key="s" value={o.status} />,
            ],
          }))}
        />
      )}
    </Listed>
  );
}

function paymentRows(list: AdminPayment[], act?: Act): TableRow[] {
  return list.map((p) => ({
    id: p.id,
    cells: [
      <RecordName key="r" title={p.id.slice(0, 8).toUpperCase()} reference={dateTime(p.created_at)} />,
      <RecordName key="b" title={p.buyer_email} reference={`Order ${p.order_id.slice(0, 8).toUpperCase()}`} />,
      p.event_title,
      kzt(p.amount_kzt),
      <Status key="s" value={p.status} />,
      p.failure_reason ?? "—",
      act && p.status === "succeeded" ? (
        <ReasonAction key="d" label={tr("Record dispute")} confirm={tr("Open dispute")} onConfirm={(reason) => act(() => api.request(`/admin/payments/${p.id}/disputes`, { body: { reason } }), tr("Dispute recorded."))} />
      ) : (
        "—"
      ),
    ],
  }));
}

function Overview({ q, k, get, act, me }: { q: string; k: string; get: Getter; act: Act; me: string }) {
  const t = useT();
  const counts = useLoadList(`counts:${k}`, async (signal) => {
    const [reports, support, failed, suspended, organizers] = await Promise.all([
      get<EventReport[]>("/admin/reports", { status: "pending" })(signal),
      api.request<CaseSummary[]>("/support/cases", { signal, query: { scope: "handling" } }),
      get<AdminPayment[]>("/admin/payments", { status: "failed", limit: 200 })(signal),
      get<AdminUser[]>("/admin/users", { suspended: true, limit: 200 })(signal),
      get<AdminOrganizer[]>("/admin/organizers", { verification_status: "pending", limit: 200 })(signal),
    ]);
    return {
      reports: reports.length,
      support: support.filter((c) => c.status !== "resolved").length,
      failed: failed.length,
      suspended: suspended.length,
      // Profiles start as "pending"; only submitted details wait for a decision
      organizers: organizers.filter((o) => o.verification_submitted_at).length,
    };
  });
  const found = useLoadList(`search:${k}`, (signal) =>
    q.length >= 2 ? api.request<AdminSearch>("/admin/search", { signal, query: { q } }) : Promise.resolve(null),
  );
  const c = counts.data;
  if (q)
    return (
      <Listed data={found}>
        {(r) =>
          r && (
            <div className="admin-global-results">
              <section>
                <h2>{t("Users")}{" "}<span>{r.users.length}</span></h2>
                <DataTable caption={t("Users found")} headings={[t("User"), t("Email"), t("Account"), t("Status"), t("Action")]} rows={userRows(r.users, act, me)} />
              </section>
              <section>
                <h2>{t("Events")}{" "}<span>{r.events.length}</span></h2>
                <DataTable caption={t("Events found")} headings={[t("Event"), t("Organizer"), t("Status"), t("Paid sales"), t("Action")]} rows={eventRows(r.events, act)} />
              </section>
              <section>
                <h2>{t("Orders")}{" "}<span>{r.orders.length}</span></h2>
                <OrdersTable data={{ data: r.orders, status: "ready" }} />
              </section>
              <section>
                <h2>{t("Payments")}{" "}<span>{r.payments.length}</span></h2>
                <DataTable caption={t("Payments found")} headings={[t("Payment"), t("Buyer / order"), t("Event"), t("Amount"), t("Status"), t("Failure reason"), t("Dispute")]} rows={paymentRows(r.payments, act)} />
              </section>
            </div>
          )
        }
      </Listed>
    );
  return (
    <>
      {counts.status === "error" && <Notice error>{counts.error.message}</Notice>}
      <div className="admin-stats">
        <Stat label={t("Event reports")} value={c?.reports} href="/admin?view=reviews" detail={t("Awaiting review")} />
        <Stat label={t("Platform support")} value={c?.support} href="/admin?view=support" detail={t("Organizer and escalated cases not resolved")} />
        <Stat label={t("Failed payments")} value={c?.failed} href="/admin?view=payments" detail={t("Simulated payment failures")} />
        <Stat label={t("Identity checks")} value={c?.organizers} href="/admin?view=organizers" detail={t("Organizers waiting for a decision")} />
        <Stat label={t("Suspended users")} value={c?.suspended} href="/admin?view=users" detail={t("Sign-in blocked")} />
      </div>
      <div className="admin-overview-grid">
        <section className="admin-panel">
          <h2>{t("Attention, where it matters.")}</h2>
          <p className="muted">{t("Work through the queues without losing sight of the people behind each record.")}</p>
          <Link className="admin-queue-link" href="/admin?view=reviews">
            <span>{t("Reported events")}<small>{t("Dismiss reports, or act and suspend the event.")}</small></span>
            <strong>{c?.reports ?? "–"}</strong>
            <Icon name="arrow" size={17} />
          </Link>
          <Link className="admin-queue-link" href="/admin?view=support">
            <span>{t("Platform support")}<small>{t("Organizer requests and escalated attendee cases.")}</small></span>
            <strong>{c?.support ?? "–"}</strong>
            <Icon name="arrow" size={17} />
          </Link>
          <Link className="admin-queue-link" href="/admin?view=organizers">
            <span>{t("Organizer identity checks")}<small>{t("Confirm or reject submitted legal details.")}</small></span>
            <strong>{c?.organizers ?? "–"}</strong>
            <Icon name="arrow" size={17} />
          </Link>
        </section>
        <SettingsSummary k={k} />
      </div>
    </>
  );
}

function SettingsSummary({ k }: { k: string }) {
  const t = useT();
  const s = useLoadList(`settings-summary:${k}`, (signal) => api.request<PlatformSettings>("/admin/settings", { signal }));
  return (
    <section className="admin-panel">
      <h2>{t("Platform at a glance.")}</h2>
      <dl className="admin-summary-list">
        <div>
          <dt>{t("New bookings")}</dt>
          <dd>{s.data ? <Status value={s.data.bookings_enabled ? "active" : "paused"} /> : "–"}</dd>
        </div>
        <div>
          <dt>{t("Activation fee")}</dt>
          <dd>{s.data ? kzt(s.data.activation_fee_kzt) : "–"}</dd>
        </div>
        <div>
          <dt>{t("Support email")}</dt>
          <dd>{s.data?.support_email ?? "–"}</dd>
        </div>
      </dl>
      <Link className="text-link" href="/admin?view=settings">{t("Manage platform settings")}{" "}<Icon name="arrow" size={15} />
      </Link>
    </section>
  );
}

function Users({ k, q, get, act, me }: { k: string; q: string; get: Getter; act: Act; me: string }) {
  const t = useT();
  const data = useLoadList(k, get<AdminUser[]>("/admin/users", { q: q || undefined }));
  return (
    <section>
      <div className="admin-section-heading">
        <h2>{t("Users")}</h2>
        <span>{t("Shown: {n}", { n: data.data?.length ?? "" })}</span>
      </div>
      <p className="admin-section-note">{t("Suspending blocks sign-in, signs the person out everywhere and takes their events out of public view.")}</p>
      <Listed data={data}>{(list) => <DataTable caption={t("Users")} headings={[t("User"), t("Email"), t("Account"), t("Status"), t("Action")]} rows={userRows(list, act, me)} />}</Listed>
    </section>
  );
}

function Organizers({ k, q, get, act, ...f }: { k: string; q: string; get: Getter; act: Act } & FilterProps) {
  const t = useT();
  const data = useLoadList(k, get<AdminOrganizer[]>("/admin/organizers", { q: q || undefined, verification_status: f.filter || undefined }));
  const decide = (o: AdminOrganizer, status: "verified" | "rejected") =>
    act(
      () => api.request(`/organizers/${o.id}/verification`, { method: "PATCH", body: { verification_status: status } }),
      `${o.display_name} is ${status}.`,
    );
  return (
    <section>
      <div className="admin-section-heading">
        <h2>{t("Organizer identity checks")}</h2>
        <FilterSelect label={t("Status")} options={[["", t("All")], ["pending", t("Pending")], ["verified", t("Verified")], ["rejected", t("Rejected")]]} {...f} />
      </div>
      <p className="admin-section-note">{t("A valid IIN/BIN verifies an organizer automatically (simulated). Reject when the details look wrong; their next submission then waits for you.")}</p>
      <Listed data={data}>
        {(list) => (
          <DataTable
            caption={t("Organizers")}
            headings={[t("Organizer"), t("Legal details"), t("Submitted"), t("Status"), t("Decision")]}
            rows={list.map((o) => ({
              id: o.id,
              cells: [
                <RecordName key="n" title={o.display_name} reference={o.email} />,
                o.legal_name ? <RecordName key="l" title={o.legal_name} reference={o.tax_id_masked ? `IIN/BIN ${o.tax_id_masked}` : undefined} /> : t("Not submitted"),
                o.verification_submitted_at ? dateTime(o.verification_submitted_at) : "—",
                <Status key="s" value={o.verification_status === "pending" && !o.verification_submitted_at ? "not submitted" : o.verification_status} />,
                o.legal_name ? (
                  <div key="d" className="admin-row-actions">
                    {o.verification_status !== "verified" && (
                      <button className="btn btn-small btn-primary" onClick={() => decide(o, "verified")}>{t("Verify")}</button>
                    )}
                    {o.verification_status !== "rejected" && (
                      <button className="btn btn-small btn-secondary" onClick={() => decide(o, "rejected")}>{t("Reject")}</button>
                    )}
                  </div>
                ) : (
                  t("Waiting for details")
                ),
              ],
            }))}
          />
        )}
      </Listed>
    </section>
  );
}

function Orders({ k, q, get }: { k: string; q: string; get: Getter }) {
  const t = useT();
  const data = useLoadList(k, get<AdminOrder[]>("/admin/orders", { q: q || undefined }));
  return (
    <section>
      <div className="admin-section-heading">
        <h2>{t("Orders")}</h2>
        <span>{t("Shown: {n}", { n: data.data?.length ?? "" })}</span>
      </div>
      <OrdersTable data={data} />
    </section>
  );
}

function Events({ k, q, get, act }: { k: string; q: string; get: Getter; act: Act }) {
  const t = useT();
  const data = useLoadList(k, get<AdminEvent[]>("/admin/events", { q: q || undefined }));
  return (
    <section>
      <div className="admin-section-heading">
        <h2>{t("Events")}</h2>
        <span>{t("Shown: {n}", { n: data.data?.length ?? "" })}</span>
      </div>
      <p className="admin-section-note">{t("A suspended event is hidden from attendees and takes no new orders. Issued tickets stay valid.")}</p>
      <Listed data={data}>{(list) => <DataTable caption={t("Events")} headings={[t("Event"), t("Organizer"), t("Status"), t("Paid sales"), t("Action")]} rows={eventRows(list, act)} />}</Listed>
    </section>
  );
}

function Payments({ k, q, get, act, ...f }: { k: string; q: string; get: Getter; act: Act } & FilterProps) {
  const t = useT();
  const payments = useLoadList(k, get<AdminPayment[]>("/admin/payments", { q: q || undefined, status: f.filter || undefined }));
  const refunds = useLoadList(`refunds:${k}`, get<AdminRefund[]>("/admin/refunds"));
  const disputes = useLoadList(`disputes:${k}`, get<Dispute[]>("/admin/disputes"));
  return (
    <>
      <section>
        <div className="admin-section-heading">
          <h2>{t("Payments")}</h2>
          <FilterSelect label={t("Status")} options={[["", t("All payments")], ["succeeded", t("Succeeded")], ["failed", t("Failed")]]} {...f} />
        </div>
        <Listed data={payments}>
          {(list) => <DataTable caption={t("Payments")} headings={[t("Payment"), t("Buyer / order"), t("Event"), t("Amount"), t("Status"), t("Failure reason"), t("Dispute")]} rows={paymentRows(list, act)} />}
        </Listed>
      </section>
      <section className="admin-section">
        <h2>{t("Refunds")}</h2>
        <Listed data={refunds}>
          {(list) => (
            <DataTable
              caption={t("Refunds")}
              headings={[t("Refund"), t("Buyer / order"), t("Event"), t("Amount"), t("Reason"), t("By")]}
              rows={list.map((r) => ({
                id: r.id,
                cells: [
                  <RecordName key="r" title={r.id.slice(0, 8).toUpperCase()} reference={dateTime(r.created_at)} />,
                  <RecordName key="b" title={r.buyer_email} reference={`Order ${r.order_id.slice(0, 8).toUpperCase()}`} />,
                  r.event_title,
                  kzt(r.amount_kzt),
                  r.reason,
                  r.initiated_by_name ?? "—",
                ],
              }))}
            />
          )}
        </Listed>
      </section>
      <section className="admin-section">
        <h2>{t("Disputes")}</h2>
        <Listed data={disputes}>
          {(list) => (
            <DataTable
              caption={t("Disputes")}
              headings={[t("Dispute"), t("Order / payment"), t("Amount"), t("Reason"), t("Status"), t("Outcome")]}
              rows={list.map((d) => ({
                id: d.id,
                cells: [
                  <RecordName key="r" title={d.id.slice(0, 8).toUpperCase()} reference={dateTime(d.created_at)} />,
                  <RecordName key="o" title={t("Order {reference}", { reference: d.order_id.slice(0, 8).toUpperCase() })} reference={t("Payment {reference}", { reference: d.payment_id.slice(0, 8).toUpperCase() })} />,
                  kzt(d.amount_kzt),
                  d.reason,
                  <Status key="s" value={d.status} />,
                  d.status === "open" ? (
                    <div key="a" className="admin-row-actions">
                      <button className="btn btn-small btn-secondary" onClick={() => act(() => api.request(`/admin/disputes/${d.id}`, { method: "PATCH", body: { status: "won" } }), t("Dispute marked as won."))}>{t("Won")}</button>
                      <button className="btn btn-small btn-secondary" onClick={() => act(() => api.request(`/admin/disputes/${d.id}`, { method: "PATCH", body: { status: "lost" } }), t("Dispute marked as lost."))}>{t("Lost")}</button>
                    </div>
                  ) : (
                    d.resolution_note ?? (d.resolved_at ? dateTime(d.resolved_at) : "—")
                  ),
                ],
              }))}
            />
          )}
        </Listed>
      </section>
    </>
  );
}

function Reports({ k, get, act, ...f }: { k: string; get: Getter; act: Act } & FilterProps) {
  const t = useT();
  const data = useLoadList(k, get<EventReport[]>("/admin/reports", { status: f.filter || undefined }));
  const review = (r: EventReport, decision: "dismissed" | "actioned", suspend: boolean, note?: string) =>
    act(
      () => api.request(`/admin/reports/${r.id}/review`, { body: { decision, suspend_event: suspend, note: note || null } }),
      suspend ? t("Report actioned and the event suspended.") : decision === "dismissed" ? t("Report dismissed.") : t("Report marked as handled."),
    );
  return (
    <section>
      <div className="admin-section-heading">
        <h2>{t("Reported events")}</h2>
        <FilterSelect label={t("Status")} options={[["", t("All")], ["pending", t("Pending")], ["dismissed", t("Dismissed")], ["actioned", t("Actioned")]]} {...f} />
      </div>
      <Listed data={data}>
        {(list) => (
          <DataTable
            caption={t("Event reports")}
            headings={[t("Event"), t("Reason"), t("Status"), t("Review")]}
            rows={list.map((r) => ({
              id: r.id,
              cells: [
                <RecordName key="e" title={<Link className="admin-case-link" href={`/events/${r.event_id}`}>{r.event_title}</Link>} reference={dateTime(r.created_at)} />,
                r.reason,
                <Status key="s" value={r.status} />,
                r.status === "pending" ? (
                  <div key="a" className="admin-row-actions">
                    <button className="btn btn-small btn-secondary" onClick={() => review(r, "dismissed", false)}>{t("Dismiss")}</button>
                    <ReasonAction label={t("Suspend event")} confirm={t("Suspend")} onConfirm={(note) => review(r, "actioned", true, note)} />
                  </div>
                ) : (
                  <RecordName key="d" title={r.review_note ?? t("Reviewed")} reference={r.reviewed_at ? dateTime(r.reviewed_at) : undefined} />
                ),
              ],
            }))}
          />
        )}
      </Listed>
    </section>
  );
}

function Activations({ k, get, act, ...f }: { k: string; get: Getter; act: Act } & FilterProps) {
  const t = useT();
  const data = useLoadList(k, get<ActivationRecord[]>("/admin/activations", { status: f.filter || undefined, limit: undefined }));
  return (
    <section>
      <div className="admin-section-heading">
        <h2>{t("Paid-sales activations")}</h2>
        <FilterSelect label={t("Status")} options={[["", t("All")], ["pending", t("Pending")], ["active", t("Active")], ["suspended", t("Suspended")]]} {...f} />
      </div>
      <p className="admin-section-note">{t("Fees are simulated; no money moves. Suspending paid sales leaves free tickets and sold tickets alone.")}</p>
      <Listed data={data}>
        {(list) => (
          <DataTable
            caption={t("Activation records")}
            headings={[t("Event"), t("Organizer"), t("Fee"), t("Steps"), t("Status"), t("Action")]}
            rows={list.map((a) => ({
              id: a.id,
              cells: [
                <RecordName key="e" title={a.event_title} reference={dateTime(a.created_at)} />,
                a.organizer_name,
                <RecordName key="f" title={kzt(a.fee_kzt)} reference={a.fee_paid_at ? t("Paid {when}", { when: dateTime(a.fee_paid_at) }) : t("Not paid")} />,
                a.terms_accepted_at ? t("Terms {version} accepted", { version: a.terms_version ?? "" }) : t("Terms not accepted"),
                <span key="s">
                  <Status value={a.status} />
                  {a.suspension_reason && <small className="admin-section-note"> {a.suspension_reason}</small>}
                </span>,
                a.status === "active" ? (
                  <ReasonAction key="a" label={t("Suspend paid sales")} confirm={t("Suspend")} minLength={5} onConfirm={(reason) => act(() => api.request(`/admin/events/${a.event_id}/paid-sales/suspend`, { body: { reason } }), t("Paid sales suspended. The organizer was emailed."))} />
                ) : a.status === "suspended" ? (
                  <button key="a" className="btn btn-small btn-secondary" onClick={() => act(() => api.request(`/admin/events/${a.event_id}/paid-sales/resume`, { method: "POST" }), t("Paid sales resumed."))}>{t("Resume")}</button>
                ) : (
                  "—"
                ),
              ],
            }))}
          />
        )}
      </Listed>
    </section>
  );
}

function SupportQueue({ k, ...f }: { k: string } & FilterProps) {
  const t = useT();
  const data = useLoadList(k, (signal) => api.request<CaseSummary[]>("/support/cases", { signal, query: { scope: "handling", status: f.filter || undefined } }));
  return (
    <section>
      <div className="admin-section-heading">
        <h2>{t("Organizer and escalated support")}</h2>
        <FilterSelect label={t("Status")} options={[["", t("All")], ["open", t("Open")], ["in_progress", t("In Progress")], ["waiting_for_customer", t("Waiting for Customer")], ["resolved", t("Resolved")]]} {...f} />
      </div>
      <Listed data={data}>
        {(list) => (
          <DataTable
            caption={t("Platform support queue")}
            headings={[t("Case"), t("Requester"), t("Category"), t("Status"), t("Assigned to")]}
            rows={list.map((c) => ({
              id: c.id,
              cells: [
                <Link key="c" className="admin-case-link" href={`/support/${c.id}`}>
                  <RecordName title={c.subject} reference={`${caseRef(c.id)} · ${c.audience === "organizer" ? t("Organizer") : (c.event_title ? t("Escalated · {event}", { event: c.event_title }) : t("Escalated"))}`} />
                </Link>,
                c.requester_name,
                CATEGORY_LABELS[c.category] ?? c.category,
                <Status key="s" value={c.status_label} />,
                c.assignee_name ?? t("Unassigned"),
              ],
            }))}
          />
        )}
      </Listed>
    </section>
  );
}

function Promotions({ k, get }: { k: string; get: Getter }) {
  const t = useT();
  const data = useLoadList(k, get<PromoActivity[]>("/admin/promo-activity"));
  return (
    <section>
      <div className="admin-section-heading">
        <h2>{t("Promo-code activity")}</h2>
        <span>{t("Redemptions: {n}", { n: data.data?.length ?? "" })}</span>
      </div>
      <Listed data={data}>
        {(list) => (
          <DataTable
            caption={t("Promo-code redemptions")}
            headings={[t("Code"), t("Buyer"), t("Event"), t("Order"), t("Discount"), t("Used")]}
            rows={list.map((p) => ({
              id: p.redemption_id,
              cells: [
                <RecordName key="c" title={p.code} reference={p.campaign_name} />,
                p.buyer_email,
                p.event_title,
                <RecordName key="o" title={p.order_id.slice(0, 8).toUpperCase()} reference={p.order_status} />,
                kzt(p.discount_kzt),
                dateTime(p.created_at),
              ],
            }))}
          />
        )}
      </Listed>
    </section>
  );
}

function Settings({ k, act }: { k: string; act: Act }) {
  const t = useT();
  const data = useLoadList(k, (signal) => api.request<PlatformSettings>("/admin/settings", { signal }));
  const [enabled, setEnabled] = useState<boolean | null>(null);
  return (
    <section className="admin-panel">
      <h2>{t("Platform settings")}</h2>
      <Listed data={data}>
        {(s) => {
          const bookings = enabled ?? s.bookings_enabled;
          return (
            <form
              key={s.updated_at ?? "initial"}
              className="stack-form admin-settings"
              onSubmit={(e) => {
                e.preventDefault();
                const d = new FormData(e.currentTarget);
                // Send only what changed, so an unchanged value is never re-validated
                const fee = Number(d.get("fee"));
                const email = String(d.get("email")).trim();
                const body = {
                  ...(fee !== s.activation_fee_kzt ? { activation_fee_kzt: fee } : {}),
                  ...(email !== s.support_email ? { support_email: email } : {}),
                  ...(bookings !== s.bookings_enabled ? { bookings_enabled: bookings } : {}),
                };
                if (!Object.keys(body).length) return;
                void act(() => api.request("/admin/settings", { method: "PATCH", body }), t("Platform settings saved."));
              }}
            >
              <label>{t("Paid-sales activation fee (KZT)")}<input name="fee" type="number" min={0} max={10000000} step={1} required defaultValue={s.activation_fee_kzt} />
                <span className="field-hint">{t("Applies to activation records created from now on. Existing records keep their fee.")}</span>
              </label>
              <label>{t("Platform support email")}<input name="email" type="email" maxLength={255} required defaultValue={s.support_email} />
              </label>
              <label className="admin-setting-toggle">
                <input type="checkbox" checked={bookings} onChange={(e) => setEnabled(e.target.checked)} />
                <span>
                  <strong>{t("Accept new bookings")}</strong>
                  <small>{t("When paused, nobody can start a checkout. Existing orders, tickets and support stay available.")}</small>
                </span>
              </label>
              {s.updated_at && <p className="field-hint">{t("Last changed {dateTime}", { dateTime: dateTime(s.updated_at) })}</p>}
              <button className="btn btn-primary">{t("Save platform settings")}{" "}<Icon name="check" size={16} />
              </button>
            </form>
          );
        }}
      </Listed>
    </section>
  );
}

function Audit({ k, get, ...f }: { k: string; get: Getter } & FilterProps) {
  const t = useT();
  const data = useLoadList(k, get<AuditRow[]>("/admin/audit", { action: f.filter || undefined, limit: 200 }));
  return (
    <section>
      <div className="admin-section-heading">
        <h2>{t("Activity history")}</h2>
        <FilterSelect
          label={t("Area")}
          options={[["", t("Everything")], ["platform.", t("Platform admin")], ["organizer.", t("Organizers")], ["event.", t("Events")], ["order.", t("Orders")], ["payment.", t("Payments")], ["refund.", t("Refunds")], ["activation.", t("Activations")], ["promo.", t("Promotions")], ["support.", t("Support")], ["check_in.", t("Check-in")]]}
          {...f}
        />
      </div>
      <p className="admin-section-note">{t("Read-only. Entries cannot be edited or deleted.")}</p>
      <Listed data={data}>
        {(list) => (
          <DataTable
            caption={t("Activity history")}
            headings={[t("When"), t("Who"), t("What"), t("Record")]}
            rows={list.map((a) => ({
              id: a.id,
              cells: [dateTime(a.created_at), a.actor_name ?? t("System"), a.description, <Status key="t" value={a.entity_type} />],
            }))}
          />
        )}
      </Listed>
    </section>
  );
}
