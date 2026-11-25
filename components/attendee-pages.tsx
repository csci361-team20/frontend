"use client";

/**
 * Checkout, My tickets and the order page, backed by the BiletFlow API.
 * Payments are simulated by the backend: no card details are asked for.
 */

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import QRCode from "qrcode";
import { api } from "@/lib/api";
import {
  eventDate,
  eventTime,
  posterInfo,
  price,
  venueLine,
  zoneName,
  type ApiEvent,
  type TicketType,
} from "@/lib/events";
import {
  ORDER_STATUS_LABEL,
  TICKET_STATUS_LABEL,
  holdLeft,
  orderTab,
  parseSelection,
  ticketCount,
  type Order,
  type Quote,
  type Seat,
  type SeatMap,
  type Selection,
  type TicketDetail,
} from "@/lib/orders";
import { useSession } from "./session-provider";
import { SupportLink } from "./support-pages";
import { useLoad } from "./use-load";
import { EmptyState, Gate, Icon, LoadingPage, Notice, PageIntro, Poster } from "./primitives";
import { useT } from "@/components/language";

import { tk, tr } from "@/lib/i18n";
const failure = (error: unknown, fallback = tk("Something went wrong. Please try again.")) =>
  tr(error instanceof Error && error.message ? error.message : fallback);

const longDate = (iso: string, zone: string) =>
  `${eventDate(iso, zone, { weekday: "long", day: "numeric", month: "long", year: "numeric" })} · ${eventTime(iso, zone)}`;

function LoadFailed({ message, retry }: { message: string; retry: () => void }) {
  const t = useT();
  return (
    <main className="workspace">
      <Notice error>
        {message}{" "}
        <button className="text-link" onClick={retry}>{t("Try again")}</button>
      </Notice>
    </main>
  );
}

/* ------------------------------ checkout ------------------------------ */

type CheckoutData = { event: ApiEvent; tickets: TicketType[] };

export function CheckoutPage({
  id,
  tickets,
  seats,
  promo,
  link,
}: {
  id: string;
  tickets?: string;
  seats?: string;
  promo?: string;
  link?: string;
}) {
  const t = useT();
  const { user, ready } = useSession();
  const data = useLoad(`checkout-${id}`, async (signal) => {
    const [event, types] = await Promise.all([
      api.events.get(id, { signal }),
      api.events.ticketTypes(id, { signal }),
    ]);
    return { event, tickets: types } satisfies CheckoutData;
  });
  const back = `/checkout/${id}?${new URLSearchParams({
    ...(tickets ? { tickets } : {}),
    ...(seats ? { seats } : {}),
    ...(promo ? { promo } : {}),
    ...(link ? { link } : {}),
  })}`;

  if (data.status === "error" && data.httpStatus === 404) return <MissingEvent />;
  if (data.status === "error") return <LoadFailed message={data.error.message} retry={data.reload} />;
  if (!data.data || !ready) return <LoadingPage />;
  if (!user)
    return (
      <div className="workspace">
        <EmptyState
          title={t("Let’s put a name on your tickets.")}
          description={t("Sign in or create an account to book. Your tickets will wait for you in My tickets.")}
          href={`/sign-in?next=${encodeURIComponent(back)}`}
          label={t("Continue to sign in")}
        />
      </div>
    );
  return (
    <Checkout
      {...data.data}
      initial={parseSelection(tickets, seats)}
      initialPromo={promo ?? ""}
      promoToken={link}
      buyer={{ name: user.full_name, email: user.email }}
    />
  );
}

