import { describe, expect, it, vi } from 'vitest';
import { bearerTokenOf, createSessionRefresher, type SessionTokens } from '@nadar-kalyanam/ui/session-refresh';

function setup(stored: Partial<SessionTokens>, respond: () => Promise<Response>) {
  let tokens = { ...stored };
  const fetchImpl = vi.fn(respond);
  const write = vi.fn((next: SessionTokens) => {
    tokens = next;
  });
  const refresh = createSessionRefresher({
    apiBaseUrl: 'http://api',
    lockName: 'test',
    read: () => tokens,
    write,
    fetchImpl: fetchImpl as unknown as typeof fetch,
    locks: undefined,
  });
  return { refresh, fetchImpl, write, current: () => tokens };
}

const ok = (body: SessionTokens) => Promise.resolve(new Response(JSON.stringify(body), { status: 200 }));

describe('createSessionRefresher', () => {
  it('spends the stored refresh token once and stores the new pair', async () => {
    const { refresh, fetchImpl, current } = setup({ accessToken: 'a1', refreshToken: 'r1' }, () => ok({ accessToken: 'a2', refreshToken: 'r2' }));

    await expect(refresh('a1')).resolves.toEqual({ kind: 'refreshed', accessToken: 'a2' });

    expect(fetchImpl).toHaveBeenCalledWith('http://api/auth/refresh', expect.objectContaining({ body: JSON.stringify({ refreshToken: 'r1' }) }));
    expect(current()).toEqual({ accessToken: 'a2', refreshToken: 'r2' });
  });

  it('concurrent 401s share one refresh call (a refresh token is never spent twice)', async () => {
    const { refresh, fetchImpl } = setup({ accessToken: 'a1', refreshToken: 'r1' }, () => ok({ accessToken: 'a2', refreshToken: 'r2' }));

    const outcomes = await Promise.all([refresh('a1'), refresh('a1'), refresh('a1')]);

    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(outcomes.every((o) => o.kind === 'refreshed' && o.accessToken === 'a2')).toBe(true);
  });

  it('adopts a token another tab already refreshed instead of spending the refresh token again', async () => {
    const { refresh, fetchImpl } = setup({ accessToken: 'a2', refreshToken: 'r2' }, () => ok({ accessToken: 'x', refreshToken: 'y' }));

    await expect(refresh('a1')).resolves.toEqual({ kind: 'refreshed', accessToken: 'a2' });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('a rejected refresh token (401) means the session is over', async () => {
    const { refresh } = setup({ accessToken: 'a1', refreshToken: 'r1' }, () => Promise.resolve(new Response('{}', { status: 401 })));
    await expect(refresh('a1')).resolves.toEqual({ kind: 'expired' });
  });

  it('no stored refresh token means the session is over', async () => {
    const { refresh, fetchImpl } = setup({ accessToken: 'a1' }, () => ok({ accessToken: 'x', refreshToken: 'y' }));
    await expect(refresh('a1')).resolves.toEqual({ kind: 'expired' });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('a network failure or server error keeps the session (unavailable, not expired)', async () => {
    const offline = setup({ accessToken: 'a1', refreshToken: 'r1' }, () => Promise.reject(new TypeError('Failed to fetch')));
    await expect(offline.refresh('a1')).resolves.toEqual({ kind: 'unavailable' });
    const down = setup({ accessToken: 'a1', refreshToken: 'r1' }, () => Promise.resolve(new Response('{}', { status: 503 })));
    await expect(down.refresh('a1')).resolves.toEqual({ kind: 'unavailable' });
    expect(down.current()).toEqual({ accessToken: 'a1', refreshToken: 'r1' });
  });
});

describe('bearerTokenOf', () => {
  it('reads the bearer token from a plain headers object', () => {
    expect(bearerTokenOf({ Authorization: 'Bearer abc', 'Content-Type': 'application/json' })).toBe('abc');
    expect(bearerTokenOf({ 'Content-Type': 'application/json' })).toBeUndefined();
    expect(bearerTokenOf(undefined)).toBeUndefined();
  });
});
