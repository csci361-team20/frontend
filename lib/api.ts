import type {
  ApiEvent, ApiOrganizerProfile, ApiTicketType, ApiUser, EventCreateInput,
  EventListQuery, EventUpdateInput, OrganizerProfileCreateInput, OrganizerProfileUpdateInput,
  TicketTypeCreateInput, TicketTypeUpdateInput, UserRegistration, UserUpdateInput,
} from "./api-types";

export type * from "./api-types";

export class ApiError extends Error {
  constructor(message: string, public readonly status: number) {
    super(message);
    this.name = "ApiError";
  }
}

export function isUserId(value: string) {
  return /^[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}$/i.test(value);
}

function invalid(label: string): never {
  throw new ApiError(`The server returned an unexpected ${label}. Please try again later.`, 502);
}

function record(value: unknown, label: string): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) invalid(label);
  return value as Record<string, unknown>;
}

function field<T>(value: unknown, valid: (v: unknown) => boolean, label: string): T {
  if (!valid(value)) invalid(label);
  return value as T;
}

const string = (v: unknown) => typeof v === "string";
const uuid = (v: unknown) => string(v) && isUserId(v as string);
const date = (v: unknown) => string(v) && !Number.isNaN(Date.parse(v as string));
const nullableString = (v: unknown) => v === null || string(v);
const nullableDate = (v: unknown) => v === null || date(v);
const integer = (v: unknown) => typeof v === "number" && Number.isSafeInteger(v) && v >= 0;
const positive = (v: unknown) => integer(v) && (v as number) > 0;
const boolean = (v: unknown) => typeof v === "boolean";
const oneOf = (...values: string[]) => (v: unknown) => string(v) && values.includes(v as string);

function parseUser(value: unknown): ApiUser {
  const data = record(value, "profile");
  return {
    id: field(data.id, uuid, "profile"),
    full_name: field(data.full_name, string, "profile"),
    email: field(data.email, string, "profile"),
    created_at: field(data.created_at, date, "profile"),
  };
}

function parseOrganizer(value: unknown): ApiOrganizerProfile {
  const data = record(value, "organizer profile");
  return {
    id: field(data.id, uuid, "organizer profile"),
    user_id: field(data.user_id, uuid, "organizer profile"),
    display_name: field(data.display_name, string, "organizer profile"),
    verification_status: field(data.verification_status, oneOf("pending", "verified", "rejected"), "organizer profile"),
  };
}

function parseEvent(value: unknown): ApiEvent {
  const data = record(value, "event");
  const result: ApiEvent = {
    id: field(data.id, uuid, "event"),
    organizer_profile_id: field(data.organizer_profile_id, uuid, "event"),
    title: field(data.title, string, "event"),
    description: field(data.description, nullableString, "event"),
    status: field(data.status, oneOf("draft", "published", "cancelled", "completed"), "event"),
    visibility: field(data.visibility, oneOf("public", "unlisted", "private"), "event"),
    seating_type: field(data.seating_type, oneOf("general_admission", "assigned"), "event"),
    start_at: field(data.start_at, date, "event"),
    end_at: field(data.end_at, date, "event"),
    capacity: field(data.capacity, positive, "event"),
    paid_sales_activated_at: field(data.paid_sales_activated_at, nullableDate, "event"),
    venue_name: field(data.venue_name, nullableString, "event"),
    venue_address: field(data.venue_address, nullableString, "event"),
    city: field(data.city, nullableString, "event"),
    category: field(data.category, nullableString, "event"),
    created_at: field(data.created_at, date, "event"),
  };
  if (Date.parse(result.end_at) <= Date.parse(result.start_at)) invalid("event");
  return result;
}

function parseTicketType(value: unknown): ApiTicketType {
  const data = record(value, "ticket type");
  return {
    id: field(data.id, uuid, "ticket type"),
    event_id: field(data.event_id, uuid, "ticket type"),
    name: field(data.name, string, "ticket type"),
    description: field(data.description, nullableString, "ticket type"),
    price_kzt: field(data.price_kzt, integer, "ticket type"),
    quantity: field(data.quantity, positive, "ticket type"),
    max_per_order: field(data.max_per_order, positive, "ticket type"),
    sale_start: field(data.sale_start, nullableDate, "ticket type"),
    sale_end: field(data.sale_end, nullableDate, "ticket type"),
    is_hidden: field(data.is_hidden, boolean, "ticket type"),
    created_at: field(data.created_at, date, "ticket type"),
  };
}

function listOf<T>(parse: (v: unknown) => T, label: string) {
  return (value: unknown) => {
    if (!Array.isArray(value)) invalid(label);
    return value.map(parse);
  };
}

function errorMessage(status: number, body: unknown, account: boolean) {
  const service = account ? "account service" : "backend service";
  if (status >= 500) return `The ${service} is unavailable. Please try again later.`;
  const detail = typeof body === "object" && body !== null && "detail" in body ? body.detail : undefined;
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail)) {
    const messages = detail.flatMap((item: unknown) => {
      if (typeof item !== "object" || item === null || !("msg" in item) || typeof item.msg !== "string") return [];
      const location = "loc" in item && Array.isArray(item.loc) ? item.loc.filter((part: unknown) => part !== "body" && (typeof part === "string" || typeof part === "number")).join(" ").replaceAll("_", " ") : "";
      return [location ? `${location}: ${item.msg}` : item.msg];
    });
    if (messages.length) return messages.join(". ");
  }
  if (status === 404) return account ? "This account could not be found." : "This record could not be found.";
  if (status === 409) return account ? "An account with this email already exists." : "This change conflicts with an existing record.";
  return "The request could not be completed. Please check your details and try again.";
}