function Checkout({
  event,
  tickets,
  initial,
  initialPromo,
  promoToken,
  buyer,
}: CheckoutData & {
  initial: Selection;
  initialPromo: string;
  promoToken?: string;
  buyer: { name: string; email: string };
}) {
  const t = useT();
  const router = useRouter();
  const assigned = event.seating_type === "assigned";
  const [selection, setSelection] = useState<Selection>(initial);
  const [pickingSeats, setPickingSeats] = useState(assigned && !initial.seat_ids.length);
  const [promoInput, setPromoInput] = useState(initialPromo);
  const [promoCode, setPromoCode] = useState(initialPromo);
  const [quote, setQuote] = useState<Quote | null>(null);
  const [quoteError, setQuoteError] = useState("");
  const [nameGuests, setNameGuests] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const count = ticketCount(selection);
  const selectionKey = JSON.stringify(selection);

  // A promo link (?link=token) fills in its code
  useEffect(() => {
    if (!promoToken) return;
    api.events
      .promoLink(promoToken)
      .then((found) => {
        if (found.event_id === event.id) {
          setPromoInput(found.code);
          setPromoCode(found.code);
        }
      })
      .catch(() => setQuoteError(tr("That promo link is no longer valid.")));
  }, [promoToken, event.id]);

  // Prices come from the backend, including any discount
  useEffect(() => {
    if (!count || pickingSeats) return;
    let live = true;
    api.events
      .quote(event.id, JSON.parse(selectionKey) as Selection, promoCode)
      .then((result) => live && (setQuote(result), setQuoteError("")))
      .catch((e: unknown) => live && (setQuote(null), setQuoteError(failure(e))));
    return () => {
      live = false;
    };
  }, [event.id, selectionKey, promoCode, count, pickingSeats]);

  if (pickingSeats)
    return (
      <SeatPicker
        event={event}
        names={Object.fromEntries(tickets.map((t) => [t.id, t.name]))}
        chosen={selection.seat_ids}
        onDone={(seat_ids) => {
          setSelection({ items: [], seat_ids });
          setPickingSeats(false);
        }}
      />
    );

  if (!count)
    return (
      <div className="workspace">
        <EmptyState
          title={t("Start with a ticket.")}
          description={t("Choose your ticket type and quantity before checking out.")}
          href={`/events/${event.id}`}
          label={t("Choose tickets")}
        />
      </div>
    );

  const typeName = (ticketTypeId: string) =>
    tickets.find((t) => t.id === ticketTypeId)?.name ?? t("Ticket");
  const guestLabels = selection.seat_ids.length
    ? selection.seat_ids.map((_, i) => t("Seat {n0}", { n0: i + 1 }))
    : selection.items.flatMap((item) =>
        Array.from({ length: item.quantity }, (_, i) => `${typeName(item.ticket_type_id)} · guest ${i + 1}`),
      );
  const total = quote?.total_kzt ?? 0;

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (busy) return;
    const form = new FormData(e.currentTarget);
    const attendees = nameGuests
      ? guestLabels.map((_, i) => ({
          name: String(form.get(`guest-name-${i}`)).trim(),
          email: String(form.get(`guest-email-${i}`)).trim(),
        }))
      : undefined;
    setBusy(true);
    setError("");
    try {
      const order = await api.orders.create(event.id, selection, {
        promo_code: quote?.promo?.applied ? promoCode : undefined,
        attendees,
      });
      router.push(`/orders/${order.id}${order.status === "confirmed" ? "?confirmed=1" : ""}`);
    } catch (e) {
      setError(failure(e));
      setBusy(false);
    }
  }

  return (
    <main className="workspace narrow-workspace">
      <Link className="text-link muted back-link" href={`/events/${event.id}`}>
        <Icon name="back" size={15} />{t("Back to the event")}</Link>
      <PageIntro
        eyebrow={t("Your next good night")}
        title={t("Make it a date.")}
        description={t("Check the details, and you’re on the list.")}
      />
      <div className="checkout-layout">
        <form className="checkout-form" onSubmit={submit}>
          <div className="section-heading">
            <span className="step-number">01</span>
            <h2>{t("Who's coming?")}</h2>
          </div>
          <div className="stack-form">
            <p className="muted">{t("Booking as {name} ({email}). Tickets are sent to this email and appear in My tickets.", { name: buyer.name, email: buyer.email })}</p>
            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={nameGuests}
                onChange={(e) => setNameGuests(e.target.checked)}
              />{t("Put each guest's own name and email on their ticket")}</label>
            {nameGuests &&
              guestLabels.map((label, i) => (
                <fieldset className="guest-fields" key={label}>
                  <legend>{label}</legend>
                  <label>{t("Name")}<input
                      name={`guest-name-${i}`}
                      required
                      minLength={2}
                      maxLength={100}
                      defaultValue={i === 0 ? buyer.name : ""}
                    />
                  </label>
                  <label>{t("Email")}<input
                      name={`guest-email-${i}`}
                      type="email"
                      required
                      maxLength={200}
                      defaultValue={i === 0 ? buyer.email : ""}
                    />
                  </label>
                </fieldset>
              ))}
          </div>
          <div className="section-heading checkout-step">
            <span className="step-number">02</span>
            <h2>{t("Promo code")}</h2>
          </div>
          <div className="promo-row">
            <input
              aria-label={t("Promo code")}
              value={promoInput}
              maxLength={40}
              placeholder={t("Have a code?")}
              onChange={(e) => setPromoInput(e.target.value.toUpperCase())}
            />
            <button
              type="button"
              className="btn btn-secondary btn-small"
              onClick={() => setPromoCode(promoInput.trim())}
            >{t("Apply")}</button>
            {promoCode && (
              <button
                type="button"
                className="text-link"
                onClick={() => {
                  setPromoInput("");
                  setPromoCode("");
                }}
              >{t("Remove")}</button>
            )}
          </div>
          {quote?.promo && (
            <Notice error={!quote.promo.applied}>{quote.promo.message}</Notice>
          )}
          <div className="section-heading checkout-step">
            <span className="step-number">03</span>
            <h2>{total ? t("Payment") : t("Free registration")}</h2>
          </div>
          <div className="payment-preview">
            <Icon name="ticket" size={25} />
            <div>
              <strong>{total ? t("Payment is simulated.") : t("Your place is free.")}</strong>
              <p>
                {total
                  ? t("Your places are held for 10 minutes while you pay {price}. BiletFlow is a study project: no card details are taken and no money moves.", { price: price(total) })
                  : t("Confirm and your tickets are issued straight away.")}
              </p>
            </div>
          </div>
          {quoteError && <Notice error>{quoteError}</Notice>}
          {error && <Notice error>{error}</Notice>}
          <button className="btn btn-primary btn-full" disabled={busy || !quote}>
            {busy ? t("Reserving your places…") : total ? t("Continue to payment") : t("Complete registration")}
            <Icon name="arrow" size={17} />
          </button>
        </form>
        <aside className="order-summary">
          <Poster event={posterInfo(event)} compact />
          <div className="summary-body">
            <span className="eyebrow">{t("Your night, at a glance")}</span>
            <h2>{event.title}</h2>
            <p className="muted">{longDate(event.start_at, event.timezone)}</p>
            <p className="muted">{venueLine(event)}</p>
            <div className="summary-lines">
              {quote ? (
                <>
                  {quote.lines.map((line) => (
                    <div key={line.ticket_type_id}>
                      <span>
                        {line.quantity} × {line.name}
                      </span>
                      <span>{price(line.subtotal_kzt)}</span>
                    </div>
                  ))}
                  {quote.discount_kzt > 0 && (
                    <div>
                      <span>{t("Discount ({code})", { code: quote.promo?.code })}</span>
                      <span>−{price(quote.discount_kzt)}</span>
                    </div>
                  )}
                  <div>
                    <span>{t("Booking fee")}</span>
                    <span>₸0</span>
                  </div>
                </>
              ) : (
                <div>
                  <span>{quoteError ? t("Prices unavailable") : t("Working out prices…")}</span>
                </div>
              )}
            </div>
            <div className="booking-total">
              <span>{t("Total · KZT")}</span>
              <strong>{quote ? price(quote.total_kzt) : "—"}</strong>
            </div>
            {assigned ? (
              <button className="text-link" onClick={() => setPickingSeats(true)}>{t("Change seats")}</button>
            ) : (
              <Link className="text-link" href={`/events/${event.id}`}>{t("Change tickets")}</Link>
            )}
          </div>
        </aside>
      </div>
    </main>
  );
}

