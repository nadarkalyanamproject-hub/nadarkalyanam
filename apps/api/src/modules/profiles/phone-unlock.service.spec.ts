import { ForbiddenException, HttpException, NotFoundException } from '@nestjs/common';
import { describe, expect, it } from 'vitest';
import { Prisma } from '../../generated/prisma/client.js';
import { PhoneUnlockService } from './phone-unlock.service.js';

/* eslint-disable @typescript-eslint/no-explicit-any */
// A stateful in-memory database covering every query PhoneUnlockService
// makes, including the subscription row lock: a second transaction waits on
// `SELECT ... FOR UPDATE` until the first finishes, like Postgres.
const DAY = 86400000;
const NOW = new Date('2026-10-06T06:00:00Z');
const GOLD = { id: 'gold', code: 'GOLD', name: 'Gold', phoneUnlockLimit: 50 };
const PLUS = { id: 'plus', code: 'GOLD_PLUS', name: 'Gold Plus', phoneUnlockLimit: null };

function world(opts: { cap?: number } = {}) {
  const users: Record<string, { status: string; phoneNumber: string }> = {};
  const profiles: { id: string; userId: string; visibility: string; phoneVisibility: string }[] = [];
  const blocks: { initiatorId: string; targetId: string }[] = [];
  const interests: { senderId: string; targetId: string; status: string }[] = [];
  const subscriptions: any[] = [];
  const unlocks: { id: string; viewerId: string; targetUserId: string; subscriptionId: string; createdAt: Date }[] = [];
  const locks = new Map<string, Promise<void>>();

  const member = (id: string, phoneVisibility = 'CONNECTED') => {
    users[id] = { status: 'ACTIVE', phoneNumber: `+9190000${String(Object.keys(users).length).padStart(5, '0')}` };
    profiles.push({ id: `p-${id}`, userId: id, visibility: 'MEMBERS_ONLY', phoneVisibility });
  };
  const connect = (a: string, b: string) => interests.push({ senderId: a, targetId: b, status: 'ACCEPTED' });
  const subscribe = (userId: string, plan: any, startedAt = new Date(NOW.getTime() - DAY), expiresAt = new Date(NOW.getTime() + 80 * DAY)) => {
    const sub = { id: `sub-${subscriptions.length + 1}`, userId, plan, cancelledAt: null, startedAt, expiresAt };
    subscriptions.push(sub);
    return sub;
  };

  const matchesVisible = (p: any, where: any): boolean => {
    if (where.AND) return where.AND.every((w: any) => matchesVisible(p, w));
    if (where.id?.in) return where.id.in.includes(p.id);
    if (typeof where.id === 'string' && where.id !== p.id) return false;
    if (where.visibility?.in && !where.visibility.in.includes(p.visibility)) return false;
    if (where.userId?.notIn?.includes(p.userId)) return false;
    if (where.user?.status && users[p.userId]!.status !== where.user.status) return false;
    return true;
  };

  const db: any = {
    user: {
      findUnique: async ({ where, select }: any) => {
        const u = users[where.id];
        if (!u) return null;
        if (select?.phoneNumber) return { phoneNumber: u.phoneNumber };
        return { status: u.status, profile: profiles.some((p) => p.userId === where.id) ? { id: `p-${where.id}` } : null };
      },
    },
    block: {
      findMany: async ({ where }: any) => {
        const id = where.OR[0].initiatorId;
        return blocks.filter((b) => b.initiatorId === id || b.targetId === id);
      },
    },
    profile: { findFirst: async ({ where }: any) => profiles.find((p) => matchesVisible(p, where)) ?? null },
    interest: {
      findMany: async ({ where }: any) =>
        interests
          .filter((i) => where.status.in.includes(i.status))
          .filter((i) => where.OR.some((o: any) => (o.senderId === i.senderId && o.targetId.in.includes(i.targetId)) || (o.targetId === i.targetId && o.senderId.in?.includes(i.senderId))))
          .map((i) => ({ ...i, conversation: { id: 'c1' } })),
    },
    subscription: {
      findMany: async ({ where }: any) =>
        subscriptions
          .filter((s) => s.userId === where.userId && s.cancelledAt === null && s.expiresAt > where.expiresAt.gt)
          .sort((a, b) => a.startedAt - b.startedAt),
    },
    phoneUnlock: {
      count: async ({ where }: any) =>
        unlocks.filter((u) => (where.subscriptionId ? u.subscriptionId === where.subscriptionId : u.viewerId === where.viewerId && u.createdAt >= where.createdAt.gte)).length,
      findUnique: async ({ where }: any) =>
        unlocks.find((u) => u.viewerId === where.viewerId_targetUserId.viewerId && u.targetUserId === where.viewerId_targetUserId.targetUserId) ?? null,
      create: async ({ data }: any) => {
        if (unlocks.some((u) => u.viewerId === data.viewerId && u.targetUserId === data.targetUserId)) {
          throw new Prisma.PrismaClientKnownRequestError('Unique constraint failed', { code: 'P2002', clientVersion: 'test' });
        }
        unlocks.push({ id: `u${unlocks.length + 1}`, createdAt: NOW, ...data });
      },
    },
    $transaction: async (fn: (tx: any) => Promise<unknown>) => {
      const held: (() => void)[] = [];
      const tx = {
        ...db,
        $queryRaw: async (_strings: TemplateStringsArray, id: string) => {
          while (locks.has(id)) await locks.get(id);
          let release!: () => void;
          locks.set(id, new Promise<void>((resolve) => (release = resolve)));
          held.push(() => {
            locks.delete(id);
            release();
          });
          return [{ id }];
        },
      };
      try {
        return await fn(tx);
      } finally {
        held.forEach((free) => free());
      }
    },
  };
  const config = { get: (key: string) => ({ UNLOCK_DAILY_CAP: opts.cap ?? 100 })[key] };
  const service = new PhoneUnlockService(db, config as never);
  return { service, users, profiles, blocks, interests, subscriptions, unlocks, member, connect, subscribe };
}

