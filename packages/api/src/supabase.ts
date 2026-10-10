import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import * as SecureStore from 'expo-secure-store';

/**
 * expo-secure-store caps a single value at 2048 bytes (iOS Keychain /
 * Android Keystore backing). A Supabase session (access + refresh token +
 * metadata, base64) routinely exceeds that. Nouzl_Platform's web app
 * already deals with a version of this — its localStorage keys show up
 * chunked as `sb-*-auth-token.0` / `.1` when the browser's storage layer
 * splits a large value — so this adapter does the same thing deliberately
 * rather than by accident: split on write, reassemble on read.
 */
const CHUNK_SIZE = 1800; // headroom under the 2048-byte cap for the key+metadata overhead

/**
 * expo-secure-store has no web implementation in this SDK/bundler
 * combination — every call throws rather than degrading gracefully. Both
 * apps are native-first; `expo start --web` exists only as a development/
 * visual-verification convenience, not a shipped target, so on web a
 * session simply never persists across a reload. Wrapping every call keeps
 * that failure local (Supabase treats it as "no stored value") instead of
 * throwing out of GoTrueClient's own constructor and crashing the app.
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

class ChunkedSecureStoreAdapter {
  async getItem(key: string): Promise<string | null> {
    const meta = await safeGetItem(`${key}.chunks`);
    if (!meta) {
      // Not chunked — either absent, or written before chunking existed.
      return safeGetItem(key);
    }
    const count = parseInt(meta, 10);
    const parts: string[] = [];
    for (let i = 0; i < count; i++) {
      const part = await safeGetItem(`${key}.${i}`);
      if (part === null) return null; // a chunk went missing — treat as absent, never return a truncated session
      parts.push(part);
    }
    return parts.join('');
  }

  async setItem(key: string, value: string): Promise<void> {
    await this.removeItem(key); // clear any stale chunk count/leftover chunks from a shorter previous value first
    if (value.length <= CHUNK_SIZE) {
      await safeSetItem(key, value);
      return;
    }
    const chunks: string[] = [];
    for (let i = 0; i < value.length; i += CHUNK_SIZE) {
      chunks.push(value.slice(i, i + CHUNK_SIZE));
    }
    await Promise.all(chunks.map((chunk, i) => safeSetItem(`${key}.${i}`, chunk)));
    await safeSetItem(`${key}.chunks`, String(chunks.length));
  }

  async removeItem(key: string): Promise<void> {
    const meta = await safeGetItem(`${key}.chunks`);
    if (meta) {
      const count = parseInt(meta, 10);
      await Promise.all(Array.from({ length: count }, (_, i) => safeDeleteItem(`${key}.${i}`)));
      await safeDeleteItem(`${key}.chunks`);
    }
    await safeDeleteItem(key);
  }
}

export interface CreateNouzlSupabaseClientOptions {
  url: string;
  anonKey: string;
}

/**
 * The customer app's ONLY Supabase client. Ships the anon key — verified
 * safe against Nouzl_Backend's actual RLS policies (properties_select_active,
 * bookings_select_own, points_select_own, notifications_select_own, etc. —
 * see supabase/migrations/20260811164206_remote_schema.sql), the same
 * posture the guest web app already runs in production.
 *
 * The web app's `boundedAuthLock` (a Web Locks API timeout wrapper around
 * getSession()) is deliberately NOT ported — Web Locks doesn't exist on
 * native, and that code already degrades gracefully when navigator.locks is
 * absent, which is always true here.
 *
 * The business app must NOT use this — see @nouzl/auth's business session
 * strategy for why direct Supabase access from the merchant app requires a
 * secret (SUPABASE_JWT_SECRET) that can never ship on-device.
 */
export function createNouzlSupabaseClient({ url, anonKey }: CreateNouzlSupabaseClientOptions): SupabaseClient {
  return createClient(url, anonKey, {
    auth: {
      storage: new ChunkedSecureStoreAdapter(),
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,
    },
  });
}

export interface CreatePartnerRealtimeClientOptions {
  url: string;
  anonKey: string;
  /** Fetches (and caches/refreshes as needed) the short-lived Supabase-shaped
   *  JWT from `GET /partner-auth/realtime-token` — see Nouzl_Backend's
   *  PartnerTokenService.mintRealtimeToken(). Called on every request AND
   *  on every Realtime (re)connect, so the caller's own cache is what
   *  bounds how often the network call actually happens. */
  getToken: () => Promise<string | null>;
}

/**
 * The business app's ONLY Supabase client, and it is deliberately NOT a
 * GoTrue session — the merchant app has no Supabase auth user (partners
 * live in `partner_users`, not `auth.users`), and the JWT secret that
 * mirrors one (`SUPABASE_JWT_SECRET`) can never ship on-device (see this
 * file's `createNouzlSupabaseClient` docblock and the mobile plan's
 * Blocker 2). Supabase-js v2's `accessToken` callback exists for exactly
 * this shape — Clerk/Auth0-style external auth — and threads the returned
 * bearer token into both PostgREST requests and the Realtime handshake
 * without ever touching `auth.*`.
 *
 * Only `conversations`/`messages` are reachable this way: those are the
 * only two partner-facing tables with RLS policies keyed on
 * `auth.uid() = partner_id` (see Nouzl_Backend's remote_schema migration),
 * which is exactly what `sub` on the minted token resolves to. Every other
 * partner surface goes through `@nouzl/api`'s RestClient against the
 * `/partner/*` endpoints instead.
 */
export function createPartnerRealtimeClient({ url, anonKey, getToken }: CreatePartnerRealtimeClientOptions): SupabaseClient {
  return createClient(url, anonKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
    // `null`, not `anonKey`, when there is no partner token. supabase-js already
    // falls back to the key itself where that is valid, and knows where it is
    // NOT: a new-style `sb_publishable_…` key is not a JWT and must not be sent
    // as `Authorization: Bearer` to Edge Functions. Returning the key here
    // bypassed that logic and would break the day the project moves off the
    // legacy anon key (see Nouzl_Platform context/known-issues.md, 2026-09-14).
    // With today's legacy JWT anon key the resulting requests are identical.
    accessToken: async () => (await getToken()) ?? null,
  });
}
