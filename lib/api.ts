/** All browser requests to the backend go through this module. */
export type ApiUser = {
  id: string;
  full_name: string;
  email: string;
  created_at: string;
};

export type UserRegistration = {
  full_name: string;
  email: string;
  password: string;
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
  // Copy only the public fields, even if the server adds other properties.
  return {
    id: value.id,
    full_name: value.full_name,
    email: value.email,
    created_at: value.created_at,
  };
}

function errorMessage(status: number, body: unknown) {
  if (status >= 500)
    return "The account service is unavailable. Please try again later.";
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
              .filter((part: unknown) => part !== "body")
              .join(" ")
              .replaceAll("_", " ")
          : "";
      return [field ? `${field}: ${item.msg}` : item.msg];
    });
    if (messages.length) return messages.join(". ");
  }
  if (status === 404) return "This account could not be found.";
  if (status === 409) return "An account with this email already exists.";
  return "The request could not be completed. Please check your details and try again.";
}

export function createApiClient({
  baseUrl = "/api/backend",
  fetch: transport = globalThis.fetch,
  timeoutMs = 15_000,
}: { baseUrl?: string; fetch?: typeof globalThis.fetch; timeoutMs?: number } = {}) {
  async function request(
    path: string,
    options: { body?: UserRegistration; signal?: AbortSignal } = {},
  ) {
    const controller = new AbortController();
    const cancel = () => controller.abort();
    options.signal?.addEventListener("abort", cancel, { once: true });
    if (options.signal?.aborted) cancel();
    const timeout = setTimeout(cancel, timeoutMs);
    try {
      const response = await transport(`${baseUrl.replace(/\/$/, "")}${path}`, {
        method: options.body ? "POST" : "GET",
        headers: {
          Accept: "application/json",
          ...(options.body ? { "Content-Type": "application/json" } : {}),
        },
        ...(options.body ? { body: JSON.stringify(options.body) } : {}),
        cache: "no-store",
        credentials: "omit",
        signal: controller.signal,
      });
      const body: unknown = await response.json().catch((error: unknown) => {
        if (error instanceof SyntaxError) return null;
        throw error;
      });
      if (!response.ok)
        throw new ApiError(errorMessage(response.status, body), response.status);
      return parseUser(body);
    } catch (error) {
      if (options.signal?.aborted)
        throw new DOMException("Request cancelled", "AbortError");
      if (error instanceof ApiError) throw error;
      throw new ApiError(
        controller.signal.aborted
          ? "The account service took too long to respond. Please try again."
          : "Could not reach the account service. Please check your connection and try again.",
        0,
      );
    } finally {
      clearTimeout(timeout);
      options.signal?.removeEventListener("abort", cancel);
    }
  }

  return {
    users: {
      register: (input: UserRegistration) => request("/users", { body: input }),
      async get(id: string, options: { signal?: AbortSignal } = {}) {
        if (!isUserId(id)) throw new ApiError("Enter a valid account ID.", 400);
        return request(`/users/${encodeURIComponent(id)}`, options);
      },
    },
  };
}

export const api = createApiClient();
