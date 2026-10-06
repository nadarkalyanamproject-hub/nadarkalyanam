import { describe, expect, it, vi } from 'vitest';
import { EntitlementsService } from './entitlements.service.js';
import { SubscriptionExpiryService } from './subscription-expiry.service.js';

/* eslint-disable @typescript-eslint/no-explicit-any */
const DAY = 24 * 60 * 60 * 1000;
const NOW = new Date('2026-10-05T12:00:00Z');
const at = (days: number) => new Date(NOW.getTime() + days * DAY);
const GOLD = { id: 'gold', code: 'GOLD', name: 'Gold', isAssisted: false, phoneUnlockLimit: 50 };
const PLUS = { id: 'plus', code: 'GOLD_PLUS', name: 'Gold Plus', isAssisted: false, phoneUnlockLimit: null };
const PREMIUM = { id: 'premium', code: 'GOLD_PREMIUM', name: 'Gold Premium', isAssisted: false, phoneUnlockLimit: null };
const config = { get: (key: string) => ({ FREE_INTERESTS_PER_MONTH: 5 })[key] } as never;

// Evaluates the where clauses the services build (equality, null, and
// gt/gte/lt/lte/not ranges) against in-memory rows.
function matches(row: any, where: any): boolean {
  return Object.entries(where ?? {}).every(([key, cond]: [string, any]) => {
    const value = row[key];
    if (cond === null || typeof cond !== 'object' || cond instanceof Date) return value === cond || (cond instanceof Date && value?.getTime() === cond.getTime());
    if ('not' in cond && value === cond.not) return false;
    if ('gt' in cond && !(value > cond.gt)) return false;
    if ('gte' in cond && !(value >= cond.gte)) return false;
    if ('lt' in cond && !(value < cond.lt)) return false;
    if ('lte' in cond && !(value <= cond.lte)) return false;
    return true;
  });
}

function store(rows: any[], extra: { interests?: number; unlocks?: number } = {}) {
  const subscriptions = rows.map((r, i) => ({
    id: `s${i + 1}`,
    userId: 'u1',
    cancelledAt: null,
    status: 'ACTIVE',
    source: 'PAYMENT',
    expiryReminderSentAt: null,
    createdAt: r.startedAt,
    ...r,
  }));
  const profile = { userId: 'u1', searchBoost: 0 };
  const find = ({ where, orderBy }: any) => {
    const key = Object.keys([orderBy].flat()[0] ?? { startedAt: 'asc' })[0]!;
    const dir = Object.values([orderBy].flat()[0] ?? { startedAt: 'asc' })[0];
    return subscriptions
      .filter((s) => matches(s, where))
      .sort((a, b) => (dir === 'desc' ? b[key] - a[key] : a[key] - b[key]))
      .map((s) => ({ ...s, plan: { entitlements: {}, ...s.plan } }));
  };
  const prisma = {
    interest: { count: vi.fn(async () => extra.interests ?? 0) },
    phoneUnlock: { count: vi.fn(async () => extra.unlocks ?? 0) },
    profile: {
      updateMany: vi.fn(async ({ where, data }: any) => {
        if (where.userId !== profile.userId || profile.searchBoost === data.searchBoost) return { count: 0 };
        profile.searchBoost = data.searchBoost;
        return { count: 1 };
      }),
    },
    subscription: {
      findMany: vi.fn(async (args: any) => find(args)),
      findFirst: vi.fn(async (args: any) => find(args)[0] ?? null),
      updateMany: vi.fn(async ({ where, data }: any) => {
        const hits = subscriptions.filter((s) => matches(s, where));
        hits.forEach((s) => Object.assign(s, data));
        return { count: hits.length };
      }),
    },
  };
  return { prisma, subscriptions, profile };
}