type RequestOptions = { method?: "GET" | "POST" | "PATCH"; body?: unknown; signal?: AbortSignal };
type ReadOptions = { signal?: AbortSignal };

export function createApiClient({ baseUrl = "/api/backend", fetch: transport = globalThis.fetch, timeoutMs = 15_000 }: { baseUrl?: string; fetch?: typeof globalThis.fetch; timeoutMs?: number } = {}) {
  async function request<T>(path: string, parse: (v: unknown) => T, options: RequestOptions = {}): Promise<T> {
    const controller = new AbortController();
    const cancel = () => controller.abort();
    options.signal?.addEventListener("abort", cancel, { once: true });
    if (options.signal?.aborted) cancel();
    const timeout = setTimeout(cancel, timeoutMs);
    const account = path.startsWith("/users");
    const service = account ? "account service" : "backend service";
    try {
      const response = await transport(`${baseUrl.replace(/\/$/, "")}${path}`, {
        method: options.method ?? "GET",
        headers: { Accept: "application/json", ...(options.body !== undefined ? { "Content-Type": "application/json" } : {}) },
        ...(options.body !== undefined ? { body: JSON.stringify(options.body) } : {}),
        cache: "no-store",
        credentials: "omit",
        signal: controller.signal,
      });
      const body: unknown = response.status === 204 ? undefined : await response.json().catch((error: unknown) => {
        if (error instanceof SyntaxError) return null;
        throw error;
      });
      if (!response.ok) throw new ApiError(errorMessage(response.status, body, account), response.status);
      return parse(body);
    } catch (error) {
      if (options.signal?.aborted) throw new DOMException("Request cancelled", "AbortError");
      if (error instanceof ApiError) throw error;
      throw new ApiError(controller.signal.aborted ? `The ${service} took too long to respond. Please try again.` : `Could not reach the ${service}. Please check your connection and try again.`, 0);
    } finally {
      clearTimeout(timeout);
      options.signal?.removeEventListener("abort", cancel);
    }
  }

  function idPath(id: string, resource: string) {
    if (!isUserId(id)) throw new ApiError(`Enter a valid ${resource} ID.`, 400);
    return encodeURIComponent(id);
  }

  return {
    users: {
      register: (input: UserRegistration) => request("/users", parseUser, { method: "POST", body: input }),
      async get(id: string, options: ReadOptions = {}) { return request(`/users/${idPath(id, "account")}`, parseUser, options); },
      async update(id: string, input: UserUpdateInput) { return request(`/users/${idPath(id, "account")}`, parseUser, { method: "PATCH", body: input }); },
    },
    organizers: {
      async create(userId: string, input: OrganizerProfileCreateInput) { return request(`/organizers/${idPath(userId, "account")}`, parseOrganizer, { method: "POST", body: input }); },
      async get(id: string, options: ReadOptions = {}) { return request(`/organizers/${idPath(id, "organizer")}`, parseOrganizer, options); },
      async update(id: string, input: OrganizerProfileUpdateInput) { return request(`/organizers/${idPath(id, "organizer")}`, parseOrganizer, { method: "PATCH", body: { display_name: input.display_name } }); },
    },
    events: {
      async list(query: EventListQuery = {}, options: ReadOptions = {}) {
        const skip = query.skip ?? 0;
        const limit = query.limit ?? 24;
        if (!Number.isSafeInteger(skip) || skip < 0 || !Number.isSafeInteger(limit) || limit < 1 || limit > 100) throw new ApiError("Choose a valid event page.", 400);
        const params = new URLSearchParams({ skip: String(skip), limit: String(limit) });
        if (query.city?.trim()) params.set("city", query.city.trim());
        if (query.category?.trim()) params.set("category", query.category.trim());
        return request(`/events?${params}`, listOf(parseEvent, "event list"), options);
      },
      async get(id: string, options: ReadOptions = {}) { return request(`/events/${idPath(id, "event")}`, parseEvent, options); },
      create: (input: EventCreateInput) => request("/events", parseEvent, { method: "POST", body: input }),
      async update(id: string, input: EventUpdateInput) { return request(`/events/${idPath(id, "event")}`, parseEvent, { method: "PATCH", body: input }); },
      async publish(id: string) { return request(`/events/${idPath(id, "event")}/publish`, parseEvent, { method: "POST" }); },
      async cancel(id: string) { return request(`/events/${idPath(id, "event")}/cancel`, parseEvent, { method: "POST" }); },
    },
    ticketTypes: {
      async list(eventId: string, options: ReadOptions & { includeHidden?: boolean } = {}) {
        return request(`/events/${idPath(eventId, "event")}/ticket-types${options.includeHidden ? "?include_hidden=true" : ""}`, listOf(parseTicketType, "ticket-type list"), options);
      },
      async get(id: string, options: ReadOptions = {}) { return request(`/ticket-types/${idPath(id, "ticket type")}`, parseTicketType, options); },
      async create(eventId: string, input: TicketTypeCreateInput) { return request(`/events/${idPath(eventId, "event")}/ticket-types`, parseTicketType, { method: "POST", body: input }); },
      async update(id: string, input: TicketTypeUpdateInput) { return request(`/ticket-types/${idPath(id, "ticket type")}`, parseTicketType, { method: "PATCH", body: input }); },
    },
  };
}

export const api = createApiClient();
