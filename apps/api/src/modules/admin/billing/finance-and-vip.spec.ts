import { ConflictException, NotFoundException } from '@nestjs/common';
import { updatePlanRequestSchema } from '@nadar-kalyanam/schemas';
import { describe, expect, it, vi } from 'vitest';
import { PaymentsService } from '../../payments/payments.service.js';
import { VipEnquiriesService } from '../../vip/vip-enquiries.service.js';
import { AdminBillingService, normalizeFeatures } from './admin-billing.service.js';
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
  const notes: any[] = [];
  const events: any[] = [];
  let seq = 0;
  const admins = [
    { id: 'ops-1', email: 'ops@example.com', vip: true },
    { id: 'ops-2', email: 'ops2@example.com', vip: true },
    { id: 'finance-9', email: 'finance@example.com', vip: false },
  ];
  const byWhere = (where: any) => (e: any) =>
    (!where?.status || e.status === where.status) && (where?.assignedAdminId === undefined || e.assignedAdminId === where.assignedAdminId);
  const prisma: any = {
    vipEnquiry: {
      findFirst: async ({ where }: any) =>
        enquiries
          .filter((e) => e.userId === where.userId && (!where.status?.in || where.status.in.includes(e.status)))
          .sort((a, b) => b.createdAt - a.createdAt)[0] ?? null,
      findUnique: async ({ where, include }: any) => {
        const row = enquiries.find((e) => e.id === where.id);
        if (!row) return null;
        if (!include) return row;
        return { ...row, notes: notes.filter((n) => n.enquiryId === row.id), events: events.filter((e) => e.enquiryId === row.id) };
      },
      findMany: async ({ where }: any) => enquiries.filter(byWhere(where)),
      count: async ({ where }: any) => enquiries.filter(byWhere(where)).length,
      create: async ({ data }: any) => {
        const row = { id: `v${(seq += 1)}`, status: 'NEW', assignedAdminId: null, adminNotes: null, createdAt: new Date(Date.now() + seq), updatedAt: new Date(), ...data };
        enquiries.push(row);
        return row;
      },
      update: async ({ where, data }: any) => Object.assign(enquiries.find((e) => e.id === where.id), data, { updatedAt: new Date() }),
    },
    vipEnquiryNote: {
      create: async ({ data }: any) => {
        const row = { id: `n${(seq += 1)}`, createdAt: new Date(Date.now() + seq), ...data };
        notes.push(row);
        return row;
      },
      groupBy: async ({ where }: any) =>
        where.enquiryId.in
          .map((id: string) => ({ enquiryId: id, _count: { _all: notes.filter((n) => n.enquiryId === id).length } }))
          .filter((g: any) => g._count._all > 0),
    },
    vipEnquiryEvent: {
      createMany: async ({ data }: any) => {
        for (const e of data) events.push({ id: `e${(seq += 1)}`, createdAt: new Date(Date.now() + seq), ...e });
        return { count: data.length };
      },
    },
    user: { findUnique: async () => ({ phoneNumber: '+919800000001', profile: { fullName: 'Vip Member' } }) },
    adminUser: {
      findMany: async ({ where }: any) =>
        admins
          .filter((a) => (where.id?.in ? where.id.in.includes(a.id) : a.vip))
          .map(({ id, email }) => ({ id, email })),
    },
  };
  prisma.$transaction = async (fn: any) => fn(prisma);
  const counter = new Map<string, number>();
  const redis = { set: async () => 'OK', incr: async (k: string) => counter.set(k, (counter.get(k) ?? 0) + 1).get(k)!, ttl: async () => 3600 };
  return { service: new VipEnquiriesService(prisma, redis as never), enquiries, notes, events };
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
    await expect(service.update('ops-1', id, { status: 'ONBOARDED' })).rejects.toBeInstanceOf(ConflictException);
    await service.update('ops-1', id, { status: 'CONTACTED', assignedAdminId: 'ops-1' });
    const { events } = await service.update('ops-1', id, { status: 'ONBOARDED' });
    expect(events).toEqual([{ kind: 'STATUS', fromValue: 'CONTACTED', toValue: 'ONBOARDED' }]);
    await expect(service.update('ops-1', id, { status: 'CLOSED' })).rejects.toBeInstanceOf(ConflictException);
  });

  it('once the enquiry is closed, the member can open a new one', async () => {
    const { service, enquiries } = vipWorld();
    const { id } = await service.create('u1', undefined);
    await service.update('ops-1', id, { status: 'CLOSED' });
    const again = await service.create('u1', 'second try');
    expect(again.existing).toBe(false);
    expect(enquiries).toHaveLength(2);
    expect((await service.mine('u1')).enquiry?.id).toBe(again.id);
  });

  it('can only be assigned to an admin who can work VIP enquiries', async () => {
    const { service, events } = vipWorld();
    const { id } = await service.create('u1', undefined);
    await expect(service.update('ops-1', id, { assignedAdminId: 'finance-9' })).rejects.toThrow('cannot be assigned');
    expect(events).toHaveLength(0);
  });

  it('assignment and status changes are recorded in history with who did them; an unchanged value records nothing', async () => {
    const { service, events } = vipWorld();
    const { id } = await service.create('u1', undefined);
    await service.update('ops-1', id, { assignedAdminId: 'ops-1' });
    await service.update('ops-1', id, { assignedAdminId: 'ops-1' });
    await service.update('ops-2', id, { assignedAdminId: 'ops-2', status: 'CONTACTED' });
    await service.update('ops-2', id, { assignedAdminId: null });
    expect(events.map((e) => [e.kind, e.adminId, e.fromValue, e.toValue])).toEqual([
      ['ASSIGNMENT', 'ops-1', null, 'ops-1'],
      ['STATUS', 'ops-2', 'NEW', 'CONTACTED'],
      ['ASSIGNMENT', 'ops-2', 'ops-1', 'ops-2'],
      ['ASSIGNMENT', 'ops-2', 'ops-2', null],
    ]);
    const detail = await service.getForAdmin(id);
    expect(detail.history.map((h) => [h.kind, h.byEmail, h.fromValue, h.toValue])).toEqual([
      ['ASSIGNMENT', 'ops@example.com', null, 'ops@example.com'],
      ['STATUS', 'ops2@example.com', 'NEW', 'CONTACTED'],
      ['ASSIGNMENT', 'ops2@example.com', 'ops@example.com', 'ops2@example.com'],
      ['ASSIGNMENT', 'ops2@example.com', 'ops2@example.com', null],
    ]);
  });

  it('list filters by status and assignee ("me", "unassigned", an admin id)', async () => {
    const { service } = vipWorld();
    const a = await service.create('u1', undefined);
    const b = await service.create('u2', undefined);
    await service.create('u3', undefined);
    await service.update('ops-1', a.id, { assignedAdminId: 'ops-1', status: 'CONTACTED' });
    await service.update('ops-2', b.id, { assignedAdminId: 'ops-2' });
    const ids = async (f: any) => (await service.list(f, 0, 25)).items.map((i) => i.id).sort();
    expect(await ids({ assignee: 'me', callerAdminId: 'ops-1' })).toEqual([a.id]);
    expect(await ids({ assignee: 'ops-2' })).toEqual([b.id]);
    expect(await ids({ assignee: 'unassigned' })).toHaveLength(1);
    expect(await ids({ status: 'CONTACTED' })).toEqual([a.id]);
    expect(await ids({})).toHaveLength(3);
  });

  it('notes are append-only with author and time, shown to admins, and never in the member response', async () => {
    const { service } = vipWorld();
    const { id } = await service.create('u1', 'Call me');
    await service.addNote('ops-1', id, '  Spoke to mother, call back Sunday  ');
    await service.addNote('ops-2', id, 'Sent brochure');
    const detail = await service.getForAdmin(id);
    expect(detail.notes.map((n) => [n.authorEmail, n.body])).toEqual([
      ['ops@example.com', 'Spoke to mother, call back Sunday'],
      ['ops2@example.com', 'Sent brochure'],
    ]);
    expect(detail.noteCount).toBe(2);
    expect(detail).not.toHaveProperty('adminNotes');

    const mine = await service.mine('u1');
    expect(Object.keys(mine.enquiry!).sort()).toEqual(['createdAt', 'id', 'message', 'status', 'updatedAt']);
    const text = JSON.stringify(mine);
    expect(text).not.toContain('Spoke to mother');
    expect(text).not.toContain('Sent brochure');
    expect(text).not.toContain('ops@example.com');
    await expect(service.addNote('ops-1', 'missing', 'x')).rejects.toBeInstanceOf(NotFoundException);
  });
});

