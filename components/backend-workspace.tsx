"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import {
  api,
  ApiError,
  isUserId,
  type ApiEvent,
  type ApiOrganizerProfile,
  type ApiTicketType,
  type EventCreateInput,
  type EventUpdateInput,
  type TicketTypeCreateInput,
} from "@/lib/api";
import { EmptyState, Icon, LoadingPage, Notice, PageIntro } from "./primitives";
import "./backend-workspace.css";
import { localeCodes, useI18n, type Locale } from "@/lib/i18n";

type Result<T> = { status: "loading" } | { status: "error"; message: string } | { status: "ready"; value: T };
type Feedback = { message: string; error: boolean } | null;
type EventFields = Omit<EventCreateInput, "organizer_profile_id" | "seating_type">;
type CreationKind = "event" | "duplicate" | "ticket";

const errorText = (cause: unknown) => cause instanceof Error ? cause.message : "The request could not be completed. Please try again.";
const dateTime = (value: string, locale: Locale = "en") => new Intl.DateTimeFormat(localeCodes[locale], locale === "kk"
  ? { year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "Etc/GMT-5" }
  : { dateStyle: "medium", timeStyle: "short", timeZone: "Etc/GMT-5" }).format(new Date(value));
const money = (value: number, locale: Locale) => new Intl.NumberFormat(localeCodes[locale], { style: "currency", currency: "KZT", maximumFractionDigits: 0 }).format(value);
const uncertainOutcome = (cause: unknown) => !(cause instanceof ApiError) || cause.status === 0 || cause.status >= 500;

