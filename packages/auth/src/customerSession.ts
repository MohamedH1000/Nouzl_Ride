import type { SupabaseClient } from '@supabase/supabase-js';
import type { AuthState, SessionProvider } from './types';

const AUTH_CALL_TIMEOUT_MS = 5000;
const AUTH_LOADING_CEILING_MS = 6000;

function withTimeout<T>(promise: PromiseLike<T>, ms: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => setTimeout(() => reject(new Error('Auth call timed out')), ms)),
  ]);
}

/**
 * Customer app session, backed directly by @supabase/supabase-js. Ports the
 * behaviours Nouzl_Platform's AuthProvider.tsx learned the hard way (see its
 * 450-line history) rather than re-deriving them from scratch:
 *
 *  - AUTH_CALL_TIMEOUT_MS per network call + an absolute
 *    AUTH_LOADING_CEILING_MS so `status` is GUARANTEED to leave 'loading' —
 *    on web, unbounded calls on a redirect-return screen (payment result,
 *    email activation) previously stranded users on the splash forever.
 *  - refreshUserData() never re-raises loading once cleared — doing so
 *    popped the splash back over an already-rendered screen.
 *  - onAuthStateChange deliberately IGNORES 'SIGNED_IN' / 'INITIAL_SESSION':
 *    'SIGNED_IN' fires while still AAL1 with a pending MFA challenge, so the
 *    sign-in SCREEN (not this provider) owns post-login/MFA navigation by
 *    calling refresh() itself once MFA is satisfied.
 *  - 'TOKEN_REFRESHED' / 'USER_UPDATED' update session state silently — no
 *    profile refetch on every token refresh.
 */
export function createCustomerSessionProvider(supabase: SupabaseClient): SessionProvider {
  let state: AuthState = { status: 'loading', userId: null, isActivated: null };
  const listeners = new Set<(s: AuthState) => void>();

  function setState(next: AuthState) {
    state = next;
    listeners.forEach((l) => l(state));
  }

  async function fetchActivation(userId: string): Promise<boolean | null> {
    try {
      const { data, error } = await withTimeout(
        supabase.from('profiles').select('is_activated').eq('id', userId).single(),
        AUTH_CALL_TIMEOUT_MS,
      );
      if (error || !data) return null;
      return Boolean((data as { is_activated: boolean }).is_activated);
    } catch {
      return null; // Network hiccup — don't block the loading gate on this; screens re-check on their own.
    }
  }

  async function refresh(): Promise<void> {
    const ceiling = setTimeout(() => {
      // Absolute ceiling: whatever refresh() is doing, the UI must not sit
      // on a splash forever. If we somehow haven't already resolved a
      // terminal state by here, force signedOut rather than hang.
      if (state.status === 'loading') setState({ status: 'signedOut', userId: null, isActivated: null });
    }, AUTH_LOADING_CEILING_MS);

    try {
      const { data } = await withTimeout(supabase.auth.getSession(), AUTH_CALL_TIMEOUT_MS);
      const session = data.session;
      if (!session) {
        setState({ status: 'signedOut', userId: null, isActivated: null });
        return;
      }
      const isActivated = await fetchActivation(session.user.id);
      setState({ status: 'signedIn', userId: session.user.id, isActivated });
    } catch {
      // A failed getSession() doesn't necessarily mean signed out — but a
      // hung one must not hang the UI. Land on signedOut; the app's own
      // retry affordances (pull-to-refresh, app resume) recover from a
      // transient network failure without ever leaving the user stuck on
      // a splash screen.
      setState({ status: 'signedOut', userId: null, isActivated: null });
    } finally {
      clearTimeout(ceiling);
    }
  }

  supabase.auth.onAuthStateChange((event, session) => {
    if (event === 'SIGNED_OUT') {
      setState({ status: 'signedOut', userId: null, isActivated: null });
      return;
    }
    if (event === 'TOKEN_REFRESHED' || event === 'USER_UPDATED') {
      if (session && state.status === 'signedIn') {
        setState({ ...state, userId: session.user.id });
      }
      return;
    }
    // SIGNED_IN / INITIAL_SESSION deliberately ignored — see docblock above.
  });

  void refresh();

  return {
    getState: () => state,
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    async getAccessToken() {
      const { data } = await supabase.auth.getSession();
      return data.session?.access_token ?? null;
    },
    async signOut() {
      await supabase.auth.signOut();
      setState({ status: 'signedOut', userId: null, isActivated: null });
    },
    refresh,
  };
}