describe('plan edits', () => {
  function planWorld(overrides: Record<string, unknown> = {}) {
    const plan: any = {
      id: 'gold',
      code: 'GOLD',
      name: 'Gold',
      description: null,
      priceInPaise: 149900,
      isActive: true,
      sortOrder: 1,
      originalPriceInPaise: null,
      durationDays: 90,
      phoneUnlockLimit: 50,
      isAssisted: false,
      entitlements: {
        features: [
          { key: 'unlimitedInterests', label: 'Unlimited interests (no monthly limit)', available: true },
          { key: 'phoneUnlocks', label: 'Unlock up to 50 phone numbers', available: true },
        ],
      },
      ...overrides,
    };
    const subscription = { id: 's1', planId: 'gold', expiresAt: new Date('2027-01-01T00:00:00Z') };
    const prisma: any = {
      membershipPlan: {
        findUnique: async () => plan,
        update: vi.fn(async ({ data }: any) => Object.assign(plan, data)),
        findMany: async () => [plan],
      },
      subscription: { groupBy: async () => [], update: vi.fn(), updateMany: vi.fn() },
      order: { updateMany: vi.fn() },
    };
    const audit = { record: vi.fn() };
    return { plan, subscription, prisma, audit, service: new AdminBillingService(prisma, {} as never, audit as never) };
  }

  it('changing a price touches only the plan (existing orders keep their amount) and is audited with before/after', async () => {
    const { prisma, audit, service } = planWorld();

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

  it('copy edits (name, description, features add/remove/reorder) keep existing keys, never touch subscriptions, and audit only changed fields', async () => {
    const { prisma, audit, service, subscription } = planWorld();
    const before = { ...subscription };

    const updated = await service.updatePlan('a1', 'gold', {
      description: 'For families who want to move faster',
      features: [
        { key: 'phoneUnlocks', label: 'Unlock up to 50 phone numbers', available: true },
        { label: 'Profile highlighted in search', available: true },
        { label: 'Profile highlighted in search', available: false },
      ],
    });

    expect(updated.description).toBe('For families who want to move faster');
    expect(updated.features.map((f: any) => f.key)).toEqual(['phoneUnlocks', 'profileHighlightedInSearch', 'profileHighlightedInSearch2']);
    const call = audit.record.mock.calls[0]!;
    expect(Object.keys(call[4].before).sort()).toEqual(['description', 'features']);
    expect(call[4].before.description).toBeNull();
    expect(call[4].after.features).toHaveLength(3);
    // Existing members' subscriptions are not rewritten and keep their dates.
    expect(prisma.subscription.update).not.toHaveBeenCalled();
    expect(prisma.subscription.updateMany).not.toHaveBeenCalled();
    expect(subscription).toEqual(before);
    // The limit and duration the subscription reads stay as they were.
    expect(updated).toMatchObject({ phoneUnlockLimit: 50, durationDays: 90 });
  });

  it('an original price is saved and audited, must stay above the price, and null removes it', async () => {
    const { prisma, audit, service } = planWorld();

    const updated = await service.updatePlan('a1', 'gold', { originalPriceInPaise: 250000 });
    expect(updated.originalPriceInPaise).toBe(250000);
    expect(audit.record.mock.calls[0]![4]).toMatchObject({ before: { originalPriceInPaise: null }, after: { originalPriceInPaise: 250000 } });

    // Not above the price: on its own, or after a price change that overtakes it.
    await expect(service.updatePlan('a1', 'gold', { originalPriceInPaise: 149900 })).rejects.toThrow('Original price must be more than the price');
    await expect(service.updatePlan('a1', 'gold', { priceInPaise: 260000 })).rejects.toThrow('Original price must be more than the price');
    // Raising both together is fine.
    await service.updatePlan('a1', 'gold', { priceInPaise: 260000, originalPriceInPaise: 300000 });

    prisma.membershipPlan.update.mockClear();
    await service.updatePlan('a1', 'gold', { originalPriceInPaise: null });
    expect(prisma.membershipPlan.update).toHaveBeenCalledWith({ where: { id: 'gold' }, data: { originalPriceInPaise: null } });
  });

  it('an empty description clears it; a no-op edit writes and audits nothing', async () => {
    const { prisma, audit, service } = planWorld({ description: 'Old line' });
    await service.updatePlan('a1', 'gold', { description: '   ' });
    expect(prisma.membershipPlan.update).toHaveBeenCalledWith({ where: { id: 'gold' }, data: { description: null } });
    prisma.membershipPlan.update.mockClear();
    audit.record.mockClear();
    await service.updatePlan('a1', 'gold', { name: 'Gold', sortOrder: 1 });
    expect(prisma.membershipPlan.update).not.toHaveBeenCalled();
    expect(audit.record).not.toHaveBeenCalled();
  });

  it('deactivating is audited; the plan is then hidden from members (members only ever see active plans)', async () => {
    const { audit, service } = planWorld();
    await service.updatePlan('a1', 'gold', { isActive: false });
    expect(audit.record).toHaveBeenCalledWith('a1', 'plan.update', 'MembershipPlan', 'gold', {
      code: 'GOLD',
      before: { isActive: true },
      after: { isActive: false },
    });
    const findMany = vi.fn(async () => []);
    const payments = new PaymentsService({ membershipPlan: { findMany } } as never, {} as never, { get: () => 5 } as never, {} as never);
    await payments.listPlans();
    expect(findMany).toHaveBeenCalledWith({ where: { isActive: true }, orderBy: { sortOrder: 'asc' } });
  });

  it('an inactive plan cannot be granted, and nothing is activated', async () => {
    const activate = vi.fn();
    const prisma: any = {
      user: { findUnique: async () => ({ status: 'ACTIVE' }) },
      membershipPlan: { findUnique: async () => ({ isActive: false }) },
    };
    const service = new AdminBillingService(prisma, { activate } as never, { record: vi.fn() } as never);
    await expect(service.grant('a1', { memberId: 'u1', planId: 'gold', reason: 'Offline payment' })).rejects.toThrow('inactive');
    expect(activate).not.toHaveBeenCalled();
    prisma.membershipPlan.findUnique = async () => null;
    await expect(service.grant('a1', { memberId: 'u1', planId: 'nope', reason: 'Offline payment' })).rejects.toBeInstanceOf(NotFoundException);
  });

  it('the edit schema refuses duration, unlock limit, tier, assisted and code, and validates copy', () => {
    for (const field of [{ durationDays: 30 }, { phoneUnlockLimit: 99 }, { searchBoost: 2 }, { isAssisted: true }, { code: 'X' }]) {
      expect(updatePlanRequestSchema.safeParse(field).success).toBe(false);
    }
    expect(updatePlanRequestSchema.safeParse({}).success).toBe(false);
    expect(updatePlanRequestSchema.safeParse({ name: '  ' }).success).toBe(false);
    expect(updatePlanRequestSchema.safeParse({ features: [] }).success).toBe(false);
    expect(updatePlanRequestSchema.safeParse({ features: [{ label: '', available: true }] }).success).toBe(false);
    expect(updatePlanRequestSchema.safeParse({ description: 'x'.repeat(161) }).success).toBe(false);
    expect(updatePlanRequestSchema.safeParse({ priceInPaise: 0 }).success).toBe(false);
    expect(updatePlanRequestSchema.safeParse({ description: null, sortOrder: 3, features: [{ label: 'Chat', available: false }] }).success).toBe(true);
  });

  it('normalizeFeatures derives stable keys for new lines and keeps them unique', () => {
    expect(normalizeFeatures([{ label: 'Chat with matches!', available: false }, { key: 'chatWithMatches', label: 'Again', available: true }])).toEqual([
      { key: 'chatWithMatches', label: 'Chat with matches!', available: false },
      { key: 'chatWithMatches2', label: 'Again', available: true },
    ]);
    expect(normalizeFeatures([{ label: '!!!', available: true }])[0]!.key).toBe('feature');
  });
});

describe('member phone-unlock usage (admin)', () => {
  const NOW_U = new Date('2026-10-07T06:00:00Z');
  function unlockWorld(active: boolean) {
    const unlocks = [
      { id: 'p1', viewerId: 'u1', targetUserId: 't1', subscriptionId: 's1', createdAt: new Date('2026-10-05T10:00:00Z'), name: 'Target One', plan: 'Gold' },
      { id: 'p2', viewerId: 'u1', targetUserId: 't2', subscriptionId: 's0', createdAt: new Date('2026-08-01T10:00:00Z'), name: 'Target Two', plan: 'Silver' },
      { id: 'p3', viewerId: 't1', targetUserId: 'u1', subscriptionId: 's9', createdAt: new Date('2026-10-01T10:00:00Z'), name: 'Me', plan: 'Gold' },
    ];
    const sel = (where: any) => unlocks.filter((u) => Object.entries(where).every(([k, v]) => (u as any)[k] === v));
    const prisma: any = {
      user: { findUnique: async ({ where }: any) => (where.id === 'u1' ? { id: 'u1' } : null) },
      phoneUnlock: {
        findMany: vi.fn(async ({ where, skip, take }: any) =>
          sel(where)
            .slice(skip, skip + take)
            .map((u) => ({
              createdAt: u.createdAt,
              targetUserId: u.targetUserId,
              // A phone number present on the row must not leak through.
              target: { phoneNumber: '+919811111111', profile: { id: `prof-${u.targetUserId}`, fullName: u.name } },
              subscription: { plan: { name: u.plan } },
            })),
        ),
        count: async ({ where }: any) => sel(where).length,
      },
      subscription: {
        findMany: async () =>
          active
            ? [{ id: 's1', userId: 'u1', cancelledAt: null, startedAt: new Date('2026-10-01T00:00:00Z'), expiresAt: new Date('2026-12-30T00:00:00Z'), plan: { name: 'Gold', phoneUnlockLimit: 50 } }]
            : [],
      },
    };
    return { prisma, service: new AdminBillingService(prisma, {} as never, { record: vi.fn() } as never) };
  }

  it('lists unlocks made (name, id, date), counts how often this member was unlocked, and the current plan counter — never a number', async () => {
    const { prisma, service } = unlockWorld(true);
    const r = await service.memberPhoneUnlocks('u1', 0, 50, NOW_U);
    expect(r.made).toEqual([
      { targetUserId: 't1', targetName: 'Target One', unlockedAt: '2026-10-05T10:00:00.000Z', planName: 'Gold' },
      { targetUserId: 't2', targetName: 'Target Two', unlockedAt: '2026-08-01T10:00:00.000Z', planName: 'Silver' },
    ]);
    expect(r).toMatchObject({ madeTotal: 2, receivedCount: 1, nextOffset: null, currentPlan: { planName: 'Gold', used: 1, limit: 50 } });
    expect(JSON.stringify(r)).not.toMatch(/\+?91\d{10}|9811111111/);
    // The query itself never asks for a phone number.
    expect(JSON.stringify(prisma.phoneUnlock.findMany.mock.calls[0][0].select)).not.toContain('phone');
  });

  it('paginates, reports no current plan for a free member, and 404s for an unknown member', async () => {
    const { service } = unlockWorld(false);
    const first = await service.memberPhoneUnlocks('u1', 0, 1, NOW_U);
    expect(first.made).toHaveLength(1);
    expect(first.nextOffset).toBe(1);
    expect(first.currentPlan).toBeNull();
    expect((await service.memberPhoneUnlocks('u1', 1, 1, NOW_U)).nextOffset).toBeNull();
    await expect(service.memberPhoneUnlocks('nobody', 0, 50, NOW_U)).rejects.toBeInstanceOf(NotFoundException);
  });
});
