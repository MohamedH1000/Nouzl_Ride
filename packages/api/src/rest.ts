/**
 * The one REST client both apps use. Nouzl_Platform has three coexisting
 * fetch patterns (a shared apiClient, hand-rolled per-service fetch, and
 * direct Supabase); mobile gets exactly one, and every domain hook module
 * (useProperty, usePartnerDashboard, ...) imports only from here — never
 * `fetch` directly, never `supabase.from()` inside a component.
 *
 * Deliberately does NOT import from @nouzl/auth — that would make this
 * package depend on a specific session strategy, when the whole point is
 * that the customer app (Supabase session) and business app (B1 token pair)
 * use different ones. Callers configure `getAuthToken`/`onUnauthorized` once
 * at app boot (see each app's own src/lib/api.ts) — dependency inversion,
 * not this package reaching upward to decide how a token is obtained.
 */

export class ApiError extends Error {
  readonly status: number;
  readonly body: unknown;

  constructor(message: string, status: number, body: unknown) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.body = body;
  }
}

export interface RestClientConfig {
  baseUrl: string;
  /** Returns the current bearer token, or null when signed out. Read fresh
   *  on every call — never cache a token across requests, matching
   *  Nouzl_Platform's apiClient.ts convention ("always re-fetch the session
   *  immediately before the call"). */
  getAuthToken?: () => Promise<string | null>;
  /** Called once on a 401 that survives a single token refresh + retry —
   *  the session is genuinely dead, not just momentarily stale. */
  onUnauthorized?: () => void;
  /** Per-call timeout. Nouzl_Platform's withTimeout.ts invariant: any call
   *  that can strand a user on a redirect-return screen must be bounded. */
  timeoutMs?: number;
}

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';
  body?: unknown;
  auth?: boolean; // default true — set false for public endpoints
  /** Opt into bounded retry on 5xx/network failure. Default false.
   *  NEVER set true for POST /bookings/create or any payment
   *  checkout/resolve route — a retried booking-create or checkout is a
   *  double-charge risk, not a convenience. */
  retryable?: boolean;
  /** Extra headers merged in after Content-Type/Authorization — e.g. an
   *  `Idempotency-Key` a caller generated once per logical mutation attempt
   *  (see useBookings.ts's useUpdateBookingStatus for the pattern). Cannot
   *  override Content-Type or Authorization. */
  headers?: Record<string, string>;
  signal?: AbortSignal;
}

const DEFAULT_TIMEOUT_MS = 15000;
const RETRY_DELAYS_MS = [300, 900]; // 2 retries, jittered below

function jitter(ms: number): number {
  return ms + Math.floor(Math.random() * ms * 0.3);
}

function isRetryableFailure(status: number | null): boolean {
  // null status = network/timeout failure (no response at all). 5xx = server
  // fault. Never retry a 4xx — that is the server correctly rejecting the
  // request as it was sent; retrying it verbatim will only fail again.
  return status === null || status >= 500;
}

export class RestClient {
  constructor(private readonly config: RestClientConfig) {}

  get<T>(path: string, opts?: Omit<RequestOptions, 'method' | 'body'>) {
    return this.request<T>(path, { ...opts, method: 'GET' });
  }
  post<T>(path: string, body?: unknown, opts?: Omit<RequestOptions, 'method' | 'body'>) {
    return this.request<T>(path, { ...opts, method: 'POST', body });
  }
  patch<T>(path: string, body?: unknown, opts?: Omit<RequestOptions, 'method' | 'body'>) {
    return this.request<T>(path, { ...opts, method: 'PATCH', body });
  }
  put<T>(path: string, body?: unknown, opts?: Omit<RequestOptions, 'method' | 'body'>) {
    return this.request<T>(path, { ...opts, method: 'PUT', body });
  }
  delete<T>(path: string, opts?: Omit<RequestOptions, 'method' | 'body'>) {
    return this.request<T>(path, { ...opts, method: 'DELETE' });
  }

  private async request<T>(path: string, opts: RequestOptions): Promise<T> {
    const { method = 'GET', body, auth = true, retryable = false } = opts;
    const attempts = retryable ? RETRY_DELAYS_MS.length + 1 : 1;

    let lastError: unknown;
    for (let attempt = 0; attempt < attempts; attempt++) {
      if (attempt > 0) {
        await new Promise((resolve) => setTimeout(resolve, jitter(RETRY_DELAYS_MS[attempt - 1])));
      }
      try {
        return await this.attempt<T>(path, method, body, auth, opts.headers, opts.signal);
      } catch (error) {
        lastError = error;
        const status = error instanceof ApiError ? error.status : null;
        if (!retryable || !isRetryableFailure(status)) throw error;
        // else: fall through to the next attempt
      }
    }
    throw lastError;
  }

  private async attempt<T>(
    path: string,
    method: NonNullable<RequestOptions['method']>,
    body: unknown,
    auth: boolean,
    extraHeaders?: Record<string, string>,
    externalSignal?: AbortSignal,
  ): Promise<T> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.config.timeoutMs ?? DEFAULT_TIMEOUT_MS);
    externalSignal?.addEventListener('abort', () => controller.abort());

    const headers: Record<string, string> = { ...extraHeaders, 'Content-Type': 'application/json' };
    if (auth && this.config.getAuthToken) {
      const token = await this.config.getAuthToken();
      if (token) headers.Authorization = `Bearer ${token}`;
    }

    try {
      const response = await fetch(`${this.config.baseUrl}/api${path}`, {
        method,
        headers,
        body: body !== undefined ? JSON.stringify(body) : undefined,
        signal: controller.signal,
      });

      if (response.status === 204) return undefined as T;

      const text = await response.text();
      const parsed = text ? safeJsonParse(text) : undefined;

      if (!response.ok) {
        if (response.status === 401) this.config.onUnauthorized?.();
        const message =
          (parsed && typeof parsed === 'object' && parsed !== null && 'message' in parsed
            ? String((parsed as { message: unknown }).message)
            : undefined) ?? `Request failed with status ${response.status}`;
        throw new ApiError(message, response.status, parsed);
      }

      return parsed as T;
    } catch (error) {
      if (error instanceof ApiError) throw error;
      if (controller.signal.aborted) {
        throw new ApiError('Request timed out', 0, null);
      }
      throw new ApiError(error instanceof Error ? error.message : 'Network request failed', 0, null);
    } finally {
      clearTimeout(timeout);
    }
  }
}

function safeJsonParse(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    // A non-JSON body (an HTML error page from a misconfigured proxy, e.g.
    // an http->https redirect silently downgrading POST to GET — the exact
    // failure mode Nouzl_Platform's resolveApiUrl() guards against) should
    // surface as a readable error, not "Unexpected token '<'".
    return { message: text.slice(0, 200) };
  }
}