/* ------------------------------ seat map ------------------------------ */

function SeatPicker({
  event,
  names,
  chosen,
  onDone,
}: {
  event: ApiEvent;
  names: Record<string, string>;
  chosen: string[];
  onDone: (seatIds: string[]) => void;
}) {
  const t = useT();
  const [picked, setPicked] = useState<string[]>(chosen);
  const [refresh, setRefresh] = useState(0);
  const map = useLoad(`seats-${event.id}-${refresh}`, (signal) => api.events.seatMap(event.id, { signal }));

  // Keep availability current while choosing
  useEffect(() => {
    const timer = setInterval(() => setRefresh((n) => n + 1), 20_000);
    return () => clearInterval(timer);
  }, []);

  const seats = useMemo(() => {
    const all = new Map<string, Seat>();
    map.data?.sections.forEach((s) => s.rows.forEach((r) => r.seats.forEach((seat) => all.set(seat.id, seat))));
    return all;
  }, [map.data]);
  // Seats taken by someone else since they were picked drop out
  const stillFree = picked.filter((id) => !seats.size || seats.get(id)?.status === "available");
  const total = stillFree.reduce((s, id) => s + (seats.get(id)?.price_kzt ?? 0), 0);

  function toggle(seat: Seat) {
    if (seat.status !== "available") return;
    setPicked((current) =>
      current.includes(seat.id)
        ? current.filter((id) => id !== seat.id)
        : current.length >= 20
          ? current
          : [...current, seat.id],
    );
  }

  return (
    <main className="workspace">
      <Link className="text-link muted back-link" href={`/events/${event.id}`}>
        <Icon name="back" size={15} />{t("Back to the event")}</Link>
      <PageIntro
        eyebrow={map.data?.venue_name ?? t("Choose your seats")}
        title={t("Pick your seats.")}
        description={t("Tap a seat to choose it, tap again to let it go. Up to 20 seats per order.")}
      />
      {map.status === "error" && !map.data && (
        <Notice error>{map.error.message}</Notice>
      )}
      {!map.data ? (
        map.status !== "error" && <div className="skeleton skeleton-panel" />
      ) : (
        <SeatGrid map={map.data} names={names} picked={stillFree} onToggle={toggle} />
      )}
      <div className="seat-footer">
        <span>
          {t.plural(stillFree.length, "{n} seat", "{n} seats")} · {price(total)}
        </span>
        <button
          className="btn btn-primary"
          disabled={!stillFree.length}
          onClick={() => onDone(stillFree)}
        >{t("Continue with these seats")}{" "}<Icon name="arrow" size={16} />
        </button>
      </div>
    </main>
  );
}

