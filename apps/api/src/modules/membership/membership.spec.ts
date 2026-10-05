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

function store(rows: any[], extra: { interests?: number; unlocks?: number } = {}) {
  const subscriptions = rows.map((r, i) => ({ id: `s${i + 1}`, userId: 'u1', cancelledAt: null, status: 'ACTIVE', ...r }));
  const profile = { userId: 'u1', searchBoost: 0 };
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
      findMany: vi.fn(async ({ where }: any) => {
        if (where.status === 'ACTIVE' && where.expiresAt?.lte) {
          return subscriptions.filter((s) => s.status === 'ACTIVE' && s.expiresAt <= where.expiresAt.lte).map((s) => ({ ...s, plan: { name: s.plan.name } }));
        }
        return subscriptions
          .filter((s) => s.userId === where.userId && s.cancelledAt === null && s.expiresAt > where.expiresAt.gt)
          .sort((a, b) => a.startedAt - b.startedAt);
      }),
      updateMany: vi.fn(async ({ where, data }: any) => {
        const hits = subscriptions.filter((s) => s.id === where.id && s.status === where.status);
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
      expiresAt: null,
      paidThroughAt: null,
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

    await expect(service.run(NOW)).resolves.toEqual({ expired: ['s1'] });
    expect(subscriptions[0].status).toBe('EXPIRED');
    expect(notifications.notify).toHaveBeenCalledWith(expect.objectContaining({ recipientUserId: 'u1', type: 'PLAN_EXPIRED' }));

    await expect(service.run(NOW)).resolves.toEqual({ expired: [] });
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
    await expect(service.run(NOW)).resolves.toEqual({ expired: [] });
    expect(subscriptions[0].status).toBe('ACTIVE');
  });
});
