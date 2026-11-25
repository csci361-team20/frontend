"use client";

/** The tabs of an event's workspace (organizer-pages.tsx renders them). */

import Link from "next/link";
import { useState, type FormEvent } from "react";
import { api } from "@/lib/api";
import { downloadCsv } from "@/lib/csv";
import { eventDate, eventTime, posterInfo, price, type ApiEvent, type TicketType } from "@/lib/events";
import type { Order } from "@/lib/orders";
import {
  ROLE_LABELS,
  fromLocalInputs,
  toLocalInputs,
  type Activation,
  type ActivityEntry,
  type Analytics,
  type Attendee,
  type Campaign,
  type CheckInStats,
  type SalesSummary,
  type StaffMember,
  type TicketStats,
  type TicketTypeStats,
  type VenueLayout,
} from "@/lib/organizer";
import { amount, failure, Stat, type EventContext } from "./organizer-pages";
import { useLoad, type Loaded } from "./use-load";
import { EmptyState, Icon, LoadingPage, Notice, Poster } from "./primitives";
import { useT } from "@/components/language";

import { tk } from "@/lib/i18n";
function Loading<T>({ data, children }: { data: Loaded<T> & { reload: () => void }; children: (value: T) => React.ReactNode }) {
  const t = useT();
  if (data.status === "error" && !data.data)
    return (
      <Notice error>
        {data.error.message}{" "}
        <button className="text-link" onClick={data.reload}>{t("Try again")}</button>
      </Notice>
    );
  if (data.data === undefined) return <LoadingPage />;
  return <>{children(data.data)}</>;
}

const when = (iso: string, event: ApiEvent) =>
  `${eventDate(iso, event.timezone, { day: "numeric", month: "short", year: "numeric" })}, ${eventTime(iso, event.timezone)}`;

/* ------------------------------ Overview ------------------------------ */