function SeatGrid({
  map,
  names,
  picked,
  onToggle,
}: {
  map: SeatMap;
  names: Record<string, string>;
  picked: string[];
  onToggle: (seat: Seat) => void;
}) {
  const t = useT();
  const categories = [...new Set(map.sections.flatMap((s) => s.rows.flatMap((r) => r.seats.map((x) => x.category))))];
  const prices = new Map<string, number | null>();
  const labels = new Map<string, string>();
  map.sections.forEach((s) =>
    s.rows.forEach((r) =>
      r.seats.forEach((x) => {
        prices.set(x.category, x.price_kzt);
        if (x.ticket_type_id && names[x.ticket_type_id]) labels.set(x.category, names[x.ticket_type_id]);
      }),
    ),
  );
  return (
    <div className="seat-map">
      <div className="seat-stage">{t("Stage")}</div>
      <div className="seat-legend">
        {categories.map((c, i) => (
          <span key={c}>
            <i className={`seat seat-cat-${i % 4}`} /> {labels.get(c) ?? c} · {prices.get(c) != null ? price(prices.get(c)!) : "—"}
          </span>
        ))}
        <span>
          <i className="seat seat-taken" />{" "}{t("Taken")}</span>
        <span>
          <i className="seat seat-picked" />{" "}{t("Your choice")}</span>
      </div>
      {map.sections.map((section) => (
        <section key={section.name} className="seat-section" aria-label={section.name}>
          <h3>{section.name}</h3>
          {section.rows.map((row) => (
            <div className="seat-row" key={row.label}>
              <span className="seat-row-label">{row.label}</span>
              {row.seats.map((seat) => {
                const mine = picked.includes(seat.id);
                const cat = categories.indexOf(seat.category) % 4;
                return (
                  <button
                    key={seat.id}
                    type="button"
                    className={`seat seat-cat-${cat} ${mine ? "seat-picked" : ""} ${seat.status !== "available" ? "seat-taken" : ""}`}
                    disabled={seat.status !== "available"}
                    aria-pressed={mine}
                    aria-label={seat.label}
                    title={seat.label}
                    onClick={() => onToggle(seat)}
                  >
                    {seat.is_accessible ? "♿" : seat.number}
                  </button>
                );
              })}
            </div>
          ))}
        </section>
      ))}
    </div>
  );
}

