import * as SecureStore from 'expo-secure-store';
import type { AuthState, SessionProvider } from './types';

const REFRESH_TOKEN_KEY = 'nouzl.business.refreshToken';
const ACCESS_TOKEN_TTL_SAFETY_MARGIN_MS = 60 * 1000; // refresh a minute before the server-declared expiry
/** A token call that gets no answer in this long is treated as offline. */
const TOKEN_CALL_TIMEOUT_MS = 10 * 1000;
/** Boot retries a network failure after these delays (ms) before giving up. */
const BOOT_RETRY_DELAYS_MS = [1500, 3500];

/**
 * The token endpoint could not be reached or failed on its side (offline,
 * timeout, 5xx, 429). Unlike a 4xx rejection, this says nothing about the
 * refresh token, so it must never end the session.
 */
export class TransientAuthError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'TransientAuthError';
  }
}

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * expo-secure-store has no web implementation in this SDK/bundler
 * combination — every call throws "ExpoSecureStore.default.
 * getValueWithKeyAsync is not a function" rather than degrading. These
 * three apps are native-first (see the plan); `expo start --web` exists
 * only as a development/visual-verification convenience here, not a
 * shipped target, so on web a session simply never persists across a
 * reload — acceptable for that use, and correctly distinct from any other
 * SecureStore failure (a real device's Keychain/Keystore genuinely being
 * unavailable), which this also has to degrade rather than crash on rather
 * than silently swallowing a same-family bug elsewhere.
 */
async function safeGetItem(key: string): Promise<string | null> {
  try {
    return await SecureStore.getItemAsync(key);
  } catch {
    return null;
  }
}
async function safeSetItem(key: string, value: string): Promise<void> {
  try {
    await SecureStore.setItemAsync(key, value);
  } catch {
    // Best-effort — see the docblock above.
  }
}
async function safeDeleteItem(key: string): Promise<void> {
  try {
    await SecureStore.deleteItemAsync(key);
  } catch {
    // Best-effort — see the docblock above.
  }
}

interface TokenPair {
  accessToken: string;
  refreshToken: string;
  expiresIn: number; // seconds
  partner: { id: string; email: string; businessName: string | null };
}

export interface BusinessSessionConfig {
  baseUrl: string;
}

/**
 * Merchant app session, backed by the B1 partner token pair
 * (POST /partner-auth/token, /refresh, /logout on Nouzl_Backend — see
 * src/partner-auth/partner-token.service.ts). Deliberately does NOT use
 * @supabase/supabase-js directly: the business app has no anon-key-safe way
 * to read partner data (nouzl_business's direct-Supabase reads all go
 * through a JWT self-signed with SUPABASE_JWT_SECRET, a secret that can
 * never ship inside an app binary — see the plan's Blocker 2). All partner
 * data instead goes through the REST endpoints from Phase 0's B3 work,
 * authenticated with the access token this provider manages.
 *
 * Access token: held in memory only, never persisted — a 15-minute HS256
 * JWT is cheap to re-mint and there's no reason to put it at rest.
 * Refresh token: SecureStore only, never AsyncStorage — it's a 60-day bearer
 * credential for the account.
 *
 * Single-flight refresh: concurrent 401s from multiple in-flight requests
 * must not each independently call /refresh (the B1 rotation-with-reuse-
 * detection logic would treat the second concurrent call as a replay of an
 * already-rotated token and revoke the whole session). All callers awaiting
 * a refresh share one in-flight promise.
 */
