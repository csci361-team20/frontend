/**
 * All browser requests to the backend go through this module.
 *
 * Requests go to the same-origin proxy at /api/backend, which adds the
 * signed-in user's token (kept in an httpOnly cookie). Sign-in and sign-out
 * use /api/auth/login and /api/auth/logout.
 */

import type {
  ApiEvent,
  CalendarLinks,
  EventImage,
  ListedEvent,
  PublicOrganizer,
  TicketType,
} from "./events";
import type { Attendee, Order, Quote, SeatMap, Selection, TicketDetail } from "./orders";

export type EventFilters = {
  q?: string;
  city?: string;
  category?: string;
  starts_from?: string;
  starts_to?: string;
  sort?: "start_at" | "-start_at";
};

export type Language = "en" | "ru" | "kk";

export type ApiUser = {
  id: string;
  full_name: string;
  email: string;
  created_at: string;
  is_email_verified: boolean;
  is_platform_admin: boolean;
  preferred_language: Language;
};

export type UserRegistration = {
  full_name: string;
  email: string;
  password: string;
  preferred_language?: Language;
};

export type OrganizerProfile = {
  id: string;
  display_name: string;
  [key: string]: unknown;
};

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export function isUserId(value: string) {
  return /^[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}$/i.test(value);
}

function parseUser(value: unknown): ApiUser {
  if (
    typeof value !== "object" ||
    value === null ||
    !("id" in value) ||
    typeof value.id !== "string" ||
    !isUserId(value.id) ||
    !("full_name" in value) ||
    typeof value.full_name !== "string" ||
    !("email" in value) ||
    typeof value.email !== "string" ||
    !("created_at" in value) ||
    typeof value.created_at !== "string" ||
    Number.isNaN(Date.parse(value.created_at))
  ) {
    throw new ApiError(
      "The server returned an unexpected profile. Please try again later.",
      502,
    );
  }
  const record = value as Record<string, unknown>;
  const language = record.preferred_language;
  // Copy only the known fields, even if the server adds other properties.
  return {
    id: value.id,
    full_name: value.full_name,
    email: value.email,
    created_at: value.created_at,
    is_email_verified: record.is_email_verified === true,
    is_platform_admin: record.is_platform_admin === true,
    preferred_language: language === "ru" || language === "kk" ? language : "en",
  };
}

export function errorMessage(status: number, body: unknown) {
  if (status >= 500) {
    const detail =
      typeof body === "object" && body !== null && "detail" in body ? body.detail : undefined;
    return typeof detail === "string" && status === 502
      ? detail
      : "The BiletFlow service is unavailable. Please try again later.";
  }
  const detail =
    typeof body === "object" && body !== null && "detail" in body
      ? body.detail
      : undefined;
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail)) {
    const messages = detail.flatMap((item: unknown) => {
      if (
        typeof item !== "object" ||
        item === null ||
        !("msg" in item) ||
        typeof item.msg !== "string"
      ) return [];
      const field =
        "loc" in item && Array.isArray(item.loc)
          ? item.loc
              .filter((part: unknown) => part !== "body" && part !== "query")
              .join(" ")
              .replaceAll("_", " ")
          : "";
      const message = item.msg.replace(/^Value error, /, "");
      return [field ? `${field}: ${message}` : message];
    });
    if (messages.length) return messages.join(". ");
  }
  if (status === 401) return "Please sign in to continue.";
  if (status === 403) return "You do not have access to this.";
  if (status === 404) return "This could not be found.";
  if (status === 409) return "This conflicts with the current state. Refresh and try again.";
  return "The request could not be completed. Please check your details and try again.";
}

export type Query = Record<string, string | number | boolean | null | undefined | (string | number)[]>;

export type RequestOptions = {
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  body?: unknown;
  form?: FormData;
  query?: Query;
  signal?: AbortSignal;
};

function queryString(query?: Query) {
  if (!query) return "";
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value === undefined || value === null || value === "") continue;
    if (Array.isArray(value)) value.forEach((item) => params.append(key, String(item)));
    else params.set(key, String(value));
  }
  const text = params.toString();
  return text ? `?${text}` : "";
}