/* ------------------------------ my tickets ------------------------------ */

type Tab = "upcoming" | "past" | "closed";

export function OrdersPage() {
  const t = useT();
  const { user, ready } = useSession();
  const [tab, setTab] = useState<Tab>("upcoming");
  const [now] = useState(Date.now);
  const data = useLoad(user ? `orders-${user.id}` : "orders-none", async (signal) => {
    if (!user) return { orders: [] as Order[], shared: [] as TicketDetail[] };
    const [orders, tickets] = await Promise.all([
      api.orders.mine({ signal }),
      api.tickets.mine({ signal }),
    ]);
    const own = new Set(orders.map((o) => o.id));
    return { orders, shared: tickets.filter((t) => !own.has(t.order_id)) };
  });
  if (!ready) return <LoadingPage />;
  if (!user) return <Gate />;
  if (data.status === "error") return <LoadFailed message={data.error.message} retry={data.reload} />;
  if (!data.data) return <LoadingPage />;
  const orders = data.data.orders.filter((o) => orderTab(o, now) === tab);
  const shared = data.data.shared.filter((t) =>
    tab === "closed"
      ? t.status === "cancelled" || t.status === "refunded"
      : t.status !== "cancelled" &&
        t.status !== "refunded" &&
        (new Date(t.event.end_at).getTime() >= now) === (tab === "upcoming"),
  );
  return (
    <main className="workspace">
      <PageIntro
        eyebrow={t("Your plans, in one place")}
        title={t("Good nights ahead.")}
        description={t("The next chapter of your calendar, {n0}.", { n0: user.full_name.split(" ")[0] })}
        action={
          <Link className="btn btn-secondary" href="/events">{t("Find your next event")}{" "}<Icon name="arrow" size={16} />
          </Link>
        }
      />
      <div className="line-tabs">
        {(["upcoming", "past", "closed"] as Tab[]).map((key) => (
          <button key={key} className={tab === key ? "active" : ""} aria-pressed={tab === key} onClick={() => setTab(key)}>
            {key === "upcoming" ? t("Upcoming") : key === "past" ? t("Past events") : t("Cancelled & refunded")}
          </button>
        ))}
      </div>
      {orders.length ? (
        <div className="order-list">
          {orders.map((order) => (
            <OrderCard key={order.id} order={order} now={now} />
          ))}
        </div>
      ) : (
        !shared.length && (
          <EmptyState
            title={
              tab === "upcoming"
                ? t("Your calendar has room for a good night.")
                : tab === "past"
                  ? t("The memories are still to come.")
                  : t("Nothing cancelled or refunded.")
            }
            description={
              tab === "upcoming"
                ? t("Pick an event you like. Your tickets will be waiting here.")
                : t("Orders in this category will appear here.")
            }
            href="/events"
            label={t("Explore events")}
          />
        )
      )}
      {shared.length > 0 && (
        <>
          <div className="section-heading tickets-section-heading">
            <h2>{t("Tickets in your name")}</h2>
            <span className="muted">{t("Booked for you by someone else.")}</span>
          </div>
          <div className="admission-grid">
            {shared.map((ticket) => (
              <TicketCard key={ticket.id} ticket={ticket} />
            ))}
          </div>
        </>
      )}
    </main>
  );
}

function OrderCard({ order, now }: { order: Order; now: number }) {
  const t = useT();
  const count = order.items.reduce((s, i) => s + i.quantity, 0);
  const hold = order.status === "pending" ? holdLeft(order.expires_at, now) : null;
  return (
    <article className="order-card">
      <div className="order-card-body">
        <div className="order-card-top">
          <span className={`status-badge ${order.status === "confirmed" ? "status-live" : ""}`}>
            {order.status === "pending" && !hold ? t("Hold ran out") : ORDER_STATUS_LABEL[order.status]}
          </span>
          <span className="order-reference">{order.id.slice(0, 8).toUpperCase()}</span>
        </div>
        <h2>
          <Link href={`/orders/${order.id}`}>{order.event_title}</Link>
        </h2>
        <p className="muted">{longDate(order.event_start_at, order.event_timezone)}</p>
        <div className="order-card-bottom">
          <span>
            {t.plural(count, "{n} ticket", "{n} tickets")}
            <span className="dot-separator">/</span>
            {price(order.total_kzt)}
          </span>
          <Link className="text-link" href={`/orders/${order.id}`}>
            {order.status === "pending" && hold ? t("Finish payment") : t("View order & tickets")}{" "}
            <Icon name="arrow" size={16} />
          </Link>
        </div>
      </div>
    </article>
  );
}