export function OverviewTab({ ctx }: { ctx: EventContext }) {
  const t = useT();
  const { event } = ctx;
  const data = useLoad(`overview:${event.id}:${event.status}`, async (signal) => {
    const [stats, sales, checkin, activation, staff] = await Promise.all([
      api.request<TicketStats>(`/events/${event.id}/ticket-stats`, { signal }),
      api.request<SalesSummary>(`/events/${event.id}/sales`, { signal }),
      api.request<CheckInStats>(`/events/${event.id}/check-in/stats`, { signal }),
      api.request<Activation>(`/events/${event.id}/activation`, { signal }).catch(() => null),
      api.request<StaffMember[]>(`/events/${event.id}/staff`, { signal }).catch(() => [] as StaffMember[]),
    ]);
    return { stats, sales, checkin, activation, staff };
  });
  return (
    <Loading data={data}>
      {({ stats, sales, checkin, activation, staff }) => {
        const paid = stats.ticket_types.some((type) => type.price_kzt > 0);
        const checklist: [string, string, boolean][] = [
          [t("The event details"), t("A name, a date, and a place to be."), !!event.venue_name],
          [t("Your ticket types"), t.plural(stats.ticket_types.length, "{n} way to join.", "{n} ways to join."), stats.ticket_types.length > 0],
          [t("Published"), t("Let people discover your event."), event.status === "published"],
          ...(paid
            ? ([[t("Paid sales open"), t("Finish the activation checklist under Paid sales."), event.paid_sales_open]] as [string, string, boolean][])
            : []),
          [t("A team at the door"), t("Add check-in staff under Team."), staff.some((s) => s.role !== "owner")],
        ];
        return (
          <>
            <div className="stats-row">
              <Stat label={t("Gross sales")} value={amount(sales.gross_sales_kzt)} note={t("Estimated payout {amount} (simulated)", { amount: amount(sales.estimated_payout_kzt) })} icon="chart" />
              <Stat label={t("Tickets sold")} value={`${stats.totals.sold} / ${stats.totals.quantity}`} note={t("{available} available · {reserved} in checkouts", { available: stats.totals.available, reserved: stats.totals.reserved })} icon="ticket" />
              <Stat label={t("Through the door")} value={checkin.checked_in} note={t.plural(checkin.remaining, "{n} guest still to arrive", "{n} guests still to arrive")} icon="users" />
            </div>
            <div className="event-overview-grid">
              <div>
                <Poster event={posterInfo(event)} />
                <p className="muted overview-caption">
                  {[event.venue_name, event.city].filter(Boolean).join(" · ")} · {event.visibility}
                </p>
                <ImagesEditor ctx={ctx} />
              </div>
              <div className="launch-checklist">
                <h2>{t("Before the doors open")}</h2>
                <p className="muted">
                  {activation?.status === "suspended"
                    ? activation.suspension_reason ? t("Paid sales were suspended by the platform: {reason}.", { reason: activation.suspension_reason }) : t("Paid sales were suspended by the platform.")
                    : t("A few things to have in place.")}
                </p>
                {checklist.map(([title, description, done]) => (
                  <div className="checklist-item" key={title}>
                    <span className={done ? "done" : ""}>
                      <Icon name={done ? "check" : "minus"} size={14} />
                    </span>
                    <div>
                      <strong>{title}</strong>
                      <p>{description}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </>
        );
      }}
    </Loading>
  );
}

function ImagesEditor({ ctx }: { ctx: EventContext }) {
  const t = useT();
  const { event } = ctx;
  const [version, setVersion] = useState(0);
  const [busy, setBusy] = useState(false);
  const images = useLoad(`images:${event.id}:${version}`, (signal) =>
    api.request<{ id: string; url: string }[]>(`/events/${event.id}/images`, { signal }),
  );
  async function upload(file: File) {
    const form = new FormData();
    form.append("file", file);
    setBusy(true);
    try {
      await api.request(`/events/${event.id}/images`, { method: "POST", form });
      ctx.reload();
      setVersion((v) => v + 1);
      ctx.notify(t("Image added. The first image is the cover."));
    } catch (e) {
      ctx.notify(failure(e, t("Could not upload the image.")), true);
    } finally {
      setBusy(false);
    }
  }
  async function remove(id: string) {
    try {
      await api.request(`/events/${event.id}/images/${id}`, { method: "DELETE" });
      ctx.reload();
      setVersion((v) => v + 1);
    } catch (e) {
      ctx.notify(failure(e), true);
    }
  }
  return (
    <div className="image-editor">
      <div className="image-thumbs">
        {images.data?.map((image) => (
          <figure key={image.id}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={image.url.replace(/^(?:https?:\/\/[^/]+)?\/api\/v1/, "/api/backend")} alt="" />
            <button className="icon-button" aria-label={t("Remove image")} onClick={() => remove(image.id)}>
              <Icon name="close" size={14} />
            </button>
          </figure>
        ))}
      </div>
      <label className="btn btn-secondary btn-small">
        <Icon name="plus" size={14} /> {busy ? t("Uploading…") : t("Add an image")}
        <input
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="sr-only"
          disabled={busy}
          onChange={(e) => {
            const file = e.target.files?.[0];
            e.target.value = "";
            if (file) void upload(file);
          }}
        />
      </label>
      <p className="field-hint">{t("JPEG, PNG or WebP, up to 5 MB, 10 per event.")}</p>
    </div>
  );
}

/* ------------------------------ Tickets ------------------------------ */

export function TicketsTab({ ctx }: { ctx: EventContext }) {
  const t = useT();
  const { event } = ctx;
  const [version, setVersion] = useState(0);
  const [editing, setEditing] = useState<string | null>(null);
  const stats = useLoad(`ticket-stats:${event.id}:${version}`, (signal) =>
    api.request<TicketStats>(`/events/${event.id}/ticket-stats`, { signal }),
  );
  const refresh = () => setVersion((v) => v + 1);
  // Chosen on the new-event form (?seating=1) or with the button below; the
  // event only becomes "assigned" once a layout is saved
  const [wantSeats, setWantSeats] = useState(
    () => typeof window !== "undefined" && new URLSearchParams(window.location.search).get("seating") === "1",
  );
  const canSwitch = (stats.data?.ticket_types.length ?? 0) === 0 && (event.status === "draft" || event.status === "published");
  if (event.seating_type === "assigned" || (wantSeats && canSwitch))
    return (
      <SeatingSetup
        ctx={ctx}
        stats={stats.data}
        onDone={refresh}
        onCancel={event.seating_type === "assigned" ? undefined : () => setWantSeats(false)}
      />
    );
  return (
    <Loading data={stats}>
      {(s) => (
        <>
          <div className="ticket-types-list">
            {s.ticket_types.map((type) =>
              editing === type.id ? (
                <TicketTypeForm key={type.id} ctx={ctx} existing={type} onDone={() => { setEditing(null); refresh(); }} />
              ) : (
                <div className="ticket-type-row" key={type.id}>
                  <Icon name="ticket" size={24} />
                  <div>
                    <h3>
                      {type.name} {type.is_hidden && <small className="status-badge">{t("Hidden")}</small>}
                    </h3>
                    <p>
                      {type.description}
                      {type.sale_start && t(" · on sale from {when}", { when: when(type.sale_start, event) })}
                      {type.sale_end && t(" · until {when}", { when: when(type.sale_end, event) })}
                      {t(" · up to {max_per_order} per order", { max_per_order: type.max_per_order })}
                    </p>
                  </div>
                  <strong>{price(type.price_kzt)}</strong>
                  <span>
                    {t("{sold} sold · {reserved} held · {available} left of {quantity}", { sold: type.sold, reserved: type.reserved, available: type.available, quantity: type.quantity })}
                  </span>
                  <button className="text-button" onClick={() => setEditing(type.id)}>{t("Edit")}</button>
                </div>
              ),
            )}
          </div>
          <p className="muted">
            {t("{quantity} of {capacity} places assigned to ticket types.", { quantity: s.totals.quantity, capacity: s.capacity })}</p>
          {editing === "new" ? (
            <TicketTypeForm ctx={ctx} onDone={() => { setEditing(null); refresh(); }} />
          ) : (
            <div className="button-row">
              <button className="btn btn-secondary" onClick={() => setEditing("new")}>
                <Icon name="plus" size={16} />{" "}{t("Add ticket type")}</button>
              {canSwitch && (
                <button className="btn btn-secondary" onClick={() => setWantSeats(true)}>{t("Use numbered seats instead")}</button>
              )}
            </div>
          )}
        </>
      )}
    </Loading>
  );
}

function TicketTypeForm({ ctx, existing, onDone }: { ctx: EventContext; existing?: TicketTypeStats; onDone: () => void }) {
  const t = useT();
  const { event } = ctx;
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const start = toLocalInputs(existing?.sale_start);
  const end = toLocalInputs(existing?.sale_end);
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const d = new FormData(e.currentTarget);
    const text = (k: string) => String(d.get(k) ?? "").trim();
    const body = {
      name: text("name"),
      description: text("description") || null,
      price_kzt: Number(d.get("price")),
      quantity: Number(d.get("quantity")),
      max_per_order: Number(d.get("max_per_order")),
      sale_start: fromLocalInputs(text("start_date"), text("start_time") || "00:00"),
      sale_end: fromLocalInputs(text("end_date"), text("end_time") || "23:59"),
      is_hidden: d.get("is_hidden") === "on",
    };
    setBusy(true);
    setError("");
    try {
      if (existing) await api.request(`/ticket-types/${existing.id}`, { method: "PATCH", body });
      else await api.request(`/events/${event.id}/ticket-types`, { body });
      ctx.notify(existing ? t("Ticket type saved.") : t("Ticket type added."));
      onDone();
    } catch (err) {
      setError(failure(err));
    } finally {
      setBusy(false);
    }
  }
  async function remove() {
    if (!existing) return;
    setBusy(true);
    try {
      await api.request(`/ticket-types/${existing.id}`, { method: "DELETE" });
      ctx.notify(t("Ticket type removed."));
      onDone();
    } catch (err) {
      setError(failure(err));
      setBusy(false);
    }
  }
  return (
    <form className="ticket-type-form stack-form" onSubmit={submit}>
      <div className="form-two">
        <label>{t("Ticket name")}<input name="name" defaultValue={existing?.name} required minLength={2} maxLength={100} />
        </label>
        <label>{t("What's included")}{" "}<span className="optional">{t("Optional")}</span>
          <input name="description" defaultValue={existing?.description ?? ""} maxLength={500} />
        </label>
      </div>
      <div className="form-two">
        <label>{t("Price · KZT")}<input name="price" type="number" min={0} defaultValue={existing?.price_kzt ?? 0} required />
          {existing && existing.sold > 0 && <span className="field-hint">{t("Orders already placed keep their price")}</span>}
        </label>
        <label>{t("Quantity")}<input name="quantity" type="number" min={Math.max(1, (existing?.sold ?? 0) + (existing?.reserved ?? 0))} defaultValue={existing?.quantity ?? 50} required />
        </label>
      </div>
      <div className="form-two">
        <label>{t("Sales start")}{" "}<span className="optional">{t("Optional")}</span>
          <span className="form-inline">
            <input name="start_date" type="date" defaultValue={start.date} />
            <input name="start_time" type="time" defaultValue={start.time} />
          </span>
        </label>
        <label>{t("Sales end")}{" "}<span className="optional">{t("Optional")}</span>
          <span className="form-inline">
            <input name="end_date" type="date" defaultValue={end.date} />
            <input name="end_time" type="time" defaultValue={end.time} />
          </span>
        </label>
      </div>
      <div className="form-two">
        <label>{t("Most per order")}<input name="max_per_order" type="number" min={1} max={100} defaultValue={existing?.max_per_order ?? 10} required />
        </label>
        <label className="checkbox-label">
          <input name="is_hidden" type="checkbox" defaultChecked={existing?.is_hidden} />{" "}{t("Hidden (for guest lists and comps)")}</label>
      </div>
      {error && <Notice error>{error}</Notice>}
      <div className="button-row">
        <button className="btn btn-primary" disabled={busy}>{busy ? t("Saving…") : t("Save ticket type")}</button>
        <button type="button" className="btn btn-secondary" onClick={onDone}>{t("Cancel")}</button>
        {existing && existing.sold + existing.reserved === 0 && (
          <button type="button" className="text-button danger" onClick={remove} disabled={busy}>{t("Remove")}</button>
        )}
      </div>
    </form>
  );
}

function SeatingSetup({
  ctx,
  stats,
  onDone,
  onCancel,
}: {
  ctx: EventContext;
  stats?: TicketStats;
  onDone: () => void;
  onCancel?: () => void;
}) {
  const t = useT();
  const { event } = ctx;
  const layouts = useLoad("venue-layouts", (signal) => api.request<VenueLayout[]>("/venue-layouts", { signal }));
  const [venue, setVenue] = useState(event.venue_layout_id ?? "");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const chosen = layouts.data?.find((l) => l.id === (venue || layouts.data?.[0]?.id));
  const configured = !!event.venue_layout_id && (stats?.ticket_types.length ?? 0) > 0;
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!chosen) return;
    const d = new FormData(e.currentTarget);
    const categories = Object.keys(chosen.categories).map((c) => ({
      category: c,
      name: String(d.get(`name_${c}`)).trim(),
      price_kzt: Number(d.get(`price_${c}`)),
      max_per_order: Number(d.get(`max_${c}`)),
    }));
    setBusy(true);
    setError("");
    try {
      await api.request(`/events/${event.id}/seating`, { body: { venue_id: chosen.id, categories } });
      ctx.reload();
      onDone();
      ctx.notify(t("Seating saved. Each seat category is now a ticket type."));
    } catch (err) {
      setError(failure(err));
    } finally {
      setBusy(false);
    }
  }
  return (
    <section>
      <div className="section-heading">
        <div>
          <h2>{t("Numbered seats")}</h2>
          <p className="muted">{t("Choose the hall, then name and price each seat category. Guests pick their seats on a map.")}</p>
        </div>
      </div>
      {configured && stats && (
        <div className="ticket-types-list">
          {stats.ticket_types.map((type) => (
            <div className="ticket-type-row" key={type.id}>
              <Icon name="ticket" size={24} />
              <div>
                <h3>{type.name}</h3>
                <p>{t("Category {seat_category}", { seat_category: type.seat_category })}</p>
              </div>
              <strong>{price(type.price_kzt)}</strong>
              <span>
                {t("{sold} sold · {available} left of {quantity}", { sold: type.sold, available: type.available, quantity: type.quantity })}
              </span>
            </div>
          ))}
        </div>
      )}
      <Loading data={layouts}>
        {(list) =>
          list.length === 0 ? (
            <EmptyState title={t("No venue layouts yet.")} description={t("A platform admin adds halls with numbered seats.")} />
          ) : (
            <form className="stack-form" onSubmit={submit}>
              <label>{t("Venue")}<select value={chosen?.id} onChange={(e) => setVenue(e.target.value)} disabled={configured && (stats?.totals.sold ?? 0) > 0}>
                  {list.map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.name}
                      {l.city ? `, ${l.city}` : ""} · {t.plural(l.total_seats, "{n} seat", "{n} seats")}</option>
                  ))}
                </select>
              </label>
              {chosen &&
                Object.entries(chosen.categories).map(([category, seats]) => {
                  const current = stats?.ticket_types.find((type) => type.seat_category === category);
                  return (
                    <div className="form-three" key={`${chosen.id}-${category}`}>
                      <label>{t("Category {category}", { category })} · {t.plural(seats, "{n} seat", "{n} seats")}<input name={`name_${category}`} defaultValue={current?.name ?? t("Category {category}", { category: category })} required minLength={2} maxLength={100} />
                      </label>
                      <label>{t("Price · KZT")}<input name={`price_${category}`} type="number" min={0} defaultValue={current?.price_kzt ?? 5000} required />
                      </label>
                      <label>{t("Most per order")}<input name={`max_${category}`} type="number" min={1} max={20} defaultValue={current?.max_per_order ?? 10} required />
                      </label>
                    </div>
                  );
                })}
              {error && <Notice error>{error}</Notice>}
              <button className="btn btn-primary" disabled={busy}>
                {busy ? t("Saving…") : configured ? t("Update seating") : t("Set up seating")}
              </button>
              {onCancel && (
                <button type="button" className="btn btn-secondary" onClick={onCancel} disabled={busy}>{t("Use general admission instead")}</button>
              )}
            </form>
          )
        }
      </Loading>
    </section>
  );
}

