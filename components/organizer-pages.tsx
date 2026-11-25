"use client";

/**
 * The organizer workspace, backed by the BiletFlow API: overview, event
 * list, creating and editing events, and the per-event management tabs
 * (see organizer-tabs.tsx).
 */

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent, type ReactNode } from "react";
import { api } from "@/lib/api";
import {
  CATEGORIES,
  CITIES,
  categoryLabel,
  eventDate,
  eventTime,
  posterInfo,
  price,
  type ApiEvent,
} from "@/lib/events";
import {
  canManageRole,
  fromLocalInputs,
  toLocalInputs,
  type MyEvent,
  type OverviewRow,
  type StaffRole,
} from "@/lib/organizer";
import { refreshSession, useSession } from "./session-provider";
import { SupportLink } from "./support-pages";
import { useLoad } from "./use-load";
import {
  ActivityTab,
  AttendeesTab,
  OverviewTab,
  PaidSalesTab,
  PromotionsTab,
  SalesTab,
  TeamTab,
  TicketsTab,
} from "./organizer-tabs";
import { OrganizerProfileView } from "./organizer-profile";
import { EmptyState, Icon, LoadingPage, Notice, PageIntro, Poster } from "./primitives";
import { useT } from "@/components/language";

import { tk, tr } from "@/lib/i18n";
export const failure = (error: unknown, fallback = tr("That did not work. Please try again.")) =>
  error instanceof Error && error.message ? error.message : fallback;

export const amount = (value: number) => `₸${value.toLocaleString("en-US")}`;

export function OrganizerShell({ children, active = "overview" }: { children: ReactNode; active?: string }) {
  const t = useT();
  const { organizer } = useSession();
  return (
    <div className="organizer-shell">
      <aside className="organizer-sidebar">
        <p className="eyebrow">{t("Behind the scenes")}</p>
        <p className="workspace-name">
          {organizer?.display_name ?? t("Your box office")}
          <span>{t("Organizer workspace")}</span>
        </p>
        <nav aria-label={t("Organizer navigation")}>
          <Link className={active === "overview" ? "active" : ""} href="/organizer">
            <Icon name="grid" size={18} />{t("Overview")}</Link>
          <Link className={active === "events" ? "active" : ""} href="/organizer?view=events">
            <Icon name="calendar" size={18} />{t("My events")}</Link>
          <Link className={active === "check-in" ? "active" : ""} href="/check-in">
            <Icon name="users" size={18} />{t("Check-in desk")}</Link>
          <Link className={active === "profile" ? "active" : ""} href="/organizer?view=profile">
            <Icon name="check" size={18} />{t("Organizer profile")}</Link>
          <Link href="/support">
            <Icon name="mail" size={18} />{t("Support inbox")}</Link>
        </nav>
        <Link className="btn btn-primary btn-full" href="/organizer/events/new">
          <Icon name="plus" size={16} />{t("Create event")}</Link>
        <div className="sidebar-note">
          <Icon name="ticket" size={23} />
          <p>{t("You set the stage.")}<br />{t("We'll keep the list.")}</p>
          <span>{t("Payments are simulated")}<br />{t("in this version of BiletFlow.")}</span>
        </div>
        <Link className="text-link muted" href="/events">{t("Back to the audience")}{" "}<Icon name="external" size={13} />
        </Link>
      </aside>
      <main className="organizer-main">{children}</main>
    </div>
  );
}

export function Stat({ label, value, note, icon }: { label: string; value: string | number; note: string; icon: string }) {
  return (
    <div className="stat">
      <div>
        <span>{label}</span>
        <Icon name={icon} size={18} />
      </div>
      <strong>{value}</strong>
      <small>{note}</small>
    </div>
  );
}

const LIFECYCLES = [
  { value: "all", label: tk("All events") },
  { value: "draft", label: tk("Drafts") },
  { value: "upcoming", label: tk("Upcoming") },
  { value: "active", label: tk("Happening now") },
  { value: "completed", label: tk("Completed") },
  { value: "cancelled", label: tk("Cancelled") },
];

export const lifecycleLabel = (value: string) =>
  ({ draft: tr("Draft"), upcoming: tr("Published"), active: tr("Happening now"), completed: tr("Completed"), cancelled: tr("Cancelled") })[
    value
  ] ?? value;