/* ------------------------------ one order ------------------------------ */

function useQr(value: string | null) {
  const [svg, setSvg] = useState("");
  useEffect(() => {
    if (!value) return;
    let live = true;
    QRCode.toString(value, { type: "svg", errorCorrectionLevel: "M", margin: 2 }).then(
      (text) => live && setSvg(text),
      () => live && setSvg(""),
    );
    return () => {
      live = false;
    };
  }, [value]);
  return value ? svg : "";
}

function TicketCard({ ticket }: { ticket: TicketDetail }) {
  const t = useT();
  const qr = useQr(ticket.qr_payload);
  const usable = ticket.status === "valid";
  return (
    <article className={`admission-ticket ${usable ? "" : "admission-closed"}`}>
      <div className="admission-body">
        <span className="eyebrow">{t("BILETFLOW / ADMIT ONE")}</span>
        <h3>{ticket.ticket_type_name}</h3>
        <p>
          {ticket.attendee_name}
          {ticket.seat && t(" · {section}, row {row}, seat {number}", { section: ticket.seat.section, row: ticket.seat.row, number: ticket.seat.number })}
        </p>
        <p className="muted">
          {ticket.event.title} · {eventDate(ticket.event.start_at, ticket.event.timezone, { day: "numeric", month: "short" })},{" "}
          {eventTime(ticket.event.start_at, ticket.event.timezone)}
        </p>
        <div className="admission-code">
          {qr ? (
            <span
              className="qr-box"
              role="img"
              aria-label={t("QR code for ticket {slice}", { slice: ticket.id.slice(0, 8) })}
              dangerouslySetInnerHTML={{ __html: qr }}
            />
          ) : (
            <span className="qr-box qr-empty" aria-hidden="true">
              <Icon name="ticket" size={30} />
            </span>
          )}
          <span>
            <strong>{TICKET_STATUS_LABEL[ticket.status]}</strong>
            <small>
              {usable ? t("Show this code at the door.") : t("This ticket can no longer be used for entry.")}
            </small>
          </span>
        </div>
        <code>{ticket.id.slice(0, 8).toUpperCase()}</code>
        <SupportLink
          eventId={ticket.event.id}
          orderId={ticket.order_id}
          ticketId={ticket.id}
          label={t("Get help with this ticket")}
        />
      </div>
      {usable && (
        <a className="admission-download" href={api.tickets.pdf(ticket.id)} download>
          <Icon name="download" size={17} />{t("Download ticket")}{" "}<span>{t("PDF")}</span>
        </a>
      )}
    </article>
  );
}

export function OrderPage({ id, confirmed }: { id: string; confirmed?: boolean }) {
  const t = useT();
  const { user, ready } = useSession();
  const [version, setVersion] = useState(0);
  const data = useLoad(user ? `order-${id}-${version}` : "order-none", async (signal) => {
    if (!user) return null;
    const order = await api.orders.get(id, { signal });
    const tickets =
      order.status === "confirmed" || order.tickets.length
        ? (await api.tickets.mine({ signal })).filter((t) => t.order_id === id)
        : [];
    return { order, tickets };
  });
  if (!ready) return <LoadingPage />;
  if (!user) return <Gate />;
  if (data.status === "error" && [403, 404, 422].includes(data.httpStatus))
    return (
      <div className="workspace">
        <EmptyState
          title={t("We couldn’t find that order.")}
          description={t("It may belong to another account. Your own tickets are one click away.")}
          href="/orders"
          label={t("My tickets")}
        />
      </div>
    );
  if (data.status === "error") return <LoadFailed message={data.error.message} retry={data.reload} />;
  if (!data.data) return <LoadingPage />;
  return (
    <OrderView
      key={version}
      {...data.data}
      confirmed={confirmed}
      isBuyer={data.data.order.user_id === user.id}
      onChange={() => setVersion((v) => v + 1)}
    />
  );
}

