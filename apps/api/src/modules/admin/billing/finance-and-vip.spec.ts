import { ConflictException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import { PaymentsService } from '../../payments/payments.service.js';
import { VipEnquiriesService } from '../../vip/vip-enquiries.service.js';
import { AdminBillingService } from './admin-billing.service.js';
import { buildFinanceDashboard } from './finance-dashboard.js';

/* eslint-disable @typescript-eslint/no-explicit-any */
const DAY = 86400000;
// 7 Oct 2026, 11:30 IST.
const NOW = new Date('2026-10-07T06:00:00Z');
const ago = (days: number, hours = 0) => new Date(NOW.getTime() - days * DAY - hours * 3600000);

// A tiny evaluator for the where clauses the finance query builds.
function matches(row: any, where: any): boolean {
  return Object.entries(where ?? {}).every(([key, cond]: [string, any]) => {
    const value = row[key];
    if (cond === null) return value === null;
    if (typeof cond !== 'object' || cond instanceof Date) return value === cond;
    if ('in' in cond && !cond.in.includes(value)) return false;
    if ('not' in cond && cond.not === null && value === null) return false;
    if ('gte' in cond && !(value !== null && value >= cond.gte)) return false;
    if ('gt' in cond && !(value !== null && value > cond.gt)) return false;
    if ('lte' in cond && !(value !== null && value <= cond.lte)) return false;
    return true;
  });
}

function financeFixture() {
  const plans = [
    { id: 'gold', code: 'GOLD', name: 'Gold', sortOrder: 1 },
    { id: 'plus', code: 'GOLD_PLUS', name: 'Gold Plus', sortOrder: 2 },
  ];
  const orders = [
    { status: 'PAID', amountInPaise: 149900, createdAt: ago(1), paidAt: ago(1), refundedAt: null },
    { status: 'PAID', amountInPaise: 229900, createdAt: ago(3), paidAt: ago(3), refundedAt: null },
    // Paid in range, refunded later in range: counts in gross AND refunded.
    { status: 'REFUNDED', amountInPaise: 149900, createdAt: ago(5), paidAt: ago(5), refundedAt: ago(2) },
    // Paid before the 7-day window: not in gross for 7 days.
    { status: 'PAID', amountInPaise: 599900, createdAt: ago(20), paidAt: ago(20), refundedAt: null },
    { status: 'CREATED', amountInPaise: 149900, createdAt: ago(0, 2), paidAt: null, refundedAt: null },
    { status: 'FAILED', amountInPaise: 229900, createdAt: ago(4), paidAt: null, refundedAt: null },
  ];
  const subs = [
    { planId: 'gold', source: 'PAYMENT', cancelledAt: null, startedAt: ago(1), expiresAt: new Date(NOW.getTime() + 89 * DAY), createdAt: ago(1), paymentReference: null },
    { planId: 'plus', source: 'PAYMENT', cancelledAt: null, startedAt: ago(85), expiresAt: new Date(NOW.getTime() + 5 * DAY), createdAt: ago(85), paymentReference: null },
    // Admin grants: one with an offline payment reference. Never revenue.
    { planId: 'plus', source: 'ADMIN_GRANT', cancelledAt: null, startedAt: ago(2), expiresAt: new Date(NOW.getTime() + 88 * DAY), createdAt: ago(2), paymentReference: 'UPI 1234' },
    { planId: 'gold', source: 'ADMIN_GRANT', cancelledAt: ago(1), startedAt: ago(3), expiresAt: new Date(NOW.getTime() + 87 * DAY), createdAt: ago(3), paymentReference: null },
  ];
  const groupBy = (rows: any[], key: string) =>
    Object.values(rows.reduce((acc: any, r: any) => ((acc[r[key]] ??= { [key]: r[key], _count: { _all: 0 } })._count._all += 1, acc), {}));
  const prisma: any = {
    order: {
      findMany: async ({ where }: any) => orders.filter((o) => matches(o, where)),
      aggregate: async ({ where }: any) => {
        const hit = orders.filter((o) => matches(o, where));
        return { _sum: { amountInPaise: hit.reduce((s, o) => s + o.amountInPaise, 0) || null }, _count: { _all: hit.length } };
      },
      groupBy: async ({ where }: any) => groupBy(orders.filter((o) => matches(o, where)), 'status'),
    },
    subscription: {
      groupBy: async ({ where }: any) => groupBy(subs.filter((s) => matches(s, where)), 'planId'),
      count: async ({ where }: any) => subs.filter((s) => matches(s, where)).length,
    },
    membershipPlan: { findMany: async () => plans },
  };
  return prisma;
}

describe('finance dashboard (7 days)', () => {
  it('matches the fixture by hand: gross, refunds, net, statuses, active plans, expiring, grants, per day', async () => {
    const d = await buildFinanceDashboard(financeFixture(), 7, NOW);
    expect(d.grossRevenueInPaise).toBe(149900 + 229900 + 149900);
    expect(d.paidOrdersCount).toBe(3);
    expect(d.refundedInPaise).toBe(149900);
    expect(d.refundedCount).toBe(1);
    expect(d.netRevenueInPaise).toBe(379800);
    expect(d.ordersByStatus).toEqual({ PAID: 2, REFUNDED: 1, CREATED: 1, FAILED: 1 });
    expect(d.activeSubscriptionsByPlan).toEqual([
      { planCode: 'GOLD', planName: 'Gold', count: 1 },
      { planCode: 'GOLD_PLUS', planName: 'Gold Plus', count: 2 },
    ]);
    expect(d.expiringNext7Days).toBe(1);
    expect(d.adminGrantsCount).toBe(2);
    expect(d.adminGrantsWithPaymentReference).toBe(1);
    expect(d.revenuePerDay).toHaveLength(7);
    expect(d.revenuePerDay.at(-1)!.date).toBe('2026-10-07');
    expect(d.revenuePerDay.reduce((s, p) => s + p.grossInPaise, 0)).toBe(d.grossRevenueInPaise);
  });

  it('admin grants never add to revenue', async () => {
    const d = await buildFinanceDashboard(financeFixture(), 90, NOW);
    expect(d.grossRevenueInPaise).toBe(149900 + 229900 + 149900 + 599900);
  });

  it('empty data: zeros and a full run of empty days', async () => {
    const empty: any = {
      order: { findMany: async () => [], aggregate: async () => ({ _sum: { amountInPaise: null }, _count: { _all: 0 } }), groupBy: async () => [] },
      subscription: { groupBy: async () => [], count: async () => 0 },
      membershipPlan: { findMany: async () => [] },
    };
    const d = await buildFinanceDashboard(empty, 30, NOW);
    expect(d).toMatchObject({ grossRevenueInPaise: 0, refundedInPaise: 0, netRevenueInPaise: 0, adminGrantsCount: 0 });
    expect(d.revenuePerDay).toHaveLength(30);
  });
});

function vipWorld() {
  const enquiries: any[] = [];
  let seq = 0;
  const prisma: any = {
    vipEnquiry: {
      findFirst: async ({ where }: any) =>
        enquiries
          .filter((e) => e.userId === where.userId && (!where.status?.in || where.status.in.includes(e.status)))
          .sort((a, b) => b.createdAt - a.createdAt)[0] ?? null,
      findUnique: async ({ where }: any) => enquiries.find((e) => e.id === where.id) ?? null,
      create: async ({ data }: any) => {
        const row = { id: `v${(seq += 1)}`, status: 'NEW', assignedAdminId: null, adminNotes: null, createdAt: new Date(Date.now() + seq), updatedAt: new Date(), ...data };
        enquiries.push(row);
        return row;
      },
      update: async ({ where, data }: any) => Object.assign(enquiries.find((e) => e.id === where.id), data),
    },
    user: { findUnique: async () => ({ phoneNumber: '+919800000001', profile: { fullName: 'Vip Member' } }) },
    adminUser: { findMany: async () => [{ id: 'ops-1', email: 'ops@example.com' }] },
  };
  const counter = new Map<string, number>();
  const redis = { set: async () => 'OK', incr: async (k: string) => counter.set(k, (counter.get(k) ?? 0) + 1).get(k)!, ttl: async () => 3600 };
  return { service: new VipEnquiriesService(prisma, redis as never), enquiries };
}

describe('VIP enquiries', () => {
  it('copies name and phone from the account, and one open enquiry per member (a second returns it)', async () => {
    const { service, enquiries } = vipWorld();
    const first = await service.create('u1', 'Please call after 6pm');
    const second = await service.create('u1', 'again');
    expect(first.existing).toBe(false);
    expect(second).toMatchObject({ id: first.id, existing: true });
    expect(enquiries).toHaveLength(1);
    expect(enquiries[0]).toMatchObject({ name: 'Vip Member', phone: '+919800000001', message: 'Please call after 6pm' });
  });

  it('status flow: NEW -> CONTACTED -> ONBOARDED; final states stay final; skipping is refused', async () => {
    const { service } = vipWorld();
    const { id } = await service.create('u1', undefined);
    await expect(service.update(id, { status: 'ONBOARDED' })).rejects.toBeInstanceOf(ConflictException);
    await service.update(id, { status: 'CONTACTED', assignedAdminId: 'ops-1', adminNotes: 'Called, interested' });
    const { before, after } = await service.update(id, { status: 'ONBOARDED' });
    expect(before).toEqual({ status: 'CONTACTED' });
    expect(after).toEqual({ status: 'ONBOARDED' });
    await expect(service.update(id, { status: 'CLOSED' })).rejects.toBeInstanceOf(ConflictException);
  });

  it('once the enquiry is closed, the member can open a new one', async () => {
    const { service, enquiries } = vipWorld();
    const { id } = await service.create('u1', undefined);
    await service.update(id, { status: 'CLOSED' });
    const again = await service.create('u1', 'second try');
    expect(again.existing).toBe(false);
    expect(enquiries).toHaveLength(2);
    expect((await service.mine('u1')).enquiry?.id).toBe(again.id);
  });

  it('can only be assigned to an admin who can work VIP enquiries', async () => {
    const { service } = vipWorld();
    const { id } = await service.create('u1', undefined);
    await expect(service.update(id, { assignedAdminId: 'finance-9' })).rejects.toThrow('cannot be assigned');
  });
});

describe('plan edits', () => {
  it('changing a price touches only the plan (existing orders keep their amount) and is audited with before/after', async () => {
    const plan = { id: 'gold', code: 'GOLD', name: 'Gold', priceInPaise: 149900, isActive: true, sortOrder: 1, durationDays: 90, phoneUnlockLimit: 50, isAssisted: false, entitlements: {} };
    const prisma: any = {
      membershipPlan: {
        findUnique: async () => plan,
        update: vi.fn(async ({ data }: any) => Object.assign(plan, data)),
        findMany: async () => [plan],
      },
      subscription: { groupBy: async () => [] },
      order: { updateMany: vi.fn() },
    };
    const audit = { record: vi.fn() };
    const service = new AdminBillingService(prisma, {} as never, audit as never);

    const updated = await service.updatePlan('a1', 'gold', { priceInPaise: 159900, name: 'Gold' });

    expect(updated.priceInPaise).toBe(159900);
    expect(prisma.membershipPlan.update).toHaveBeenCalledWith({ where: { id: 'gold' }, data: { priceInPaise: 159900 } });
    expect(prisma.order.updateMany).not.toHaveBeenCalled();
    expect(audit.record).toHaveBeenCalledWith('a1', 'plan.update', 'MembershipPlan', 'gold', {
      code: 'GOLD',
      before: { priceInPaise: 149900 },
      after: { priceInPaise: 159900 },
    });
  });

  it('members only ever see active plans', async () => {
    const findMany = vi.fn(async () => []);
    const payments = new PaymentsService({ membershipPlan: { findMany } } as never, {} as never, {} as never, {} as never);
    await payments.listPlans();
    expect(findMany).toHaveBeenCalledWith({ where: { isActive: true }, orderBy: { sortOrder: 'asc' } });
  });
});
