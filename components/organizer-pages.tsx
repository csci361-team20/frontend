"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent, type ReactNode } from "react";
import {
  amount,
  canCheckIn,
  canManage,
  categories,
  checkIn,
  dateLabel,
  money,
  saveEvent,
  soldCount,
  timeLabel,
  type Event,
  type Order,
  type TicketType,
} from "@/lib/demo-data";
import { useDemo } from "./demo-provider";
import { SupportLink } from "./support-pages";
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

function OrganizerShell({
  children,
  active = "overview",
}: {
  children: ReactNode;
  active?: string;
}) {
  const { t } = useI18n();
  return (
    <div className="organizer-shell">
      <aside className="organizer-sidebar">
        <p className="eyebrow">{t("Behind the scenes")}</p>
        <p className="workspace-name">
          {t("Your box office")}<span>{t("Organizer workspace")}</span>
        </p>
        <nav aria-label={t("Organizer navigation")}>
          <Link
            className={active === "overview" ? "active" : ""}
            href="/organizer"
          >
            <Icon name="grid" size={18} />
            {t("Overview")}</Link>
          <Link
            className={active === "events" ? "active" : ""}
            href="/organizer?view=events"
          >
            <Icon name="calendar" size={18} />
            {t("My events")}</Link>
          <Link
            className={active === "check-in" ? "active" : ""}
            href="/check-in"
          >
            <Icon name="users" size={18} />
            {t("Check-in desk")}</Link>
          <Link href="/support"><Icon name="mail" size={18} />{t("Support inbox")}</Link>
          <Link href="/support/new">{t("Contact platform support")}</Link>
        </nav>
        <Link className="btn btn-primary btn-full" href="/organizer/events/new">
          <Icon name="plus" size={16} />
          {t("Create event")}</Link>
        <div className="sidebar-note">
          <Icon name="ticket" size={23} />
          <p>
            {t("You set the stage.")}<br />
            {t("We'll keep the list.")}</p>
          <span>
            {t("Demo workspace")}<br />
            {t("Changes stay in this browser.")}</span>
        </div>
        <Link className="text-link muted" href="/events">
          {t("Back to the audience")}{" "}<Icon name="external" size={13} />
        </Link>
      </aside>
      <main className="organizer-main">{children}</main>
    </div>
  );
}
function Stat({
  label,
  value,
  note,
  icon,
}: {
  label: string;
  value: string | number;
  note: string;
  icon: string;
}) {
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
export function OrganizerPage({ view }: { view?: string }) {
  const { t, locale } = useI18n();
  const { state, user, ready } = useDemo();
  const [filter, setFilter] = useState("all");
  const [search, setSearch] = useState("");
  if (!ready) return <LoadingPage />;
  if (user?.role !== "organizer") return <Gate organizer />;
  const events = state.events.filter((e) => canManage(user, e));
  const orders = state.orders.filter(
    (o) => events.some((e) => e.id === o.eventId) && o.status === "confirmed",
  );
  const sold = orders.reduce(
    (s, o) => s + o.lines.reduce((n, l) => n + l.quantity, 0),
    0,
  );
  const revenue = orders.reduce((s, o) => s + o.total, 0);
  const visible = events.filter(
    (e) =>
      (filter === "all" || e.status === filter) &&
      e.title.toLowerCase().includes(search.toLowerCase()),
  );
  return (
    <OrganizerShell active={view === "events" ? "events" : "overview"}>
      <PageIntro
        eyebrow={
          view === "events"
            ? t("The things you’re putting into the world")
            : t("A little planning. A full house.")
        }
        title={
          view === "events"
            ? t("Your events.")
            : t("Hello, {name}.", { name: user.name.split(" ")[0] })
        }
        description={
          view === "events"
            ? t("From the first draft to the last person through the door.")
            : t("Here’s how things are shaping up at your box office.")
        }
        action={
          <Link className="btn btn-primary" href="/organizer/events/new">
            <Icon name="plus" size={16} />
            {t("Create event")}</Link>
        }
      />
      {view !== "events" && (
        <>
          <div className="stats-row">
            <Stat
              label={t("Demo ticket sales")}
              value={amount(revenue)}
              note={t("Across confirmed orders")}
              icon="chart"
            />
            <Stat
              label={t("Tickets booked")}
              value={sold}
              note={t("Confirmed orders: {count}", { count: orders.length })}
              icon="ticket"
            />
            <Stat
              label={t("Published events")}
              value={events.filter((e) => e.status === "published").length}
              note={t("Draft events: {count}", { count: events.filter((e) => e.status === "draft").length })}
              icon="calendar"
            />
          </div>
          <div className="dashboard-note">
            <span className="status-dot" />
            <p>
              {t("Your stage, your rules. Open an event to manage tickets, check the guest list, or add your door team.")}</p>
            <Icon name="arrow" size={20} />
          </div>
        </>
      )}
      <div className="section-heading events-heading">
        <h2>{view === "events" ? t("The event list") : t("On your calendar")}</h2>
        <label className="compact-search">
          <Icon name="search" size={16} />
          <input
            aria-label={t("Search your events")}
            placeholder={t("Find an event")}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </label>
      </div>
      <div className="line-tabs">
        {["all", "published", "draft"].map((status) => (
          <button
            key={status}
            aria-pressed={filter === status}
            className={filter === status ? "active" : ""}
            onClick={() => setFilter(status)}
          >
            {status === "all"
              ? t("All events")
              : status === "draft"
                ? t("Drafts")
                : t("Published")}
            <span>
              {
                events.filter((e) => status === "all" || e.status === status)
                  .length
              }
            </span>
          </button>
        ))}
      </div>
      {visible.length ? (
        <div className="managed-events">
          {visible.map((event) => {
            const booked = soldCount(state.orders, event.id);
            const capacity = event.tickets.reduce((s, item) => s + item.capacity, 0);
            const total = orders
              .filter((o) => o.eventId === event.id)
              .reduce((s, o) => s + o.total, 0);
            return (
              <Link
                className="managed-event"
                href={`/organizer/events/${event.id}`}
                key={event.id}
              >
                <div className="managed-poster">
                  <Poster event={event} compact />
                </div>
                <div className="managed-event-title">
                  <span
                    className={`status-badge ${event.status === "published" ? "status-live" : ""}`}
                  >
                    {event.status === "published" ? t("Published") : t("Draft")}
                  </span>
                  <h3>{event.title}</h3>
                  <p>
                    {dateLabel(event.date, { weekday: "short" }, localeCodes[locale])} ·{" "}
                    {event.venue}
                  </p>
                </div>
                <div className="managed-progress">
                  <span>
                    <strong>{booked}</strong> / {capacity}
                  </span>
                  <div className="progress-track">
                    <span
                      style={{
                        width: `${capacity ? (booked / capacity) * 100 : 0}%`,
                      }}
                    />
                  </div>
                  <small>{t("tickets booked")}</small>
                </div>
                <div className="managed-revenue">
                  <strong>{amount(total, localeCodes[locale])}</strong>
                  <small>{t("demo sales")}</small>
                </div>
                <Icon name="arrow" size={18} />
              </Link>
            );
          })}
        </div>
      ) : (
        <EmptyState
          icon="calendar"
          title={
            events.length
              ? t("No events match just yet.")
              : t("It starts with an idea.")
          }
          description={
            events.length
              ? t("Try a different search or status.")
              : t("Give it a name, pick a date, and invite the city in.")
          }
          href="/organizer/events/new"
          label={t("Create your first event")}
        />
      )}
    </OrganizerShell>
  );
}

const posterOptions: Record<string, string> = {
  Concerts: "concert",
  Cinema: "cine",
  Theatre: "theatre",
  Festivals: "fest",
  Comedy: "comedy",
  Sport: "sport",
};
export function EventEditor({
  existing,
  onSaved,
}: {
  existing?: Event;
  onSaved?: () => void;
}) {
  const { t } = useI18n();
  const { user, update, state } = useDemo();
  const router = useRouter();
  const [types, setTypes] = useState<TicketType[]>(
    existing?.tickets ?? [
      {
        id: "general",
        name: "General admission",
        description: "Entry to the event.",
        price: 0,
        capacity: 100,
      },
    ],
  );
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  function changeType(index: number, patch: Partial<TicketType>) {
    setTypes((items) =>
      items.map((item, i) => (i === index ? { ...item, ...patch } : item)),
    );
  }
  function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    setMessage("");
    const data = new FormData(e.currentTarget);
    const id = existing?.id ?? crypto.randomUUID();
    const category = String(data.get("category"));
    const event: Event = {
      id,
      ownerId: user!.id,
      title: String(data.get("title")).trim(),
      subtitle: String(data.get("subtitle")).trim(),
      category,
      date: `${data.get("date")}T${data.get("time")}:00+05:00`,
      venue: String(data.get("venue")).trim(),
      city: String(data.get("city")),
      description: String(data.get("description")).trim(),
      status: existing?.status ?? "draft",
      paidSales: existing?.paidSales ?? false,
      poster: posterOptions[category],
      tickets: types,
      staff: existing?.staff ?? [],
    };
    try {
      update((s) => saveEvent(s, event));
      if (!existing) router.push(`/organizer/events/${id}`);
      else {
        setMessage(t("Event details saved."));
        onSaved?.();
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : t("Could not save this event."));
    }
  }
  return (
    <form onSubmit={submit} className="event-editor">
      <section className="editor-section">
        <div className="editor-section-label">
          <span className="step-number">01</span>
          <h2>{t("The essentials")}</h2>
          <p>{t("Give people a reason to put this in their calendar.")}</p>
        </div>
        <div className="stack-form">
          <label>
            {t("Event name")}<input
              name="title"
              defaultValue={existing?.title}
              placeholder={t("Something worth showing up for")}
              maxLength={100}
              required
            />
          </label>
          <label>
            {t("A line for the poster")}{" "}<span className="optional">{t("Optional")}</span>
            <input
              name="subtitle"
              defaultValue={existing?.subtitle}
              placeholder={t("One good sentence about your event")}
              maxLength={120}
            />
          </label>
          <div className="form-two">
            <label>
              {t("Category")}<select
                name="category"
                defaultValue={existing?.category ?? "Concerts"}
              >
                {categories.slice(1).map((c) => (
                  <option key={c} value={c}>{t(c)}</option>
                ))}
              </select>
            </label>
            <label>
              {t("City")}<select name="city" defaultValue={existing?.city ?? "Almaty"}>
                {["Almaty", "Astana", "Shymkent"].map((c) => (
                  <option key={c} value={c}>{t(c)}</option>
                ))}
              </select>
            </label>
          </div>
          <label>
            {t("About the event")}<textarea
              name="description"
              defaultValue={existing?.description}
              placeholder={t("The lineup, the atmosphere, the things people should know…")}
              rows={5}
              required
              maxLength={4000}
            />
          </label>
        </div>
      </section>
      <section className="editor-section">
        <div className="editor-section-label">
          <span className="step-number">02</span>
          <h2>{t("A time & a place")}</h2>
          <p>{t("All times are local to Kazakhstan (UTC+5).")}</p>
        </div>
        <div className="stack-form">
          <div className="form-two">
            <label>
              {t("Date")}<input
                type="date"
                name="date"
                min={new Date().toLocaleDateString("en-CA", {
                  timeZone: "Asia/Almaty",
                })}
                defaultValue={existing?.date.slice(0, 10)}
                required
              />
            </label>
            <label>
              {t("Start time")}<input
                type="time"
                name="time"
                defaultValue={existing ? timeLabel(existing.date) : "19:00"}
                required
              />
            </label>
          </div>
          <label>
            {t("Venue")}<input
              name="venue"
              defaultValue={existing?.venue}
              placeholder={t("Venue name or street address")}
              maxLength={150}
              required
            />
          </label>
        </div>
      </section>
      <section className="editor-section">
        <div className="editor-section-label">
          <span className="step-number">03</span>
          <h2>{t("A way in")}</h2>
          <p>
            {t("Make it free, or set a price in tenge. Paid sales are enabled separately.")}</p>
        </div>
        <div className="ticket-type-editor">
          {types.map((item, i) => (
            <div className="ticket-type-form" key={item.id}>
              <div className="ticket-type-heading">
                <span>{t("Ticket type")}{" "}{String(i + 1).padStart(2, "0")}</span>
                {types.length > 1 && (
                  <button
                    type="button"
                    className="icon-button"
                    aria-label={t("Remove ticket type {name}", { name: item.name })}
                    disabled={
                      !!existing &&
                      soldCount(state.orders, existing.id, item.id) > 0
                    }
                    onClick={() =>
                      setTypes((items) =>
                        items.filter((item) => item.id !== item.id),
                      )
                    }
                  >
                    <Icon name="close" size={16} />
                  </button>
                )}
              </div>
              <label>
                {t("Ticket name")}<input
                  value={item.name}
                  onChange={(e) => changeType(i, { name: e.target.value })}
                  required
                  maxLength={60}
                />
              </label>
              <label>
                {t("What's included")}<input
                  value={item.description}
                  onChange={(e) =>
                    changeType(i, { description: e.target.value })
                  }
                  maxLength={150}
                />
              </label>
              <div className="form-two">
                <label>
                  {t("Price · KZT")}<input
                    type="number"
                    min={0}
                    max={10000000}
                    step={1}
                    value={item.price}
                    onChange={(e) =>
                      changeType(i, { price: e.target.valueAsNumber || 0 })
                    }
                    required
                  />
                  <span className="field-hint">{t("0 = free registration")}</span>
                </label>
                <label>
                  {t("Quantity available")}<input
                    type="number"
                    min={1}
                    max={100000}
                    step={1}
                    value={item.capacity}
                    onChange={(e) =>
                      changeType(i, { capacity: e.target.valueAsNumber || 0 })
                    }
                    required
                  />
                </label>
              </div>
            </div>
          ))}
          <button
            className="btn btn-secondary"
            type="button"
            onClick={() =>
              setTypes((items) => [
                ...items,
                {
                  id: crypto.randomUUID(),
                  name: "",
                  description: "",
                  price: 0,
                  capacity: 50,
                },
              ])
            }
          >
            <Icon name="plus" size={16} />
            {t("Add ticket type")}</button>
        </div>
      </section>
      {error && <Notice error>{error}</Notice>}
      {message && <Notice>{message}</Notice>}
      <div className="editor-footer">
        <p>
          {existing
            ? t("Existing orders keep their original ticket price.")
            : t("Your event starts as a draft. Publish it when you’re ready.")}
        </p>
        <button className="btn btn-primary" type="submit">
          {existing ? t("Save changes") : t("Create draft")}
          <Icon name="arrow" size={16} />
        </button>
      </div>
    </form>
  );
}