describe('EntitlementsService.getActivePlan', () => {
  it('a free member (no subscriptions) has no plan', async () => {
    const { prisma } = store([]);
    const service = new EntitlementsService(prisma as never, config);
    await expect(service.getActivePlan('u1', NOW)).resolves.toBeNull();
    await expect(service.getMyMembership('u1')).resolves.toEqual({
      plan: null,
      status: 'FREE',
      startedAt: null,
      expiresAt: null,
      paidThroughAt: null,
      queued: [],
      history: [],
      lastEnded: null,
      phoneUnlocksUsed: null,
      phoneUnlocksRemaining: null,
      interestsUsedThisMonth: 0,
      interestsLimit: 5,
      resetsAt: expect.any(String),
    });
  });

  it('dates win over status: a past-due row still marked ACTIVE is NOT active', async () => {
    const { prisma } = store([{ plan: GOLD, startedAt: at(-91), expiresAt: at(-1), status: 'ACTIVE' }]);
    await expect(new EntitlementsService(prisma as never, config).getActivePlan('u1', NOW)).resolves.toBeNull();
  });

  it('dates win over status: a row marked EXPIRED too early is still active until its expiresAt', async () => {
    const { prisma } = store([{ plan: GOLD, startedAt: at(-10), expiresAt: at(80), status: 'EXPIRED' }]);
    const active = await new EntitlementsService(prisma as never, config).getActivePlan('u1', NOW);
    expect(active?.plan.code).toBe('GOLD');
  });

  it('a refunded (cancelled) subscription is not active even before its expiry', async () => {
    const { prisma, subscriptions } = store([{ plan: GOLD, startedAt: at(-10), expiresAt: at(80) }]);
    subscriptions[0].cancelledAt = at(-1);
    await expect(new EntitlementsService(prisma as never, config).getActivePlan('u1', NOW)).resolves.toBeNull();
  });

  it('with a renewal queued, the current plan is the one running now; paidThroughAt is the end of the renewal', async () => {
    const { prisma } = store([
      { plan: PLUS, startedAt: at(20), expiresAt: at(110) },
      { plan: GOLD, startedAt: at(-70), expiresAt: at(20) },
    ]);
    const active = await new EntitlementsService(prisma as never, config).getActivePlan('u1', NOW);
    expect(active).toMatchObject({ plan: { code: 'GOLD', phoneUnlockLimit: 50 }, expiresAt: at(20), paidThroughAt: at(110) });
  });

  it('a renewal that has not started yet does not count on its own', async () => {
    const { prisma } = store([{ plan: PLUS, startedAt: at(5), expiresAt: at(95) }]);
    await expect(new EntitlementsService(prisma as never, config).getActivePlan('u1', NOW)).resolves.toBeNull();
  });
});

describe('EntitlementsService.getMyMembership usage', () => {
  it('a paid member sees unlocks used and remaining for the current plan period, and no interest limit', async () => {
    const { prisma } = store([{ plan: GOLD, startedAt: new Date(Date.now() - DAY), expiresAt: new Date(Date.now() + 80 * DAY) }], { unlocks: 3 });
    const result = await new EntitlementsService(prisma as never, config).getMyMembership('u1');
    expect(result).toMatchObject({ status: 'ACTIVE', phoneUnlocksUsed: 3, phoneUnlocksRemaining: 47, interestsLimit: null, interestsUsedThisMonth: null });
  });

  it('an unlimited plan reports remaining as null (unlimited)', async () => {
    const { prisma } = store([{ plan: PLUS, startedAt: new Date(Date.now() - DAY), expiresAt: new Date(Date.now() + 80 * DAY) }], { unlocks: 12 });
    const result = await new EntitlementsService(prisma as never, config).getMyMembership('u1');
    expect(result).toMatchObject({ phoneUnlocksUsed: 12, phoneUnlocksRemaining: null });
  });

  it('a free member sees interests used this month, the limit and the reset date', async () => {
    const { prisma } = store([], { interests: 4 });
    const result = await new EntitlementsService(prisma as never, config).getMyMembership('u1');
    expect(result).toMatchObject({ status: 'FREE', interestsUsedThisMonth: 4, interestsLimit: 5 });
    expect(new Date(result.resetsAt!).getTime()).toBeGreaterThan(Date.now());
  });
});

