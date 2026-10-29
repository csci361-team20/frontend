"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";
import { api, type ApiEvent, type ApiTicketType } from "@/lib/api";
import { CalendarActions } from "./event-utilities";
import { EmptyState, Icon, LoadingPage, Notice, PageIntro } from "./primitives";
import "./backend-catalog.css";
import { useI18n, localeCodes, type Locale } from "@/lib/i18n";

const PAGE_SIZE = 24;
const dateTime = (date: string, locale: Locale) => new Intl.DateTimeFormat(localeCodes[locale], locale === "kk"
  ? { timeZone: "Etc/GMT-5", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false }
  : { timeZone: "Etc/GMT-5", dateStyle: "medium", timeStyle: "short" }).format(new Date(date));
const money = (amount: number, locale: Locale) => new Intl.NumberFormat(localeCodes[locale], { style: "currency", currency: "KZT", maximumFractionDigits: 0 }).format(amount);

function phase(event: ApiEvent, now: number) {
  if (event.status === "cancelled") return "Cancelled";
  if (event.status === "draft") return "Draft";
  if (event.status === "completed" || Date.parse(event.end_at) <= now) return "Completed";
  return Date.parse(event.start_at) <= now ? "Active" : "Upcoming";
}

function EventCard({ event }: { event: ApiEvent }) {
  const { t, locale } = useI18n();
  const [now] = useState(Date.now);
  return <Link className="live-event-card" href={`/events/${event.id}`}>
    <div className="live-event-art" aria-hidden="true"><Icon name="ticket" size={52} /><span>{event.category || "BiletFlow"}</span></div>
    <div className="live-event-copy">
      <div className="live-event-meta"><span>{t(phase(event, now))}</span><span>{event.city || t("City to be announced")}</span></div>
      <h3>{event.title}</h3>
      <p><Icon name="calendar" size={16} />{dateTime(event.start_at, locale)}</p>
      <p><Icon name="pin" size={16} />{event.venue_name || t("Venue to be announced")}</p>
      <span className="live-event-link">{t("View event")}{" "}<Icon name="arrow" size={16} /></span>
    </div>
  </Link>;
}