export function NewEventPage() {
  const { t } = useI18n();
  const { ready, user } = useDemo();
  if (!ready) return <LoadingPage />;
  if (user?.role !== "organizer") return <Gate organizer />;
  return (
    <OrganizerShell active="events">
      <Link className="text-link muted back-link" href="/organizer">
        <Icon name="back" size={15} />
        {t("Your events")}</Link>
      <PageIntro
        eyebrow={t("From an idea to a full room")}
        title={t("Let’s put it on the calendar.")}
        description={t("Start with the essentials. The rest can take shape as you go.")}
      />
      <EventEditor />
    </OrganizerShell>
  );
}

export function ManageEventPage({ id }: { id: string }) {
  const { t, locale } = useI18n();
  const { ready, state, user, update } = useDemo();
  const [tab, setTab] = useState("Overview");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  if (!ready) return <LoadingPage />;
  if (user?.role !== "organizer") return <Gate organizer />;
  const event = state.events.find((e) => e.id === id && canManage(user, e));
  if (!event)
    return (
      <OrganizerShell>
        <EmptyState
          title={t("This isn’t one of your events.")}
          description={t("Your workspace contains the events created by your profile.")}
          href="/organizer"
          label={t("Back to your events")}
        />
      </OrganizerShell>
    );
  const orders = state.orders.filter((o) => o.eventId === id);
  const confirmed = orders.filter((o) => o.status === "confirmed");
  const booked = soldCount(state.orders, id);
  const capacity = event.tickets.reduce((s, item) => s + item.capacity, 0);
  const revenue = confirmed.reduce((s, o) => s + o.total, 0);
  const checked = confirmed
    .flatMap((o) => o.lines.flatMap((l) => l.admissions))
    .filter((a) => a.checkedIn).length;
  function patch(value: Partial<Event>, success: string) {
    setError("");
    try {
      update((s) => {
        const current = s.events.find((e) => e.id === id)!;
        return saveEvent(s, { ...current, ...value });
      });
      setMessage(success);
    } catch (e) {
      setError(e instanceof Error ? e.message : t("Could not save this change."));
    }
  }
  return (
    <OrganizerShell active="events">
      <Link className="text-link muted back-link" href="/organizer?view=events">
        <Icon name="back" size={15} />
        {t("Your events")}</Link>
      <div className="manage-title">
        <span
          className={`status-badge ${event.status === "published" ? "status-live" : ""}`}
        >
          {event.status === "published" ? t("Published") : t("Draft")}
        </span>
        <span>
          {dateLabel(event.date, { weekday: "short" }, localeCodes[locale])} ·{" "}
          {timeLabel(event.date, localeCodes[locale])} · {event.city}
        </span>
      </div>
      <SupportLink eventId={event.id} label={t("Get platform support for this event")} />
      <PageIntro
        eyebrow={t("Your event")}
        title={event.title}
        action={
          <div className="button-row">
            {event.status === "published" && (
              <Link className="btn btn-secondary" href={`/events/${id}`}>
                {t("View event")}{" "}<Icon name="external" size={14} />
              </Link>
            )}
            <button
              className={`btn ${event.status === "draft" ? "btn-primary" : "btn-secondary"}`}
              onClick={() =>
                patch(
                  { status: event.status === "draft" ? "published" : "draft" },
                  event.status === "draft"
                    ? t("Your event is now on the public event list.")
                    : t("Event unpublished. Existing orders are kept."),
                )
              }
            >
              {event.status === "draft" ? t("Publish event") : t("Unpublish")}
            </button>
          </div>
        }
      />
      <div className="line-tabs manage-tabs">
        {["Overview", "Tickets", "Attendees", "Sales", "Team", "Details"].map(
          (item) => (
            <button
              aria-pressed={tab === item}
              className={tab === item ? "active" : ""}
              key={item}
              onClick={() => {
                setTab(item);
                setMessage("");
                setError("");
              }}
            >
              {t(item)}
              {item === "Attendees" && <span>{booked}</span>}
            </button>
          ),
        )}
      </div>
      {error && <Notice error>{error}</Notice>}
      {message && <Notice>{message}</Notice>}
      {tab === "Overview" && (
        <>
          <div className="stats-row">
            <Stat
              label={t("Demo sales")}
              value={amount(revenue)}
              note={t("Confirmed orders only")}
              icon="chart"
            />
            <Stat
              label={t("Tickets booked")}
              value={`${booked} / ${capacity}`}
              note={t("Available: {count}", { count: Math.max(0, capacity - booked) })}
              icon="ticket"
            />
            <Stat
              label={t("Through the door")}
              value={checked}
              note={t("Guests remaining: {count}", { count: Math.max(0, booked - checked) })}
              icon="users"
            />
          </div>
          <div className="event-overview-grid">
            <div>
              <Poster event={event} />
              <p className="muted overview-caption">
                {event.venue} · {event.city}
              </p>
            </div>
            <div className="launch-checklist">
              <h2>{t("Before the doors open")}</h2>
              <p className="muted">{t("A few things to have in place.")}</p>
              {[
                [
                  "The event details",
                  "A name, a date, and a place to be.",
                  true,
                ],
                [
                  "Your ticket types",
                  t("Ticket types available: {count}", { count: event.tickets.length }),
                  event.tickets.length > 0,
                ],
                [
                  "On the public calendar",
                  "Let people discover your event.",
                  event.status === "published",
                ],
                [
                  "A team at the door",
                  "Assign someone to welcome your guests.",
                  event.staff.length > 0,
                ],
              ].map(([title, description, done]) => (
                <div className="checklist-item" key={String(title)}>
                  <span className={done ? "done" : ""}>
                    {done ? (
                      <Icon name="check" size={14} />
                    ) : (
                      <Icon name="minus" size={14} />
                    )}
                  </span>
                  <div>
                    <strong>{t(String(title))}</strong>
                    <p>{t(String(description))}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
      {tab === "Tickets" && (
        <>
          <div className="sales-switch">
            <div>
              <span className="eyebrow">{t("Box office")}</span>
              <h2>{t("Paid ticket sales")}</h2>
              <p>
                {event.paidSales
                  ? t("Paid tickets can be booked through demo checkout.")
                  : t("Paid tickets are paused. Free registration remains available.")}
              </p>
            </div>
            <button
              className={`toggle ${event.paidSales ? "on" : ""}`}
              role="switch"
              aria-checked={event.paidSales}
              aria-label={t("Enable paid demo sales")}
              onClick={() =>
                patch(
                  { paidSales: !event.paidSales },
                  event.paidSales
                    ? t("Paid ticket sales paused.")
                    : t("Paid demo sales enabled. No payments will be collected."),
                )
              }
            >
              <span />
            </button>
          </div>
          <div className="ticket-types-list">
            {event.tickets.map((item) => (
              <div className="ticket-type-row" key={item.id}>
                <Icon name="ticket" size={24} />
                <div>
                  <h3>{item.name}</h3>
                  <p>{item.description}</p>
                </div>
                <strong>{t(money(item.price, localeCodes[locale]))}</strong>
                <span>
                  {soldCount(state.orders, id, item.id)} / {item.capacity} {t("booked")}</span>
              </div>
            ))}
          </div>
          <button
            className="btn btn-secondary"
            onClick={() => setTab("Details")}
          >
            <Icon name="plus" size={16} />
            {t("Edit ticket types & capacity")}</button>
          <p className="order-note">
            {t("Prices are shown for demonstration. Payment provider integration is not enabled.")}</p>
        </>
      )}
      {tab === "Attendees" && <AttendeeList event={event} orders={orders} />}
      {tab === "Sales" && <SalesView event={event} orders={confirmed} />}
      {tab === "Team" && <TeamEditor event={event} />}
      {tab === "Details" && <EventEditor existing={event} />}
    </OrganizerShell>
  );
}

function AttendeeList({
  event,
  orders,
  staffOnly = false,
}: {
  event: Event;
  orders: Order[];
  staffOnly?: boolean;
}) {
  const { t, locale } = useI18n();
  const { update } = useDemo();
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [cancelId, setCancelId] = useState<string | null>(null);
  const visible = orders.filter(
    (o) =>
      (!staffOnly || o.status === "confirmed") &&
      `${o.name} ${o.email} ${o.id} ${o.lines.flatMap((l) => l.admissions.map((a) => a.id)).join(" ")}`
        .toLowerCase()
        .includes(search.toLowerCase()) &&
      (filter === "all" ||
        (filter === "cancelled"
          ? o.status === "cancelled"
          : o.status === "confirmed" &&
            o.lines.some((l) =>
              l.admissions.some((a) =>
                filter === "checked" ? a.checkedIn : !a.checkedIn,
              ),
            ))),
  );
  function admit(id: string) {
    setError("");
    setMessage("");
    try {
      update((s) => checkIn(s, event.id, id));
      setMessage(t("Ticket checked in. Welcome to the night."));
    } catch (e) {
      setError(e instanceof Error ? e.message : t("Unable to check in."));
    }
  }
  function cancel(id: string) {
    setError("");
    try {
      update((s) => {
        const current = s.events.find((e) => e.id === event.id)!;
        if (
          !canManage(
            s.profiles.find((p) => p.id === s.currentUserId),
            current,
          )
        )
          throw new Error("Only the organizer can cancel an order.");
        const order = s.orders.find(
          (o) => o.id === id && o.eventId === event.id,
        );
        if (!order) throw new Error("Order not found.");
        if (order.lines.some((l) => l.admissions.some((a) => a.checkedIn)))
          throw new Error("A checked-in order cannot be cancelled.");
        return {
          ...s,
          orders: s.orders.map((o) =>
            o.id === id ? { ...o, status: "cancelled" } : o,
          ),
        };
      });
      setCancelId(null);
      setMessage(t("Demo order cancelled. Its tickets are available again."));
    } catch (e) {
      setError(e instanceof Error ? e.message : t("Could not cancel the order."));
    }
  }
  return (
    <section>
      <div className="section-heading">
        <div>
          <h2>{staffOnly ? t("At the door") : t("The guest list")}</h2>
          <p className="muted">
            {t("One ticket, one check-in. Search by name, email, or ticket reference.")}</p>
        </div>
      </div>
      <div className="attendee-filters">
        <label className="search-input">
          <Icon name="search" size={17} />
          <input
            aria-label={t("Search attendees")}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t("Name, email, or ticket reference")}
          />
        </label>
        <select
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          aria-label={t("Attendee status")}
        >
          <option value="all">{t("All attendees")}</option>
          <option value="waiting">{t("Not checked in")}</option>
          <option value="checked">{t("Checked in")}</option>
          {!staffOnly && <option value="cancelled">{t("Cancelled")}</option>}
        </select>
      </div>
      {error && <Notice error>{error}</Notice>}
      {message && <Notice>{message}</Notice>}
      {visible.length ? (
        <div className="attendee-list">
          {visible.map((order) => (
            <article key={order.id} className="attendee-row">
              <div className="attendee-person">
                <span className="avatar">
                  {order.name
                    .split(" ")
                    .map((n) => n[0])
                    .slice(0, 2)
                    .join("")}
                </span>
                <div>
                  <h3>{order.name}</h3>
                  <p>{order.email}</p>
                  <code>{order.id.slice(0, 20)}</code>
                </div>
                {!staffOnly && <strong>{t(money(order.total, localeCodes[locale]))}</strong>}
              </div>
              <div className="attendee-tickets">
                {order.status === "cancelled" ? (
                  <span className="status-badge">{t("Cancelled")}</span>
                ) : (
                  order.lines.flatMap((line) =>
                    line.admissions.map((a, i) => (
                      <div key={a.id}>
                        <span>
                          {line.name} · {i + 1}
                          <small>{a.id}</small>
                        </span>
                        <button
                          className={`btn btn-small ${a.checkedIn ? "btn-checked" : "btn-secondary"}`}
                          disabled={a.checkedIn}
                          onClick={() => admit(a.id)}
                        >
                          <Icon
                            name={a.checkedIn ? "check" : "ticket"}
                            size={14}
                          />
                          {a.checkedIn ? t("Checked in") : t("Check in")}
                        </button>
                      </div>
                    )),
                  )
                )}
              </div>
              {!staffOnly &&
                order.status === "confirmed" &&
                !order.lines.some((l) =>
                  l.admissions.some((a) => a.checkedIn),
                ) && (
                  <div className="cancel-order">
                    {cancelId === order.id ? (
                      <>
                        <span>{t("Cancel this order and release its tickets?")}</span>
                        <button
                          onClick={() => cancel(order.id)}
                          className="text-button danger"
                        >
                          {t("Yes, cancel order")}</button>
                        <button
                          onClick={() => setCancelId(null)}
                          className="text-button"
                        >
                          {t("Keep order")}</button>
                      </>
                    ) : (
                      <button
                        className="text-button muted"
                        onClick={() => setCancelId(order.id)}
                      >
                        {t("Cancel demo order")}</button>
                    )}
                  </div>
                )}
            </article>
          ))}
        </div>
      ) : (
        <EmptyState
          icon="users"
          title={
            orders.length
              ? t("No guests match this search.")
              : t("A guest list waiting to happen.")
          }
          description={
            orders.length
              ? t("Try a different name or check-in status.")
              : t("New bookings will appear here, ready for a warm welcome.")
          }
        />
      )}
    </section>
  );
}

function SalesView({ event, orders }: { event: Event; orders: Order[] }) {
  const { t, locale } = useI18n();
  const total = orders.reduce((s, o) => s + o.total, 0);
  const sold = soldCount(orders, event.id);
  return (
    <section>
      <div className="stats-row">
        <Stat
          label={t("Gross demo sales")}
          value={amount(total)}
          note={t("No real money collected")}
          icon="chart"
        />
        <Stat
          label={t("Confirmed orders")}
          value={orders.length}
          note={t("Total tickets: {count}", { count: sold })}
          icon="ticket"
        />
        <Stat
          label={t("Average order")}
          value={amount(orders.length ? Math.round(total / orders.length) : 0)}
          note={t("Based on confirmed orders")}
          icon="users"
        />
      </div>
      <div className="section-heading">
        <h2>{t("By ticket type")}</h2>
        <span className="muted">{t("All time")}</span>
      </div>
      <div className="table-scroll">
        <table className="sales-table">
          <thead>
            <tr>
              <th>{t("Ticket type")}</th>
              <th>{t("Booked")}</th>
              <th>{t("Available")}</th>
              <th>{t("Demo sales")}</th>
            </tr>
          </thead>
          <tbody>
            {event.tickets.map((item) => {
              const lines = orders.flatMap((o) =>
                o.lines.filter((l) => l.ticketId === item.id),
              );
              const count = lines.reduce((s, l) => s + l.quantity, 0);
              return (
                <tr key={item.id}>
                  <td>
                    <strong>{item.name}</strong>
                    <small>{t(money(item.price, localeCodes[locale]))} {t("per ticket now")}</small>
                  </td>
                  <td>{count}</td>
                  <td>{item.capacity - count}</td>
                  <td>
                    {amount(lines.reduce((s, l) => s + l.price * l.quantity, 0), localeCodes[locale])}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div className="section-heading recent-orders-heading">
        <h2>{t("Recent orders")}</h2>
      </div>
      {orders.length ? (
        <div className="sales-orders">
          {orders.map((o) => (
            <div key={o.id}>
              <div>
                <strong>{o.name}</strong>
                <small>
                  {dateLabel(o.createdAt, { year: "numeric" }, localeCodes[locale])} ·{" "}
                  {o.lines.reduce((s, l) => s + l.quantity, 0)} {t("tickets")}</small>
              </div>
              <span className="status-badge status-live">{t("Confirmed")}</span>
              <strong>{t(money(o.total, localeCodes[locale]))}</strong>
            </div>
          ))}
        </div>
      ) : (
        <p className="muted">
          {t("No sales yet. Publish the event and enable sales when you're ready.")}</p>
      )}
    </section>
  );
}

function TeamEditor({ event }: { event: Event }) {
  const { t } = useI18n();
  const { update } = useDemo();
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  function add(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    const form = e.currentTarget;
    const data = new FormData(form);
    const name = String(data.get("name")).trim();
    const email = String(data.get("email")).trim().toLowerCase();
    if (!name) return setError(t("Add a name for your team member."));
    try {
      update((s) => {
        const current = s.events.find((e) => e.id === event.id)!;
        if (current.staff.some((m) => m.email === email))
          throw new Error("This person is already on your door team.");
        return saveEvent(s, {
          ...current,
          staff: [...current.staff, { id: crypto.randomUUID(), name, email }],
        });
      });
      form.reset();
      setMessage(
        t("Team member assigned. They can use the check-in desk with a matching demo profile."),
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : t("Could not add team member."));
    }
  }
  function remove(id: string) {
    setError("");
    try {
      update((s) => {
        const current = s.events.find((e) => e.id === event.id)!;
        return saveEvent(s, {
          ...current,
          staff: current.staff.filter((m) => m.id !== id),
        });
      });
      setMessage(t("Check-in access removed."));
    } catch (e) {
      setError(
        e instanceof Error ? e.message : t("Could not remove team member."),
      );
    }
  }
  return (
    <section>
      <div className="section-heading">
        <div>
          <h2>{t("Good people at the door.")}</h2>
          <p className="muted">
            {t("Assign check-in access to a demo profile by email. No invitation email is sent.")}</p>
        </div>
      </div>
      <div className="team-layout">
        <div className="team-list">
          {event.staff.length ? (
            event.staff.map((member) => (
              <div className="team-member" key={member.id}>
                <span className="avatar">{member.name[0]}</span>
                <div>
                  <strong>{member.name}</strong>
                  <p>{member.email}</p>
                  <small>{t("Check-in access only")}</small>
                </div>
                <button
                  className="icon-button"
                  aria-label={t("Remove {name}", { name: member.name })}
                  onClick={() => remove(member.id)}
                >
                  <Icon name="close" size={16} />
                </button>
              </div>
            ))
          ) : (
            <EmptyState
              icon="users"
              title={t("Who’s on the door?")}
              description={t("Add the people who will be welcoming your guests.")}
            />
          )}
        </div>
        <form onSubmit={add} className="stack-form team-add">
          <h3>{t("Add a team member")}</h3>
          <label>
            {t("Name")}<input
              name="name"
              required
              maxLength={80}
              placeholder={t("First and last name")}
            />
          </label>
          <label>
            {t("Email")}<input
              name="email"
              type="email"
              required
              maxLength={200}
              placeholder={t("teammate@example.com")}
            />
          </label>
          <button className="btn btn-primary" type="submit">
            <Icon name="plus" size={16} />
            {t("Assign check-in access")}</button>
          <p className="field-hint">
            {t("Team members can check tickets for this event. Event settings and sales stay with you.")}</p>
        </form>
      </div>
      {error && <Notice error>{error}</Notice>}
      {message && <Notice>{message}</Notice>}
    </section>
  );
}

export function CheckInPage() {
  const { t, locale } = useI18n();
  const { ready, state, user } = useDemo();
  const [selected, setSelected] = useState("");
  if (!ready) return <LoadingPage />;
  if (!user) return <Gate />;
  const events = state.events.filter((e) => canCheckIn(user, e, state));
  const event = events.find((e) => e.id === selected) ?? events[0];
  const body = (
    <>
      <PageIntro
        eyebrow={t("First impressions count")}
        title={t("Welcome them in.")}
        description={t("Your door team’s list. Find a ticket and mark its arrival.")}
      />
      {event ? (
        <>
          <label className="checkin-event-select">
            {t("Event")}<select
              value={event.id}
              onChange={(e) => setSelected(e.target.value)}
            >
              {events.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.title} · {dateLabel(e.date, undefined, localeCodes[locale])}
                </option>
              ))}
            </select>
          </label>
          <AttendeeList
            key={event.id}
            event={event}
            orders={state.orders.filter((o) => o.eventId === event.id)}
            staffOnly={!canManage(user, event)}
          />
        </>
      ) : (
        <EmptyState
          icon="users"
          title={t("No door assignment yet.")}
          description={t("Your organizer needs to add your profile’s email to the event team. Assigned events will appear here.")}
          href="/events"
          label={t("Browse events")}
        />
      )}
    </>
  );
  return user.role === "organizer" ? (
    <OrganizerShell active="check-in">{body}</OrganizerShell>
  ) : (
    <main className="workspace narrow-workspace">{body}</main>
  );
}