function OrderView({
  order,
  tickets,
  confirmed,
  isBuyer,
  onChange,
}: {
  order: Order;
  tickets: TicketDetail[];
  confirmed?: boolean;
  isBuyer: boolean;
  onChange: () => void;
}) {
  const t = useT();
  const [now, setNow] = useState(Date.now);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const pending = order.status === "pending";
  const hold = pending ? holdLeft(order.expires_at, now) : null;
  const free = order.total_kzt === 0;
  const upcoming = new Date(order.event_start_at).getTime() > now;
  const failedPayments = order.payments.filter((p) => p.status === "failed");

  // Count down the hold
  useEffect(() => {
    if (!pending) return;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [pending]);

  async function act(kind: string, action: () => Promise<unknown>, done?: string) {
    setBusy(kind);
    setError("");
    setNotice("");
    try {
      await action();
      if (done) setNotice(done);
      onChange();
    } catch (e) {
      setError(failure(e));
    } finally {
      setBusy("");
    }
  }

  return (
    <main className="workspace narrow-workspace">
      <Link className="text-link muted back-link" href="/orders">
        <Icon name="back" size={15} />{t("All orders")}</Link>
      {confirmed && order.status === "confirmed" && (
        <div className="confirmation-banner">
          <span className="confirmation-check">
            <Icon name="check" size={24} />
          </span>
          <div>
            <span className="eyebrow">{t("You're on the list")}</span>
            <h2>{t("That's a night to look forward to.")}</h2>
            <p>{t("Your tickets are below and on their way to your inbox.")}</p>
          </div>
        </div>
      )}
      <PageIntro
        eyebrow={t("Order / {toUpperCase}", { toUpperCase: order.id.slice(0, 8).toUpperCase() })}
        title={order.event_title}
        description={`${longDate(order.event_start_at, order.event_timezone)} · ${zoneName(order.event_timezone)}`}
      />
      {notice && <Notice>{notice}</Notice>}
      {error && <Notice error>{error}</Notice>}

      {pending && isBuyer && (
        <section className="payment-panel">
          {hold ? (
            <>
              <span className="eyebrow">{t("Places held for {hold}", { hold: hold })}</span>
              <h2>{t("Pay {price} to confirm.", { price: price(order.total_kzt) })}</h2>
              <p className="muted">{t("Payment is simulated: no card details are taken and no money moves. Choose how the test payment should end.")}</p>
              {failedPayments.length > 0 && (
                <Notice error>{t("The last payment attempt failed{n0}. Your places are still held.", { n0: failedPayments.at(-1)?.failure_reason ? `: ${failedPayments.at(-1)?.failure_reason}` : "" })}</Notice>
              )}
              <div className="button-row">
                <button
                  className="btn btn-primary"
                  disabled={!!busy}
                  onClick={() => act("pay", () => api.orders.pay(order.id), t("Payment received. Your tickets are ready."))}
                >
                  {busy === "pay" ? t("Paying…") : t("Pay now (simulated)")}
                </button>
                <button
                  className="btn btn-secondary"
                  disabled={!!busy}
                  onClick={() => act("fail", () => api.orders.pay(order.id, "failure"))}
                >{t("Simulate a declined card")}</button>
                <button
                  className="text-link"
                  disabled={!!busy}
                  onClick={() => act("cancel", () => api.orders.cancel(order.id), t("Checkout cancelled. The places were released."))}
                >{t("Cancel checkout")}</button>
              </div>
            </>
          ) : (
            <>
              <h2>{t("Your hold ran out.")}</h2>
              <p className="muted">{t("The places went back on sale. You can start again from the event page.")}</p>
              <Link className="btn btn-primary" href={`/events/${order.event_id}`}>{t("Back to the event")}</Link>
            </>
          )}
        </section>
      )}

      <div className="order-detail-meta">
        <div>
          <small>{t("Booked by")}</small>
          <strong>{order.buyer_name}</strong>
          <span>{order.buyer_email}</span>
        </div>
        <div>
          <small>{t("Order total")}</small>
          <strong>{price(order.total_kzt)}</strong>
          <span>
            {order.discount_kzt > 0 && t("{price} off with {promo_code} · ", { price: price(order.discount_kzt), promo_code: order.promo_code })}
            {eventDate(order.created_at, order.event_timezone, { day: "numeric", month: "short", year: "numeric" })}
          </span>
        </div>
        <span className={`status-badge ${order.status === "confirmed" ? "status-live" : ""}`}>
          {pending && !hold ? t("Hold ran out") : ORDER_STATUS_LABEL[order.status]}
        </span>
      </div>

      <div className="summary-lines order-lines">
        {order.items.map((item) => (
          <div key={item.id}>
            <span>
              {item.quantity} × {item.ticket_type_name}
              {item.seats?.length ? ` (${item.seats.join("; ")})` : ""}
            </span>
            <span>{price(item.subtotal_kzt)}</span>
          </div>
        ))}
      </div>

      {order.refund && (
        <Notice>
          {t("Refunded {price} on {eventDate}{n2}. The tickets are no longer valid.{n3}", {
            price: price(order.refund.amount_kzt),
            eventDate: eventDate(order.refund.created_at, order.event_timezone, { day: "numeric", month: "long" }),
            n2: order.refund.reason ? ` — ${order.refund.reason}` : "",
            n3: order.refund.is_simulated ? t(" (Simulated refund: no money moved.)") : "",
          })}
        </Notice>
      )}
      {order.status === "cancelled" && !order.refund && (
        <Notice>{t("This order was cancelled. Its tickets are no longer valid.")}</Notice>
      )}
      {order.status === "expired" && <Notice>{t("The checkout hold ran out before payment.")}</Notice>}

      <div className="button-row">
        <SupportLink eventId={order.event_id} orderId={order.id} label={t("Get help with this order")} />
        {order.status === "confirmed" && upcoming && order.calendar_links?.google && (
          <a className="btn btn-secondary" href={order.calendar_links.google} target="_blank" rel="noreferrer">
            <Icon name="calendar" size={16} />{" "}{t("Google Calendar")}</a>
        )}
        {order.status === "confirmed" && upcoming && (
          <a className="btn btn-secondary" href={api.events.calendarFile(order.event_id)} download>
            <Icon name="calendar" size={16} />{" "}{t("Calendar file")}</a>
        )}
        {order.status === "confirmed" && isBuyer && tickets.length > 1 && (
          <a className="btn btn-secondary" href={api.orders.pdf(order.id)} download>
            <Icon name="download" size={16} />{" "}{t("All tickets (PDF)")}</a>
        )}
      </div>

      {tickets.length > 0 && (
        <>
          <div className="section-heading tickets-section-heading">
            <h2>{t("Your tickets")}</h2>
            <span className="muted">{t("Each guest has their own QR code.")}</span>
          </div>
          <div className="admission-grid">
            {tickets.map((ticket) => (
              <TicketCard key={ticket.id} ticket={ticket} />
            ))}
          </div>
        </>
      )}

      {order.status === "confirmed" && isBuyer && upcoming && (
        <div className="order-note">
          {free ? (
            <details>
              <summary>{t("Can’t make it? Cancel this registration")}</summary>
              <form
                className="stack-form"
                onSubmit={(e) => {
                  e.preventDefault();
                  const reason = String(new FormData(e.currentTarget).get("reason") ?? "").trim();
                  void act("unregister", () => api.orders.cancelRegistration(order.id, reason), t("Your registration was cancelled."));
                }}
              >
                <label>{t("Reason (optional)")}<input name="reason" maxLength={500} />
                </label>
                <button className="btn btn-secondary" disabled={!!busy}>
                  {busy === "unregister" ? t("Cancelling…") : t("Cancel registration")}
                </button>
              </form>
            </details>
          ) : (
            <p>{t("Need a refund? Refunds for paid tickets are handled by the organizer.")}{" "}
              <Link className="text-link" href={`/support/new?event=${order.event_id}&order=${order.id}`}>{t("Ask for a refund")}</Link>
            </p>
          )}
        </div>
      )}
    </main>
  );
}

function MissingEvent() {
  const t = useT();
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