describe('SubscriptionExpiryService', () => {
  it('expiring a spotlight plan drops the search tier; a queued priority renewal sets tier 1', async () => {
    const { prisma, profile } = store([
      { plan: PREMIUM, startedAt: at(-365), expiresAt: at(0) },
      { plan: PLUS, startedAt: at(0), expiresAt: at(90) },
    ]);
    profile.searchBoost = 2;
    const service = new SubscriptionExpiryService(prisma as never, new EntitlementsService(prisma as never, config), { notify: vi.fn() } as never);
    await service.run(NOW);
    expect(profile.searchBoost).toBe(1);
  });

  it('expiring the only plan returns the member to tier 0', async () => {
    const { prisma, profile } = store([{ plan: PREMIUM, startedAt: at(-365), expiresAt: at(-1) }]);
    profile.searchBoost = 2;
    const service = new SubscriptionExpiryService(prisma as never, new EntitlementsService(prisma as never, config), { notify: vi.fn() } as never);
    await service.run(NOW);
    expect(profile.searchBoost).toBe(0);
  });

  it('marks past-due ACTIVE subscriptions EXPIRED and notifies once; a re-run does nothing', async () => {
    const { prisma, subscriptions } = store([{ plan: GOLD, startedAt: at(-91), expiresAt: at(-1) }]);
    const notifications = { notify: vi.fn() };
    const service = new SubscriptionExpiryService(prisma as never, new EntitlementsService(prisma as never, config), notifications as never);

    await expect(service.run(NOW)).resolves.toEqual({ expired: ['s1'], reminded: [] });
    expect(subscriptions[0].status).toBe('EXPIRED');
    expect(notifications.notify).toHaveBeenCalledWith(expect.objectContaining({ recipientUserId: 'u1', type: 'PLAN_EXPIRED' }));

    await expect(service.run(NOW)).resolves.toMatchObject({ expired: [] });
    expect(notifications.notify).toHaveBeenCalledTimes(1);
  });

  it('when a paid renewal takes over, the old period is marked EXPIRED but no PLAN_EXPIRED is sent', async () => {
    const { prisma, subscriptions } = store([
      { plan: GOLD, startedAt: at(-90), expiresAt: at(0) },
      { plan: PLUS, startedAt: at(0), expiresAt: at(90) },
    ]);
    const notifications = { notify: vi.fn() };
    const service = new SubscriptionExpiryService(prisma as never, new EntitlementsService(prisma as never, config), notifications as never);

    await service.run(NOW);

    expect(subscriptions.map((s) => s.status)).toEqual(['EXPIRED', 'ACTIVE']);
    expect(notifications.notify).not.toHaveBeenCalled();
  });

  it('leaves subscriptions that have not expired alone', async () => {
    const { prisma, subscriptions } = store([{ plan: GOLD, startedAt: at(-1), expiresAt: at(89) }]);
    const service = new SubscriptionExpiryService(prisma as never, new EntitlementsService(prisma as never, config), { notify: vi.fn() } as never);
    await expect(service.run(NOW)).resolves.toMatchObject({ expired: [] });
    expect(subscriptions[0].status).toBe('ACTIVE');
  });
});