export function BackendCatalog({ query = {}, compact = false }: { query?: Record<string, string>; compact?: boolean }) {
  const { t } = useI18n();
  const router = useRouter();
  const [now] = useState(Date.now);
  const [events, setEvents] = useState<ApiEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [page, setPage] = useState(0);
  const [more, setMore] = useState(false);
  const [retry, setRetry] = useState(0);
  const [search, setSearch] = useState(query.q ?? "");
  const [lifecycle, setLifecycle] = useState("Upcoming");
  const [sort, setSort] = useState("soonest");
  const city = query.city === "All cities" ? "" : query.city ?? "";
  const category = query.category === "All events" ? "" : query.category ?? "";

  useEffect(() => {
    const controller = new AbortController();
    api.events.list({ skip: page * PAGE_SIZE, limit: compact ? 6 : PAGE_SIZE, city, category }, { signal: controller.signal })
      .then((records) => {
        const visible = records.filter((event) => event.status === "published" && event.visibility === "public");
        setEvents((previous) => page === 0 ? visible : [...previous, ...visible.filter((event) => !previous.some((known) => known.id === event.id))]);
        setMore(records.length === PAGE_SIZE && !compact);
        setError("");
      })
      .catch((cause: unknown) => {
        if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : "Events could not be loaded.");
      })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [page, city, category, compact, retry]);

  const filtered = events.filter((event) => {
    const text = `${event.title} ${event.description ?? ""} ${event.venue_name ?? ""}`.toLocaleLowerCase();
    return text.includes(search.trim().toLocaleLowerCase()) && (lifecycle === "All dates" || (compact ? ["Upcoming", "Active"].includes(phase(event, now)) : phase(event, now) === lifecycle));
  }).sort((a, b) => sort === "latest" ? Date.parse(b.start_at) - Date.parse(a.start_at) : Date.parse(a.start_at) - Date.parse(b.start_at));

  function reload() { setLoading(true); setError(""); setRetry((value) => value + 1); }
  function filters(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const params = new URLSearchParams();
    for (const field of ["city", "category"]) {
      const value = String(form.get(field) ?? "").trim();
      if (value) params.set(field, value);
    }
    if (search.trim()) params.set("q", search.trim());
    router.push(`/events${params.size ? `?${params}` : ""}`);
  }

  const content = <>
    {!compact && <>
      <PageIntro eyebrow={t("Discover BiletFlow")} title={t("Find your next event.")} description={t("Published events from organizers, with dates and venues in one place.")} action={<Link href="/events?source=demo" className="text-link">{t("Explore the demo")}{" "}<Icon name="arrow" size={16} /></Link>} />
      <form className="live-filter-bar" onSubmit={filters}>
        <label>{t("Search loaded events")}<input value={search} onChange={(event) => setSearch(event.target.value)} type="search" placeholder={t("Event or venue")} /></label>
        <label>{t("City")}<input name="city" defaultValue={city} maxLength={100} placeholder={t("Any city")} /></label>
        <label>{t("Category")}<input name="category" defaultValue={category} maxLength={50} placeholder={t("Any category")} /></label>
        <button className="btn btn-primary" type="submit">{t("Apply filters")}</button>
      </form>
      <div className="live-filter-secondary">
        <label>{t("Dates")}<select value={lifecycle} onChange={(event) => setLifecycle(event.target.value)}>{["Upcoming", "Active", "Completed", "All dates"].map((value) => <option key={value} value={value}>{t(value)}</option>)}</select></label>
        <label>{t("Sort")}<select value={sort} onChange={(event) => setSort(event.target.value)}><option value="soonest">{t("Soonest first")}</option><option value="latest">{t("Latest first")}</option></select></label>
        <span role="status">{events.length} {t("events loaded · times in Kazakhstan (UTC+05:00)")}</span>
      </div>
    </>}
    {error && <div className="live-status"><Notice error>{error}</Notice><button className="btn btn-light" onClick={reload} disabled={loading}>{t("Try again")}</button><Link href="/events?source=demo" className="text-link">{t("Open demo events")}</Link></div>}
    {loading && events.length === 0 && <p className="live-status" role="status">{t("Loading events…")}</p>}
    {filtered.length > 0 && <div className="live-event-grid">{filtered.map((event) => <EventCard key={event.id} event={event} />)}</div>}
    {!loading && !error && filtered.length === 0 && <EmptyState icon="calendar" title={t("No matching events yet.")} description={events.length ? t("Change the search or date filters, or load more events.") : t("Try another city or category. New public events appear here when published.")} />}
    {!compact && more && !error && <div className="live-load-more"><p>{t("Search and date filters apply to the events loaded so far.")}</p><button className="btn btn-light" disabled={loading} onClick={() => { setLoading(true); setPage((value) => value + 1); }}>{loading ? t("Loading…") : t("Load more events")}</button></div>}
  </>;
  return compact ? <div className="live-catalog">{content}</div> : <main className="workspace live-catalog">{content}</main>;
}

