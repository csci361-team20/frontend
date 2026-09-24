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
  timeLabel,
  type Admission,
  type Event,
  type Order,
} from "@/lib/demo-data";
import { useDemo } from "./demo-provider";
import {
  EmptyState,
  Gate,
  Icon,
  LoadingPage,
  Notice,
  PageIntro,
  Poster,
} from "./primitives";

export function LandingEvents() {
  const { state } = useDemo();
  const [now] = useState(Date.now);
  const events = state.events
    .filter((e) => e.status === "published" && new Date(e.date).getTime() > now)
    .slice(0, 6);
  return events.length ? (
    <div className="event-grid">
      {events.map((event) => (
        <EventCard key={event.id} event={event} />
      ))}
    </div>
  ) : (
    <EmptyState
      title="The next good night is taking shape."
      description="New events will appear here as soon as their organizers publish them."
    />
  );
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
      });
      return (
        e.status === "published" &&
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
        ? Math.min(...a.tickets.map((t) => t.price)) -
          Math.min(...b.tickets.map((t) => t.price))
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
      <PageIntro
        eyebrow="Out of the ordinary. Into the city."
        title="Make a night of it."
        description="Big stages, small rooms, and everything worth showing up for."
        action={
          <span className="season-note">
            The autumn edit <span>— 2026</span>
          </span>
        }
      />
      <div className="browse-search">
        <label className="search-input">
          <Icon name="search" />
          <span className="sr-only">Search events, artists or venues</span>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="An artist, a venue, a good idea…"
          />
        </label>
        <label>
          <Icon name="pin" size={17} />
          <span className="sr-only">City</span>
          <select
            value={location}
            onChange={(e) => setLocation(e.target.value)}
          >
            {["All cities", "Almaty", "Astana", "Shymkent"].map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
        </label>
        <label>
          <Icon name="calendar" size={17} />
          <span className="sr-only">When</span>
          <select value={date} onChange={(e) => setDate(e.target.value)}>
            <option value="any">Any date</option>
            <option value="weekend">Weekends</option>
          </select>
        </label>
      </div>
      <div className="filter-row">
        <div className="filter-tabs" aria-label="Event categories">
          {categories.map((c) => (
            <button
              key={c}
              aria-pressed={selected === c}
              className={selected === c ? "active" : ""}
              onClick={() => setSelected(c)}
            >
              {c}
            </button>
          ))}
        </div>
      </div>
      <div className="results-meta">
        <span>
          {events.length} {events.length === 1 ? "event" : "events"} to look
          forward to
        </span>
        <label>
          Sort by{" "}
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value)}
            aria-label="Sort events"
          >
            <option value="date">Soonest first</option>
            <option value="price">Lowest price</option>
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
            title="Nothing on the bill just yet."
            description="Try a different city, category, or search. A good night might be one filter away."
          />
          <button className="btn btn-secondary reset-filters" onClick={reset}>
            Clear filters
          </button>
        </>
      )}
      <div className="organizer-invite">
        <div>
          <span className="eyebrow">On the other side of the stage?</span>
          <h2>Put your event on the map.</h2>
        </div>
        <Link className="btn btn-secondary" href="/organizer">
          Meet your box office <Icon name="arrow" size={17} />
        </Link>
      </div>
    </main>
  );
}

