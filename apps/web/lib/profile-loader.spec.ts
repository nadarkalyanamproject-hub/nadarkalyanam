import { describe, expect, it, vi } from 'vitest';
import { ApiError } from './api-client';
import { createProfileLoader, isTemporaryFailure, shouldRefetchOnVisible } from './profile-loader';

function setup(outcomes: Array<'ok' | Error>) {
  const delays: number[] = [];
  let calls = 0;
  const load = vi.fn(async () => {
    const outcome = outcomes[Math.min(calls++, outcomes.length - 1)];
    if (outcome instanceof Error) throw outcome;
    return 'profile';
  });
  const loader = createProfileLoader({
    load,
    sleep: async (ms) => {
      delays.push(ms);
    },
  });
  return { loader, load, delays };
}

const serverError = () => new ApiError('Service unavailable', 503);
const networkError = () => new TypeError('Failed to fetch');

describe('createProfileLoader', () => {
  it('retries a 5xx with growing delays', async () => {
    const { loader, load, delays } = setup([serverError(), serverError(), 'ok']);
    await expect(loader()).resolves.toBe('profile');
    expect(load).toHaveBeenCalledTimes(3);
    expect(delays).toEqual([1000, 3000]);
  });

  it('retries a network error', async () => {
    const { loader, load } = setup([networkError(), 'ok']);
    await expect(loader()).resolves.toBe('profile');
    expect(load).toHaveBeenCalledTimes(2);
  });

  it.each([401, 403, 404])('does not retry a %i', async (status) => {
    const { loader, load, delays } = setup([new ApiError('nope', status)]);
    await expect(loader()).rejects.toMatchObject({ status });
    expect(load).toHaveBeenCalledTimes(1);
    expect(delays).toEqual([]);
  });

  it('gives up after three retries with the last error', async () => {
    const { loader, load, delays } = setup([serverError()]);
    await expect(loader()).rejects.toMatchObject({ status: 503 });
    expect(load).toHaveBeenCalledTimes(4);
    expect(delays).toEqual([1000, 3000, 8000]);
  });

  it('never runs two loads at once; calls made meanwhile share the running one', async () => {
    let running = 0;
    let maxRunning = 0;
    let release!: () => void;
    const load = vi.fn(async () => {
      running++;
      maxRunning = Math.max(maxRunning, running);
      await new Promise<void>((resolve) => {
        release = resolve;
      });
      running--;
      return 'profile';
    });
    const loader = createProfileLoader({ load, sleep: async () => {} });

    const first = loader();
    const second = loader();
    expect(second).toBe(first);
    release();
    await expect(Promise.all([first, second])).resolves.toEqual(['profile', 'profile']);
    expect(load).toHaveBeenCalledTimes(1);
    expect(maxRunning).toBe(1);

    // Once it's finished, the next call loads again.
    const third = loader();
    release();
    await third;
    expect(load).toHaveBeenCalledTimes(2);
  });

  it('a call during the retry wait joins the same load instead of starting another', async () => {
    let wake!: () => void;
    let calls = 0;
    const load = vi.fn(async () => {
      if (calls++ === 0) throw serverError();
      return 'profile';
    });
    const loader = createProfileLoader({
      load,
      sleep: () =>
        new Promise<void>((resolve) => {
          wake = resolve;
        }),
    });
    const first = loader();
    await vi.waitFor(() => expect(load).toHaveBeenCalledTimes(1));
    expect(loader()).toBe(first);
    wake();
    await expect(first).resolves.toBe('profile');
    expect(load).toHaveBeenCalledTimes(2);
  });
});

describe('isTemporaryFailure', () => {
  it('is true only for network errors and 5xx', () => {
    expect(isTemporaryFailure(networkError())).toBe(true);
    expect(isTemporaryFailure(new ApiError('x', 500))).toBe(true);
    expect(isTemporaryFailure(new ApiError('x', 502))).toBe(true);
    expect(isTemporaryFailure(new ApiError('x', 400))).toBe(false);
    expect(isTemporaryFailure(new ApiError('x', 401))).toBe(false);
    expect(isTemporaryFailure(new SyntaxError('bad json'))).toBe(false);
  });
});

describe('shouldRefetchOnVisible', () => {
  it('refetches only after the tab was hidden for more than a minute', () => {
    expect(shouldRefetchOnVisible(null, 100_000)).toBe(false);
    expect(shouldRefetchOnVisible(0, 60_000)).toBe(false);
    expect(shouldRefetchOnVisible(0, 60_001)).toBe(true);
  });
});
