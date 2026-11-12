"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import QRCode from "qrcode";
import {
  available,
  categories,
  dateLabel,
  money,
  placeOrder,
  isEventVisible,
  timeLabel,
  type Event,
} from "@/lib/demo-data";
import { useDemo } from "./demo-provider";
import { SupportLink } from "./support-pages";
import { EventReportForm } from "./event-report-form";
import { BackendCatalog } from "./backend-catalog";
import { CalendarActions, TicketExportActions } from "./event-utilities";
import {
  EmptyState,
  Gate,
  Icon,
  LoadingPage,
  Notice,
  PageIntro,
  Poster,
} from "./primitives";
import { useI18n, localeCodes } from "@/lib/i18n";

export function LandingEvents() {
  return <BackendCatalog compact />;
}

export function BrowsePage({
  query = "",
  category = "All events",
  city = "All cities",
  when = "any",
}: {
  query?: string;
  category?: string;
  city?: string;
  when?: string;
}) {
  const { t, locale } = useI18n();
  const { state } = useDemo();
  const [search, setSearch] = useState(query);
  const [selected, setSelected] = useState(
    categories.includes(category) ? category : "All events",
  );
  const [location, setLocation] = useState(city);
  const [date, setDate] = useState(when);
  const [sort, setSort] = useState("date");
  const [now] = useState(Date.now);
  const events = state.events
    .filter((e) => {
      const day = dateLabel(e.date, {
        day: undefined,
        month: undefined,
        weekday: "short",
      }, localeCodes[locale]);
      return (
        isEventVisible(state, e) &&
        new Date(e.date).getTime() > now &&
        (selected === "All events" || e.category === selected) &&
        (location === "All cities" || e.city === location) &&
        (date !== "weekend" || day === "Sun" || day === "Sat") &&
        `${e.title} ${e.venue} ${e.category}`
          .toLowerCase()
          .includes(search.toLowerCase())
      );
    })
    .sort((a, b) =>
      sort === "price"
        ? Math.min(...a.tickets.map((item) => item.price)) -
          Math.min(...b.tickets.map((item) => item.price))
        : a.date.localeCompare(b.date),
    );
  function reset() {
    setSearch("");
    setSelected("All events");
    setLocation("All cities");
    setDate("any");
  }
  return (
    <main className="workspace browse-page">
      <Notice>{t("These events use browser demo data.")}{" "}<Link href="/events">{t("Browse connected events")}</Link>.</Notice>
      <PageIntro
        eyebrow={t("Out of the ordinary. Into the city.")}
        title={t("Make a night of it.")}
        description={t("Big stages, small rooms, and everything worth showing up for.")}
        action={
          <span className="season-note">
            {t("The autumn edit")}{" "}<span>— 2026</span>
          </span>
        }
      />
      <div className="browse-search">
        <label className="search-input">
          <Icon name="search" />
          <span className="sr-only">{t("Search events, artists or venues")}</span>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t("An artist, a venue, a good idea…")}
          />
        </label>
        <label>
          <Icon name="pin" size={17} />
          <span className="sr-only">{t("City")}</span>
          <select
            value={location}
            onChange={(e) => setLocation(e.target.value)}
          >
            {["All cities", "Almaty", "Astana", "Shymkent"].map((c) => (
              <option key={c} value={c}>{t(c)}</option>
            ))}
          </select>
        </label>
        <label>
          <Icon name="calendar" size={17} />
          <span className="sr-only">{t("When")}</span>
          <select value={date} onChange={(e) => setDate(e.target.value)}>
            <option value="any">{t("Any date")}</option>
            <option value="weekend">{t("Weekends")}</option>
          </select>
        </label>
      </div>
      <div className="filter-row">
        <div className="filter-tabs" aria-label={t("Event categories")}>
          {categories.map((c) => (
            <button
              key={c}
              aria-pressed={selected === c}
              className={selected === c ? "active" : ""}
              onClick={() => setSelected(c)}
            >
              {t(c)}
            </button>
          ))}
        </div>
      </div>
      <div className="results-meta">
        <span>
          {events.length} {events.length === 1 ? t("event") : t("events")} {t("to look forward to")}</span>
        <label>
          {t("Sort by")}{" "}
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value)}
            aria-label={t("Sort events")}
          >
            <option value="date">{t("Soonest first")}</option>
            <option value="price">{t("Lowest price")}</option>
          </select>
        </label>
      </div>
      {events.length ? (
        <div className="event-grid">
          {events.map((event) => (
            <EventCard key={event.id} event={event} />
          ))}
        </div>
      ) : (
        <>
          <EmptyState
            icon="search"
            title={t("Nothing on the bill just yet.")}
            description={t("Try a different city, category, or search. A good night might be one filter away.")}
          />
          <button className="btn btn-secondary reset-filters" onClick={reset}>
            {t("Clear filters")}</button>
        </>
      )}
      <div className="organizer-invite">
        <div>
          <span className="eyebrow">{t("On the other side of the stage?")}</span>
          <h2>{t("Put your event on the map.")}</h2>
        </div>
        <Link className="btn btn-secondary" href="/organizer">
          {t("Meet your box office")}{" "}<Icon name="arrow" size={17} />
        </Link>
      </div>
    </main>
  );
}