function EventCard({ event }: { event: Event }) {
  const { state } = useDemo();
  const remaining = event.tickets.reduce(
    (s, t) => s + available(state, event, t),
    0,
  );
  return (
    <Link href={`/events/${event.id}`} className="discovery-card">
      <Poster event={event} />
      <div className="discovery-info">
        <p className="event-kicker">
          {dateLabel(event.date, { weekday: "short" })} <span> / </span>{" "}
          {timeLabel(event.date)}
        </p>
        <h2>{event.title}</h2>
        <p className="muted">
          {event.venue} · {event.city}
        </p>
        <div className="discovery-bottom">
          <strong>
            {remaining
              ? money(Math.min(...event.tickets.map((t) => t.price)))
              : "Sold out"}
          </strong>
          <span>
            {Math.min(...event.tickets.map((t) => t.price)) === 0
              ? "Register"
              : "Get tickets"}
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
  const { state, ready } = useDemo();
  const event = state.events.find(
    (e) => e.id === id && e.status === "published",
  );
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [now] = useState(Date.now);
  if (!ready) return <LoadingPage />;
  if (!event) return <MissingEvent />;
  const count = Object.values(quantities).reduce((s, q) => s + q, 0);
  const total = event.tickets.reduce(
    (s, t) => s + t.price * (quantities[t.id] ?? 0),
    0,
  );
  const past = new Date(event.date).getTime() <= now;
  return (
    <main className="workspace">
      <Link href="/events" className="text-link muted back-link">
        <Icon name="back" size={15} />
        All events
      </Link>
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
                  {dateLabel(event.date, { weekday: "long", year: "numeric" })}
                </strong>
                <small>{timeLabel(event.date)} · Kazakhstan time</small>
              </span>
            </div>
            <div>
              <Icon name="pin" />
              <span>
                <strong>{event.venue}</strong>
                <small>{event.city}, Kazakhstan</small>
              </span>
            </div>
          </div>
          <section className="event-about">
            <h2>A little about the night</h2>
            <p>{event.description}</p>
            <div className="good-to-know">
              <span className="eyebrow">Good to know</span>
              <p>
                Keep your ticket handy at the door. Each ticket admits one
                person; every guest receives a separate ticket reference.
              </p>
            </div>
          </section>
          <div className="host-line">
            <span className="avatar">
              {
                (state.profiles.find((p) => p.id === event.ownerId)?.name ??
                  "Organizer")[0]
              }
            </span>
            <div>
              <small>Put together by</small>
              <p>
                {state.profiles.find((p) => p.id === event.ownerId)?.name ??
                  "Independent organizer"}
              </p>
            </div>
          </div>
        </div>
        <aside className="booking-panel">
          <div className="booking-heading">
            <span className="eyebrow">Save your place</span>
            <Icon name="ticket" />
          </div>
          <h2>See you there.</h2>
          <p className="muted">Choose your tickets. Bring your people.</p>
          <div className="ticket-options">
            {event.tickets.map((t) => {
              const left = available(state, event, t);
              const disabled =
                past || !left || (t.price > 0 && !event.paidSales);
              const quantity = quantities[t.id] ?? 0;
              return (
                <div className="ticket-option" key={t.id}>
                  <div>
                    <strong>{t.name}</strong>
                    <p>{t.description}</p>
                    <small>
                      {!left
                        ? "Sold out"
                        : t.price > 0 && !event.paidSales
                          ? "Sales paused"
                          : `${left} available`}
                    </small>
                  </div>
                  <div className="ticket-option-bottom">
                    <span>{money(t.price)}</span>
                    <div className="quantity-control">
                      <button
                        disabled={!quantity}
                        onClick={() =>
                          setQuantities((q) => ({ ...q, [t.id]: quantity - 1 }))
                        }
                        aria-label={`Remove one ${t.name} ticket`}
                      >
                        <Icon name="minus" size={14} />
                      </button>
                      <output aria-label={`${t.name} quantity`}>
                        {quantity}
                      </output>
                      <button
                        disabled={disabled || quantity >= Math.min(8, left)}
                        onClick={() =>
                          setQuantities((q) => ({ ...q, [t.id]: quantity + 1 }))
                        }
                        aria-label={`Add one ${t.name} ticket`}
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
              {count} {count === 1 ? "ticket" : "tickets"}
            </span>
            <strong>{money(total)}</strong>
          </div>
          {count && !past ? (
            <Link
              className="btn btn-primary btn-full"
              href={`/checkout/${event.id}?tickets=${encodeURIComponent(JSON.stringify(quantities))}`}
            >
              {total ? "Continue to checkout" : "Register for free"}
              <Icon name="arrow" size={16} />
            </Link>
          ) : (
            <button className="btn btn-primary btn-full" disabled>
              {past ? "This event has ended" : "Choose your tickets"}
            </button>
          )}
          <p className="booking-footnote">
            Demo bookings · no payment collected
          </p>
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
  const { state, user, ready, update } = useDemo();
  const router = useRouter();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [orderId] = useState(
    () => `TE-${globalThis.crypto?.randomUUID?.() ?? "draft"}`,
  );
  const event = state.events.find(
    (e) => e.id === id && e.status === "published",
  );
  if (!ready) return <LoadingPage />;
  if (!event) return <MissingEvent />;
  const quantities = selectionFromString(tickets);
  const lines = event.tickets.filter((t) => (quantities[t.id] ?? 0) > 0);
  const total = lines.reduce((s, t) => s + t.price * quantities[t.id], 0);
  if (!lines.length)
    return (
      <div className="workspace">
        <EmptyState
          title="Start with a ticket."
          description="Choose your ticket type and quantity before checking out."
          href={`/events/${id}`}
          label="Choose tickets"
        />
      </div>
    );
  if (!user)
    return (
      <div className="workspace">
        <EmptyState
          title="Let’s put a name on your tickets."
          description="Sign in or create a demo profile to keep your tickets and orders together."
          href={`/sign-in?next=${encodeURIComponent(`/checkout/${id}?tickets=${encodeURIComponent(JSON.stringify(quantities))}`)}`}
          label="Continue to sign in"
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
          : "Something went wrong. Please try again.",
      );
      setBusy(false);
    }
  }
  return (
    <main className="workspace narrow-workspace">
      <Link className="text-link muted back-link" href={`/events/${id}`}>
        <Icon name="back" size={15} />
        Back to tickets
      </Link>
      <PageIntro
        eyebrow="Your next good night"
        title="Make it a date."
        description="A few details, and you’re on the list."
      />
      <div className="checkout-layout">
        <form className="checkout-form" onSubmit={submit}>
          <div className="section-heading">
            <span className="step-number">01</span>
            <h2>Who&apos;s coming?</h2>
          </div>
          <div className="stack-form">
            <label>
              Full name
              <input
                name="name"
                defaultValue={user.name}
                autoComplete="name"
                required
                maxLength={80}
              />
            </label>
            <label>
              Email address
              <input
                name="email"
                defaultValue={user.email}
                type="email"
                autoComplete="email"
                required
                maxLength={200}
              />
              <span className="field-hint">
                Your demo tickets will appear in My tickets. No email will be
                sent.
              </span>
            </label>
          </div>
          <div className="section-heading checkout-step">
            <span className="step-number">02</span>
            <h2>{total ? "Demo checkout" : "Free registration"}</h2>
          </div>
          <div className="payment-preview">
            <Icon name="ticket" size={25} />
            <div>
              <strong>
                {total ? "A test run, on the house." : "Your place is free."}
              </strong>
              <p>
                {total
                  ? `The order total is ${money(total)}. This preview creates a demo order without charging you.`
                  : "Confirm your details and we’ll save your free ticket in this browser."}
              </p>
            </div>
          </div>
          <label className="checkbox-label">
            <input type="checkbox" required />I understand this is a demo
            ticket, not valid for a real event.
          </label>
          {error && <Notice error>{error}</Notice>}
          <button className="btn btn-primary btn-full" disabled={busy}>
            {busy
              ? "Saving your tickets…"
              : total
                ? "Confirm demo booking"
                : "Complete registration"}
            <Icon name="arrow" size={17} />
          </button>
        </form>
        <aside className="order-summary">
          <Poster event={event} compact />
          <div className="summary-body">
            <span className="eyebrow">Your night, at a glance</span>
            <h2>{event.title}</h2>
            <p className="muted">
              {dateLabel(event.date, { weekday: "short" })} ·{" "}
              {timeLabel(event.date)}
            </p>
            <p className="muted">
              {event.venue}, {event.city}
            </p>
            <div className="summary-lines">
              {lines.map((t) => (
                <div key={t.id}>
                  <span>
                    {quantities[t.id]} × {t.name}
                  </span>
                  <span>{money(t.price * quantities[t.id])}</span>
                </div>
              ))}
              <div>
                <span>Booking fee</span>
                <span>{money(0)}</span>
              </div>
            </div>
            <div className="booking-total">
              <span>Total · KZT</span>
              <strong>{money(total)}</strong>
            </div>
            <Link className="text-link" href={`/events/${id}`}>
              Change tickets
            </Link>
          </div>
        </aside>
      </div>
    </main>
  );
}

export function OrdersPage() {
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
        eyebrow="Your plans, in one place"
        title="Good nights ahead."
        description={`The next chapter of your calendar, ${user.name.split(" ")[0]}.`}
        action={
          <Link className="btn btn-secondary" href="/events">
            Find your next event <Icon name="arrow" size={16} />
          </Link>
        }
      />
      <div className="line-tabs">
        {["upcoming", "past", "cancelled"].map((t) => (
          <button
            key={t}
            className={tab === t ? "active" : ""}
            aria-pressed={tab === t}
            onClick={() => setTab(t)}
          >
            {t === "upcoming"
              ? "Upcoming"
              : t === "past"
                ? "Past events"
                : "Cancelled"}
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
                        ? "Confirmed · demo"
                        : "Cancelled"}
                    </span>
                    <span className="order-reference">
                      {order.id.slice(0, 16)}
                    </span>
                  </div>
                  <h2>
                    <Link href={`/orders/${order.id}`}>{order.eventTitle}</Link>
                  </h2>
                  <p className="muted">
                    {dateLabel(order.eventDate, { weekday: "short" })} ·{" "}
                    {timeLabel(order.eventDate)}
                    <span className="dot-separator">·</span>
                    {order.venue}
                  </p>
                  <div className="order-card-bottom">
                    <span>
                      {count} {count === 1 ? "ticket" : "tickets"}
                      <span className="dot-separator">/</span>
                      {money(order.total)}
                    </span>
                    <Link className="text-link" href={`/orders/${order.id}`}>
                      View order & tickets <Icon name="arrow" size={16} />
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
              ? "Your calendar has room for a good night."
              : tab === "past"
                ? "The memories are still to come."
                : "No cancelled orders."
          }
          description={
            tab === "upcoming"
              ? "Pick an event you like. Your tickets will be waiting here."
              : "Orders in this category will appear here."
          }
          href="/events"
          label="Explore events"
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
const xml = (text: string) =>
  text.replace(
    /[<>&"']/g,
    (c) =>
      ({
        "<": "&lt;",
        ">": "&gt;",
        "&": "&amp;",
        '"': "&quot;",
        "'": "&apos;",
      })[c]!,
  );
function downloadTicket(order: Order, admission: Admission, type: string) {
  const qr = qrPath(admission.id);
  const title = order.eventTitle.match(/.{1,32}(?:\s|$)|.{1,32}/g) ?? [
    order.eventTitle,
  ];
  const content = `<svg xmlns="http://www.w3.org/2000/svg" width="720" height="980" viewBox="0 0 720 980"><rect width="720" height="980" rx="24" fill="#f1e7d4"/><g fill="#1a130d" font-family="Arial,sans-serif"><text x="48" y="66" font-size="28" font-weight="700">ticketelo.</text><text x="48" y="106" font-size="12" letter-spacing="2">DEMO TICKET — NOT VALID FOR ENTRY</text>${title
    .slice(0, 3)
    .map(
      (line, i) =>
        `<text x="48" y="${180 + i * 42}" font-size="32" font-weight="700">${xml(line.trim())}</text>`,
    )
    .join(
      "",
    )}<text x="48" y="330" font-size="20">${xml(dateLabel(order.eventDate, { weekday: "long", year: "numeric" }))} · ${timeLabel(order.eventDate)}</text><text x="48" y="370" font-size="20">${xml(order.venue)} · ${xml(order.city)}</text><text x="48" y="425" font-size="18">${xml(type)} · ${xml(order.name)}</text><path d="M24 470h672" stroke="#1a130d" stroke-dasharray="6 8"/><svg x="235" y="510" width="250" height="250" viewBox="0 0 ${qr.size} ${qr.size}"><rect width="100%" height="100%" fill="white"/><path d="${qr.path}" fill="#1a130d"/></svg><text x="360" y="800" text-anchor="middle" font-size="11">${xml(admission.id)}</text><text x="360" y="865" text-anchor="middle" font-size="16">One ticket. One guest. One good night.</text><text x="360" y="911" text-anchor="middle" font-size="12">Saved from the Ticketelo frontend demo.</text></g></svg>`;
  const url = URL.createObjectURL(
    new Blob([content], { type: "image/svg+xml" }),
  );
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `${admission.id}.svg`;
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export function OrderPage({
  id,
  confirmed,
}: {
  id: string;
  confirmed?: boolean;
}) {
  const { state, user, ready } = useDemo();
  if (!ready) return <LoadingPage />;
  if (!user) return <Gate />;
  const order = state.orders.find((o) => o.id === id && o.userId === user.id);
  if (!order)
    return (
      <div className="workspace">
        <EmptyState
          title="We couldn’t find that order."
          description="It may belong to another demo profile. Your own tickets are one click away."
          href="/orders"
          label="My tickets"
        />
      </div>
    );
  return (
    <main className="workspace narrow-workspace">
      <Link className="text-link muted back-link" href="/orders">
        <Icon name="back" size={15} />
        All orders
      </Link>
      {confirmed && order.status === "confirmed" && (
        <div className="confirmation-banner">
          <span className="confirmation-check">
            <Icon name="check" size={24} />
          </span>
          <div>
            <span className="eyebrow">You&apos;re on the list</span>
            <h2>That&apos;s a night to look forward to.</h2>
            <p>
              Your demo booking is confirmed. Save a ticket for everyone coming
              along.
            </p>
          </div>
        </div>
      )}
      <PageIntro
        eyebrow={`Order / ${order.id.slice(0, 16)}`}
        title={order.eventTitle}
        description={`${dateLabel(order.eventDate, { weekday: "long", year: "numeric" })} · ${timeLabel(order.eventDate)} · ${order.venue}, ${order.city}`}
      />
      <div className="order-detail-meta">
        <div>
          <small>Booked by</small>
          <strong>{order.name}</strong>
          <span>{order.email}</span>
        </div>
        <div>
          <small>Order total</small>
          <strong>{money(order.total)}</strong>
          <span>{dateLabel(order.createdAt, { year: "numeric" })}</span>
        </div>
        <span
          className={`status-badge ${order.status === "confirmed" ? "status-live" : ""}`}
        >
          {order.status === "confirmed" ? "Confirmed · demo" : "Cancelled"}
        </span>
      </div>
      {order.status === "cancelled" ? (
        <Notice>
          This order was cancelled by the organizer. Its tickets are no longer
          valid.
        </Notice>
      ) : (
        <>
          <div className="section-heading tickets-section-heading">
            <h2>Your tickets</h2>
            <span className="muted">Each guest has their own reference.</span>
          </div>
          <div className="admission-grid">
            {order.lines.flatMap((line, lineIndex) =>
              line.admissions.map((admission, index) => {
                const qr = qrPath(admission.id);
                return (
                  <article className="admission-ticket" key={admission.id}>
                    <div className="admission-body">
                      <span className="eyebrow">TICKET ELO / ADMIT ONE</span>
                      <h3>{line.name}</h3>
                      <p>
                        {order.name} · Guest{" "}
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
                          aria-label={`QR code for ticket ${admission.id}`}
                        >
                          <rect width="100%" height="100%" fill="#fff" />
                          <path d={qr.path} fill="#1a130d" />
                        </svg>
                        <span>
                          <strong>
                            {admission.checkedIn
                              ? "Checked in"
                              : "Ready for your night"}
                          </strong>
                          <small>
                            Demo ticket
                            <br />
                            Not valid for a real event
                          </small>
                        </span>
                      </div>
                      <code>{admission.id}</code>
                    </div>
                    <button
                      className="admission-download"
                      onClick={() =>
                        downloadTicket(order, admission, line.name)
                      }
                    >
                      <Icon name="download" size={17} />
                      Download ticket <span>SVG</span>
                    </button>
                  </article>
                );
              }),
            )}
          </div>
        </>
      )}
      <p className="order-note">
        These tickets are part of the frontend preview. Orders are saved only in
        this browser.
      </p>
    </main>
  );
}
function MissingEvent() {
  return (
    <main className="workspace">
      <EmptyState
        title="This one isn’t on the bill."
        description="The event may be a draft, or the link may have changed."
        href="/events"
        label="See what’s on"
      />
    </main>
  );
}