describe('GET /me/membership shape (member dashboard)', () => {
  const PLUS_WITH_COPY = { ...PLUS, entitlements: { features: [{ key: 'searchPriority', label: 'Priority placement', available: true }] } };

  it('paid member: plan with features and tier, dates, queued renewal, history — and no admin-only fields', async () => {
    const { prisma } = store(
      [
        { plan: PLUS_WITH_COPY, startedAt: at(-10), expiresAt: at(80), source: 'ADMIN_GRANT', grantedByAdminId: 'admin-secret-id', grantReason: 'SECRET reason', paymentReference: 'SECRET ref' },
        { plan: GOLD, startedAt: at(80), expiresAt: at(170) },
        { plan: GOLD, startedAt: at(-200), expiresAt: at(-110), cancelledAt: at(-150), cancelReason: 'SECRET cancel' },
      ],
      { unlocks: 7 },
    );
    const me = await new EntitlementsService(prisma as never, config).getMyMembership('u1', NOW);

    expect(me).toMatchObject({
      status: 'ACTIVE',
      plan: { code: 'GOLD_PLUS', name: 'Gold Plus', phoneUnlockLimit: null, searchTier: 1, features: [{ key: 'searchPriority', available: true }] },
      startedAt: at(-10).toISOString(),
      expiresAt: at(80).toISOString(),
      paidThroughAt: at(170).toISOString(),
      phoneUnlocksUsed: 7,
      phoneUnlocksRemaining: null,
      interestsLimit: null,
      lastEnded: null,
    });
    expect(me.queued).toEqual([{ planCode: 'GOLD', planName: 'Gold', startedAt: at(80).toISOString(), endsAt: at(170).toISOString(), source: 'PURCHASED', status: 'QUEUED' }]);
    expect(me.history.map((h) => [h.planCode, h.status, h.source])).toEqual([
      ['GOLD', 'QUEUED', 'PURCHASED'],
      ['GOLD_PLUS', 'ACTIVE', 'GRANTED'],
      ['GOLD', 'CANCELLED', 'PURCHASED'],
    ]);
    expect(me.history[2]!.endsAt).toBe(at(-150).toISOString());
    const json = JSON.stringify(me);
    for (const secret of ['admin-secret-id', 'SECRET', 'grantReason', 'grantedBy', 'paymentReference', 'cancelReason']) expect(json).not.toContain(secret);
  });

  it('expired member: free, with lastEnded EXPIRED and the interest limit back', async () => {
    const { prisma } = store([{ plan: GOLD, startedAt: at(-95), expiresAt: at(-5) }], { interests: 2 });
    const me = await new EntitlementsService(prisma as never, config).getMyMembership('u1', NOW);
    expect(me).toMatchObject({ status: 'FREE', plan: null, interestsUsedThisMonth: 2, interestsLimit: 5, lastEnded: { planName: 'Gold', endedAt: at(-5).toISOString(), kind: 'EXPIRED' } });
  });

  it('cancelled by admin: lastEnded CANCELLED at the cancellation time', async () => {
    const { prisma } = store([{ plan: GOLD, startedAt: at(-20), expiresAt: at(70), cancelledAt: at(-1) }]);
    const me = await new EntitlementsService(prisma as never, config).getMyMembership('u1', NOW);
    expect(me.lastEnded).toEqual({ planName: 'Gold', endedAt: at(-1).toISOString(), kind: 'CANCELLED' });
  });
});

describe('expiring-soon reminder', () => {
  const service = (prisma: unknown, notifications = { notify: vi.fn() }) =>
    ({ svc: new SubscriptionExpiryService(prisma as never, new EntitlementsService(prisma as never, config), notifications as never), notifications });

  it('sends once per subscription within 7 days of expiry; re-runs send nothing more', async () => {
    const { prisma, subscriptions } = store([{ plan: GOLD, startedAt: at(-85), expiresAt: at(5) }]);
    const { svc, notifications } = service(prisma);

    await expect(svc.run(NOW)).resolves.toEqual({ expired: [], reminded: ['s1'] });
    await expect(svc.run(NOW)).resolves.toEqual({ expired: [], reminded: [] });
    await expect(svc.run(new Date(NOW.getTime() + DAY))).resolves.toEqual({ expired: [], reminded: [] });

    expect(notifications.notify).toHaveBeenCalledTimes(1);
    expect(notifications.notify).toHaveBeenCalledWith(expect.objectContaining({ type: 'PLAN_EXPIRING_SOON', data: { planName: 'Gold', expiresAt: at(5).toISOString() } }));
    expect(subscriptions[0]!.expiryReminderSentAt).toEqual(NOW);
  });

  it('not yet when more than 7 days remain', async () => {
    const { prisma } = store([{ plan: GOLD, startedAt: at(-10), expiresAt: at(8) }]);
    await expect(service(prisma).svc.run(NOW)).resolves.toEqual({ expired: [], reminded: [] });
  });

  it('no reminder when a renewal is already queued, or for a cancelled plan', async () => {
    const queued = store([
      { plan: GOLD, startedAt: at(-85), expiresAt: at(5) },
      { plan: PLUS, startedAt: at(5), expiresAt: at(95) },
    ]);
    await expect(service(queued.prisma).svc.run(NOW)).resolves.toEqual({ expired: [], reminded: [] });
    const cancelled = store([{ plan: GOLD, startedAt: at(-85), expiresAt: at(5), cancelledAt: at(-1) }]);
    await expect(service(cancelled.prisma).svc.run(NOW)).resolves.toEqual({ expired: [], reminded: [] });
  });
});