export function BackendEventPage({ id }: { id: string }) {
  const { t, locale } = useI18n();
  const [now] = useState(Date.now);
  const [event, setEvent] = useState<ApiEvent | null>(null);
  const [tickets, setTickets] = useState<ApiTicketType[]>([]);
  const [error, setError] = useState("");
  const [ticketError, setTicketError] = useState("");
  const [loading, setLoading] = useState(true);
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    async function load() {
      try {
        const value = await api.events.get(id, { signal: controller.signal });
        if (controller.signal.aborted) return;
        setEvent(value);
        if (value.visibility !== "private" && value.status !== "draft") {
          try {
            const types = await api.ticketTypes.list(id, { signal: controller.signal });
            if (!controller.signal.aborted) { setTickets(types.filter((ticket) => ticket.event_id.toLowerCase() === value.id.toLowerCase() && !ticket.is_hidden)); setTicketError(""); }
          } catch (cause: unknown) {
            if (!controller.signal.aborted) setTicketError(cause instanceof Error ? cause.message : "Ticket types could not be loaded.");
          }
        }
        setError("");
      } catch (cause: unknown) {
        if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : "This event could not be loaded.");
      } finally { if (!controller.signal.aborted) setLoading(false); }
    }
    void load();
    return () => controller.abort();
  }, [id, retry]);

  function reload() { setLoading(true); setRetry((value) => value + 1); }
  if (loading && !event) return <LoadingPage />;
  if (error || !event) return <main className="workspace live-catalog"><PageIntro eyebrow="BiletFlow" title={t("Event unavailable")} /><Notice error>{error || t("This event could not be loaded.")}</Notice><button className="btn btn-light" onClick={reload} disabled={loading}>{t("Try again")}</button><Link href="/events" className="text-link">{t("Browse events")}</Link></main>;
  if (event.visibility === "private" || event.status === "draft") return <main className="workspace live-catalog"><EmptyState title={t("This event is not public.")} description={t("Private events and drafts can be opened in the organizer workspace using their event and organizer IDs.")} href="/workspace" label={t("Open organizer workspace")} /></main>;

  return <main className="workspace live-catalog">
    <Link href="/events" className="back-link"><Icon name="back" size={16} />{t("All events")}</Link>
    <div className="live-detail-header"><p className="eyebrow">{event.category || t("BiletFlow event")} · {t(phase(event, now))}</p><h1>{event.title}</h1><p>{dateTime(event.start_at, locale)} – {dateTime(event.end_at, locale)} {t("· Kazakhstan time (UTC+05:00)")}</p></div>
    {event.status === "cancelled" && <Notice error>{t("This event has been cancelled. Download the updated calendar file to record the cancellation.")}</Notice>}
    <div className="live-detail-grid">
      <section className="live-detail-content">
        <h2>{t("About the event")}</h2><p className="live-description">{event.description || t("The organizer has not added a description yet.")}</p>
        <h2>{t("Venue")}</h2><p>{event.venue_name || t("Venue to be announced")}</p>{event.venue_address && <p>{event.venue_address}</p>}{event.city && <p>{event.city}</p>}
        <h2>{t("Plan your visit")}</h2><dl className="live-facts"><div><dt>{t("Starts")}</dt><dd>{dateTime(event.start_at, locale)}</dd></div><div><dt>{t("Ends")}</dt><dd>{dateTime(event.end_at, locale)}</dd></div><div><dt>{t("Capacity")}</dt><dd>{event.capacity}</dd></div><div><dt>{t("Seating")}</dt><dd>{event.seating_type === "assigned" ? t("Assigned seating") : t("General admission")}</dd></div></dl>
        <CalendarActions event={{ id: event.id, title: event.title, startAt: event.start_at, endAt: event.end_at, venue: event.venue_name ?? undefined, address: [event.venue_address, event.city].filter(Boolean).join(", "), description: event.description ?? undefined, status: event.status, url: `${typeof window === "undefined" ? "" : window.location.origin}/events/${event.id}` }} />
      </section>
      <aside className="live-ticket-panel" aria-labelledby="live-ticket-title">
        <h2 id="live-ticket-title">{t("Ticket options")}</h2>
        {ticketError && <><Notice error>{ticketError}</Notice><button className="btn btn-light" onClick={reload} disabled={loading}>{t("Retry ticket types")}</button></>}
        {!ticketError && tickets.length === 0 && <p>{t("No ticket types have been announced.")}</p>}
        {tickets.map((ticket) => <TicketOption key={ticket.id} ticket={ticket} />)}
        <Notice>{t("Online booking is not available yet. No tickets have been reserved.")}</Notice>
        {event.seating_type === "assigned" && <p className="live-fine-print">{t("Seat selection is not available yet.")}</p>}
        <Link href="/events?source=demo" className="text-link">{t("Try booking in the demo")}{" "}<Icon name="arrow" size={16} /></Link>
      </aside>
    </div>
  </main>;
}

function TicketOption({ ticket }: { ticket: ApiTicketType }) {
  const { t, locale } = useI18n();
  const [now] = useState(Date.now);
  const closed = ticket.sale_end && Date.parse(ticket.sale_end) <= now;
  const upcoming = ticket.sale_start && Date.parse(ticket.sale_start) > now;
  return <div className="live-ticket-option"><div><h3>{ticket.name}</h3><strong>{ticket.price_kzt === 0 ? t("Free") : money(ticket.price_kzt, locale)}</strong></div>{ticket.description && <p>{ticket.description}</p>}<p>{t("Maximum")}{" "}{ticket.max_per_order} {t("per order")}</p>{ticket.sale_start && <p>{t("Sales open:")}{" "}{dateTime(ticket.sale_start, locale)}</p>}{ticket.sale_end && <p>{t("Sales close:")}{" "}{dateTime(ticket.sale_end, locale)}</p>}{closed ? <span>{t("Sales window ended")}</span> : upcoming ? <span>{t("Sales window has not started")}</span> : null}</div>;
}
