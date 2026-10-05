import { describe, expect, it } from 'vitest';
import { OTP_LIMITS, OtpRateLimitException, OtpRateLimiter, waitPhrase } from './otp-rate-limiter.js';

// In-memory Redis covering the commands the limiter uses, with a controllable
// clock so window expiry can be tested without waiting.
function fakeRedis() {
  let now = 0;
  const store = new Map<string, { value: string; expiresAt: number | null }>();
  const live = (key: string) => {
    const entry = store.get(key);
    if (entry && entry.expiresAt !== null && entry.expiresAt <= now) store.delete(key);
    return store.get(key);
  };
  const redis = {
    set: async (key: string, value: string, _ex: 'EX', seconds: number, nx?: 'NX') => {
      if (nx && live(key)) return null;
      store.set(key, { value, expiresAt: now + seconds * 1000 });
      return 'OK';
    },
    incr: async (key: string) => {
      const entry = live(key);
      const next = Number(entry?.value ?? 0) + 1;
      store.set(key, { value: String(next), expiresAt: entry?.expiresAt ?? null });
      return next;
    },
    ttl: async (key: string) => {
      const entry = live(key);
      if (!entry) return -2;
      return entry.expiresAt === null ? -1 : Math.ceil((entry.expiresAt - now) / 1000);
    },
    del: async (...keys: string[]) => keys.filter((key) => store.delete(key)).length,
  };
  return { redis, advance: (seconds: number) => (now += seconds * 1000), has: (key: string) => Boolean(live(key)) };
}

const PHONE = '+919876543210';
const OTP_KEY = `otp:${PHONE}`;

async function rejection(promise: Promise<unknown>): Promise<OtpRateLimitException> {
  const error = await promise.then(
    () => null,
    (err: unknown) => err,
  );
  expect(error).toBeInstanceOf(OtpRateLimitException);
  return error as OtpRateLimitException;
}

describe('OtpRateLimiter — OTP requests', () => {
  it('allows 5 requests per phone in 10 minutes and refuses the 6th with 429 and a retry-after', async () => {
    const { redis } = fakeRedis();
    const limiter = new OtpRateLimiter(redis as never);

    for (let i = 0; i < OTP_LIMITS.requestsPerPhone.max; i += 1) {
      await limiter.assertCanRequest(PHONE, '1.2.3.4');
    }
    const error = await rejection(limiter.assertCanRequest(PHONE, '1.2.3.4'));

    expect(error.getStatus()).toBe(429);
    expect(error.retryAfterSeconds).toBe(600);
    expect(error.getResponse()).toMatchObject({
      errorCode: 'OTP_RATE_LIMITED',
      retryAfterSeconds: 600,
      message: 'Too many OTP requests for this number. Please try again in 10 minutes.',
    });
  });

  it('opens again once the window has passed, and the window never slides forward', async () => {
    const { redis, advance } = fakeRedis();
    const limiter = new OtpRateLimiter(redis as never);
    for (let i = 0; i < 5; i += 1) await limiter.assertCanRequest(PHONE, undefined);

    advance(540);
    const error = await rejection(limiter.assertCanRequest(PHONE, undefined));
    expect(error.retryAfterSeconds).toBe(60); // the 6th hit didn't restart the 10 minutes

    advance(60);
    await expect(limiter.assertCanRequest(PHONE, undefined)).resolves.toBeUndefined();
  });

  it('counts each phone separately', async () => {
    const { redis } = fakeRedis();
    const limiter = new OtpRateLimiter(redis as never);
    for (let i = 0; i < 5; i += 1) await limiter.assertCanRequest(PHONE, undefined);

    await expect(limiter.assertCanRequest('+919876500000', undefined)).resolves.toBeUndefined();
  });

  it('limits one IP across many phone numbers', async () => {
    const { redis } = fakeRedis();
    const limiter = new OtpRateLimiter(redis as never);
    for (let i = 0; i < OTP_LIMITS.requestsPerIp.max; i += 1) {
      await limiter.assertCanRequest(`+9198765${String(i).padStart(5, '0')}`, '9.9.9.9');
    }

    const error = await rejection(limiter.assertCanRequest('+919000000000', '9.9.9.9'));
    expect(error.message).toContain('from this network');
    await expect(limiter.assertCanRequest('+919000000000', '8.8.8.8')).resolves.toBeUndefined();
  });
});

describe('OtpRateLimiter — wrong codes', () => {
  it('counts down the attempts left, then locks the number for 15 minutes and discards the OTP', async () => {
    const { redis, has } = fakeRedis();
    const limiter = new OtpRateLimiter(redis as never);
    await redis.set(OTP_KEY, 'hash', 'EX', 300);

    const left: number[] = [];
    for (let i = 0; i < OTP_LIMITS.failedVerifies.max - 1; i += 1) left.push(await limiter.recordFailedVerify(PHONE, OTP_KEY));
    expect(left).toEqual([4, 3, 2, 1]);

    const error = await rejection(limiter.recordFailedVerify(PHONE, OTP_KEY));
    expect(error.retryAfterSeconds).toBe(900);
    expect(error.message).toBe('Too many incorrect codes. Please try again in 15 minutes.');
    expect(has(OTP_KEY)).toBe(false);
  });

  it('refuses verification while locked, and allows it again after the cooldown', async () => {
    const { redis, advance } = fakeRedis();
    const limiter = new OtpRateLimiter(redis as never);
    for (let i = 0; i < 4; i += 1) await limiter.recordFailedVerify(PHONE, OTP_KEY);
    await rejection(limiter.recordFailedVerify(PHONE, OTP_KEY));

    advance(300);
    const error = await rejection(limiter.assertCanVerify(PHONE));
    expect(error.retryAfterSeconds).toBe(600);

    advance(600);
    await expect(limiter.assertCanVerify(PHONE)).resolves.toBeUndefined();
  });

  it('a correct code clears the failure count', async () => {
    const { redis } = fakeRedis();
    const limiter = new OtpRateLimiter(redis as never);
    for (let i = 0; i < 4; i += 1) await limiter.recordFailedVerify(PHONE, OTP_KEY);

    await limiter.clearFailedVerifies(PHONE);

    expect(await limiter.recordFailedVerify(PHONE, OTP_KEY)).toBe(4);
  });
});

describe('waitPhrase', () => {
  it('rounds up to whole minutes so the wait is never understated', () => {
    expect(waitPhrase(1)).toBe('in 1 minute');
    expect(waitPhrase(61)).toBe('in 2 minutes');
    expect(waitPhrase(600)).toBe('in 10 minutes');
  });
});
