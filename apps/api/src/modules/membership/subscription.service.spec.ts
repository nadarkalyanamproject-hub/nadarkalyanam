import { ConflictException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import { AdminBillingService } from '../admin/billing/admin-billing.service.js';
import { SubscriptionService } from './subscription.service.js';

/* eslint-disable @typescript-eslint/no-explicit-any */
// A stateful store covering every query SubscriptionService and the admin
// refund make. `SELECT ... FOR UPDATE` on a users row really blocks a second
// transaction until the first finishes, like Postgres.
const DAY = 86400000;
const NOW = new Date('2026-10-07T06:00:00Z');
const at = (days: number) => new Date(NOW.getTime() + days * DAY);

export function billingWorld() {
  const plans: Record<string, any> = {
    gold: { id: 'gold', code: 'GOLD', name: 'Gold', priceInPaise: 149900, durationDays: 90 },
    plus: { id: 'plus', code: 'GOLD_PLUS', name: 'Gold Plus', priceInPaise: 229900, durationDays: 90 },
    premium: { id: 'premium', code: 'GOLD_PREMIUM', name: 'Gold Premium', priceInPaise: 599900, durationDays: 365 },
  };
  const subscriptions: any[] = [];
  const orders: any[] = [];
  const unlocks: { viewerId: string; subscriptionId: string }[] = [];
  const profiles: Record<string, { searchBoost: number }> = { u1: { searchBoost: 0 } };
  const locks = new Map<string, Promise<void>>();
  let seq = 0;

  const withPlan = (s: any, include: any) => (s && include?.plan ? { ...s, plan: plans[s.planId] } : s);
  const db: any = {
    membershipPlan: { findUnique: async ({ where }: any) => plans[where.id] ?? null },
    subscription: {
      findUnique: async ({ where, include }: any) =>
        withPlan(subscriptions.find((s) => (where.orderId ? s.orderId === where.orderId : s.id === where.id)) ?? null, include),
      findFirst: async ({ where }: any) =>
        subscriptions
          .filter((s) => s.userId === where.userId && s.cancelledAt === null && s.expiresAt > where.expiresAt.gt)
          .sort((a, b) => b.expiresAt - a.expiresAt)[0] ?? null,
      findMany: async ({ where }: any) =>
        subscriptions
          .filter((s) => s.userId === where.userId && s.cancelledAt === null && s.expiresAt > where.expiresAt.gt)
          .sort((a, b) => a.startedAt - b.startedAt || a.createdAt - b.createdAt)
          .map((s) => ({ ...s, plan: plans[s.planId] })),
      create: async ({ data }: any) => {
        if (data.orderId && subscriptions.some((s) => s.orderId === data.orderId)) {
          throw Object.assign(new Error('unique'), { code: 'P2002' });
        }
        const row = { id: `s${(seq += 1)}`, cancelledAt: null, createdAt: new Date(NOW.getTime() + seq), ...data };
        subscriptions.push(row);
        return row;
      },
      update: async ({ where, data, include }: any) => withPlan(Object.assign(subscriptions.find((s) => s.id === where.id), data), include),
    },
    profile: {
      updateMany: async ({ where, data }: any) => {
        const row = profiles[where.userId];
        if (!row || row.searchBoost === data.searchBoost) return { count: 0 };
        row.searchBoost = data.searchBoost;
        return { count: 1 };
      },
    },
    order: {
      findUnique: async ({ where }: any) => orders.find((o) => o.id === where.id) ?? null,
      updateMany: async ({ where, data }: any) => {
        const hits = orders.filter((o) => o.id === where.id && o.status === where.status);
        hits.forEach((o) => Object.assign(o, data));
        return { count: hits.length };
      },
    },
    $transaction: async (fn: (tx: any) => Promise<unknown>) => {
      const held: (() => void)[] = [];
      const tx = {
        ...db,
        $queryRaw: async (_s: TemplateStringsArray, id: string) => {
          if (held.some((h: any) => h.id === id)) return [];
          while (locks.has(id)) await locks.get(id);
          let release!: () => void;
          locks.set(id, new Promise<void>((r) => (release = r)));
          held.push(Object.assign(() => (locks.delete(id), release()), { id }));
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
  const notifications = { notify: vi.fn() };
  const service = new SubscriptionService(db, notifications as never);
  const audit = { record: vi.fn() };
  const admin = new AdminBillingService(db, service, audit as never);
  // The refund's final read-back of the order isn't under test here.
  (admin as any).getOrder = vi.fn(async (id: string) => orders.find((o) => o.id === id));
  const seed = (planId: string, startedAt: Date, expiresAt: Date, extra: any = {}) => {
    const row = { id: `s${(seq += 1)}`, userId: 'u1', planId, status: 'ACTIVE', source: 'PAYMENT', cancelledAt: null, createdAt: new Date(NOW.getTime() + seq), startedAt, expiresAt, ...extra };
    subscriptions.push(row);
    return row;
  };
  return { db, service, admin, audit, notifications, subscriptions, orders, unlocks, profiles, seed, plans };
}

const span = (s: any) => [s.startedAt.toISOString(), s.expiresAt.toISOString()];

describe('SubscriptionService.activate', () => {
  it('with no current plan, starts now', async () => {
    const w = billingWorld();
    const { subscription, created } = await w.service.activate({ userId: 'u1', planId: 'gold', source: 'PAYMENT', orderId: 'o1' }, NOW);
    expect(created).toBe(true);
    expect(span(subscription)).toEqual(span({ startedAt: NOW, expiresAt: at(90) }));
    expect(w.notifications.notify).toHaveBeenCalledWith(expect.objectContaining({ type: 'PLAN_ACTIVATED', recipientUserId: 'u1' }));
  });

  it('chains after the current plan (no overlap), keeping its own length', async () => {
    const w = billingWorld();
    w.seed('gold', at(-10), at(80));
    const { subscription } = await w.service.activate({ userId: 'u1', planId: 'plus', source: 'ADMIN_GRANT', grantedByAdminId: 'a1', reason: 'goodwill', durationDays: 30 }, NOW);
    expect(span(subscription)).toEqual(span({ startedAt: at(80), expiresAt: at(110) }));
    expect(subscription).toMatchObject({ source: 'ADMIN_GRANT', grantedByAdminId: 'a1', grantReason: 'goodwill' });
  });

  it('a concurrent admin grant and webhook activation for one member never overlap', async () => {
    const w = billingWorld();
    const [a, b] = await Promise.all([
      w.service.activate({ userId: 'u1', planId: 'gold', source: 'PAYMENT', orderId: 'o1' }, NOW),
      w.service.activate({ userId: 'u1', planId: 'plus', source: 'ADMIN_GRANT', grantedByAdminId: 'a1', reason: 'x' }, NOW),
    ]);
    const [first, second] = [a.subscription, b.subscription].sort((x, y) => x.startedAt.getTime() - y.startedAt.getTime());
    expect(first!.startedAt.getTime()).toBe(NOW.getTime());
    expect(second!.startedAt.getTime()).toBe(first!.expiresAt.getTime());
  });

  it('is idempotent per order: a second activation of the same order creates nothing', async () => {
    const w = billingWorld();
    await w.service.activate({ userId: 'u1', planId: 'gold', source: 'PAYMENT', orderId: 'o1' }, NOW);
    const again = await w.service.activate({ userId: 'u1', planId: 'gold', source: 'PAYMENT', orderId: 'o1' }, NOW);
    expect(again.created).toBe(false);
    expect(w.subscriptions).toHaveLength(1);
    expect(w.notifications.notify).toHaveBeenCalledTimes(1);
  });

  it('sets the search tier from the plan now running', async () => {
    const w = billingWorld();
    await w.service.activate({ userId: 'u1', planId: 'premium', source: 'ADMIN_GRANT', reason: 'x' }, NOW);
    expect(w.profiles.u1!.searchBoost).toBe(2);
  });
});

describe('SubscriptionService.cancel and rechain', () => {
  it('cancelling the running plan starts the queued one immediately with its own length', async () => {
    const w = billingWorld();
    const running = w.seed('premium', at(-5), at(360));
    const queued = w.seed('gold', at(360), at(450));
    w.profiles.u1!.searchBoost = 2;

    await w.service.cancel(running.id, { adminId: 'a1', reason: 'requested by member' }, NOW);

    expect(running).toMatchObject({ status: 'CANCELLED', cancelledByAdminId: 'a1', cancelReason: 'requested by member' });
    expect(span(queued)).toEqual(span({ startedAt: NOW, expiresAt: at(90) }));
    expect(w.profiles.u1!.searchBoost).toBe(0);
    expect(w.notifications.notify).toHaveBeenCalledWith(expect.objectContaining({ type: 'PLAN_CANCELLED' }));
  });

  it('cancelling a queued plan moves the later ones up; the running plan is untouched', async () => {
    const w = billingWorld();
    const running = w.seed('gold', at(-10), at(80));
    const q1 = w.seed('plus', at(80), at(170));
    const q2 = w.seed('premium', at(170), at(535));
    const before = span(running);

    await w.service.cancel(q1.id, { adminId: 'a1', reason: 'duplicate grant' }, NOW);

    expect(span(running)).toEqual(before);
    expect(span(q2)).toEqual(span({ startedAt: at(80), expiresAt: at(445) }));
  });

  it('cannot cancel twice, or cancel a plan that already ended', async () => {
    const w = billingWorld();
    const s = w.seed('gold', at(-10), at(80));
    await w.service.cancel(s.id, { adminId: 'a1', reason: 'x' }, NOW);
    await expect(w.service.cancel(s.id, { adminId: 'a1', reason: 'x' }, NOW)).rejects.toBeInstanceOf(ConflictException);
    const ended = w.seed('gold', at(-100), at(-10));
    await expect(w.service.cancel(ended.id, { adminId: 'a1', reason: 'x' }, NOW)).rejects.toBeInstanceOf(ConflictException);
  });
});

describe('Admin refund', () => {
  function withPaidOrder() {
    const w = billingWorld();
    w.orders.push({ id: 'o1', userId: 'u1', planId: 'premium', amountInPaise: 599900, status: 'PAID' });
    const running = w.seed('premium', at(-5), at(360), { orderId: 'o1' });
    const q1 = w.seed('gold', at(360), at(450));
    const q2 = w.seed('plus', at(450), at(540));
    w.profiles.u1!.searchBoost = 2;
    w.unlocks.push({ viewerId: 'u1', subscriptionId: running.id });
    return { w, running, q1, q2 };
  }

  it('PAID -> REFUNDED: cancels that order’s plan and starts the two queued plans back to back with no gap', async () => {
    const { w, running, q1, q2 } = withPaidOrder();

    await w.admin.refund('a1', 'o1', 'duplicate payment', NOW);

    expect(w.orders[0]).toMatchObject({ status: 'REFUNDED', refundReason: 'duplicate payment', refundedByAdminId: 'a1', refundedAt: NOW });
    expect(running).toMatchObject({ status: 'CANCELLED', cancelReason: 'Order refunded: duplicate payment' });
    expect(span(q1)).toEqual(span({ startedAt: NOW, expiresAt: at(90) }));
    expect(span(q2)).toEqual(span({ startedAt: at(90), expiresAt: at(180) }));
    expect(w.profiles.u1!.searchBoost).toBe(0);
    expect(w.unlocks).toHaveLength(1); // unlocks already made stay
    expect(w.audit.record).toHaveBeenCalledWith('a1', 'order.refund', 'Order', 'o1', expect.objectContaining({ reason: 'duplicate payment' }));
  });

  it('a second refund of the same order is rejected and changes nothing', async () => {
    const { w } = withPaidOrder();
    await w.admin.refund('a1', 'o1', 'duplicate payment', NOW);
    const snapshot = JSON.stringify(w.subscriptions);
    await expect(w.admin.refund('a1', 'o1', 'again', NOW)).rejects.toThrow('Only a paid order can be refunded');
    expect(JSON.stringify(w.subscriptions)).toBe(snapshot);
  });

  it('only a PAID order can be refunded', async () => {
    const w = billingWorld();
    w.orders.push({ id: 'o2', userId: 'u1', planId: 'gold', amountInPaise: 149900, status: 'CREATED' });
    await expect(w.admin.refund('a1', 'o2', 'not paid', NOW)).rejects.toBeInstanceOf(ConflictException);
    expect(w.orders[0].status).toBe('CREATED');
  });
});
