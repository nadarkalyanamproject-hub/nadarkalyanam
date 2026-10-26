import { ApiError } from './api-client';

// GET /profiles/me can fail for reasons that go away on their own: the
// network isn't back yet after a laptop wakes, or the API is still starting
// up (5xx). Those are retried a few times with growing gaps. Anything else
// isn't: a 401 has already been through the token refresh in request(), and
// a 403/404 won't change by asking again.
export const PROFILE_RETRY_DELAYS_MS = [1000, 3000, 8000];

// After the tab has been hidden this long, coming back refetches the profile.
export const PROFILE_STALE_AFTER_HIDDEN_MS = 60_000;

export function isTemporaryFailure(error: unknown): boolean {
  if (error instanceof ApiError) return error.status >= 500;
  // fetch() rejects with a TypeError when the request never got a response.
  return error instanceof TypeError;
}

export function shouldRefetchOnVisible(hiddenAt: number | null, now: number): boolean {
  return hiddenAt !== null && now - hiddenAt > PROFILE_STALE_AFTER_HIDDEN_MS;
}

interface ProfileLoaderOptions<T> {
  load: () => Promise<T>;
  delays?: readonly number[];
  sleep?: (ms: number) => Promise<void>;
}

// Returns a function that loads with retries. Calls made while a load is
// already running share it, so two fetches never run at once.
export function createProfileLoader<T>({
  load,
  delays = PROFILE_RETRY_DELAYS_MS,
  sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
}: ProfileLoaderOptions<T>): () => Promise<T> {
  let inFlight: Promise<T> | null = null;

  async function loadWithRetry(): Promise<T> {
    for (let attempt = 0; ; attempt++) {
      try {
        return await load();
      } catch (error) {
        if (attempt >= delays.length || !isTemporaryFailure(error)) throw error;
        await sleep(delays[attempt]);
      }
    }
  }

  return () => {
    inFlight ??= loadWithRetry().finally(() => {
      inFlight = null;
    });
    return inFlight;
  };
}
