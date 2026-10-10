import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const store = new Map<string, string>();
vi.mock('expo-secure-store', () => ({
  getItemAsync: async (key: string) => store.get(key) ?? null,
  setItemAsync: async (key: string, value: string) => void store.set(key, value),
  deleteItemAsync: async (key: string) => void store.delete(key),
}));

import { createBusinessSessionProvider, TransientAuthError } from './businessSession';
import type { AuthState } from './types';

const KEY = 'nouzl.business.refreshToken';
const PAIR = {
  accessToken: 'access-1',
  refreshToken: 'refresh-2',
  expiresIn: 900,
  partner: { id: 'partner-1', email: 'p@example.test', businessName: 'Palm' },
};

function json(status: number, body: unknown = {}) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

/** Resolves once the provider leaves 'loading'. */
function settled(provider: ReturnType<typeof createBusinessSessionProvider>): Promise<AuthState> {
  return new Promise((resolve) => {
    if (provider.getState().status !== 'loading') return resolve(provider.getState());
    const unsubscribe = provider.subscribe((s) => {
      if (s.status !== 'loading') {
        unsubscribe();
        resolve(s);
      }
    });
  });
}

const fetchMock = vi.fn<typeof fetch>();

beforeEach(() => {
  store.clear();
  fetchMock.mockReset();
  vi.stubGlobal('fetch', fetchMock);
  vi.useFakeTimers({ shouldAdvanceTime: true });
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('business session boot', () => {
  it('is signed out at once with no stored token, without calling the server', async () => {
    const provider = createBusinessSessionProvider({ baseUrl: 'https://api.test' });
    expect((await settled(provider)).status).toBe('signedOut');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('restores the session from a stored refresh token and rotates it', async () => {
    store.set(KEY, 'refresh-1');
    fetchMock.mockResolvedValueOnce(json(200, PAIR));
    const provider = createBusinessSessionProvider({ baseUrl: 'https://api.test' });
    const state = await settled(provider);
    expect(state).toEqual({ status: 'signedIn', userId: 'partner-1', isActivated: true });
    expect(store.get(KEY)).toBe('refresh-2');
    expect(await provider.getAccessToken()).toBe('access-1');
  });

  it('ends the session when the server rejects the token (4xx)', async () => {
    store.set(KEY, 'refresh-1');
    fetchMock.mockResolvedValueOnce(json(401));
    const provider = createBusinessSessionProvider({ baseUrl: 'https://api.test' });
    expect((await settled(provider)).status).toBe('signedOut');
    expect(store.has(KEY)).toBe(false);
  });

  it('never hangs on the splash when offline, and keeps the token for next launch', async () => {
    store.set(KEY, 'refresh-1');
    fetchMock.mockRejectedValue(new TypeError('Network request failed'));
    const provider = createBusinessSessionProvider({ baseUrl: 'https://api.test' });
    const pending = settled(provider);
    await vi.advanceTimersByTimeAsync(6_000); // the two retry delays
    const state = await pending;
    expect(state.status).toBe('signedOut');
    expect(fetchMock).toHaveBeenCalledTimes(3); // first try + 2 retries
    expect(store.get(KEY)).toBe('refresh-1');
  });

  it('recovers when the connection comes back during the boot retries', async () => {
    store.set(KEY, 'refresh-1');
    fetchMock.mockRejectedValueOnce(new TypeError('Network request failed')).mockResolvedValueOnce(json(200, PAIR));
    const provider = createBusinessSessionProvider({ baseUrl: 'https://api.test' });
    expect((await settled(provider)).status).toBe('signedIn');
  });

  it('does not sign the partner out over a server error (5xx)', async () => {
    store.set(KEY, 'refresh-1');
    fetchMock.mockResolvedValue(json(502));
    const provider = createBusinessSessionProvider({ baseUrl: 'https://api.test' });
    const pending = settled(provider);
    await vi.advanceTimersByTimeAsync(6_000);
    expect((await pending).status).toBe('signedOut');
    expect(store.get(KEY)).toBe('refresh-1');
  });

  it('gives up on a call that never answers', async () => {
    store.set(KEY, 'refresh-1');
    fetchMock.mockImplementation(
      (_url, init) =>
        new Promise((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')));
        }),
    );
    const provider = createBusinessSessionProvider({ baseUrl: 'https://api.test' });
    const pending = settled(provider);
    await vi.advanceTimersByTimeAsync(3 * 10_000 + 6_000);
    expect((await pending).status).toBe('signedOut');
    expect(store.get(KEY)).toBe('refresh-1');
  });
});

describe('access token refresh while signed in', () => {
  async function signedIn() {
    store.set(KEY, 'refresh-1');
    fetchMock.mockResolvedValueOnce(json(200, { ...PAIR, expiresIn: 0 })); // already expired
    const provider = createBusinessSessionProvider({ baseUrl: 'https://api.test' });
    await settled(provider);
    return provider;
  }

  it('keeps the session through a network error', async () => {
    const provider = await signedIn();
    fetchMock.mockRejectedValueOnce(new TypeError('Network request failed'));
    await expect(provider.getAccessToken()).rejects.toBeInstanceOf(TransientAuthError);
    expect(provider.getState().status).toBe('signedIn');
    expect(store.has(KEY)).toBe(true);
  });

  it('shares one refresh between concurrent callers', async () => {
    const provider = await signedIn();
    fetchMock.mockResolvedValueOnce(json(200, { ...PAIR, accessToken: 'access-2', refreshToken: 'refresh-3' }));
    const [a, b] = await Promise.all([provider.getAccessToken(), provider.getAccessToken()]);
    expect([a, b]).toEqual(['access-2', 'access-2']);
    expect(fetchMock).toHaveBeenCalledTimes(2); // boot + one shared refresh
  });

  it('signs out when the refresh is rejected', async () => {
    const provider = await signedIn();
    fetchMock.mockResolvedValueOnce(json(401));
    expect(await provider.getAccessToken()).toBeNull();
    expect(provider.getState().status).toBe('signedOut');
  });
});