function EventCard({ event }: { event: Event }) {
  const { t, locale } = useI18n();
  const { state } = useDemo();
  const remaining = event.tickets.reduce(
    (s, item) => s + available(state, event, item),
    0,
  );
  return (
    <Link href={`/events/${event.id}`} className="discovery-card">
      <Poster event={event} />
      <div className="discovery-info">
        <p className="event-kicker">
          {dateLabel(event.date, { weekday: "short" }, localeCodes[locale])} <span> / </span>{" "}
          {timeLabel(event.date, localeCodes[locale])}
        </p>
        <h2>{event.title}</h2>
        <p className="muted">
          {event.venue} · {event.city}
        </p>
        <div className="discovery-bottom">
          <strong>
            {remaining
              ? t(money(Math.min(...event.tickets.map((item) => item.price)), localeCodes[locale]))
              : t("Sold out")}
          </strong>
          <span>
            {Math.min(...event.tickets.map((item) => item.price)) === 0
              ? t("Register")
              : t("Get tickets")}
            <Icon name="arrow" size={16} />
          </span>
        </div>
      </div>
    </Link>
  );
}

function selectionFromString(raw?: string) {
  try {
    const parsed: unknown = JSON.parse(raw ?? "{}");
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed))
      return Object.fromEntries(
        Object.entries(parsed).filter(
          ([, v]) => Number.isInteger(v) && Number(v) >= 0 && Number(v) <= 8,
        ),
      ) as Record<string, number>;
  } catch {
    /* Invalid selection is handled as empty. */
  }
  return {};
}
export function EventPage({ id }: { id: string }) {
  const { t, locale } = useI18n();
  const { state, ready } = useDemo();
  const event = state.events.find(
    (e) => e.id === id && isEventVisible(state, e),
  );
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [now] = useState(Date.now);
  if (!ready) return <LoadingPage />;
  if (!event) return <MissingEvent />;
  const count = Object.values(quantities).reduce((s, q) => s + q, 0);
  const total = event.tickets.reduce(
    (s, item) => s + item.price * (quantities[item.id] ?? 0),
    0,
  );
  const past = new Date(event.date).getTime() <= now;
  return (
    <main className="workspace">
      <Notice>{t("This is a browser demo event.")}{" "}<Link href="/events">{t("Browse connected events")}</Link>.</Notice>
      <Link href="/events?source=demo" className="text-link muted back-link">
        <Icon name="back" size={15} />
        {t("All events")}</Link>
      <div className="event-detail-layout">
        <div className="event-story">
          <Poster event={event} />
          <div className="event-title-block">
            <p className="eyebrow">
              {event.category} <span> / </span> {event.city}
            </p>
            <h1>{event.title}</h1>
            <p className="event-subtitle">{event.subtitle}</p>
          </div>
          <div className="event-facts">
            <div>
              <Icon name="calendar" />
              <span>
                <strong>
                  {dateLabel(event.date, { weekday: "long", year: "numeric" }, localeCodes[locale])}
                </strong>
                <small>{timeLabel(event.date, localeCodes[locale])} {t("· Kazakhstan time")}</small>
              </span>
            </div>
            <div>
              <Icon name="pin" />
              <span>
                <strong>{event.venue}</strong>
                <small>{event.city}{t(", Kazakhstan")}</small>
              </span>
            </div>
          </div>
          <section className="event-about">
            <h2>{t("A little about the night")}</h2>
            <p>{event.description}</p>
            <div className="good-to-know">
              <span className="eyebrow">{t("Good to know")}</span>
              <p>
                {t("Keep your ticket handy at the door. Each ticket admits one person; every guest receives a separate ticket reference.")}</p>
            </div>
          </section>
          <CalendarActions event={{ id: event.id, title: event.title, startAt: event.date, venue: event.venue, address: event.city, description: event.description, status: event.status, url: `${typeof window === "undefined" ? "" : window.location.origin}/events/${event.id}` }} />
          <div className="host-line">
            <span className="avatar">
              {
                (state.profiles.find((p) => p.id === event.ownerId)?.name ??
                  "Organizer")[0]
              }
            </span>
            <div>
              <small>{t("Put together by")}</small>
              <p>
                {state.profiles.find((p) => p.id === event.ownerId)?.name ??
                  t("Independent organizer")}
              </p>
            </div>
          </div>
          <div className="event-support-actions">
            <SupportLink eventId={event.id} label={t("Ask about this event")} />
            <EventReportForm eventId={event.id} />
          </div>
        </div>
        <aside className="booking-panel">
          <div className="booking-heading">
            <span className="eyebrow">{t("Save your place")}</span>
            <Icon name="ticket" />
          </div>
          <h2>{t("See you there.")}</h2>
          <p className="muted">{t("Choose your tickets. Bring your people.")}</p>
          <div className="ticket-options">
            {event.tickets.map((item) => {
              const left = available(state, event, item);
              const disabled =
                past || !left || (item.price > 0 && !event.paidSales);
              const quantity = quantities[item.id] ?? 0;
              return (
                <div className="ticket-option" key={item.id}>
                  <div>
                    <strong>{item.name}</strong>
                    <p>{item.description}</p>
                    <small>
                      {!left
                        ? t("Sold out")
                        : item.price > 0 && !event.paidSales
                          ? t("Sales paused")
                          : t("Available: {count}", { count: left })}
                    </small>
                  </div>
                  <div className="ticket-option-bottom">
                    <span>{t(money(item.price, localeCodes[locale]))}</span>
                    <div className="quantity-control">
                      <button
                        disabled={!quantity}
                        onClick={() =>
                          setQuantities((q) => ({ ...q, [item.id]: quantity - 1 }))
                        }
                        aria-label={t("Remove one {name} ticket", { name: item.name })}
                      >
                        <Icon name="minus" size={14} />
                      </button>
                      <output aria-label={t("{name} quantity", { name: item.name })}>
                        {quantity}
                      </output>
                      <button
                        disabled={disabled || quantity >= Math.min(8, left)}
                        onClick={() =>
                          setQuantities((q) => ({ ...q, [item.id]: quantity + 1 }))
                        }
                        aria-label={t("Add one {name} ticket", { name: item.name })}
                      >
                        <Icon name="plus" size={14} />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
          <div className="booking-total">
            <span>
              {count} {count === 1 ? t("ticket") : t("tickets")}
            </span>
            <strong>{t(money(total, localeCodes[locale]))}</strong>
          </div>
          {count && !past ? (
            <Link
              className="btn btn-primary btn-full"
              href={`/checkout/${event.id}?tickets=${encodeURIComponent(JSON.stringify(quantities))}`}
            >
              {total ? t("Continue to checkout") : t("Register for free")}
              <Icon name="arrow" size={16} />
            </Link>
          ) : (
            <button className="btn btn-primary btn-full" disabled>
              {past ? t("This event has ended") : t("Choose your tickets")}
            </button>
          )}
          <p className="booking-footnote">
            {t("Demo bookings · no payment collected")}</p>
        </aside>
      </div>
    </main>
  );
}

export function CheckoutPage({
  id,
  tickets,
}: {
  id: string;
  tickets?: string;
}) {
  const { t, locale } = useI18n();
  const { state, user, ready, update } = useDemo();
  const router = useRouter();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [orderId] = useState(
    () => `TE-${globalThis.crypto?.randomUUID?.() ?? "draft"}`,
  );
  const event = state.events.find(
    (e) => e.id === id && isEventVisible(state, e),
  );
  if (!ready) return <LoadingPage />;
  if (!event) return <MissingEvent />;
  const quantities = selectionFromString(tickets);
  const lines = event.tickets.filter((item) => (quantities[item.id] ?? 0) > 0);
  const total = lines.reduce((s, item) => s + item.price * quantities[item.id], 0);
  if (!lines.length)
    return (
      <div className="workspace">
        <EmptyState
          title={t("Start with a ticket.")}
          description={t("Choose your ticket type and quantity before checking out.")}
          href={`/events/${id}`}
          label={t("Choose tickets")}
        />
      </div>
    );
  if (!user)
    return (
      <div className="workspace">
        <EmptyState
          title={t("Let’s put a name on your tickets.")}
          description={t("Open a demo profile to try booking tickets. Backend account sign-in is not available yet.")}
          href={`/sign-in?next=${encodeURIComponent(`/checkout/${id}?tickets=${encodeURIComponent(JSON.stringify(quantities))}`)}`}
          label={t("Continue to sign in")}
        />
      </div>
    );
  function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError("");
    const data = new FormData(e.currentTarget);
    try {
      update((s) =>
        placeOrder(
          s,
          id,
          quantities,
          { name: String(data.get("name")), email: String(data.get("email")) },
          orderId,
        ),
      );
      router.push(`/orders/${orderId}?confirmed=1`);
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : t("Something went wrong. Please try again."),
      );
      setBusy(false);
    }
  }
  return (
    <main className="workspace narrow-workspace">
      <Link className="text-link muted back-link" href={`/events/${id}`}>
        <Icon name="back" size={15} />
        {t("Back to tickets")}</Link>
      <PageIntro
        eyebrow={t("Your next good night")}
        title={t("Make it a date.")}
        description={t("A few details, and you’re on the list.")}
      />
      <div className="checkout-layout">
        <form className="checkout-form" onSubmit={submit}>
          <div className="section-heading">
            <span className="step-number">01</span>
            <h2>{t("Who's coming?")}</h2>
          </div>
          <div className="stack-form">
            <label>
              {t("Full name")}<input
                name="name"
                defaultValue={user.name}
                autoComplete="name"
                required
                maxLength={80}
              />
            </label>
            <label>
              {t("Email address")}<input
                name="email"
                defaultValue={user.email}
                type="email"
                autoComplete="email"
                required
                maxLength={200}
              />
              <span className="field-hint">
                {t("Your demo tickets will appear in My tickets. No email will be sent.")}</span>
            </label>
          </div>
          <div className="section-heading checkout-step">
            <span className="step-number">02</span>
            <h2>{total ? t("Demo checkout") : t("Free registration")}</h2>
          </div>
          <div className="payment-preview">
            <Icon name="ticket" size={25} />
            <div>
              <strong>
                {total ? t("A test run, on the house.") : t("Your place is free.")}
              </strong>
              <p>
                {total
                  ? t("The order total is {total}. This preview creates a demo order without charging you.", { total: t(money(total, localeCodes[locale])) })
                  : t("Confirm your details and we’ll save your free ticket in this browser.")}
              </p>
            </div>
          </div>
          <label className="checkbox-label">
            <input type="checkbox" required />{t("I understand this is a demo ticket, not valid for a real event.")}</label>
          {error && <Notice error>{error}</Notice>}
          <button className="btn btn-primary btn-full" disabled={busy}>
            {busy
              ? t("Saving your tickets…")
              : total
                ? t("Confirm demo booking")
                : t("Complete registration")}
            <Icon name="arrow" size={17} />
          </button>
        </form>
        <aside className="order-summary">
          <Poster event={event} compact />
          <div className="summary-body">
            <span className="eyebrow">{t("Your night, at a glance")}</span>
            <h2>{event.title}</h2>
            <p className="muted">
              {dateLabel(event.date, { weekday: "short" }, localeCodes[locale])} ·{" "}
              {timeLabel(event.date, localeCodes[locale])}
            </p>
            <p className="muted">
              {event.venue}, {event.city}
            </p>
            <div className="summary-lines">
              {lines.map((item) => (
                <div key={item.id}>
                  <span>
                    {quantities[item.id]} × {item.name}
                  </span>
                  <span>{t(money(item.price * quantities[item.id], localeCodes[locale]))}</span>
                </div>
              ))}
              <div>
                <span>{t("Booking fee")}</span>
                <span>{t(money(0, localeCodes[locale]))}</span>
              </div>
            </div>
            <div className="booking-total">
              <span>{t("Total · KZT")}</span>
              <strong>{t(money(total, localeCodes[locale]))}</strong>
            </div>
            <Link className="text-link" href={`/events/${id}`}>
              {t("Change tickets")}</Link>
          </div>
        </aside>
      </div>
    </main>
  );
}

export function OrdersPage() {
  const { t, locale } = useI18n();
  const { state, user, ready } = useDemo();
  const [tab, setTab] = useState("upcoming");
  const [now] = useState(Date.now);
  if (!ready) return <LoadingPage />;
  if (!user) return <Gate />;
  const orders = state.orders.filter(
    (o) =>
      o.userId === user.id &&
      (tab === "cancelled"
        ? o.status === "cancelled"
        : o.status === "confirmed" &&
          (tab === "upcoming"
            ? new Date(o.eventDate).getTime() >= now
            : new Date(o.eventDate).getTime() < now)),
  );
  return (
    <main className="workspace">
      <PageIntro
        eyebrow={t("Your plans, in one place")}
        title={t("Good nights ahead.")}
        description={t("The next chapter of your calendar, {name}.", { name: user.name.split(" ")[0] })}
        action={
          <Link className="btn btn-secondary" href="/events">
            {t("Find your next event")}{" "}<Icon name="arrow" size={16} />
          </Link>
        }
      />
      <div className="line-tabs">
        {["upcoming", "past", "cancelled"].map((item) => (
          <button
            key={item}
            className={tab === item ? "active" : ""}
            aria-pressed={tab === item}
            onClick={() => setTab(item)}
          >
            {item === "upcoming"
              ? t("Upcoming")
              : item === "past"
                ? t("Past events")
                : t("Cancelled")}
          </button>
        ))}
      </div>
      {orders.length ? (
        <div className="order-list">
          {orders.map((order) => {
            const event = state.events.find((e) => e.id === order.eventId);
            const count = order.lines.reduce((s, l) => s + l.quantity, 0);
            return (
              <article className="order-card" key={order.id}>
                {event && (
                  <Link href={`/orders/${order.id}`} className="order-poster">
                    <Poster event={event} compact />
                  </Link>
                )}
                <div className="order-card-body">
                  <div className="order-card-top">
                    <span
                      className={`status-badge ${order.status === "confirmed" ? "status-live" : ""}`}
                    >
                      {order.status === "confirmed"
                        ? t("Confirmed · demo")
                        : t("Cancelled")}
                    </span>
                    <span className="order-reference">
                      {order.id.slice(0, 16)}
                    </span>
                  </div>
                  <h2>
                    <Link href={`/orders/${order.id}`}>{order.eventTitle}</Link>
                  </h2>
                  <p className="muted">
                    {dateLabel(order.eventDate, { weekday: "short" }, localeCodes[locale])} ·{" "}
                    {timeLabel(order.eventDate, localeCodes[locale])}
                    <span className="dot-separator">·</span>
                    {order.venue}
                  </p>
                  <div className="order-card-bottom">
                    <span>
                      {count} {count === 1 ? t("ticket") : t("tickets")}
                      <span className="dot-separator">/</span>
                      {t(money(order.total, localeCodes[locale]))}
                    </span>
                    <Link className="text-link" href={`/orders/${order.id}`}>
                      {t("View order & tickets")}{" "}<Icon name="arrow" size={16} />
                    </Link>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      ) : (
        <EmptyState
          title={
            tab === "upcoming"
              ? t("Your calendar has room for a good night.")
              : tab === "past"
                ? t("The memories are still to come.")
                : t("No cancelled orders.")
          }
          description={
            tab === "upcoming"
              ? t("Pick an event you like. Your tickets will be waiting here.")
              : t("Orders in this category will appear here.")
          }
          href="/events"
          label={t("Explore events")}
        />
      )}
    </main>
  );
}

function qrPath(value: string) {
  const qr = QRCode.create(value, { errorCorrectionLevel: "M" });
  let path = "";
  for (let y = 0; y < qr.modules.size; y++)
    for (let x = 0; x < qr.modules.size; x++)
      if (qr.modules.get(y, x)) path += `M${x + 4},${y + 4}h1v1h-1z`;
  return { path, size: qr.modules.size + 8 };
}
export function OrderPage({
  id,
  confirmed,
}: {
  id: string;
  confirmed?: boolean;
}) {
  const { t, locale } = useI18n();
  const { state, user, ready } = useDemo();
  if (!ready) return <LoadingPage />;
  if (!user) return <Gate />;
  const order = state.orders.find((o) => o.id === id && o.userId === user.id);
  if (!order)
    return (
      <div className="workspace">
        <EmptyState
          title={t("We couldn’t find that order.")}
          description={t("It may belong to another demo profile. Your own tickets are one click away.")}
          href="/orders"
          label={t("My tickets")}
        />
      </div>
    );
  return (
    <main className="workspace narrow-workspace">
      <Link className="text-link muted back-link" href="/orders">
        <Icon name="back" size={15} />
        {t("All orders")}</Link>
      {confirmed && order.status === "confirmed" && (
        <div className="confirmation-banner">
          <span className="confirmation-check">
            <Icon name="check" size={24} />
          </span>
          <div>
            <span className="eyebrow">{t("You're on the list")}</span>
            <h2>{t("That's a night to look forward to.")}</h2>
            <p>
              {t("Your demo booking is confirmed. Save a ticket for everyone coming along.")}</p>
          </div>
        </div>
      )}
      <PageIntro
        eyebrow={t("Order / {id}", { id: order.id.slice(0, 16) })}
        title={order.eventTitle}
        description={`${dateLabel(order.eventDate, { weekday: "long", year: "numeric" }, localeCodes[locale])} · ${timeLabel(order.eventDate, localeCodes[locale])} · ${order.venue}, ${order.city}`}
      />
      <div className="order-detail-meta">
        <div>
          <small>{t("Booked by")}</small>
          <strong>{order.name}</strong>
          <span>{order.email}</span>
        </div>
        <div>
          <small>{t("Order total")}</small>
          <strong>{t(money(order.total, localeCodes[locale]))}</strong>
          <span>{dateLabel(order.createdAt, { year: "numeric" }, localeCodes[locale])}</span>
        </div>
        <span
          className={`status-badge ${order.status === "confirmed" ? "status-live" : ""}`}
        >
          {order.status === "confirmed" ? t("Confirmed · demo") : t("Cancelled")}
        </span>
      </div>
      <SupportLink eventId={order.eventId} orderId={order.id} label={t("Get help with this order")} />
      <CalendarActions event={{ id: order.eventId, title: state.events.find((event) => event.id === order.eventId)?.title ?? order.eventTitle, startAt: state.events.find((event) => event.id === order.eventId)?.date ?? order.eventDate, venue: state.events.find((event) => event.id === order.eventId)?.venue ?? order.venue, address: state.events.find((event) => event.id === order.eventId)?.city ?? order.city, url: `${typeof window === "undefined" ? "" : window.location.origin}/events/${order.eventId}` }} />
      {order.status === "cancelled" ? (
        <Notice>
          {t("This order was cancelled by the organizer. Its tickets are no longer valid.")}</Notice>
      ) : (
        <>
          <div className="section-heading tickets-section-heading">
            <h2>{t("Your tickets")}</h2>
            <span className="muted">{t("Each guest has their own reference.")}</span>
          </div>
          <div className="admission-grid">
            {order.lines.flatMap((line, lineIndex) =>
              line.admissions.map((admission, index) => {
                const qr = qrPath(admission.id);
                return (
                  <article className="admission-ticket" key={admission.id}>
                    <div className="admission-body">
                      <span className="eyebrow">{t("BILETFLOW / ADMIT ONE")}</span>
                      <h3>{line.name}</h3>
                      <p>
                        {order.name} {t("· Guest")}{" "}
                        {order.lines
                          .slice(0, lineIndex)
                          .reduce((sum, item) => sum + item.quantity, 0) +
                          index +
                          1}
                      </p>
                      <div className="admission-code">
                        <svg
                          width="115"
                          height="115"
                          viewBox={`0 0 ${qr.size} ${qr.size}`}
                          role="img"
                          aria-label={t("QR code for ticket {id}", { id: admission.id })}
                        >
                          <rect width="100%" height="100%" fill="#fff" />
                          <path d={qr.path} fill="#1a130d" />
                        </svg>
                        <span>
                          <strong>
                            {admission.checkedIn
                              ? t("Checked in")
                              : t("Ready for your night")}
                          </strong>
                          <small>
                            {t("Demo ticket")}<br />
                            {t("Not valid for a real event")}</small>
                        </span>
                      </div>
                      <code>{admission.id}</code>
                      <SupportLink eventId={order.eventId} orderId={order.id} ticketId={admission.id} label={t("Get help with this ticket")} />
                    </div>
                    <TicketExportActions order={order} admission={admission} ticketType={line.name} />
                  </article>
                );
              }),
            )}
          </div>
        </>
      )}
      <p className="order-note">
        {t("These tickets are part of the frontend preview. Orders are saved only in this browser.")}</p>
    </main>
  );
}
function MissingEvent() {
  const { t } = useI18n();
  return (
    <main className="workspace">
      <EmptyState
        title={t("This one isn’t on the bill.")}
        description={t("The event may be a draft, or the link may have changed.")}
        href="/events"
        label={t("See what’s on")}
      />
    </main>
  );
}
