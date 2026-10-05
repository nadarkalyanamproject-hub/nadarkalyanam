import { ForbiddenException } from '@nestjs/common';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { istMonthWindow } from '../../common/ist-calendar.js';
import { InterestsService } from './interests.service.js';

/* eslint-disable @typescript-eslint/no-explicit-any */
// Free members: 5 interests per IST calendar month, counted in the same
// transaction as the insert under a lock on the sender's row.
function world(opts: { paid?: boolean; limit?: number } = {}) {
  const interests: { id: string; senderId: string; targetId: string; status: string; createdAt: Date }[] = [];
  const locks = new Map<string, Promise<void>>();
  const db: any = {
    profile: { findUnique: async ({ where }: any) => ({ id: where.id, userId: where.id.replace('p-', ''), visibility: 'MEMBERS_ONLY' }) },
    block: { findFirst: async () => null },
    interest: {
      findMany: async () => [],
      findFirst: async () => null,
      count: async ({ where }: any) =>
        interests.filter((i) => i.senderId === where.senderId && i.createdAt >= where.createdAt.gte && i.createdAt < where.createdAt.lt).length,
      create: async ({ data }: any) => {
        const row = { id: `i${interests.length + 1}`, status: 'PENDING', createdAt: new Date(), ...data };
        interests.push(row);
        return row;
      },
    },
    $transaction: async (fn: (tx: any) => Promise<unknown>) => {
      const held: (() => void)[] = [];
      const tx = {
        ...db,
        $queryRaw: async (_s: TemplateStringsArray, id: string) => {
          while (locks.has(id)) await locks.get(id);
          let release!: () => void;
          locks.set(id, new Promise<void>((r) => (release = r)));
          held.push(() => {
            locks.delete(id);
            release();
          });
          return [];
        },
      };
      try {
        return await fn(tx);
      } finally {
        held.forEach((free) => free());
      }
    },
  };
  const profiles = { getOwnProfileOrThrow: async (userId: string) => ({ id: `p-${userId}`, userId }) };
  const entitlements = {
    getActivePlan: async () => (opts.paid ? { plan: { code: 'GOLD' } } : null),
    freeInterestsPerMonth: () => opts.limit ?? 5,
  };
  const service = new InterestsService(db, profiles as never, {} as never, { notify: vi.fn() } as never, entitlements as never);
  const past = (status: string, createdAt: Date) =>
    interests.push({ id: `old${interests.length}`, senderId: 'me', targetId: `x${interests.length}`, status, createdAt });
  return { service, interests, past };
}

afterEach(() => vi.useRealTimers());

async function limitError(promise: Promise<unknown>) {
  const error = await promise.then(() => null, (e: unknown) => e);
  expect(error).toBeInstanceOf(ForbiddenException);
  return (error as ForbiddenException).getResponse() as Record<string, unknown>;
}

describe('free-tier interest limit', () => {
  it('allows 5 in a month and rejects the 6th with PLAN_LIMIT_REACHED, limit, used and resetsAt', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-10-15T10:00:00Z'));
    const w = world();
    for (let i = 1; i <= 5; i += 1) await expect(w.service.sendInterest('me', `p-t${i}`)).resolves.toMatchObject({ status: 'PENDING' });

    const body = await limitError(w.service.sendInterest('me', 'p-t6'));
    expect(body).toMatchObject({ statusCode: 403, errorCode: 'PLAN_LIMIT_REACHED', limit: 5, used: 5, resetsAt: '2026-10-31T18:30:00.000Z' });
    expect(body.message).toBe("You've sent all 5 free interests for this month. More become available on 1 Nov 2026, or upgrade for unlimited interests.");
    expect(w.interests).toHaveLength(5);
  });

  it('declined and withdrawn interests sent this month still count', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-10-15T10:00:00Z'));
    const w = world();
    w.past('DECLINED', new Date('2026-10-02T10:00:00Z'));
    w.past('WITHDRAWN', new Date('2026-10-03T10:00:00Z'));
    w.past('ACCEPTED', new Date('2026-10-04T10:00:00Z'));
    w.past('PENDING', new Date('2026-10-05T10:00:00Z'));
    await w.service.sendInterest('me', 'p-a');
    expect((await limitError(w.service.sendInterest('me', 'p-b'))).used).toBe(5);
  });

  it('uses the India-time calendar month: 23:30 IST on 30 Sep is last month, 00:30 IST on 1 Oct is this month', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-10-01T05:00:00Z'));
    const w = world();
    for (let i = 0; i < 5; i += 1) w.past('PENDING', new Date('2026-09-30T18:00:00Z')); // 30 Sep 23:30 IST
    await expect(w.service.sendInterest('me', 'p-a')).resolves.toBeDefined();
    for (let i = 0; i < 3; i += 1) w.past('PENDING', new Date('2026-09-30T19:00:00Z')); // 1 Oct 00:30 IST
    await w.service.sendInterest('me', 'p-b');
    expect((await limitError(w.service.sendInterest('me', 'p-c'))).used).toBe(5);

    expect(istMonthWindow(new Date('2026-09-30T18:29:59Z'))).toEqual({
      start: new Date('2026-08-31T18:30:00Z'),
      resetsAt: new Date('2026-09-30T18:30:00Z'),
    });
  });

  it('paid plans are not limited', async () => {
    const w = world({ paid: true });
    for (let i = 1; i <= 8; i += 1) await w.service.sendInterest('me', `p-t${i}`);
    expect(w.interests).toHaveLength(8);
  });

  it('two parallel sends at the limit: exactly one gets through', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-10-15T10:00:00Z'));
    const w = world();
    for (let i = 0; i < 4; i += 1) w.past('PENDING', new Date('2026-10-10T10:00:00Z'));

    const results = await Promise.allSettled([w.service.sendInterest('me', 'p-a'), w.service.sendInterest('me', 'p-b')]);

    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    expect(w.interests.filter((i) => i.createdAt >= new Date('2026-10-01T00:00:00Z'))).toHaveLength(5);
  });
});
