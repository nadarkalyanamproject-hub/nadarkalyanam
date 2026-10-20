import { vi } from 'vitest';
import { AdminBillingService } from '../../modules/admin/billing/admin-billing.service.js';
import { SubscriptionService } from '../../modules/membership/subscription.service.js';

/* eslint-disable @typescript-eslint/no-explicit-any */
// A stateful store covering every query SubscriptionService and the admin
// refund make. `SELECT ... FOR UPDATE` on a users row really blocks a second
// transaction until the first finishes, like Postgres. Shared by the
// subscription and launch-trial specs.
const NOW = new Date('2026-10-07T06:00:00Z');

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