function inputTime(value: string | null | undefined) {
  if (!value) return "";
  return new Intl.DateTimeFormat("sv-SE", { timeZone: "Etc/GMT-5", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(new Date(value)).replace(" ", "T");
}

function isoTime(value: FormDataEntryValue | null, optional = false) {
  const local = String(value ?? "").trim();
  if (!local && optional) return null;
  const result = `${local}+05:00`;
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(local) || !Number.isFinite(Date.parse(result)) || inputTime(result) !== local) throw new Error("Enter a valid date and time in Kazakhstan time (UTC+05:00).");
  return result;
}

function eventFields(data: FormData, minimumCapacity: number, existing?: ApiEvent): EventFields {
  const title = String(data.get("title") ?? "").trim();
  const start_at = existing && String(data.get("start_at")) === inputTime(existing.start_at) ? existing.start_at : isoTime(data.get("start_at"))!;
  const end_at = existing && String(data.get("end_at")) === inputTime(existing.end_at) ? existing.end_at : isoTime(data.get("end_at"))!;
  const capacity = Number(data.get("capacity"));
  if (title.length < 3 || title.length > 255) throw new Error("Use 3–255 characters for the event title.");
  if (Date.parse(end_at) <= Date.parse(start_at)) throw new Error("The event must end after it starts.");
  if (!Number.isSafeInteger(capacity) || capacity < 1 || capacity < minimumCapacity) throw new Error(`Capacity must be a whole number of at least ${Math.max(1, minimumCapacity)} to cover allocated ticket types.`);
  const visibility = String(data.get("visibility"));
  if (!["public", "unlisted", "private"].includes(visibility)) throw new Error("Choose an event visibility.");
  return {
    title,
    description: String(data.get("description") ?? "").trim(),
    visibility: visibility as ApiEvent["visibility"],
    start_at,
    end_at,
    capacity,
    venue_name: String(data.get("venue_name") ?? "").trim(),
    venue_address: String(data.get("venue_address") ?? "").trim(),
    city: String(data.get("city") ?? "").trim(),
    category: String(data.get("category") ?? "").trim(),
  };
}

function WorkspaceShell({ title, description, children, action }: { title: string; description: string; children: ReactNode; action?: ReactNode }) {
  const { t } = useI18n();
  return <main className="workspace backend-workspace">
    <PageIntro eyebrow={t("BiletFlow / connected workspace")} title={title} description={description} action={action} />
    <div className="backend-workspace-note"><Icon name="external" size={17} /><p>{t("Connected preview. Changes here are sent to the backend. Account sign-in is not connected yet; record IDs locate data and do not authenticate you. These records stay separate from browser demo bookings.")}</p></div>
    {children}
  </main>;
}

function OrganizerLookup({ organizerId }: { organizerId: string }) {
  const { t } = useI18n();
  const router = useRouter();
  const [result, setResult] = useState<Result<ApiOrganizerProfile>>({ status: "loading" });
  const [attempt, setAttempt] = useState(0);
  const [error, setError] = useState("");
  useEffect(() => {
    if (!organizerId) return;
    const controller = new AbortController();
    api.organizers.get(organizerId, { signal: controller.signal }).then(
      (value) => { if (!controller.signal.aborted) setResult({ status: "ready", value }); },
      (cause: unknown) => { if (!controller.signal.aborted) setResult({ status: "error", message: errorText(cause) }); },
    );
    return () => controller.abort();
  }, [organizerId, attempt]);

  function lookup(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const id = String(new FormData(event.currentTarget).get("organizer")).trim();
    if (!isUserId(id)) return setError(t("Enter a valid organizer profile ID."));
    setError("");
    if (id === organizerId) { setResult({ status: "loading" }); setAttempt((value) => value + 1); }
    else router.push(`/workspace?organizer=${encodeURIComponent(id)}`);
  }

  function openEvent(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const id = String(new FormData(event.currentTarget).get("event")).trim();
    if (!isUserId(id)) return setError(t("Enter a valid event ID."));
    router.push(`/workspace/events/${encodeURIComponent(id)}?organizer=${encodeURIComponent(organizerId)}`);
  }

  return <WorkspaceShell title={t("Bring your next event to life.")} description={t("Create and manage backend events and ticket definitions using an organizer profile reference.")} action={<Link className="btn btn-secondary" href="/events">{t("Browse events")}{" "}<Icon name="arrow" size={16} /></Link>}>
    <section className="backend-panel">
      <h2>{t("Open an organizer profile")}</h2>
      <form className="stack-form backend-lookup" onSubmit={lookup}>
        <label>{t("Organizer profile ID")}<input name="organizer" defaultValue={organizerId} required maxLength={36} autoComplete="off" placeholder={t("Organizer profile ID returned by the backend")} /></label>
        <button className="btn btn-primary">{t("Open workspace")}{" "}<Icon name="arrow" size={16} /></button>
      </form>
      <p className="field-hint">{t("Need an organizer profile? Open your backend account profile to create one, or use a profile reference you already have.")}</p>
      <Link className="text-link" href="/profile">{t("Find an account profile")}{" "}<Icon name="arrow" size={15} /></Link>
    </section>
    {error && <Notice error>{error}</Notice>}
    {organizerId && (result.status === "loading" ? <LoadingPage /> : result.status === "error" ? <Notice error>{result.message}</Notice> : <>
      <section className="backend-panel backend-profile-summary">
        <div><span className="eyebrow">{t("Organizer profile")}</span><h2>{result.value.display_name}</h2><p>{result.value.id}</p><span className="status-badge">{t("Verification:")}{" "}{t(result.value.verification_status)}</span></div>
        <Link className="btn btn-primary" href={`/workspace/events/new?organizer=${encodeURIComponent(result.value.id)}`}><Icon name="plus" size={16} />{t("Create an event")}</Link>
      </section>
      <section className="backend-panel">
        <h2>{t("Open an existing event")}</h2>
        <p className="muted">{t("A complete organizer event list is not available yet. Save the event link after creating a draft, or enter its ID here.")}</p>
        <form className="stack-form backend-lookup" onSubmit={openEvent}><label>{t("Event ID")}<input name="event" required maxLength={36} autoComplete="off" placeholder={t("Event reference")} /></label><button className="btn btn-secondary">{t("Open event")}</button></form>
      </section>
    </>)}
  </WorkspaceShell>;
}

function EventPreview({ event, tickets = [] }: { event: EventFields & { seating_type?: ApiEvent["seating_type"] }; tickets?: ApiTicketType[] }) {
  const { t, locale } = useI18n();
  return <section className="backend-preview" aria-label={t("Event preview")}>
    <span className="eyebrow">{t("Event preview")}</span><h2>{event.title}</h2>
    <p className="backend-preview-description">{event.description || t("No description added yet.")}</p>
    <dl className="backend-facts">
      <div><dt>{t("When")}</dt><dd>{dateTime(event.start_at, locale)} – {dateTime(event.end_at, locale)}<small>{t("Kazakhstan time · UTC+05:00")}</small></dd></div>
      <div><dt>{t("Where")}</dt><dd>{event.venue_name || t("Venue not provided")}<small>{[event.venue_address, event.city].filter(Boolean).join(", ")}</small></dd></div>
      <div><dt>{t("Visibility")}</dt><dd>{t(event.visibility)}</dd></div>
      <div><dt>{t("Capacity")}</dt><dd>{event.capacity}</dd></div>
      {event.seating_type && <div><dt>{t("Seating")}</dt><dd>{event.seating_type === "assigned" ? t("Assigned seating") : t("General admission")}</dd></div>}
    </dl>
    {tickets.length > 0 && <div className="backend-preview-tickets">{tickets.filter((ticket) => !ticket.is_hidden).map((ticket) => <div key={ticket.id}><strong>{ticket.name}</strong><span>{ticket.price_kzt === 0 ? t("Free") : money(ticket.price_kzt, locale)}</span></div>)}</div>}
  </section>;
}

function EventForm({ organizerId, event, tickets, busy, blocked = false, onSave }: { organizerId: string; event?: ApiEvent; tickets: ApiTicketType[]; busy: boolean; blocked?: boolean; onSave: (input: EventCreateInput | EventUpdateInput) => void }) {
  const { t } = useI18n();
  const [error, setError] = useState("");
  const [preview, setPreview] = useState<(EventFields & { seating_type: ApiEvent["seating_type"] }) | null>(null);
  const allocated = tickets.reduce((sum, ticket) => sum + ticket.quantity, 0);
  function values(form: HTMLFormElement) {
    const data = new FormData(form);
    const fields = eventFields(data, allocated, event);
    const seating_type = event?.seating_type ?? String(data.get("seating_type")) as ApiEvent["seating_type"];
    if (!["general_admission", "assigned"].includes(seating_type)) throw new Error("Choose a seating mode.");
    return { fields, seating_type };
  }
  function submit(submitEvent: FormEvent<HTMLFormElement>) {
    submitEvent.preventDefault();
    setError("");
    try {
      const { fields, seating_type } = values(submitEvent.currentTarget);
      onSave(event ? fields : { ...fields, seating_type, organizer_profile_id: organizerId });
    } catch (cause) { setError(errorText(cause)); }
  }
  function showPreview(form: HTMLFormElement | null) {
    if (!form || !form.reportValidity()) return;
    setError("");
    try { const { fields, seating_type } = values(form); setPreview({ ...fields, seating_type }); }
    catch (cause) { setError(errorText(cause)); }
  }
  return <>
    <form className="stack-form backend-event-form" onSubmit={submit} aria-busy={busy}>
      <fieldset disabled={busy || blocked}>
        <label>{t("Event title")}<input name="title" required minLength={3} maxLength={255} defaultValue={event?.title} /></label>
        <label>{t("Description")}<textarea name="description" rows={6} defaultValue={event?.description ?? ""} /></label>
        <div className="backend-form-grid">
          <label>{t("Category")}<input name="category" maxLength={50} defaultValue={event?.category ?? ""} placeholder={t("Concerts, theatre, workshops…")} /></label>
          <label>{t("Visibility")}<select name="visibility" defaultValue={event?.visibility ?? "public"}><option value="public">{t("Public · listed in discovery")}</option><option value="unlisted">{t("Unlisted · accessible by link")}</option><option value="private">{t("Private")}</option></select></label>
          <label>{t("Starts in Kazakhstan time")}<input name="start_at" type="datetime-local" step={60} required defaultValue={inputTime(event?.start_at)} /></label>
          <label>{t("Ends in Kazakhstan time")}<input name="end_at" type="datetime-local" step={60} required defaultValue={inputTime(event?.end_at)} /></label>
          <label>{t("Total event capacity")}<input name="capacity" type="number" step={1} min={Math.max(1, allocated)} required defaultValue={event?.capacity ?? 100} /><span className="field-hint">{allocated} {t("places allocated to ticket types. This is not a live remaining-inventory count.")}</span></label>
          {event ? <label>{t("Seating mode")}<input value={event.seating_type === "assigned" ? t("Assigned seating") : t("General admission")} readOnly /><span className="field-hint">{t("Seating mode cannot be changed through the current event update API.")}</span></label> : <label>{t("Seating mode")}<select name="seating_type" defaultValue="general_admission"><option value="general_admission">{t("General admission")}</option><option value="assigned">{t("Assigned seating configuration")}</option></select><span className="field-hint">{t("Seat maps and seat reservations are unavailable until seating services are connected.")}</span></label>}
          <label>{t("Venue name")}<input name="venue_name" maxLength={255} defaultValue={event?.venue_name ?? ""} /></label>
          <label>{t("City")}<input name="city" maxLength={100} defaultValue={event?.city ?? ""} /></label>
        </div>
        <label>{t("Venue address")}<input name="venue_address" maxLength={500} defaultValue={event?.venue_address ?? ""} /></label>
        <p className="field-hint">{t("Dates use Asia/Almaty (UTC+05:00), independent of your browser's time zone. Images, registration windows, and refund policies have no backend fields yet.")}</p>
        {error && <Notice error>{error}</Notice>}
        <div className="button-row"><button className="btn btn-primary" disabled={busy || blocked}>{busy ? t("Saving…") : event ? t("Save event details") : t("Create draft event")}</button><button type="button" className="btn btn-secondary" disabled={busy || blocked} onClick={(click) => showPreview(click.currentTarget.form)}>{t("Preview these details")}</button></div>
      </fieldset>
    </form>
    {preview && <EventPreview event={preview} tickets={tickets} />}
  </>;
}

function TicketForm({ event, tickets, ticket, busy, blocked = false, onSave }: { event: ApiEvent; tickets: ApiTicketType[]; ticket?: ApiTicketType; busy: boolean; blocked?: boolean; onSave: (input: TicketTypeCreateInput, ticketId?: string) => void }) {
  const { t } = useI18n();
  const [error, setError] = useState("");
  const others = tickets.filter((item) => item.id !== ticket?.id).reduce((sum, item) => sum + item.quantity, 0);
  function submit(submitEvent: FormEvent<HTMLFormElement>) {
    submitEvent.preventDefault();
    setError("");
    try {
      const data = new FormData(submitEvent.currentTarget);
      const name = String(data.get("name")).trim();
      const price_kzt = Number(data.get("price_kzt"));
      const quantity = Number(data.get("quantity"));
      const max_per_order = Number(data.get("max_per_order"));
      const sale_start = ticket?.sale_start && String(data.get("sale_start")) === inputTime(ticket.sale_start) ? ticket.sale_start : isoTime(data.get("sale_start"), true);
      const sale_end = ticket?.sale_end && String(data.get("sale_end")) === inputTime(ticket.sale_end) ? ticket.sale_end : isoTime(data.get("sale_end"), true);
      if (name.length < 2 || name.length > 100) throw new Error("Use 2–100 characters for the ticket name.");
      if (!Number.isSafeInteger(price_kzt) || price_kzt < 0) throw new Error("Enter a whole, non-negative price in KZT.");
      if (!Number.isSafeInteger(quantity) || quantity < 1 || others + quantity > event.capacity) throw new Error(`Ticket allocations cannot exceed the event capacity of ${event.capacity}. ${others} places are allocated to other ticket types.`);
      if (!Number.isSafeInteger(max_per_order) || max_per_order < 1) throw new Error("The per-order limit must be a positive whole number.");
      if (sale_start && sale_end && Date.parse(sale_end) <= Date.parse(sale_start)) throw new Error("Ticket sales must end after they start.");
      onSave({ name, description: String(data.get("description") ?? "").trim(), price_kzt, quantity, max_per_order, sale_start, sale_end, is_hidden: data.get("is_hidden") === "on" }, ticket?.id);
    } catch (cause) { setError(errorText(cause)); }
  }
  return <form className="stack-form backend-ticket-form" onSubmit={submit} aria-busy={busy}>
    <fieldset disabled={busy || blocked}>
      <label>{t("Ticket name")}<input name="name" minLength={2} maxLength={100} required defaultValue={ticket?.name} /></label>
      <label>{t("Description")}<textarea name="description" rows={2} defaultValue={ticket?.description ?? ""} /></label>
      <div className="backend-form-grid">
        <label>{t("Price (KZT)")}<input name="price_kzt" type="number" min={0} step={1} required defaultValue={ticket?.price_kzt ?? 0} /><span className="field-hint">{t("Use 0 for a free ticket.")}</span></label>
        <label>{t("Allocated quantity")}<input name="quantity" type="number" min={1} max={Math.max(ticket?.quantity ?? 1, event.capacity - others)} step={1} required defaultValue={ticket?.quantity ?? Math.max(1, event.capacity - others)} /></label>
        <label>{t("Maximum per order")}<input name="max_per_order" type="number" min={1} step={1} required defaultValue={ticket?.max_per_order ?? 10} /></label>
        <label className="backend-checkbox"><input name="is_hidden" type="checkbox" defaultChecked={ticket?.is_hidden ?? false} /><span>{t("Hide this ticket type from public listings")}</span></label>
        <label>{t("Sales open in Kazakhstan time")}<input name="sale_start" type="datetime-local" step={60} defaultValue={inputTime(ticket?.sale_start)} /></label>
        <label>{t("Sales close in Kazakhstan time")}<input name="sale_end" type="datetime-local" step={60} defaultValue={inputTime(ticket?.sale_end)} /></label>
      </div>
      <p className="field-hint">{t("Leave sale dates empty for no date restriction. Hiding preserves the ticket definition; deletion and live reservation counts are not available.")}</p>
      {error && <Notice error>{error}</Notice>}
      <button className="btn btn-primary" disabled={busy || blocked}>{busy ? t("Saving…") : ticket ? t("Save ticket type") : t("Create ticket type")}</button>
    </fieldset>
  </form>;
}

function EventWorkspace({ id, organizerId }: { id: string; organizerId: string }) {
  const { t, locale } = useI18n();
  const router = useRouter();
  const [result, setResult] = useState<Result<{ organizer: ApiOrganizerProfile; event?: ApiEvent; tickets: ApiTicketType[] }>>({ status: "loading" });
  const [attempt, setAttempt] = useState(0);
  const [revision, setRevision] = useState(0);
  const [ticketRevisions, setTicketRevisions] = useState<Record<string, number>>({});
  const [feedback, setFeedback] = useState<Feedback>(null);
  const [busy, setBusy] = useState(false);
  const mutation = useRef(false);
  const mounted = useRef(true);
  const creationHolds = useRef(new Set<CreationKind>());
  const [uncertainCreations, setUncertainCreations] = useState<CreationKind[]>([]);
  const [createdTarget, setCreatedTarget] = useState("");
  const [previewOpen, setPreviewOpen] = useState(false);
  const [cancelReady, setCancelReady] = useState(false);
  const [duplicateTarget, setDuplicateTarget] = useState("");
  const [copyProgress, setCopyProgress] = useState<{ confirmed: number; total: number; uncertain: boolean } | null>(null);
  const isNew = id === "new";

  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);

  useEffect(() => {
    if (!organizerId) return;
    const controller = new AbortController();
    async function load() {
      const organizerTask = api.organizers.get(organizerId, { signal: controller.signal });
      if (isNew) return { organizer: await organizerTask, tickets: [] as ApiTicketType[] };
      const [organizer, event, tickets] = await Promise.all([organizerTask, api.events.get(id, { signal: controller.signal }), api.ticketTypes.list(id, { includeHidden: true, signal: controller.signal })]);
      if (event.organizer_profile_id !== organizer.id) throw new Error("This event belongs to a different organizer profile. Open the matching profile before changing it.");
      return { organizer, event, tickets };
    }
    load().then(
      (value) => { if (!controller.signal.aborted) setResult({ status: "ready", value }); },
      (cause: unknown) => { if (!controller.signal.aborted) setResult({ status: "error", message: errorText(cause) }); },
    );
    return () => controller.abort();
  }, [id, organizerId, isNew, attempt]);

  async function run(task: () => Promise<void>, message: string) {
    if (!mounted.current || mutation.current) return;
    mutation.current = true;
    setBusy(true);
    setFeedback(null);
    try { await task(); if (mounted.current) setFeedback({ message, error: false }); }
    catch (cause) { if (mounted.current) setFeedback({ message: errorText(cause), error: true }); }
    finally { mutation.current = false; if (mounted.current) setBusy(false); }
  }

  function setEvent(event: ApiEvent) {
    if (!mounted.current) return;
    setResult((current) => current.status === "ready" ? { ...current, value: { ...current.value, event } } : current);
    setRevision((value) => value + 1);
    setPreviewOpen(false);
  }

  function holdUncertainCreation(kind: CreationKind, cause: unknown) {
    if (!mounted.current || !uncertainOutcome(cause)) return;
    creationHolds.current.add(kind);
    setUncertainCreations((current) => current.includes(kind) ? current : [...current, kind]);
  }

  if (!organizerId) return <WorkspaceShell title={t("Choose an organizer profile first.")} description={t("An organizer reference is required to create or manage an event.")}><Link className="btn btn-primary" href="/workspace">{t("Open an organizer profile")}</Link></WorkspaceShell>;
  if (result.status === "loading") return <LoadingPage />;
  const workspaceUrl = `/workspace?organizer=${encodeURIComponent(organizerId)}`;
  if (result.status === "error") return <WorkspaceShell title={t("Could not open this workspace.")} description={t("The backend request failed. No browser demo data was substituted.")}><Notice error>{result.message}</Notice><div className="button-row"><button className="btn btn-secondary" onClick={() => { setResult({ status: "loading" }); setAttempt((value) => value + 1); }}>{t("Try again")}</button><Link className="btn btn-secondary" href={workspaceUrl}>{t("Choose another reference")}</Link></div></WorkspaceShell>;

  const { organizer, event, tickets } = result.value;
  const editable = !event || ["draft", "published"].includes(event.status);
  const allocated = tickets.reduce((sum, ticket) => sum + ticket.quantity, 0);

  function saveEvent(input: EventCreateInput | EventUpdateInput) {
    if (!event && creationHolds.current.has("event")) return;
    void run(async () => {
      if (event) setEvent(await api.events.update(event.id, input as EventUpdateInput));
      else {
        let created: ApiEvent;
        try { created = await api.events.create(input as EventCreateInput); }
        catch (cause) { holdUncertainCreation("event", cause); throw cause; }
        creationHolds.current.add("event");
        if (!mounted.current) return;
        const target = `/workspace/events/${encodeURIComponent(created.id)}?organizer=${encodeURIComponent(organizer.id)}`;
        setCreatedTarget(target);
        router.push(target);
      }
    }, event ? t("Event details saved to the backend.") : t("Draft event created."));
  }

  function saveTicket(input: TicketTypeCreateInput, ticketId?: string) {
    if (!event || (!ticketId && creationHolds.current.has("ticket"))) return;
    void run(async () => {
      let saved: ApiTicketType;
      try { saved = ticketId ? await api.ticketTypes.update(ticketId, input) : await api.ticketTypes.create(event.id, input); }
      catch (cause) { if (!ticketId) holdUncertainCreation("ticket", cause); throw cause; }
      if (!mounted.current) return;
      setResult((current) => current.status === "ready" ? { ...current, value: { ...current.value, tickets: ticketId ? current.value.tickets.map((item) => item.id === ticketId ? saved : item) : [...current.value.tickets, saved] } } : current);
      setTicketRevisions((current) => ({ ...current, [ticketId ?? "new"]: (current[ticketId ?? "new"] ?? 0) + 1 }));
      setPreviewOpen(false);
    }, t("Ticket definition saved to the backend."));
  }

  function duplicate(submitEvent: FormEvent<HTMLFormElement>) {
    submitEvent.preventDefault();
    if (!event || creationHolds.current.has("duplicate")) return;
    const data = new FormData(submitEvent.currentTarget);
    void run(async () => {
      const start_at = isoTime(data.get("start_at"))!;
      const end_at = isoTime(data.get("end_at"))!;
      if (Date.parse(end_at) <= Date.parse(start_at)) throw new Error(t("The duplicate must end after it starts."));
      const title = String(data.get("title")).trim();
      if (title.length < 3 || title.length > 255) throw new Error(t("Use 3–255 characters for the new event title."));
      let draft: ApiEvent;
      try { draft = await api.events.create({ organizer_profile_id: organizer.id, title, start_at, end_at, description: event.description, visibility: event.visibility, seating_type: event.seating_type, capacity: event.capacity, venue_name: event.venue_name, venue_address: event.venue_address, city: event.city, category: event.category }); }
      catch (cause) { holdUncertainCreation("duplicate", cause); throw cause; }
      creationHolds.current.add("duplicate");
      if (!mounted.current) return;
      const target = `/workspace/events/${encodeURIComponent(draft.id)}?organizer=${encodeURIComponent(organizer.id)}`;
      setDuplicateTarget(target);
      let copied = 0;
      const total = data.get("copy_tickets") === "on" ? tickets.length : 0;
      setCopyProgress({ confirmed: 0, total, uncertain: false });
      if (data.get("copy_tickets") === "on") {
        try {
          for (const ticket of tickets) {
            if (!mounted.current) return;
            await api.ticketTypes.create(draft.id, { name: ticket.name, description: ticket.description, price_kzt: ticket.price_kzt, quantity: ticket.quantity, max_per_order: ticket.max_per_order, sale_start: null, sale_end: null, is_hidden: ticket.is_hidden });
            copied++;
            if (mounted.current) setCopyProgress({ confirmed: copied, total, uncertain: false });
          }
        } catch (cause) {
          if (mounted.current) setCopyProgress({ confirmed: copied, total, uncertain: uncertainOutcome(cause) });
          throw new Error(`${t("The new draft was created, but ticket copying did not finish. Review its saved ticket types before adding anything else.")} ${errorText(cause)}`);
        }
      }
      if (mounted.current) router.push(target);
    }, t("New draft created without copying transactions or attendees."));
  }

  return <WorkspaceShell title={event ? event.title : t("Start with a new draft.")} description={`${organizer.display_name} · ${event ? t("Manage this backend event and its ticket definitions.") : t("Add event details, then configure its ticket types before publication.")}`} action={<Link className="text-link" href={workspaceUrl}><Icon name="back" size={16} />{t("Organizer workspace")}</Link>}>
    {feedback && <Notice error={feedback.error}>{feedback.message}</Notice>}
    {uncertainCreations.length > 0 && <section className="backend-panel"><Notice error>{t("The last creation request may have been saved even though confirmation was lost. Check your saved links or known records before creating another record. Nothing will be retried automatically.")}</Notice><button className="btn btn-secondary" disabled={busy} onClick={() => { uncertainCreations.forEach((kind) => creationHolds.current.delete(kind)); setUncertainCreations([]); }}>{t("I checked existing records; enable another creation attempt")}</button></section>}
    {event && <>
      <section className="backend-panel backend-event-summary">
        <div><span className="status-badge">{t(event.status)}</span><span className="status-badge">{t(event.visibility)}</span><code>{event.id}</code></div>
        <dl className="backend-facts"><div><dt>{t("Starts")}</dt><dd>{dateTime(event.start_at, locale)}</dd></div><div><dt>{t("Ends")}</dt><dd>{dateTime(event.end_at, locale)}</dd></div><div><dt>{t("Allocation")}</dt><dd>{allocated} / {event.capacity}<small>{t("Not live remaining inventory")}</small></dd></div><div><dt>{t("Paid sales")}</dt><dd>{event.paid_sales_activated_at ? t("Activated") : t("Not activated")}</dd></div></dl>
        <div className="button-row"><button className="btn btn-secondary" onClick={() => setPreviewOpen((value) => !value)} disabled={busy}>{previewOpen ? t("Close event preview") : t("Preview saved event")}</button><button className="btn btn-secondary" disabled={busy} onClick={() => { setPreviewOpen(false); setCancelReady(false); setResult({ status: "loading" }); setAttempt((value) => value + 1); }}>{t("Refresh saved event")}</button><Link className="btn btn-secondary" href={`/events/${encodeURIComponent(event.id)}`}>{t("Open event page")}{" "}<Icon name="external" size={15} /></Link>
          {event.status === "draft" && <button className="btn btn-primary" disabled={busy || !previewOpen || !tickets.length || allocated > event.capacity} onClick={() => void run(async () => setEvent(await api.events.publish(event.id)), t("Event published. Public events can now appear in discovery."))}>{busy ? t("Working…") : t("Publish event")}</button>}
        </div>
        {event.status === "draft" && <p className="field-hint">{t("Add at least one ticket type and preview the saved draft before publication. Unpublishing is not supported yet.")}</p>}
      </section>
      {previewOpen && <EventPreview event={event} tickets={tickets} />}
    </>}
    {editable ? <section className="backend-panel"><h2>{event ? t("Event details") : t("The essentials")}</h2>{createdTarget ? <><Notice>{t("Draft creation is confirmed. Open the saved draft to continue.")}</Notice><Link className="btn btn-primary" href={createdTarget}>{t("Open the created draft")}</Link></> : <EventForm key={`event-${revision}`} organizerId={organizer.id} event={event} tickets={tickets} busy={busy} blocked={!event && uncertainCreations.includes("event")} onSave={saveEvent} />}</section> : <Notice>{t("This event is retained for reference. Its event and ticket definitions are read-only.")}</Notice>}
    {event && <>
      <section className="backend-panel">
        <h2>{t("Ticket definitions")}</h2>
        <p className="muted">{allocated} {t("allocated places across")}{" "}{tickets.length} {t("ticket types. Sold, held, refunded, and checked-in counts need order and admission services and are not inferred from these allocations.")}</p>
        {tickets.length ? <div className="backend-ticket-list">{tickets.map((ticket) => <article className="backend-ticket-card" key={`${ticket.id}-${ticketRevisions[ticket.id] ?? 0}`}>
          <div className="backend-ticket-summary"><div><h3>{ticket.name}</h3><p>{ticket.description}</p><code>{ticket.id}</code></div><strong>{ticket.price_kzt === 0 ? t("Free") : money(ticket.price_kzt, locale)}</strong></div>
          <dl className="backend-facts"><div><dt>{t("Allocated")}</dt><dd>{ticket.quantity}</dd></div><div><dt>{t("Per order")}</dt><dd>{ticket.max_per_order}</dd></div><div><dt>{t("Visibility")}</dt><dd>{ticket.is_hidden ? t("Hidden") : t("Visible")}</dd></div><div><dt>{t("Sales window")}</dt><dd>{ticket.sale_start ? dateTime(ticket.sale_start, locale) : t("No start restriction")}<small>{ticket.sale_end ? `${t("Until")} ${dateTime(ticket.sale_end, locale)}` : t("No end restriction")}</small></dd></div></dl>
          {editable && <details><summary>{t("Edit ticket type")}</summary><TicketForm event={event} tickets={tickets} ticket={ticket} busy={busy} onSave={saveTicket} /></details>}
        </article>)}</div> : <EmptyState title={t("Add the first ticket type.")} description={t("Create a free or paid ticket definition before publishing this draft.")} />}
        {editable && <details className="backend-add-ticket" open={tickets.length === 0}><summary><Icon name="plus" size={16} />{t("Add a ticket type")}</summary><TicketForm key={`new-ticket-${ticketRevisions.new ?? 0}`} event={event} tickets={tickets} busy={busy} blocked={uncertainCreations.includes("ticket")} onSave={saveTicket} /></details>}
      </section>
      <section className="backend-panel"><h2>{t("Connected services")}</h2><p className="muted">{t("Checkout, payment activation, seating holds, sales analytics, operational event history, and support for backend records remain unavailable until their services are connected. No local demo transaction is created for this event.")}</p></section>
      <details className="backend-panel backend-duplicate"><summary>{t("Reuse event configuration in a new draft")}</summary>
        <p className="muted">{t("Copy event details and optionally ticket definitions. Orders, issued tickets, payments, check-ins, and support cases are never copied. Ticket sale windows reset so you can choose new dates.")}</p>
        {duplicateTarget ? <>{copyProgress && <Notice>{t("Confirmed ticket types copied: {confirmed} of {total}.", { confirmed: copyProgress.confirmed, total: copyProgress.total })}{copyProgress.uncertain && ` ${t("The last copy request may also have succeeded. Review the saved draft before adding or retrying ticket types.")}`}</Notice>}{busy ? <p role="status">{t("Copying ticket definitions…")}</p> : <Link className="btn btn-primary" href={duplicateTarget}>{t("Open the created draft")}{" "}<Icon name="arrow" size={16} /></Link>}</> : <form className="stack-form" onSubmit={duplicate} aria-busy={busy}><fieldset disabled={busy || uncertainCreations.includes("duplicate")}>
          <label>{t("New event title")}<input name="title" required minLength={3} maxLength={255} defaultValue={`${event.title.slice(0, 248)} (copy)`} /></label>
          <div className="backend-form-grid"><label>{t("New start in Kazakhstan time")}<input name="start_at" type="datetime-local" step={60} required /></label><label>{t("New end in Kazakhstan time")}<input name="end_at" type="datetime-local" step={60} required /></label></div>
          <label className="backend-checkbox"><input type="checkbox" name="copy_tickets" defaultChecked /><span>{t("Copy ticket definitions, with new ticket-type IDs")}</span></label>
          <p className="field-hint">{t("Draft creation and ticket copies are separate requests. If a ticket copy fails, the created draft remains available for you to finish.")}</p>
          <button className="btn btn-secondary" disabled={busy}>{busy ? t("Creating draft…") : t("Create a separate draft")}</button>
        </fieldset></form>}
      </details>
      {editable && <section className="backend-panel backend-cancel"><h2>{t("Cancel event")}</h2><p className="muted">{t("Cancellation stops further event edits through the current API. It does not initiate refunds or send cancellation emails.")}</p>{cancelReady ? <div className="button-row"><button className="btn btn-primary" disabled={busy} onClick={() => void run(async () => { setEvent(await api.events.cancel(event.id)); if (mounted.current) setCancelReady(false); }, t("Event cancelled. Refunds and notifications were not initiated."))}>{t("Confirm event cancellation")}</button><button className="btn btn-secondary" disabled={busy} onClick={() => setCancelReady(false)}>{t("Keep event")}</button></div> : <button className="btn btn-secondary" disabled={busy} onClick={() => setCancelReady(true)}>{t("Cancel this event")}</button>}</section>}
    </>}
  </WorkspaceShell>;
}

export function BackendWorkspace({ route, query }: { route: string[]; query: Record<string, string> }) {
  const organizerId = query.organizer ?? "";
  if (route[1] === "events" && route[2]) return <EventWorkspace key={`${route[2]}-${organizerId}`} id={route[2]} organizerId={organizerId} />;
  return <OrganizerLookup key={organizerId} organizerId={organizerId} />;
}
