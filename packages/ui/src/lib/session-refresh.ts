// Silent access-token refresh shared by the member and admin apps.
//
// When a request carrying a bearer token gets a 401, the app asks the
// refresher for a fresh access token and retries once. The API rotates
// refresh tokens and treats a reused one as theft (the whole session is
// revoked), so the refresher makes sure a refresh token is only ever spent
// once:
//  - concurrent 401s in this tab share one refresh call;
//  - across tabs, refreshes run one at a time under a Web Lock, and a tab
//    that finds the stored token already replaced (another tab refreshed)
//    adopts it instead of spending the refresh token again.

export interface SessionTokens {
  accessToken: string;
  refreshToken: string;
}

export type RefreshOutcome =
  // A new (or already-refreshed) access token to retry with.
  | { kind: 'refreshed'; accessToken: string }
  // The session is over (refresh token rejected or missing): sign out.
  | { kind: 'expired' }
  // Couldn't reach the API or it errored: keep the session, just fail this
  // request.
  | { kind: 'unavailable' };

export interface SessionRefresherOptions {
  apiBaseUrl: string;
  // Web Lock name, so this app's tabs refresh one at a time.
  lockName: string;
  // The tokens as currently stored (shared by every tab).
  read: () => Partial<SessionTokens>;
  // Store new tokens and update the app's in-memory auth state.
  write: (tokens: SessionTokens) => void;
  fetchImpl?: typeof fetch;
  locks?: Pick<LockManager, 'request'>;
}

export function createSessionRefresher(options: SessionRefresherOptions): (staleAccessToken: string) => Promise<RefreshOutcome> {
  const fetchImpl = options.fetchImpl ?? ((...args: Parameters<typeof fetch>) => fetch(...args));
  let inFlight: Promise<RefreshOutcome> | null = null;

  async function refresh(staleAccessToken: string): Promise<RefreshOutcome> {
    const stored = options.read();
    // Someone already replaced the token that just failed: use theirs.
    if (stored.accessToken && stored.refreshToken && stored.accessToken !== staleAccessToken) {
      options.write({ accessToken: stored.accessToken, refreshToken: stored.refreshToken });
      return { kind: 'refreshed', accessToken: stored.accessToken };
    }
    if (!stored.refreshToken) return { kind: 'expired' };

    let response: Response;
    try {
      response = await fetchImpl(`${options.apiBaseUrl}/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken: stored.refreshToken }),
      });
    } catch {
      return { kind: 'unavailable' };
    }
    if (response.status === 401 || response.status === 400) return { kind: 'expired' };
    if (!response.ok) return { kind: 'unavailable' };
    const tokens = (await response.json()) as SessionTokens;
    options.write(tokens);
    return { kind: 'refreshed', accessToken: tokens.accessToken };
  }

  return (staleAccessToken: string): Promise<RefreshOutcome> => {
    if (!inFlight) {
      const run = () => refresh(staleAccessToken);
      const locks = options.locks ?? (typeof navigator !== 'undefined' ? navigator.locks : undefined);
      const pending: Promise<RefreshOutcome> = locks ? (async () => await locks.request(options.lockName, run))() : run();
      inFlight = pending.finally(() => {
        inFlight = null;
      });
      return inFlight;
    }
    return inFlight;
  };
}

// The bearer token a request was sent with, if any.
export function bearerTokenOf(headers: HeadersInit | undefined): string | undefined {
  if (!headers) return undefined;
  const value =
    headers instanceof Headers
      ? headers.get('Authorization')
      : Array.isArray(headers)
        ? headers.find(([name]) => name.toLowerCase() === 'authorization')?.[1]
        : (headers as Record<string, string>).Authorization;
  return value?.startsWith('Bearer ') ? value.slice('Bearer '.length) : undefined;
}