/** Signed-in check plus "become an organizer" for accounts without a profile. */
function useOrganizerGate() {
  const session = useSession();
  const manages = session.staffEvents.some((e) => canManageRole(e.my_role));
  return { ...session, allowed: !!session.organizer || manages };
}

function SignInFirst() {
  const t = useT();
  return (
    <div className="workspace">
      <EmptyState
        icon="grid"
        title={t("Your box office starts here.")}
        description={t("Sign in to create events, sell tickets and manage your guest list.")}
        href="/sign-in?next=/organizer"
        label={t("Sign in")}
      />
    </div>
  );
}

function BecomeOrganizer() {
  const t = useT();
  const { user } = useSession();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    setBusy(true);
    setError("");
    try {
      await api.request("/organizers/", {
        body: {
          display_name: String(data.get("display_name")).trim(),
          contact_email: String(data.get("contact_email")).trim() || null,
        },
      });
      await refreshSession();
    } catch (e) {
      setError(failure(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className="workspace narrow-workspace">
      <PageIntro
        eyebrow={t("On the other side of the stage")}
        title={t("Open your box office.")}
        description={t("Create an organizer profile to publish events, sell tickets and welcome your guests.")}
      />
      {!user?.is_email_verified && (
        <Notice>{t("Confirm your email address first; organizer tools need a confirmed email.")}{" "}
          <Link className="text-link" href="/profile">{t("Go to your profile")}</Link>
        </Notice>
      )}
      <form className="stack-form" onSubmit={submit}>
        <label>{t("Organizer name (shown on your events)")}<input name="display_name" required minLength={2} maxLength={255} defaultValue={user?.full_name} />
        </label>
        <label>{t("Contact email for guests")}{" "}<span className="optional">{t("Optional")}</span>
          <input name="contact_email" type="email" maxLength={255} placeholder={user?.email} />
        </label>
        {error && <Notice error>{error}</Notice>}
        <button className="btn btn-primary" disabled={busy}>
          {busy ? t("Creating…") : t("Create organizer profile")}
        </button>
      </form>
    </main>
  );
}

export function OrganizerPage({ view }: { view?: string }) {
  const gate = useOrganizerGate();
  if (!gate.ready) return <LoadingPage />;
  if (!gate.user) return <SignInFirst />;
  if (!gate.allowed) return <BecomeOrganizer />;
  if (view === "profile")
    return (
      <OrganizerShell active="profile">
        <OrganizerProfileView />
      </OrganizerShell>
    );
  return <EventsOverview view={view} />;
}

function EventsOverview({ view }: { view?: string }) {
  const t = useT();
  const { user } = useSession();
  const [filter, setFilter] = useState("all");
  const [search, setSearch] = useState("");
  const data = useLoad("organizer-events", async (signal) => {
    const [events, overview] = await Promise.all([
      api.request<MyEvent[]>("/events/mine", { signal }),
      api.request<OverviewRow[]>("/analytics/events", { signal }).catch(() => [] as OverviewRow[]),
    ]);
    return { events, overview };
  });
  if (data.status === "error" && !data.data)
    return (
      <OrganizerShell>
        <Notice error>{data.error.message}</Notice>
      </OrganizerShell>
    );
  if (!data.data) return <LoadingPage />;
  const { events, overview } = data.data;
  const stats = new Map(overview.map((row) => [row.event_id, row]));
  const sold = overview.reduce((s, r) => s + r.tickets_sold, 0);
  const revenue = overview.reduce((s, r) => s + r.net_revenue_kzt, 0);
  const visible = events.filter(
    (e) =>
      (filter === "all" || e.lifecycle === filter) &&
      `${e.title} ${e.venue_name ?? ""} ${e.city ?? ""}`.toLowerCase().includes(search.toLowerCase()),
  );
  const events_ = view === "events";
  return (
    <OrganizerShell active={events_ ? "events" : "overview"}>
      <PageIntro
        eyebrow={events_ ? t("The things you’re putting into the world") : t("A little planning. A full house.")}
        title={events_ ? t("Your events.") : t("Hello, {name}.", { name: user?.full_name.split(" ")[0] })}
        description={
          events_
            ? t("From the first draft to the last person through the door.")
            : t("Here’s how things are shaping up at your box office.")
        }
        action={
          <Link className="btn btn-primary" href="/organizer/events/new">
            <Icon name="plus" size={16} />{t("Create event")}</Link>
        }
      />
      {!events_ && (
        <div className="stats-row">
          <Stat label={t("Net revenue")} value={amount(revenue)} note={t("After discounts and refunds (simulated)")} icon="chart" />
          <Stat label={t("Tickets sold")} value={sold} note={t.plural(overview.length, "Across {n} event", "Across {n} events")} icon="ticket" />
          <Stat
            label={t("Live events")}
            value={events.filter((e) => e.lifecycle === "upcoming" || e.lifecycle === "active").length}
            note={t.plural(events.filter((e) => e.lifecycle === "draft").length, "{n} draft in the wings", "{n} drafts in the wings")}
            icon="calendar"
          />
        </div>
      )}
      <div className="section-heading events-heading">
        <h2>{events_ ? t("The event list") : t("On your calendar")}</h2>
        <label className="compact-search">
          <Icon name="search" size={16} />
          <input aria-label={t("Search your events")} placeholder={t("Find an event")} value={search} onChange={(e) => setSearch(e.target.value)} />
        </label>
      </div>
      <div className="line-tabs">
        {LIFECYCLES.map((tab) => (
          <button
            key={tab.value}
            aria-pressed={filter === tab.value}
            className={filter === tab.value ? "active" : ""}
            onClick={() => setFilter(tab.value)}
          >
            {t(tab.label)}
            <span>{events.filter((e) => tab.value === "all" || e.lifecycle === tab.value).length}</span>
          </button>
        ))}
      </div>
      {visible.length ? (
        <div className="managed-events">
          {visible.map((event) => {
            const row = stats.get(event.id);
            const booked = row?.tickets_sold ?? 0;
            const capacity = row?.capacity ?? event.capacity;
            return (
              <Link className="managed-event" href={`/organizer/events/${event.id}`} key={event.id}>
                <div className="managed-poster">
                  <Poster event={posterInfo(event)} compact />
                </div>
                <div className="managed-event-title">
                  <span className={`status-badge ${event.lifecycle === "upcoming" || event.lifecycle === "active" ? "status-live" : ""}`}>
                    {lifecycleLabel(event.lifecycle)}
                  </span>
                  <h3>{event.title}</h3>
                  <p>
                    {eventDate(event.start_at, event.timezone, { weekday: "short", day: "numeric", month: "short" })} ·{" "}
                    {event.venue_name ?? t("Venue to be announced")}
                    {event.my_role !== "owner" && ` · ${event.my_role}`}
                  </p>
                </div>
                <div className="managed-progress">
                  <span>
                    <strong>{booked}</strong> / {capacity}
                  </span>
                  <div className="progress-track">
                    <span style={{ width: `${capacity ? Math.min(100, (booked / capacity) * 100) : 0}%` }} />
                  </div>
                  <small>{t("tickets sold")}</small>
                </div>
                <div className="managed-revenue">
                  <strong>{amount(row?.net_revenue_kzt ?? 0)}</strong>
                  <small>{t("net revenue")}</small>
                </div>
                <Icon name="arrow" size={18} />
              </Link>
            );
          })}
        </div>
      ) : (
        <EmptyState
          icon="calendar"
          title={events.length ? t("No events match just yet.") : t("It starts with an idea.")}
          description={events.length ? t("Try a different search or status.") : t("Give it a name, pick a date, and invite the city in.")}
          href="/organizer/events/new"
          label={t("Create your first event")}
        />
      )}
    </OrganizerShell>
  );
}

type DraftTicket = { key: string; name: string; description: string; price: number; quantity: number };

export function EventEditor({ existing, onSaved }: { existing?: ApiEvent; onSaved?: (event: ApiEvent) => void }) {
  const t = useT();
  const router = useRouter();
  const [seating, setSeating] = useState(existing?.seating_type ?? "general_admission");
  const [types, setTypes] = useState<DraftTicket[]>([
    { key: "t1", name: t("General admission"), description: t("Entry to the event."), price: 0, quantity: 100 },
  ]);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const start = toLocalInputs(existing?.start_at);
  const end = toLocalInputs(existing?.end_at);
  const today = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Almaty" });
  const knownCity = !existing?.city || CITIES.includes(existing.city);

  function change(index: number, patch: Partial<DraftTicket>) {
    setTypes((items) => items.map((type, i) => (i === index ? { ...type, ...patch } : type)));
  }

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const data = new FormData(e.currentTarget);
    const text = (name: string) => String(data.get(name) ?? "").trim();
    const startAt = fromLocalInputs(text("date"), text("time"));
    const endAt = fromLocalInputs(text("end_date") || text("date"), text("end_time"));
    if (startAt && endAt && endAt <= startAt) return setError(t("The event has to end after it starts."));
    const city = text("city") === "other" ? text("other_city") : text("city");
    const body = {
      title: text("title"),
      subtitle: text("subtitle") || null,
      description: text("description") || null,
      category: text("category") || null,
      city: city || null,
      venue_name: text("venue_name") || null,
      venue_address: text("venue_address") || null,
      start_at: startAt,
      end_at: endAt,
      timezone: existing?.timezone ?? "Asia/Almaty",
      capacity: Number(data.get("capacity")),
      visibility: text("visibility"),
      refund_policy: text("refund_policy") || null,
      // Numbered seats are set up after creation (POST /events/{id}/seating)
    };
    setBusy(true);
    setError("");
    setMessage("");
    try {
      if (existing) {
        const saved = await api.request<ApiEvent>(`/events/${existing.id}`, { method: "PATCH", body });
        setMessage(
          existing.status === "published"
            ? t("Changes saved. Ticket holders are told by email about date, time and venue changes.")
            : t("Changes saved."),
        );
        onSaved?.(saved);
      } else {
        const created = await api.request<ApiEvent>("/events/", { body });
        if (seating === "general_admission")
          for (const t of types)
            await api.request(`/events/${created.id}/ticket-types`, {
              body: { name: t.name.trim(), description: t.description.trim() || null, price_kzt: t.price, quantity: t.quantity },
            });
        await refreshSession();
        router.push(`/organizer/events/${created.id}${seating === "assigned" ? "?tab=Tickets&seating=1" : ""}`);
      }
    } catch (e) {
      setError(failure(e, t("Could not save this event.")));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="event-editor" aria-busy={busy}>
      <section className="editor-section">
        <div className="editor-section-label">
          <span className="step-number">01</span>
          <h2>{t("The essentials")}</h2>
          <p>{t("Give people a reason to put this in their calendar.")}</p>
        </div>
        <div className="stack-form">
          <label>{t("Event name")}<input name="title" defaultValue={existing?.title} placeholder={t("Something worth showing up for")} minLength={3} maxLength={255} required />
          </label>
          <label>{t("A line for the poster")}{" "}<span className="optional">{t("Optional")}</span>
            <input name="subtitle" defaultValue={existing?.subtitle ?? ""} placeholder={t("One good sentence about your event")} maxLength={255} />
          </label>
          <div className="form-two">
            <label>{t("Category")}<select name="category" defaultValue={existing?.category ?? "concert"}>
                {CATEGORIES.map((c) => (
                  <option key={c.value} value={c.value}>{c.label}</option>
                ))}
                {existing?.category && !CATEGORIES.some((c) => c.value === existing.category) && (
                  <option value={existing.category}>{categoryLabel(existing.category)}</option>
                )}
              </select>
            </label>
            <label>{t("Who can find it")}<select name="visibility" defaultValue={existing?.visibility ?? "public"}>
                <option value="public">{t("Public — listed on BiletFlow")}</option>
                <option value="unlisted">{t("Unlisted — only people with the link")}</option>
                <option value="private">{t("Private — only your team")}</option>
              </select>
            </label>
          </div>
          <label>{t("About the event")}<textarea
              name="description"
              defaultValue={existing?.description ?? ""}
              placeholder={t("The lineup, the atmosphere, the things people should know…")}
              rows={5}
              maxLength={10000}
            />
          </label>
        </div>
      </section>
      <section className="editor-section">
        <div className="editor-section-label">
          <span className="step-number">02</span>
          <h2>{t("A time & a place")}</h2>
          <p>{t("Times are Kazakhstan time (UTC+5).")}</p>
        </div>
        <div className="stack-form">
          <div className="form-two">
            <label>{t("Date")}<input type="date" name="date" min={existing ? undefined : today} defaultValue={start.date} required />
            </label>
            <label>{t("Starts at")}<input type="time" name="time" defaultValue={start.time || "19:00"} required />
            </label>
          </div>
          <div className="form-two">
            <label>{t("Ends on")}{" "}<span className="optional">{t("If not the same day")}</span>
              <input type="date" name="end_date" defaultValue={end.date !== start.date ? end.date : ""} />
            </label>
            <label>{t("Ends at")}<input type="time" name="end_time" defaultValue={end.time || "22:00"} required />
            </label>
          </div>
          <div className="form-two">
            <label>{t("Venue")}<input name="venue_name" defaultValue={existing?.venue_name ?? ""} placeholder={t("Venue name")} maxLength={255} required />
            </label>
            <label>{t("City")}<select name="city" defaultValue={knownCity ? (existing?.city ?? "Almaty") : "other"}>
                {CITIES.map((c) => (
                  <option key={c} value={c}>
                    {t(c)}
                  </option>
                ))}
                <option value="other">{t("Another city…")}</option>
              </select>
            </label>
          </div>
          {!knownCity && (
            <label>{t("City name")}<input name="other_city" defaultValue={existing?.city ?? ""} maxLength={100} />
            </label>
          )}
          <label>{t("Street address")}{" "}<span className="optional">{t("Optional")}</span>
            <input name="venue_address" defaultValue={existing?.venue_address ?? ""} maxLength={500} />
          </label>
          <div className="form-two">
            <label>{t("Capacity")}<input type="number" name="capacity" min={1} max={1000000} defaultValue={existing?.capacity ?? 100} required />
              <span className="field-hint">
                {seating === "assigned"
                  ? t("With numbered seats, the hall you choose next sets the capacity")
                  : t("All ticket types together cannot exceed it")}
              </span>
            </label>
            {!existing ? (
              <label>{t("Seating")}<select value={seating} onChange={(e) => setSeating(e.target.value as typeof seating)}>
                  <option value="general_admission">{t("General admission")}</option>
                  <option value="assigned">{t("Numbered seats (choose a venue next)")}</option>
                </select>
              </label>
            ) : (
              <label>{t("Seating")}<input value={existing.seating_type === "assigned" ? t("Numbered seats") : t("General admission")} disabled />
              </label>
            )}
          </div>
          <label>{t("Refund policy")}{" "}<span className="optional">{t("Optional")}</span>
            <textarea name="refund_policy" rows={2} maxLength={5000} defaultValue={existing?.refund_policy ?? ""} placeholder={t("For example: full refund up to 48 hours before the event.")} />
          </label>
        </div>
      </section>
      {!existing && seating === "general_admission" && (
        <section className="editor-section">
          <div className="editor-section-label">
            <span className="step-number">03</span>
            <h2>{t("A way in")}</h2>
            <p>{t("Make it free, or set a price in tenge. Paid sales open after the activation checklist.")}</p>
          </div>
          <div className="ticket-type-editor">
            {types.map((type, i) => (
              <div className="ticket-type-form" key={type.key}>
                <div className="ticket-type-heading">
                  <span>{t("Ticket type")}{" "}{String(i + 1).padStart(2, "0")}</span>
                  {types.length > 1 && (
                    <button type="button" className="icon-button" aria-label={t("Remove ticket type {name}", { name: type.name })} onClick={() => setTypes((items) => items.filter((x) => x.key !== type.key))}>
                      <Icon name="close" size={16} />
                    </button>
                  )}
                </div>
                <label>{t("Ticket name")}<input value={type.name} onChange={(e) => change(i, { name: e.target.value })} required minLength={2} maxLength={100} />
                </label>
                <label>{t("What's included")}<input value={type.description} onChange={(e) => change(i, { description: e.target.value })} maxLength={500} />
                </label>
                <div className="form-two">
                  <label>{t("Price · KZT")}<input type="number" min={0} max={10000000} value={type.price} onChange={(e) => change(i, { price: e.target.valueAsNumber || 0 })} required />
                    <span className="field-hint">{t("0 = free registration")}</span>
                  </label>
                  <label>{t("Quantity")}<input type="number" min={1} max={1000000} value={type.quantity} onChange={(e) => change(i, { quantity: e.target.valueAsNumber || 0 })} required />
                  </label>
                </div>
              </div>
            ))}
            <button
              className="btn btn-secondary"
              type="button"
              onClick={() => setTypes((items) => [...items, { key: `t${Date.now()}`, name: "", description: "", price: 0, quantity: 50 }])}
            >
              <Icon name="plus" size={16} />{t("Add ticket type")}</button>
          </div>
        </section>
      )}
      {error && <Notice error>{error}</Notice>}
      {message && <Notice>{message}</Notice>}
      <div className="editor-footer">
        <p>
          {existing
            ? t("Existing orders keep the price they were bought at.")
            : t("Your event starts as a draft. Publish it when you’re ready.")}
        </p>
        <button className="btn btn-primary" type="submit" disabled={busy}>
          {busy ? t("Saving…") : existing ? t("Save changes") : t("Create draft")}
          <Icon name="arrow" size={16} />
        </button>
      </div>
    </form>
  );
}

export function NewEventPage() {
  const t = useT();
  const gate = useOrganizerGate();
  if (!gate.ready) return <LoadingPage />;
  if (!gate.user) return <SignInFirst />;
  if (!gate.organizer) return <BecomeOrganizer />;
  return (
    <OrganizerShell active="events">
      <Link className="text-link muted back-link" href="/organizer">
        <Icon name="back" size={15} />{t("Your events")}</Link>
      <PageIntro
        eyebrow={t("From an idea to a full room")}
        title={t("Let’s put it on the calendar.")}
        description={t("Start with the essentials. The rest can take shape as you go.")}
      />
      {!gate.user.is_email_verified && (
        <Notice error>{t("Please confirm your email address before creating events.")}{" "}
          <Link className="text-link" href="/profile">{t("Resend the link")}</Link>
        </Notice>
      )}
      <EventEditor />
    </OrganizerShell>
  );
}

const TABS = [tk("Overview"), tk("Tickets"), tk("Paid sales"), tk("Promotions"), tk("Attendees"), tk("Sales"), tk("Team"), tk("Activity"), tk("Details")];

export type EventContext = {
  event: ApiEvent;
  role: StaffRole;
  reload: () => void;
  setEvent: (event: ApiEvent) => void;
  notify: (message: string, error?: boolean) => void;
};

export function ManageEventPage({ id, tab: initialTab }: { id: string; tab?: string }) {
  const t = useT();
  const gate = useOrganizerGate();
  const [tab, setTab] = useState(TABS.includes(initialTab ?? "") ? initialTab! : "Overview");
  const [notice, setNotice] = useState<{ text: string; error: boolean } | null>(null);
  const [saved, setSaved] = useState<ApiEvent | null>(null);
  const [version, setVersion] = useState(0);
  const data = useLoad(`${id}:${version}`, (signal) => api.request<ApiEvent>(`/events/${id}`, { signal }));
  const role = gate.staffEvents.find((e) => e.id === id)?.my_role as StaffRole | undefined;

  if (!gate.ready) return <LoadingPage />;
  if (!gate.user) return <SignInFirst />;
  if (data.status === "error" && !data.data)
    return (
      <OrganizerShell>
        <EmptyState
          title={t("This isn’t one of your events.")}
          description={data.httpStatus === 404 ? t("The event may have been removed, or the link is wrong.") : data.error.message}
          href="/organizer"
          label={t("Back to your events")}
        />
      </OrganizerShell>
    );
  const event = saved ?? data.data;
  if (!event) return <LoadingPage />;
  if (!role || !canManageRole(role))
    return (
      <OrganizerShell>
        <EmptyState
          title={t("This isn’t one of your events.")}
          description={t("Only the event's owner and managers can open its workspace. Check-in staff use the check-in desk.")}
          href={role ? "/check-in" : "/organizer"}
          label={role ? t("Open the check-in desk") : t("Back to your events")}
        />
      </OrganizerShell>
    );

  const ctx: EventContext = {
    event,
    role,
    reload: () => {
      setSaved(null);
      setVersion((v) => v + 1);
    },
    setEvent: setSaved,
    notify: (text, error = false) => setNotice({ text, error }),
  };
  const live = event.lifecycle === "upcoming" || event.lifecycle === "active";

  return (
    <OrganizerShell active="events">
      <Link className="text-link muted back-link" href="/organizer?view=events">
        <Icon name="back" size={15} />{t("Your events")}</Link>
      <div className="manage-title">
        <span className={`status-badge ${live ? "status-live" : ""}`}>{lifecycleLabel(event.lifecycle)}</span>
        <span>
          {eventDate(event.start_at, event.timezone, { weekday: "short", day: "numeric", month: "short" })} ·{" "}
          {eventTime(event.start_at, event.timezone)} · {event.city ?? t("City to be announced")}
          {event.is_suspended && t(" · suspended by the platform")}
        </span>
      </div>
      <PageIntro
        eyebrow={role === "owner" ? t("Your event · owner") : t("Your event · manager")}
        title={event.title}
        action={<EventActions ctx={ctx} />}
      />
      <div className="line-tabs manage-tabs">
        {TABS.map((key) => (
          <button
            aria-pressed={tab === key}
            className={tab === key ? "active" : ""}
            key={key}
            onClick={() => {
              setTab(key);
              setNotice(null);
            }}
          >
            {t(key)}
          </button>
        ))}
      </div>
      {notice && <Notice error={notice.error}>{notice.text}</Notice>}
      {tab === "Overview" && <OverviewTab ctx={ctx} />}
      {tab === "Tickets" && <TicketsTab ctx={ctx} />}
      {tab === "Paid sales" && <PaidSalesTab ctx={ctx} />}
      {tab === "Promotions" && <PromotionsTab ctx={ctx} />}
      {tab === "Attendees" && <AttendeesTab ctx={ctx} />}
      {tab === "Sales" && <SalesTab ctx={ctx} />}
      {tab === "Team" && <TeamTab ctx={ctx} />}
      {tab === "Activity" && <ActivityTab ctx={ctx} />}
      {tab === "Details" && <EventEditor existing={event} onSaved={ctx.setEvent} />}
      <div className="event-support-actions">
        <SupportLink eventId={event.id} platform label={t("Get platform support for this event")} />
      </div>
    </OrganizerShell>
  );
}

function EventActions({ ctx }: { ctx: EventContext }) {
  const t = useT();
  const { event, role } = ctx;
  const router = useRouter();
  const [busy, setBusy] = useState("");
  const [confirmCancel, setConfirmCancel] = useState(false);
  async function act(kind: string, path: string, done: string) {
    setBusy(kind);
    try {
      const next = await api.request<ApiEvent>(`/events/${event.id}/${path}`, { method: "POST" });
      if (kind === "duplicate") {
        await refreshSession();
        router.push(`/organizer/events/${next.id}?tab=Details`);
        return;
      }
      ctx.setEvent(next);
      await refreshSession();
      ctx.notify(done);
    } catch (e) {
      ctx.notify(failure(e), true);
    } finally {
      setBusy("");
      setConfirmCancel(false);
    }
  }
  const draft = event.status === "draft";
  const ended = event.lifecycle === "completed" || event.lifecycle === "cancelled";
  return (
    <div className="button-row">
      {event.status === "published" && (
        <Link className="btn btn-secondary" href={`/events/${event.id}`}>{t("View event")}{" "}<Icon name="external" size={14} />
        </Link>
      )}
      {draft && (
        <Link className="btn btn-secondary" href={`/events/${event.id}`}>{t("Preview")}</Link>
      )}
      {!ended && (
        <button
          className={`btn ${draft ? "btn-primary" : "btn-secondary"}`}
          disabled={!!busy}
          onClick={() =>
            draft
              ? act("publish", "publish", t("Your event is published."))
              : act("unpublish", "unpublish", t("Event unpublished. Existing orders are kept."))
          }
        >
          {busy === "publish" || busy === "unpublish" ? t("Saving…") : draft ? t("Publish event") : t("Unpublish")}
        </button>
      )}
      <button className="btn btn-secondary" disabled={!!busy} onClick={() => act("duplicate", "duplicate", "")}>
        {busy === "duplicate" ? t("Copying…") : t("Duplicate")}
      </button>
      {role === "owner" && !ended && event.status !== "draft" &&
        (confirmCancel ? (
          <span className="cancel-order">
            <span>{t("Cancel the event and refund every order?")}</span>
            <button className="text-button danger" disabled={!!busy} onClick={() => act("cancel", "cancel", t("Event cancelled. Paid orders were refunded (simulated) and ticket holders were emailed."))}>{t("Yes, cancel event")}</button>
            <button className="text-button" onClick={() => setConfirmCancel(false)}>{t("Keep it")}</button>
          </span>
        ) : (
          <button className="btn btn-secondary" onClick={() => setConfirmCancel(true)}>{t("Cancel event")}</button>
        ))}
    </div>
  );
}

export { price };
