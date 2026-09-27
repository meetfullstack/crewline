/**
 * Thin fetch wrapper for the Crewline API.
 *
 * Auth lives in httpOnly cookies, so requests just need `credentials`. When an
 * access token expires the first 401 triggers one refresh (shared across
 * concurrent requests) and the original request is retried.
 */

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
    public readonly details?: string[],
  ) {
    super(message);
    this.name = "ApiError";
  }
}

type Json = Record<string, unknown> | unknown[];

interface RequestOptions extends Omit<RequestInit, "body"> {
  body?: Json;
  /** Skip the refresh-and-retry dance (used by the auth endpoints themselves). */
  noRefresh?: boolean;
}

let refreshing: Promise<boolean> | null = null;

function refreshSession(): Promise<boolean> {
  refreshing ??= fetch("/api/auth/refresh", {
    method: "POST",
    credentials: "include",
  })
    .then((res) => res.ok)
    .catch(() => false)
    .finally(() => {
      refreshing = null;
    });
  return refreshing;
}

/** The session is gone (expired or revoked): send the user to sign in again. */
function redirectToLogin() {
  if (typeof window === "undefined" || window.location.pathname === "/login") {
    return;
  }
  const next = window.location.pathname + window.location.search;
  // A full reload (not router.push) is deliberate: it drops every cached
  // query that belonged to the expired session.
  // eslint-disable-next-line @next/next/no-location-assign-relative-destination
  window.location.assign(`/login?next=${encodeURIComponent(next)}`);
}

async function toError(res: Response): Promise<ApiError> {
  let message = res.statusText || "Request failed";
  let details: string[] | undefined;
  try {
    const data = (await res.json()) as { message?: string | string[] };
    if (Array.isArray(data.message)) {
      details = data.message;
      message = data.message[0] ?? message;
    } else if (data.message) {
      message = data.message;
    }
  } catch {
    // Non-JSON error body; keep the status text.
  }
  return new ApiError(res.status, message, details);
}

export async function api<T = unknown>(
  path: string,
  { body, noRefresh, headers, ...init }: RequestOptions = {},
): Promise<T> {
  const send = () =>
    fetch(`/api${path}`, {
      ...init,
      credentials: "include",
      headers: {
        ...(body ? { "Content-Type": "application/json" } : {}),
        ...headers,
      },
      body: body ? JSON.stringify(body) : undefined,
    });

  let res = await send();
  if (res.status === 401 && !noRefresh) {
    if (await refreshSession()) {
      res = await send();
    } else {
      redirectToLogin();
    }
  }

  if (!res.ok) throw await toError(res);
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}