export function createApiClient({
  baseUrl = "/api/backend",
  authUrl = "/api/auth",
  fetch: transport = globalThis.fetch,
  timeoutMs = 15_000,
}: {
  baseUrl?: string;
  authUrl?: string;
  fetch?: typeof globalThis.fetch;
  timeoutMs?: number;
} = {}) {
  async function raw(url: string, options: RequestOptions = {}): Promise<Response> {
    const controller = new AbortController();
    const cancel = () => controller.abort();
    options.signal?.addEventListener("abort", cancel, { once: true });
    if (options.signal?.aborted) cancel();
    const timeout = setTimeout(cancel, timeoutMs);
    const hasJson = options.body !== undefined;
    try {
      const response = await transport(url, {
        method: options.method ?? (hasJson || options.form ? "POST" : "GET"),
        headers: {
          Accept: "application/json",
          ...(hasJson ? { "Content-Type": "application/json" } : {}),
        },
        ...(hasJson ? { body: JSON.stringify(options.body) } : {}),
        ...(options.form ? { body: options.form } : {}),
        cache: "no-store",
        credentials: "same-origin",
        signal: controller.signal,
      });
      if (!response.ok) {
        const body: unknown = await response.json().catch(() => null);
        throw new ApiError(errorMessage(response.status, body), response.status);
      }
      return response;
    } catch (error) {
      if (options.signal?.aborted)
        throw new DOMException("Request cancelled", "AbortError");
      if (error instanceof ApiError) throw error;
      throw new ApiError(
        controller.signal.aborted
          ? "BiletFlow took too long to respond. Please try again."
          : "Could not reach BiletFlow. Please check your connection and try again.",
        0,
      );
    } finally {
      clearTimeout(timeout);
      options.signal?.removeEventListener("abort", cancel);
    }
  }

  /** JSON request to the backend; resolves to the parsed body (null for 204). */
  async function request<T = unknown>(path: string, options: RequestOptions = {}): Promise<T> {
    const response = await raw(
      `${baseUrl.replace(/\/$/, "")}${path}${queryString(options.query)}`,
      options,
    );
    if (response.status === 204) return null as T;
    const body: unknown = await response.json().catch((error: unknown) => {
      if (error instanceof SyntaxError) return null;
      throw error;
    });
    return body as T;
  }

  /** A same-origin URL for links that download files (PDF, .ics, CSV). */
  function fileUrl(path: string, query?: Query) {
    return `${baseUrl.replace(/\/$/, "")}${path}${queryString(query)}`;
  }

  return {
    request,
    fileUrl,
    auth: {
      async signIn(email: string, password: string) {
        await raw(`${authUrl}/login`, { method: "POST", body: { email, password } });
      },
      async signOut() {
        await raw(`${authUrl}/logout`, { method: "POST" });
      },
      signOutEverywhere: () => request("/auth/logout", { method: "POST" }),
      requestVerification: () =>
        request<{ detail: string }>("/auth/verify-email/request", { method: "POST" }),
      confirmVerification: async (token: string) =>
        parseUser(await request("/auth/verify-email/confirm", { body: { token } })),
      requestPasswordReset: (email: string) =>
        request<{ detail: string }>("/auth/password-reset/request", { body: { email } }),
      confirmPasswordReset: (token: string, new_password: string) =>
        request("/auth/password-reset/confirm", { body: { token, new_password } }),
      changePassword: (current_password: string, new_password: string) =>
        request("/auth/change-password", { body: { current_password, new_password } }),
    },
    users: {
      register: async (input: UserRegistration) =>
        parseUser(await request("/users", { body: input })),
      async get(id: string, options: { signal?: AbortSignal } = {}) {
        if (!isUserId(id)) throw new ApiError("Enter a valid account ID.", 400);
        return parseUser(await request(`/users/${encodeURIComponent(id)}`, options));
      },
      me: async (options: { signal?: AbortSignal } = {}) =>
        parseUser(await request("/users/me", options)),
      updateMe: async (input: { full_name?: string; preferred_language?: Language }) =>
        parseUser(await request("/users/me", { method: "PATCH", body: input })),
    },
    organizers: {
      me: (options: { signal?: AbortSignal } = {}) =>
        request<OrganizerProfile>("/organizers/me", options),
      get: (id: string, options: { signal?: AbortSignal } = {}) =>
        request<PublicOrganizer>(`/organizers/${encodeURIComponent(id)}`, options),
    },
    events: {
      /** Published public events that have not ended, soonest first. */
      list: (filters: EventFilters = {}, options: { signal?: AbortSignal } = {}) =>
        request<ListedEvent[]>("/events/", { ...options, query: { limit: 200, ...filters } }),
      get: (id: string, options: { signal?: AbortSignal } = {}) =>
        request<ApiEvent>(`/events/${encodeURIComponent(id)}`, options),
      ticketTypes: (id: string, options: { signal?: AbortSignal } = {}) =>
        request<TicketType[]>(`/events/${encodeURIComponent(id)}/ticket-types`, options),
      images: (id: string, options: { signal?: AbortSignal } = {}) =>
        request<EventImage[]>(`/events/${encodeURIComponent(id)}/images`, options),
      calendarLinks: (id: string, options: { signal?: AbortSignal } = {}) =>
        request<CalendarLinks>(`/events/${encodeURIComponent(id)}/calendar-links`, options),
      calendarFile: (id: string) => fileUrl(`/events/${encodeURIComponent(id)}/calendar.ics`),
      seatMap: (id: string, options: { signal?: AbortSignal } = {}) =>
        request<SeatMap>(`/events/${encodeURIComponent(id)}/seat-map`, options),
      quote: (id: string, selection: Selection, promo_code?: string) =>
        request<Quote>(`/events/${encodeURIComponent(id)}/quote`, {
          body: { ...selection, promo_code: promo_code || null },
        }),
      promoLink: (token: string) =>
        request<{ event_id: string; code: string; campaign_name: string; discount_label: string }>(
          `/promo-links/${encodeURIComponent(token)}`,
        ),
    },
    orders: {
      create: (
        eventId: string,
        selection: Selection,
        extra: { promo_code?: string; attendees?: Attendee[] } = {},
      ) =>
        request<Order>(`/events/${encodeURIComponent(eventId)}/orders`, {
          body: {
            ...selection,
            promo_code: extra.promo_code || null,
            ...(extra.attendees ? { attendees: extra.attendees } : {}),
          },
        }),
      mine: (options: { signal?: AbortSignal } = {}) => request<Order[]>("/orders/mine", options),
      get: (id: string, options: { signal?: AbortSignal } = {}) =>
        request<Order>(`/orders/${encodeURIComponent(id)}`, options),
      pay: (id: string, outcome: "success" | "failure" = "success") =>
        request<Order>(`/orders/${encodeURIComponent(id)}/pay`, {
          body: outcome === "failure" ? { outcome, failure_reason: "Card declined (simulated)" } : { outcome },
        }),
      cancel: (id: string) =>
        request<Order>(`/orders/${encodeURIComponent(id)}/cancel`, { method: "POST" }),
      cancelRegistration: (id: string, reason?: string) =>
        request<Order>(`/orders/${encodeURIComponent(id)}/cancel-registration`, {
          body: { reason: reason || null },
        }),
      refund: (id: string, reason: string) =>
        request<Order>(`/orders/${encodeURIComponent(id)}/refund`, { body: { reason } }),
      pdf: (id: string) => fileUrl(`/orders/${encodeURIComponent(id)}/tickets.pdf`),
    },
    tickets: {
      mine: (options: { signal?: AbortSignal } = {}) =>
        request<TicketDetail[]>("/tickets/mine", options),
      pdf: (id: string) => fileUrl(`/tickets/${encodeURIComponent(id)}/pdf`),
    },
  };
}

export const api = createApiClient();
