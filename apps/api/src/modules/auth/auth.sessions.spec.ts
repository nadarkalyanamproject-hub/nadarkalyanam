import 'reflect-metadata';
import { describe, expect, it } from 'vitest';
import { noopOtpRateLimiter } from '../../common/testing/noop-otp-rate-limiter.js';
import { AuthService, maskPhone } from './auth.service.js';

/* eslint-disable @typescript-eslint/no-explicit-any */
interface Row {
  id: string;
  userId: string;
  adminUserId: string | null;
  revokedAt: Date | null;
  expiresAt: Date;
}

const LATER = new Date(Date.now() + 86_400_000);
const EARLIER = new Date(Date.now() - 1000);

// Evaluates the few `where` shapes these methods use.
function matches(row: Row, where: any): boolean {
  if (where.userId !== undefined && row.userId !== where.userId) return false;
  if ('adminUserId' in where && row.adminUserId !== where.adminUserId) return false;
  if ('revokedAt' in where && row.revokedAt !== where.revokedAt) return false;
  if (where.id?.not !== undefined && row.id === where.id.not) return false;
  if (where.expiresAt?.gt && !(row.expiresAt > where.expiresAt.gt)) return false;
  return true;
}

function setup(rows: Row[]) {
  const prisma = {
    user: { findUnique: async ({ where }: any) => (where.id === 'user-1' ? { phoneNumber: '+919876543201' } : null) },
    session: {
      count: async ({ where }: any) => rows.filter((r) => matches(r, where)).length,
      updateMany: async ({ where, data }: any) => {
        const hits = rows.filter((r) => matches(r, where));
        hits.forEach((r) => Object.assign(r, data));
        return { count: hits.length };
      },
    },
  };
  // Just enough Redis for storing and spending a code.
  const store = new Map<string, string>();
  const redis = {
    set: async (key: string, value: string) => void store.set(key, value),
    get: async (key: string) => store.get(key) ?? null,
    del: async (key: string) => void store.delete(key),
  };
  // Development, so the code comes back in the response (devOtp).
  const config = { get: (key: string) => (key === 'NODE_ENV' ? 'development' : undefined) };
  const service = new AuthService(prisma as never, {} as never, config as never, redis as never, noopOtpRateLimiter as never);
  return { service, rows, store };
}

const session = (id: string, over: Partial<Row> = {}): Row => ({
  id,
  userId: 'user-1',
  adminUserId: null,
  revokedAt: null,
  expiresAt: LATER,
  ...over,
});

describe('signed-in devices', () => {
  it('counts only this member’s live sign-ins: not ended, expired, staff-panel or someone else’s', async () => {
    const { service } = setup([
      session('phone'),
      session('laptop'),
      session('old', { revokedAt: EARLIER }),
      session('stale', { expiresAt: EARLIER }),
      session('staff', { adminUserId: 'admin-1' }),
      session('other', { userId: 'user-2' }),
    ]);
    await expect(service.countActiveSessions('user-1')).resolves.toBe(2);
  });

  it('sends the code to the member’s own registered number, masked in the reply', async () => {
    const { service, store } = setup([]);
    const sent = await service.requestLogoutOthersOtp('user-1');
    expect(sent.sentTo).toBe('+91 ******3201');
    expect(sent.devOtp).toMatch(/^\d{6}$/);
    // Stored apart from login codes, so it can't be used to sign in.
    expect([...store.keys()]).toEqual(['otp:logout-others:user-1']);
  });

  it('refuses a wrong code and logs nobody out', async () => {
    const { service, rows } = setup([session('this'), session('laptop')]);
    const { devOtp } = await service.requestLogoutOthersOtp('user-1');
    const wrong = devOtp === '000000' ? '111111' : '000000';
    await expect(service.logoutOtherSessions('user-1', 'this', wrong)).rejects.toThrow(/Invalid or expired OTP/);
    expect(rows.every((r) => r.revokedAt === null)).toBe(true);
  });

  it('“log out of all other devices” ends every other sign-in and keeps this one', async () => {
    const { service, rows } = setup([session('this'), session('laptop'), session('tablet'), session('staff', { adminUserId: 'admin-1' })]);
    const { devOtp } = await service.requestLogoutOthersOtp('user-1');

    await expect(service.logoutOtherSessions('user-1', 'this', devOtp!)).resolves.toBe(2);
    // The code is spent: it can't be used a second time.
    await expect(service.logoutOtherSessions('user-1', 'this', devOtp!)).rejects.toThrow(/Invalid or expired OTP/);

    const byId = Object.fromEntries(rows.map((r) => [r.id, r.revokedAt]));
    expect(byId.this).toBeNull();
    expect(byId.laptop).toBeInstanceOf(Date);
    expect(byId.tablet).toBeInstanceOf(Date);
    // The staff panel sign-in is separate and untouched.
    expect(byId.staff).toBeNull();
  });
});

describe('maskPhone', () => {
  it('shows only the last four digits', () => {
    expect(maskPhone('+919876543201')).toBe('+91 ******3201');
  });
});