/* ------------------------------ Paid sales ------------------------------ */

export function PaidSalesTab({ ctx }: { ctx: EventContext }) {
  const t = useT();
  const { event, role } = ctx;
  const [version, setVersion] = useState(0);
  const [busy, setBusy] = useState("");
  const data = useLoad(`activation:${event.id}:${version}`, (signal) =>
    api.request<Activation>(`/events/${event.id}/activation`, { signal }),
  );
  async function step(kind: string, path: string, body: unknown, done: string) {
    setBusy(kind);
    try {
      await api.request(`/events/${event.id}/activation/${path}`, { body });
      setVersion((v) => v + 1);
      if (kind === "activate") ctx.reload();
      ctx.notify(done);
    } catch (e) {
      ctx.notify(failure(e), true);
    } finally {
      setBusy("");
    }
  }
  return (
    <Loading data={data}>
      {(a) => (
        <section>
          <div className="sales-switch">
            <div>
              <span className="eyebrow">{t("Box office")}</span>
              <h2>{t("Paid ticket sales")}</h2>
              <p>
                {a.status === "active"
                  ? t("Paid sales are open. Guests can buy paid tickets (payments are simulated).")
                  : a.status === "suspended"
                    ? a.suspension_reason ? t("Suspended by the platform: {reason}. Contact platform support.", { reason: a.suspension_reason }) : t("Suspended by the platform. Contact platform support.")
                    : t("Free registration works now. Paid tickets open once every step below is done.")}
              </p>
            </div>
            <span className={`status-badge ${a.status === "active" ? "status-live" : ""}`}>{a.status}</span>
          </div>
          <div className="launch-checklist">
            {a.checklist.map((entry) => (
              <div className="checklist-item" key={entry.item}>
                <span className={entry.done ? "done" : ""}>
                  <Icon name={entry.done ? "check" : "minus"} size={14} />
                </span>
                <div>
                  <strong>{entry.label}</strong>
                  {!entry.done && (
                    <p>
                      {entry.item === "paid_ticket_type" && t("Add a ticket type with a price under Tickets.")}
                      {entry.item === "identity_verified" && (
                        <>{t("Submit your legal name and IIN/BIN on your organizer profile; the platform team confirms it.")}{" "}<Link className="text-link" href="/organizer?view=profile">{t("Open profile")}</Link></>
                      )}
                      {entry.item === "payout_account" && (
                        <>{t("Add the bank account for payouts on your organizer profile.")}{" "}<Link className="text-link" href="/organizer?view=profile">{t("Open profile")}</Link></>
                      )}
                      {entry.item === "activation_fee_paid" && (
                        <button className="btn btn-small btn-secondary" disabled={!!busy || role !== "owner"} onClick={() => step("fee", "pay-fee", { outcome: "success" }, t("Activation fee paid (simulated)."))}>
                          {busy === "fee" ? t("Paying…") : t("Pay the {amount} fee (simulated)", { amount: amount(a.fee_kzt) })}
                        </button>
                      )}
                      {entry.item === "terms_accepted" && (
                        <button className="btn btn-small btn-secondary" disabled={!!busy || role !== "owner"} onClick={() => step("terms", "accept-terms", { terms_version: a.terms_version }, t("Organizer terms accepted."))}>
                          {t("Accept the organizer terms ({terms_version})", { terms_version: a.terms_version })}</button>
                      )}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
          {a.status !== "active" && (
            <button
              className="btn btn-primary"
              disabled={!a.can_activate || !!busy || role !== "owner"}
              onClick={() => step("activate", "activate", {}, t("Paid sales are open."))}
            >
              {busy === "activate" ? t("Opening…") : t("Open paid sales")}
            </button>
          )}
          {role !== "owner" && <p className="field-hint">{t("Only the event owner can pay the fee, accept the terms and open paid sales.")}</p>}
        </section>
      )}
    </Loading>
  );
}

/* ------------------------------ Promotions ------------------------------ */

export function PromotionsTab({ ctx }: { ctx: EventContext }) {
  const t = useT();
  const { event } = ctx;
  const [version, setVersion] = useState(0);
  const [adding, setAdding] = useState(false);
  const data = useLoad(`campaigns:${event.id}:${version}`, async (signal) => {
    const [campaigns, types] = await Promise.all([
      api.request<Campaign[]>(`/events/${event.id}/campaigns`, { signal }),
      api.request<TicketType[]>(`/events/${event.id}/ticket-types`, { signal, query: { include_hidden: true } }),
    ]);
    return { campaigns, types };
  });
  async function toggle(c: Campaign) {
    try {
      await api.request(`/events/${event.id}/campaigns/${c.id}`, { method: "PATCH", body: { is_active: !c.is_active } });
      setVersion((v) => v + 1);
    } catch (e) {
      ctx.notify(failure(e), true);
    }
  }
  async function create(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const d = new FormData(e.currentTarget);
    const text = (k: string) => String(d.get(k) ?? "").trim();
    try {
      await api.request(`/events/${event.id}/campaigns`, {
        body: {
          name: text("name"),
          code: text("code") || null,
          discount_type: text("discount_type"),
          discount_value: Number(d.get("discount_value")),
          max_redemptions: text("max_redemptions") ? Number(text("max_redemptions")) : null,
          starts_at: fromLocalInputs(text("start_date"), "00:00"),
          ends_at: fromLocalInputs(text("end_date"), "23:59"),
          ticket_type_ids: d.getAll("ticket_type_ids").map(String),
        },
      });
      setAdding(false);
      setVersion((v) => v + 1);
      ctx.notify(t("Promo campaign created."));
    } catch (err) {
      ctx.notify(failure(err), true);
    }
  }
  return (
    <Loading data={data}>
      {({ campaigns, types }) => (
        <section>
          <div className="section-heading">
            <div>
              <h2>{t("Promo codes and links")}</h2>
              <p className="muted">{t("Each campaign has a code, a shareable link and a QR code for posters.")}</p>
            </div>
            {!adding && (
              <button className="btn btn-secondary" onClick={() => setAdding(true)}>
                <Icon name="plus" size={16} />{" "}{t("New campaign")}</button>
            )}
          </div>
          {adding && (
            <form className="stack-form" onSubmit={create}>
              <div className="form-two">
                <label>{t("Campaign name")}<input name="name" required minLength={2} maxLength={100} placeholder={t("Student night")} />
                </label>
                <label>{t("Code")}{" "}<span className="optional">{t("Leave empty to generate one")}</span>
                  <input name="code" maxLength={32} pattern="[A-Za-z0-9_-]*" placeholder="STUDENT20" />
                </label>
              </div>
              <div className="form-three">
                <label>{t("Discount")}<select name="discount_type" defaultValue="percent">
                    <option value="percent">{t("Percent off")}</option>
                    <option value="fixed">{t("Tenge off per order")}</option>
                  </select>
                </label>
                <label>{t("Amount")}<input name="discount_value" type="number" min={1} defaultValue={10} required />
                </label>
                <label>{t("Uses")}{" "}<span className="optional">{t("Optional")}</span>
                  <input name="max_redemptions" type="number" min={1} />
                </label>
              </div>
              <div className="form-two">
                <label>{t("From")}{" "}<span className="optional">{t("Optional")}</span>
                  <input name="start_date" type="date" />
                </label>
                <label>{t("Until")}{" "}<span className="optional">{t("Optional")}</span>
                  <input name="end_date" type="date" />
                </label>
              </div>
              <fieldset className="checkbox-group">
                <legend>{t("Applies to (none ticked = every ticket type)")}</legend>
                {types.map((type) => (
                  <label key={type.id} className="checkbox-label">
                    <input type="checkbox" name="ticket_type_ids" value={type.id} /> {type.name} · {price(type.price_kzt)}
                  </label>
                ))}
              </fieldset>
              <div className="button-row">
                <button className="btn btn-primary">{t("Create campaign")}</button>
                <button type="button" className="btn btn-secondary" onClick={() => setAdding(false)}>{t("Cancel")}</button>
              </div>
            </form>
          )}
          {campaigns.length ? (
            <div className="table-scroll">
              <table className="sales-table">
                <thead>
                  <tr>
                    <th>{t("Campaign")}</th>
                    <th>{t("Discount")}</th>
                    <th>{t("Used")}</th>
                    <th>{t("Net revenue")}</th>
                    <th>{t("Share")}</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {campaigns.map((c) => (
                    <tr key={c.id}>
                      <td>
                        <strong>{c.name}</strong>
                        <small>
                          <code>{c.code}</code> {c.is_active ? "" : t("· paused")}
                        </small>
                      </td>
                      <td>{c.discount_label}</td>
                      <td>
                        {c.stats.redemptions}
                        {c.max_redemptions ? ` / ${c.max_redemptions}` : ""}
                      </td>
                      <td>{amount(c.stats.net_revenue_kzt)}</td>
                      <td>
                        <button className="text-link" onClick={() => void navigator.clipboard?.writeText(c.link_url).then(() => ctx.notify(t("Link copied.")))}>{t("Copy link")}</button>{" "}
                        · <a className="text-link" href={`/api/backend/events/${event.id}/campaigns/${c.id}/qr.png`} download>{t("QR code")}</a>
                      </td>
                      <td>
                        <button className="text-button" onClick={() => toggle(c)}>{c.is_active ? t("Pause") : t("Resume")}</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            !adding && <EmptyState icon="ticket" title={t("No campaigns yet.")} description={t("Create a code for students, early birds or partners.")} />
          )}
        </section>
      )}
    </Loading>
  );
}

/* ------------------------------ Attendees ------------------------------ */

const TICKET_STATUS: Record<Attendee["status"], string> = {
  valid: tk("Not arrived"),
  checked_in: tk("Checked in"),
  cancelled: tk("Cancelled"),
  refunded: tk("Refunded"),
};

export function AttendeesTab({ ctx }: { ctx: EventContext }) {
  const t = useT();
  const { event, role } = ctx;
  const [version, setVersion] = useState(0);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");
  const [refunding, setRefunding] = useState<string | null>(null);
  const data = useLoad(`attendees:${event.id}:${version}`, async (signal) => {
    const [attendees, orders] = await Promise.all([
      api.request<Attendee[]>(`/events/${event.id}/attendees`, { signal }),
      api.request<Order[]>(`/events/${event.id}/orders`, { signal }),
    ]);
    return { attendees, orders };
  });
  async function admit(ticketId: string) {
    try {
      const result = await api.request<{ admitted: boolean; message: string }>(`/events/${event.id}/check-in/tickets/${ticketId}`, { method: "POST" });
      ctx.notify(result.message, !result.admitted);
      setVersion((v) => v + 1);
    } catch (e) {
      ctx.notify(failure(e), true);
    }
  }
  async function refund(e: FormEvent<HTMLFormElement>, orderId: string) {
    e.preventDefault();
    const reason = String(new FormData(e.currentTarget).get("reason")).trim();
    try {
      await api.request(`/orders/${orderId}/refund`, { body: { reason } });
      setRefunding(null);
      setVersion((v) => v + 1);
      ctx.notify(t("Order refunded in full (simulated). The buyer was emailed."));
    } catch (err) {
      ctx.notify(failure(err), true);
    }
  }
  return (
    <Loading data={data}>
      {({ attendees, orders }) => {
        const q = search.toLowerCase();
        const visible = attendees.filter(
          (a) =>
            (filter === "all" || a.status === filter) &&
            `${a.attendee_name} ${a.attendee_email} ${a.ticket_id} ${a.order_id} ${a.seat ?? ""}`.toLowerCase().includes(q),
        );
        const paidOrders = orders.filter((o) => o.status === "confirmed" && o.total_kzt > 0);
        return (
          <section>
            <div className="section-heading">
              <div>
                <h2>{t("The guest list")}</h2>
                <p className="muted">{t("One ticket, one check-in. Search by name, email, seat or ticket reference.")}</p>
              </div>
              <button
                className="btn btn-secondary btn-small"
                onClick={() =>
                  downloadCsv(`attendees-${event.id.slice(0, 8)}.csv`, [
                    [t("Ticket"), t("Order"), t("Name"), t("Email"), t("Ticket type"), t("Seat"), t("Status"), t("Checked in at")],
                    ...attendees.map((a) => [a.ticket_id, a.order_id, a.attendee_name, a.attendee_email, a.ticket_type_name, a.seat ?? "", t(TICKET_STATUS[a.status]), a.checked_in_at ?? ""]),
                  ])
                }
              >
                <Icon name="download" size={14} />{" "}{t("Export CSV")}</button>
            </div>
            <div className="attendee-filters">
              <label className="search-input">
                <Icon name="search" size={17} />
                <input aria-label={t("Search attendees")} value={search} onChange={(e) => setSearch(e.target.value)} placeholder={t("Name, email, seat or ticket reference")} />
              </label>
              <select value={filter} onChange={(e) => setFilter(e.target.value)} aria-label={t("Ticket status")}>
                <option value="all">{t("All tickets ({length})", { length: attendees.length })}</option>
                <option value="valid">{t("Not arrived")}</option>
                <option value="checked_in">{t("Checked in")}</option>
                <option value="cancelled">{t("Cancelled")}</option>
                <option value="refunded">{t("Refunded")}</option>
              </select>
            </div>
            {visible.length ? (
              <div className="attendee-list">
                {visible.map((a) => (
                  <article key={a.ticket_id} className="attendee-row">
                    <div className="attendee-person">
                      <span className="avatar">{a.attendee_name.split(" ").map((n) => n[0]).slice(0, 2).join("")}</span>
                      <div>
                        <h3>{a.attendee_name}</h3>
                        <p>{a.attendee_email}</p>
                        <code>{a.ticket_id.slice(0, 8).toUpperCase()}</code>
                      </div>
                    </div>
                    <div className="attendee-tickets">
                      <div>
                        <span>
                          {a.ticket_type_name}
                          {a.seat && ` · ${a.seat}`}
                          <small>
                            {t(TICKET_STATUS[a.status])}
                            {a.checked_in_at && t(" at {eventTime}", { eventTime: eventTime(a.checked_in_at, event.timezone) })}
                          </small>
                        </span>
                        {a.status === "valid" && (
                          <button className="btn btn-small btn-secondary" onClick={() => admit(a.ticket_id)}>
                            <Icon name="ticket" size={14} />{" "}{t("Check in")}</button>
                        )}
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            ) : (
              <EmptyState
                icon="users"
                title={attendees.length ? t("No guests match this search.") : t("A guest list waiting to happen.")}
                description={attendees.length ? t("Try a different name or status.") : t("New bookings will appear here.")}
              />
            )}
            {role === "owner" && paidOrders.length > 0 && (
              <>
                <div className="section-heading recent-orders-heading">
                  <h2>{t("Refunds")}</h2>
                  <span className="muted">{t("Full refunds only; money moves are simulated")}</span>
                </div>
                <div className="sales-orders">
                  {paidOrders.map((o) => (
                    <div key={o.id}>
                      <div>
                        <strong>{o.buyer_name}</strong>
                        <small>
                          {`${o.id.slice(0, 8).toUpperCase()} · ${t.plural(o.tickets.length, "{n} ticket", "{n} tickets")} · ${when(o.created_at, event)}`}
                        </small>
                      </div>
                      <strong>{amount(o.total_kzt)}</strong>
                      {refunding === o.id ? (
                        <form className="cancel-order" onSubmit={(e) => refund(e, o.id)}>
                          <input name="reason" required minLength={3} maxLength={500} placeholder={t("Reason (sent to the buyer)")} aria-label={t("Refund reason")} />
                          <button className="text-button danger">{t("Refund")}</button>
                          <button type="button" className="text-button" onClick={() => setRefunding(null)}>{t("Keep")}</button>
                        </form>
                      ) : (
                        <button className="text-button muted" onClick={() => setRefunding(o.id)}>{t("Refund order")}</button>
                      )}
                    </div>
                  ))}
                </div>
              </>
            )}
          </section>
        );
      }}
    </Loading>
  );
}

/* ------------------------------ Sales & analytics ------------------------------ */

export function SalesTab({ ctx }: { ctx: EventContext }) {
  const t = useT();
  const { event } = ctx;
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const data = useLoad(`analytics:${event.id}:${from}:${to}`, (signal) =>
    api.request<Analytics>(`/events/${event.id}/analytics`, {
      signal,
      query: { date_from: fromLocalInputs(from, "00:00"), date_to: fromLocalInputs(to, "23:59") },
    }),
  );
  return (
    <section>
      <div className="attendee-filters">
        <label>{t("From")}{" "}<input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
        </label>
        <label>{t("Until")}{" "}<input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
        </label>
      </div>
      <Loading data={data}>
        {(a) => {
          const peak = Math.max(1, ...a.sales_over_time.map((d) => d.revenue_kzt));
          return (
            <>
              <div className="stats-row">
                <Stat label={t("Net revenue")} value={amount(a.revenue.net_revenue_kzt)} note={t("Gross {gross} · discounts {discounts} · refunds {refunds}", { gross: amount(a.revenue.gross_sales_kzt), discounts: amount(a.revenue.discounts_kzt), refunds: amount(a.revenue.refunds_kzt) })} icon="chart" />
                <Stat label={t("Sold")} value={`${a.capacity.percent_sold}%`} note={t("{tickets_sold} of {capacity} · {tickets_remaining} left", { tickets_sold: a.capacity.tickets_sold, capacity: a.capacity.capacity, tickets_remaining: a.capacity.tickets_remaining })} icon="ticket" />
                <Stat label={t("Attendance")} value={`${a.attendance.checked_in_percent}%`} note={t("{checked_in} checked in · {absent} absent", { checked_in: a.attendance.checked_in, absent: a.attendance.absent })} icon="users" />
              </div>
              <div className="section-heading">
                <h2>{t("Sales over time")}</h2>
                <span className="muted">{t("Revenue per day")}</span>
              </div>
              {a.sales_over_time.length ? (
                <div className="sales-bars" role="img" aria-label={t("Revenue per day")}>
                  {a.sales_over_time.map((d) => (
                    <div key={d.date} title={`${d.date}: ${amount(d.revenue_kzt)}, ${t.plural(d.tickets, "{n} ticket", "{n} tickets")}`}>
                      <span style={{ height: `${Math.max(4, (d.revenue_kzt / peak) * 100)}%` }} />
                      <small>{d.date.slice(5)}</small>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="muted">{t("No sales in this period.")}</p>
              )}
              <div className="section-heading">
                <h2>{t("By ticket type")}</h2>
              </div>
              <div className="table-scroll">
                <table className="sales-table">
                  <thead>
                    <tr>
                      <th>{t("Ticket type")}</th>
                      <th>{t("Sold")}</th>
                      <th>{t("Checked in")}</th>
                      <th>{t("Revenue")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {a.by_ticket_type.map((type) => (
                      <tr key={type.ticket_type_id}>
                        <td>
                          <strong>{type.name}</strong>
                          <small>{`${price(type.price_kzt)} · ${t.plural(type.quantity, "{n} place", "{n} places")}`}</small>
                        </td>
                        <td>{type.tickets_sold}</td>
                        <td>{type.checked_in}</td>
                        <td>{amount(type.revenue_kzt)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {a.campaigns.length > 0 && (
                <>
                  <div className="section-heading">
                    <h2>{t("Promo campaigns")}</h2>
                  </div>
                  <div className="table-scroll">
                    <table className="sales-table">
                      <tbody>
                        {a.campaigns.map((c) => (
                          <tr key={c.campaign_id}>
                            <td><strong>{c.name}</strong><small>{c.code}</small></td>
                            <td>{t.plural(c.redemptions, "{n} use", "{n} uses")}</td>
                            <td>{t.plural(c.tickets_sold, "{n} ticket", "{n} tickets")}</td>
                            <td>{amount(c.net_revenue_kzt)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
              {a.is_simulated && <p className="order-note">{t("Payments are simulated; no real money was collected.")}</p>}
            </>
          );
        }}
      </Loading>
    </section>
  );
}

/* ------------------------------ Team ------------------------------ */

export function TeamTab({ ctx }: { ctx: EventContext }) {
  const t = useT();
  const { event, role } = ctx;
  const [version, setVersion] = useState(0);
  const [error, setError] = useState("");
  const staff = useLoad(`staff:${event.id}:${version}`, (signal) => api.request<StaffMember[]>(`/events/${event.id}/staff`, { signal }));
  async function add(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const d = new FormData(form);
    setError("");
    try {
      await api.request(`/events/${event.id}/staff`, { body: { email: String(d.get("email")).trim(), role: d.get("role") } });
      form.reset();
      setVersion((v) => v + 1);
      ctx.notify(t("Team member added. They see this event the next time they sign in."));
    } catch (err) {
      setError(failure(err));
    }
  }
  async function remove(member: StaffMember) {
    try {
      await api.request(`/events/${event.id}/staff/${member.user_id}`, { method: "DELETE" });
      setVersion((v) => v + 1);
      ctx.notify(t("{full_name} no longer works on this event.", { full_name: member.full_name }));
    } catch (err) {
      ctx.notify(failure(err), true);
    }
  }
  return (
    <section>
      <div className="section-heading">
        <div>
          <h2>{t("Good people at the door.")}</h2>
          <p className="muted">{t("Add people by the email of their BiletFlow account. Managers can run the event; check-in staff only scan tickets.")}</p>
        </div>
      </div>
      <div className="team-layout">
        <div className="team-list">
          <Loading data={staff}>
            {(list) =>
              list.map((member) => (
                <div className="team-member" key={member.id}>
                  <span className="avatar">{member.full_name[0]}</span>
                  <div>
                    <strong>{member.full_name}</strong>
                    <p>{member.email}</p>
                    <small>{ROLE_LABELS[member.role]}</small>
                  </div>
                  {member.role !== "owner" && (role === "owner" || member.role !== "manager") && (
                    <button className="icon-button" aria-label={t("Remove {full_name}", { full_name: member.full_name })} onClick={() => remove(member)}>
                      <Icon name="close" size={16} />
                    </button>
                  )}
                </div>
              ))
            }
          </Loading>
        </div>
        <form onSubmit={add} className="stack-form team-add">
          <h3>{t("Add a team member")}</h3>
          <label>{t("Email of their BiletFlow account")}<input name="email" type="email" required maxLength={255} placeholder="teammate@example.com" />
          </label>
          <label>{t("Role")}<select name="role" defaultValue="checkin_staff">
              <option value="checkin_staff">{t("Check-in staff")}</option>
              <option value="support_staff">{t("Support staff (answers guest questions)")}</option>
              {role === "owner" && <option value="manager">{t("Manager")}</option>}
            </select>
          </label>
          {error && <Notice error>{error}</Notice>}
          <button className="btn btn-primary" type="submit">
            <Icon name="plus" size={16} />{" "}{t("Add to the team")}</button>
        </form>
      </div>
    </section>
  );
}

/* ------------------------------ Activity ------------------------------ */

export function ActivityTab({ ctx }: { ctx: EventContext }) {
  const t = useT();
  const { event } = ctx;
  const [area, setArea] = useState("");
  const log = useLoad(`activity:${event.id}:${area}`, (signal) =>
    api.request<ActivityEntry[]>(`/events/${event.id}/activity`, { signal, query: { area: area || undefined, limit: 100 } }),
  );
  return (
    <section>
      <div className="section-heading">
        <div>
          <h2>{t("Event history")}</h2>
          <p className="muted">{t("Who changed what, and when. Entries cannot be edited or deleted.")}</p>
        </div>
        <select value={area} onChange={(e) => setArea(e.target.value)} aria-label={t("Filter history")}>
          <option value="">{t("Everything")}</option>
          <option value="event">{t("Event details")}</option>
          <option value="ticket_type">{t("Ticket types")}</option>
          <option value="order">{t("Orders")}</option>
          <option value="payment">{t("Payments")}</option>
          <option value="refund">{t("Refunds")}</option>
          <option value="staff">{t("Team")}</option>
          <option value="activation">{t("Paid sales")}</option>
          <option value="check_in">{t("Check-in")}</option>
          <option value="promo">{t("Promotions")}</option>
          <option value="support">{t("Support")}</option>
        </select>
      </div>
      <Loading data={log}>
        {(entries) =>
          entries.length ? (
            <ol className="activity-log">
              {entries.map((entry) => (
                <li key={entry.id}>
                  <time>{when(entry.created_at, event)}</time>
                  <p>
                    <strong>{entry.actor_name ?? t("BiletFlow")}</strong> {entry.description}
                  </p>
                </li>
              ))}
            </ol>
          ) : (
            <p className="muted">{t("Nothing recorded yet.")}</p>
          )
        }
      </Loading>
    </section>
  );
}