export function createBusinessSessionProvider(config: BusinessSessionConfig): BusinessSessionProvider {
  let state: AuthState = { status: 'loading', userId: null, isActivated: null };
  const listeners = new Set<(s: AuthState) => void>();
  let accessToken: string | null = null;
  let accessTokenExpiresAt = 0;
  let refreshInFlight: Promise<string | null> | null = null;
  // Not part of the shared AuthState (customer's Supabase-backed
  // implementation has no equivalent) — kept alongside it the same way
  // ingestTokenPair() sits outside SessionProvider, exposed only through
  // BusinessSessionProvider's own extra method below.
  let partnerInfo: { email: string; businessName: string | null } | null = null;

  function setState(next: AuthState) {
    state = next;
    listeners.forEach((l) => l(state));
  }

  function applyTokenPair(pair: TokenPair) {
    accessToken = pair.accessToken;
    accessTokenExpiresAt = Date.now() + pair.expiresIn * 1000;
    partnerInfo = { email: pair.partner.email, businessName: pair.partner.businessName };
    setState({ status: 'signedIn', userId: pair.partner.id, isActivated: true });
  }

  async function persistRefreshToken(token: string) {
    await safeSetItem(REFRESH_TOKEN_KEY, token);
  }

  async function clearSession() {
    accessToken = null;
    accessTokenExpiresAt = 0;
    partnerInfo = null;
    await safeDeleteItem(REFRESH_TOKEN_KEY);
    setState({ status: 'signedOut', userId: null, isActivated: null });
  }

  /**
   * `null` = the server rejected the refresh token (4xx): the session is over.
   * Throws TransientAuthError when the server could not be reached or failed
   * (offline, timeout, 5xx, 429). Both used to be wrong: a network error
   * left boot stuck on the splash forever (a partner opening the app with
   * no signal), and a 5xx read as a rejection and signed the partner out.
   */
  async function callTokenEndpoint(path: 'refresh' | 'logout', refreshToken: string): Promise<TokenPair | null> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TOKEN_CALL_TIMEOUT_MS);
    let response: Response;
    try {
      response = await fetch(`${config.baseUrl}/api/partner-auth/${path}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken }),
        signal: controller.signal,
      });
    } catch (error) {
      throw new TransientAuthError(`partner-auth/${path} unreachable: ${String(error)}`);
    } finally {
      clearTimeout(timer);
    }
    if (response.status >= 500 || response.status === 429) {
      throw new TransientAuthError(`partner-auth/${path} failed with ${response.status}`);
    }
    if (!response.ok) return null;
    const json = (await response.json()) as {
      accessToken?: string;
      refreshToken?: string;
      expiresIn?: number;
      partner?: { id: string; email: string; businessName: string | null };
    };
    if (path === 'logout' || !json.accessToken || !json.refreshToken || json.expiresIn === undefined) return null;
    return {
      accessToken: json.accessToken,
      refreshToken: json.refreshToken,
      expiresIn: json.expiresIn,
      partner: json.partner ?? { id: '', email: '', businessName: null },
    };
  }

  /**
   * Rehydrates from the stored refresh token on boot, and always leaves
   * 'loading'. If the server stays unreachable after the retries, it shows
   * the signed-out screen but KEEPS the refresh token, so the next launch
   * with a connection restores the session.
   */
  async function bootstrap(): Promise<void> {
    const stored = await safeGetItem(REFRESH_TOKEN_KEY);
    if (!stored) {
      setState({ status: 'signedOut', userId: null, isActivated: null });
      return;
    }
    let pair: TokenPair | null = null;
    for (let attempt = 0; ; attempt++) {
      try {
        pair = await callTokenEndpoint('refresh', stored);
        break;
      } catch (error) {
        if (!(error instanceof TransientAuthError) || attempt >= BOOT_RETRY_DELAYS_MS.length) {
          setState({ status: 'signedOut', userId: null, isActivated: null });
          return;
        }
        await delay(BOOT_RETRY_DELAYS_MS[attempt]);
      }
    }
    if (!pair) {
      await clearSession();
      return;
    }
    await persistRefreshToken(pair.refreshToken);
    applyTokenPair(pair);
  }

  async function doRefresh(): Promise<string | null> {
    const stored = await safeGetItem(REFRESH_TOKEN_KEY);
    if (!stored) {
      await clearSession();
      return null;
    }
    // A TransientAuthError propagates: that request fails, the session stays.
    const pair = await callTokenEndpoint('refresh', stored);
    if (!pair) {
      // The B1 endpoint already revokes the whole token family on reuse
      // detection server-side — a failed refresh here means this session is
      // genuinely over, not "try again".
      await clearSession();
      return null;
    }
    await persistRefreshToken(pair.refreshToken);
    applyTokenPair(pair);
    return pair.accessToken;
  }

  void bootstrap();

  return {
    getState: () => state,
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    /**
     * Ingests a token pair obtained directly from POST /partner-auth/token
     * (the sign-in screen's own call, after a successful login) without an
     * extra round-trip through /refresh. Not part of the SessionProvider
     * interface — sign-in is a one-time credential exchange, not an ongoing
     * session concern the customer-app implementation needs an equivalent
     * of.
     */
    async ingestTokenPair(pair: TokenPair) {
      await persistRefreshToken(pair.refreshToken);
      applyTokenPair(pair);
    },
    /** email/businessName from the token pair — `null` until signed in. */
    getPartnerInfo() {
      return partnerInfo;
    },
    async getAccessToken() {
      if (accessToken && Date.now() < accessTokenExpiresAt - ACCESS_TOKEN_TTL_SAFETY_MARGIN_MS) {
        return accessToken;
      }
      // Single-flight: join an in-progress refresh instead of starting a
      // second one — see the docblock above for why a second concurrent
      // /refresh call is actively dangerous here, not just wasteful.
      if (!refreshInFlight) {
        refreshInFlight = doRefresh().finally(() => {
          refreshInFlight = null;
        });
      }
      return refreshInFlight;
    },
    async signOut() {
      const stored = await safeGetItem(REFRESH_TOKEN_KEY);
      if (stored) {
        await callTokenEndpoint('logout', stored).catch(() => undefined); // best-effort server-side revoke
      }
      await clearSession();
    },
    // Business doesn't have the customer provider's gap this exists to
    // close — ingestTokenPair() already sets `signedIn` synchronously
    // right after a successful login, no event to wait on. Re-derives
    // from the stored refresh token, same as the constructor's own
    // bootstrap() — a sensible "re-check now" for the interface's sake.
    refresh: bootstrap,
  };
}

export type BusinessSessionProvider = SessionProvider & {
  ingestTokenPair(pair: TokenPair): Promise<void>;
  getPartnerInfo(): { email: string; businessName: string | null } | null;
};