async function refusal(promise: Promise<unknown>): Promise<{ status: number; body: any }> {
  const error = await promise.then(() => null, (e: unknown) => e);
  expect(error).toBeInstanceOf(HttpException);
  return { status: (error as HttpException).getStatus(), body: (error as HttpException).getResponse() };
}

describe('PhoneUnlockService rules', () => {
  it('no plan: NO_PLAN, and unlock is refused without revealing anything', async () => {
    const w = world();
    w.member('viewer');
    w.member('target');
    w.connect('viewer', 'target');

    await expect(w.service.status('viewer', 'p-target', NOW)).resolves.toEqual({ state: 'NO_PLAN', limit: null, remaining: null });
    const r = await refusal(w.service.unlock('viewer', 'p-target', NOW));
    expect(r).toMatchObject({ status: 403, body: { errorCode: 'NO_PLAN' } });
    expect(JSON.stringify(r.body)).not.toContain(w.users.target!.phoneNumber);
    expect(w.unlocks).toHaveLength(0);
  });

  it('not connected: NOT_CONNECTED even with a plan', async () => {
    const w = world();
    w.member('viewer');
    w.member('target');
    w.subscribe('viewer', GOLD);
    await expect(w.service.status('viewer', 'p-target', NOW)).resolves.toMatchObject({ state: 'NOT_CONNECTED' });
    expect((await refusal(w.service.unlock('viewer', 'p-target', NOW))).body.errorCode).toBe('NOT_CONNECTED');
  });

  it('blocked either way: the profile is not found at all', async () => {
    const w = world();
    w.member('viewer');
    w.member('target');
    w.connect('viewer', 'target');
    w.subscribe('viewer', GOLD);
    w.blocks.push({ initiatorId: 'target', targetId: 'viewer' });
    await expect(w.service.status('viewer', 'p-target', NOW)).rejects.toBeInstanceOf(NotFoundException);
    await expect(w.service.unlock('viewer', 'p-target', NOW)).rejects.toBeInstanceOf(NotFoundException);
  });

  it('a suspended (not ACTIVE) target is not found', async () => {
    const w = world();
    w.member('viewer');
    w.member('target');
    w.connect('viewer', 'target');
    w.subscribe('viewer', GOLD);
    w.users.target!.status = 'SUSPENDED';
    await expect(w.service.unlock('viewer', 'p-target', NOW)).rejects.toBeInstanceOf(NotFoundException);
  });

  it('owner set NEVER (the default): HIDDEN_BY_MEMBER', async () => {
    const w = world();
    w.member('viewer');
    w.member('target', 'NEVER');
    w.connect('target', 'viewer');
    w.subscribe('viewer', GOLD);
    await expect(w.service.status('viewer', 'p-target', NOW)).resolves.toMatchObject({ state: 'HIDDEN_BY_MEMBER' });
    expect((await refusal(w.service.unlock('viewer', 'p-target', NOW))).body.errorCode).toBe('HIDDEN_BY_MEMBER');
  });

  it('Gold: AVAILABLE with 50 left; unlocking reveals the E.164 number and leaves 49', async () => {
    const w = world();
    w.member('viewer');
    w.member('target');
    w.connect('viewer', 'target');
    const sub = w.subscribe('viewer', GOLD);

    await expect(w.service.status('viewer', 'p-target', NOW)).resolves.toEqual({ state: 'AVAILABLE', limit: 50, remaining: 50 });
    const result = await w.service.unlock('viewer', 'p-target', NOW);
    expect(result).toEqual({ state: 'UNLOCKED', phoneNumber: w.users.target!.phoneNumber, limit: 50, remaining: 49 });
    expect(result.phoneNumber).toMatch(/^\+[1-9]\d{7,14}$/);
    expect(w.unlocks).toEqual([expect.objectContaining({ viewerId: 'viewer', targetUserId: 'target', subscriptionId: sub.id })]);
    // The status call never carries the number.
    const status = await w.service.status('viewer', 'p-target', NOW);
    expect(status).toEqual({ state: 'UNLOCKED', limit: 50, remaining: 49 });
    expect(JSON.stringify(status)).not.toContain(w.users.target!.phoneNumber);
  });

  it('repeat unlock returns the number again without using quota', async () => {
    const w = world();
    w.member('viewer');
    w.member('target');
    w.connect('viewer', 'target');
    w.subscribe('viewer', GOLD);
    await w.service.unlock('viewer', 'p-target', NOW);
    const again = await w.service.unlock('viewer', 'p-target', NOW);
    expect(again).toMatchObject({ state: 'UNLOCKED', remaining: 49 });
    expect(w.unlocks).toHaveLength(1);
  });

  it('quota exhausted: QUOTA_EXHAUSTED once the plan period’s unlocks are used', async () => {
    const w = world();
    w.member('viewer');
    w.member('t1');
    w.member('t2');
    w.connect('viewer', 't1');
    w.connect('viewer', 't2');
    w.subscribe('viewer', { ...GOLD, phoneUnlockLimit: 1 });
    await w.service.unlock('viewer', 'p-t1', NOW);
    await expect(w.service.status('viewer', 'p-t2', NOW)).resolves.toEqual({ state: 'QUOTA_EXHAUSTED', limit: 1, remaining: 0 });
    expect((await refusal(w.service.unlock('viewer', 'p-t2', NOW))).body).toMatchObject({ errorCode: 'QUOTA_EXHAUSTED', message: expect.stringContaining('all 1') });
  });

  it('a renewal is a new plan period with fresh quota', async () => {
    const w = world();
    w.member('viewer');
    w.member('t1');
    w.member('t2');
    w.connect('viewer', 't1');
    w.connect('viewer', 't2');
    const old = w.subscribe('viewer', { ...GOLD, phoneUnlockLimit: 1 }, new Date(NOW.getTime() - 100 * DAY), new Date(NOW.getTime() - DAY));
    w.unlocks.push({ id: 'old', viewerId: 'viewer', targetUserId: 't1', subscriptionId: old.id, createdAt: new Date(NOW.getTime() - 50 * DAY) });
    w.subscribe('viewer', { ...GOLD, phoneUnlockLimit: 1 });
    await expect(w.service.status('viewer', 'p-t2', NOW)).resolves.toMatchObject({ state: 'AVAILABLE', remaining: 1 });
  });

  it('unlimited plan: no count shown (limit and remaining null)', async () => {
    const w = world();
    w.member('viewer');
    w.member('target');
    w.connect('viewer', 'target');
    w.subscribe('viewer', PLUS);
    await expect(w.service.status('viewer', 'p-target', NOW)).resolves.toEqual({ state: 'AVAILABLE', limit: null, remaining: null });
    await expect(w.service.unlock('viewer', 'p-target', NOW)).resolves.toMatchObject({ state: 'UNLOCKED', limit: null, remaining: null });
  });

  it('two parallel unlocks for the last unit: exactly one succeeds', async () => {
    const w = world();
    w.member('viewer');
    w.member('t1');
    w.member('t2');
    w.connect('viewer', 't1');
    w.connect('viewer', 't2');
    w.subscribe('viewer', { ...GOLD, phoneUnlockLimit: 1 });

    const results = await Promise.allSettled([w.service.unlock('viewer', 'p-t1', NOW), w.service.unlock('viewer', 'p-t2', NOW)]);

    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    const failed = results.find((r) => r.status === 'rejected') as PromiseRejectedResult;
    expect(failed.reason).toBeInstanceOf(ForbiddenException);
    expect((failed.reason as ForbiddenException).getResponse()).toMatchObject({ errorCode: 'QUOTA_EXHAUSTED' });
    expect(w.unlocks).toHaveLength(1);
  });

  it('plan expired: an earlier unlock still works (no plan needed), a new one does not', async () => {
    const w = world();
    w.member('viewer');
    w.member('t1');
    w.member('t2');
    w.connect('viewer', 't1');
    w.connect('viewer', 't2');
    const sub = w.subscribe('viewer', GOLD, new Date(NOW.getTime() - 100 * DAY), new Date(NOW.getTime() - DAY));
    w.unlocks.push({ id: 'u1', viewerId: 'viewer', targetUserId: 't1', subscriptionId: sub.id, createdAt: new Date(NOW.getTime() - 50 * DAY) });

    await expect(w.service.unlock('viewer', 'p-t1', NOW)).resolves.toMatchObject({ state: 'UNLOCKED', phoneNumber: w.users.t1!.phoneNumber });
    expect((await refusal(w.service.unlock('viewer', 'p-t2', NOW))).body.errorCode).toBe('NO_PLAN');
  });

  it('the owner switching to NEVER later wins over an earlier unlock', async () => {
    const w = world();
    w.member('viewer');
    w.member('target');
    w.connect('viewer', 'target');
    w.subscribe('viewer', GOLD);
    await w.service.unlock('viewer', 'p-target', NOW);
    w.profiles.find((p) => p.userId === 'target')!.phoneVisibility = 'NEVER';

    await expect(w.service.status('viewer', 'p-target', NOW)).resolves.toMatchObject({ state: 'HIDDEN_BY_MEMBER' });
    expect((await refusal(w.service.unlock('viewer', 'p-target', NOW))).body.errorCode).toBe('HIDDEN_BY_MEMBER');
  });

  it('no longer connected: an earlier unlock stops working', async () => {
    const w = world();
    w.member('viewer');
    w.member('target');
    w.connect('viewer', 'target');
    w.subscribe('viewer', GOLD);
    await w.service.unlock('viewer', 'p-target', NOW);
    w.interests.length = 0;
    expect((await refusal(w.service.unlock('viewer', 'p-target', NOW))).body.errorCode).toBe('NOT_CONNECTED');
  });

  it('daily cap: new unlocks beyond UNLOCK_DAILY_CAP are refused with 429 (re-showing is still free)', async () => {
    const w = world({ cap: 2 });
    w.member('viewer');
    for (const t of ['t1', 't2', 't3']) {
      w.member(t);
      w.connect('viewer', t);
    }
    w.subscribe('viewer', PLUS);
    await w.service.unlock('viewer', 'p-t1', NOW);
    await w.service.unlock('viewer', 'p-t2', NOW);
    const r = await refusal(w.service.unlock('viewer', 'p-t3', NOW));
    expect(r).toMatchObject({ status: 429, body: { errorCode: 'UNLOCK_DAILY_CAP' } });
    await expect(w.service.unlock('viewer', 'p-t1', NOW)).resolves.toMatchObject({ state: 'UNLOCKED' });
  });
});
