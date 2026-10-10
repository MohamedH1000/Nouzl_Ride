/**
 * One interface, two implementations — the dependency inversion that lets
 * both apps share every screen-level auth pattern (loading gates, protected
 * routes, activation gates) while the actual credential mechanics differ
 * completely underneath:
 *
 *  - customer app: @supabase/supabase-js owns sign-in/refresh/MFA directly.
 *  - business app: the B1 token pair (POST /partner-auth/token, /refresh,
 *    /logout on Nouzl_Backend) — see partner-token.service.ts.
 *
 * Screens and packages/ui components should depend on THIS interface, never
 * on `supabase.auth.*` or the token-pair calls directly.
 */
export interface AuthState {
  status: 'loading' | 'signedOut' | 'signedIn';
  /** Present only when status === 'signedIn'. */
  userId: string | null;
  /** Mirrors profiles.is_activated / partner_users.is_activated — screens
   *  gate on this the same way both web apps' account-pending screens do. */
  isActivated: boolean | null;
}

export interface SessionProvider {
  getState(): AuthState;
  subscribe(listener: (state: AuthState) => void): () => void;
  /** Returns the current bearer token, refreshing first if needed. Wired
   *  directly into RestClientConfig.getAuthToken. */
  getAccessToken(): Promise<string | null>;
  signOut(): Promise<void>;
  /**
   * Re-derives `status`/`userId`/`isActivated` from the underlying auth
   * mechanism right now, rather than waiting for the next event the
   * provider happens to react to on its own. The customer provider's
   * `onAuthStateChange` deliberately ignores `SIGNED_IN`/`INITIAL_SESSION`
   * (see its docblock — `SIGNED_IN` fires at AAL1 with a pending MFA
   * challenge, before it's safe to call the guest actually signed in), so
   * nothing else ever transitions `status` out of `signedOut` after an
   * interactive sign-in. The sign-in screen calling this explicitly, once
   * per successful credentials submit AND once per successful MFA verify,
   * is what closes that gap — not a fallback, the only path in.
   */
  refresh(): Promise<void>;
}
