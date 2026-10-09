import { createHmac } from 'node:crypto';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NotYetAvailableException } from '../../common/not-yet-available.exception.js';
import { StubPaymentGatewayAdapter } from './adapters/stub-payment-gateway.adapter.js';
import { SubscriptionService } from '../membership/subscription.service.js';
import { PaymentsService, type PaymentWebhookEvent } from './payments.service.js';

function buildService(overrides?: { nodeEnv?: string; gatewayIsStub?: boolean; freeInterests?: number; requirePaidPlan?: boolean }) {
  const prisma = {
    membershipPlan: {
      findUnique: vi.fn().mockResolvedValue({
        id: 'plan-1',
        isActive: true,
        priceInPaise: 149900,
        durationDays: 90,
      }),
      findMany: vi.fn().mockResolvedValue([]),
    },
    order: {
      create: vi.fn().mockResolvedValue({
        id: 'order-1',
        planId: 'plan-1',
        amountInPaise: 149900,
        status: 'CREATED',
        createdAt: new Date(),
      }),
    },
  };
  const gateway = {
    isStub: overrides?.gatewayIsStub ?? true,
    createProviderOrder: vi.fn(),
    verifyWebhookSignature: vi.fn(),
  };
  const configService = {
    get: vi.fn(
      (key: string) =>
        ({
          NODE_ENV: overrides?.nodeEnv ?? 'test',
          FREE_INTERESTS_PER_MONTH: overrides?.freeInterests ?? 5,
          REQUIRE_PAID_PLAN: overrides?.requirePaidPlan ?? false,
        })[key],
    ),
  };

  const service = new PaymentsService(prisma as never, gateway as never, configService as never, { notify: vi.fn() } as never);
  return { service, prisma, gateway };
}

describe('PaymentsService', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('createOrder returns NotYetAvailableException in production while the gateway is the stub, without creating an order row', async () => {
    const { service, prisma } = buildService({ nodeEnv: 'production', gatewayIsStub: true });

    await expect(service.createOrder('user-1', 'plan-1')).rejects.toBeInstanceOf(NotYetAvailableException);
    expect(prisma.order.create).not.toHaveBeenCalled();
  });

  it('createOrder still works with the stub outside production (no regression to local dev)', async () => {
    const { service, prisma } = buildService({ nodeEnv: 'development', gatewayIsStub: true });

    const result = await service.createOrder('user-1', 'plan-1');

    expect(result.id).toBe('order-1');
    expect(prisma.order.create).toHaveBeenCalledTimes(1);
  });

  it('createOrder proceeds in production once a real (non-stub) gateway is configured', async () => {
    const { service, prisma } = buildService({ nodeEnv: 'production', gatewayIsStub: false });

    const result = await service.createOrder('user-1', 'plan-1');

    expect(result.id).toBe('order-1');
    expect(prisma.order.create).toHaveBeenCalledTimes(1);
  });

  it('createOrder rejects an unknown or inactive plan before touching the gateway check outcome', async () => {
    const { service, prisma } = buildService({ nodeEnv: 'development' });
    prisma.membershipPlan.findUnique.mockResolvedValue(null);

    await expect(service.createOrder('user-1', 'missing-plan')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('createOrder looks the plan up by id and charges that plan’s own price', async () => {
    const { service, prisma } = buildService({ nodeEnv: 'development' });
    prisma.membershipPlan.findUnique.mockResolvedValue({ id: 'plan-gold-plus-3m', isActive: true, priceInPaise: 229900 });

    await service.createOrder('user-1', 'plan-gold-plus-3m');

    expect(prisma.membershipPlan.findUnique).toHaveBeenCalledWith({ where: { id: 'plan-gold-plus-3m' } });
    expect(prisma.order.create).toHaveBeenCalledWith({
      data: { userId: 'user-1', planId: 'plan-gold-plus-3m', amountInPaise: 229900, status: 'CREATED' },
    });
  });

  it('listPlans returns plans in sortOrder with typed limits and only well-formed feature copy', async () => {
    const { service, prisma } = buildService();
    prisma.membershipPlan.findMany.mockResolvedValue([
      {
        id: 'plan-gold-3m',
        code: 'GOLD',
        name: 'Gold',
        description: 'For families ready to talk',
        priceInPaise: 149900,
        originalPriceInPaise: 249900,
        durationDays: 90,
        sortOrder: 1,
        phoneUnlockLimit: 50,
        isAssisted: false,
        entitlements: { features: [{ key: 'unlimitedMessages', label: 'Messages', available: true }, { key: 'broken' }] },
      },
    ]);

    const { items, freeInterestsPerMonth } = await service.listPlans();

    expect(prisma.membershipPlan.findMany).toHaveBeenCalledWith({ where: { isActive: true }, orderBy: { sortOrder: 'asc' } });
    expect(items).toEqual([
      {
        id: 'plan-gold-3m',
        code: 'GOLD',
        name: 'Gold',
        description: 'For families ready to talk',
        priceInPaise: 149900,
        originalPriceInPaise: 249900,
        durationDays: 90,
        sortOrder: 1,
        phoneUnlockLimit: 50,
        isAssisted: false,
        features: [{ key: 'unlimitedMessages', label: 'Messages', available: true }],
      },
    ]);
    expect(freeInterestsPerMonth).toBe(5);
  });

  it('listPlans reports the free monthly interest limit from the setting, so member copy follows it', async () => {
    const { service, prisma } = buildService({ freeInterests: 12 });
    prisma.membershipPlan.findMany.mockResolvedValue([]);
    expect((await service.listPlans()).freeInterestsPerMonth).toBe(12);
  });

  it('listPlans reports whether a plan is required, so the public Membership page can say so', async () => {
    const off = buildService();
    off.prisma.membershipPlan.findMany.mockResolvedValue([]);
    expect((await off.service.listPlans()).requirePaidPlan).toBe(false);

    const on = buildService({ requirePaidPlan: true });
    on.prisma.membershipPlan.findMany.mockResolvedValue([]);
    expect((await on.service.listPlans()).requirePaidPlan).toBe(true);
  });
});

// --- Webhook: a stateful in-memory store and the real HMAC adapter, so the
// tests prove what a signed provider request actually does. ---------------
/* eslint-disable @typescript-eslint/no-explicit-any */
const SECRET = 'test-webhook-secret';
const DAY = 24 * 60 * 60 * 1000;

function webhookWorld() {
  const orders: any[] = [];
  const payments: any[] = [];
  const subscriptions: any[] = [];
  const plans: Record<string, any> = {
    gold: { id: 'gold', code: 'GOLD', name: 'Gold', priceInPaise: 149900, durationDays: 90 },
    plus: { id: 'plus', code: 'GOLD_PLUS', name: 'Gold Plus', priceInPaise: 229900, durationDays: 90 },
    premium: { id: 'premium', code: 'GOLD_PREMIUM', name: 'Gold Premium', priceInPaise: 599900, durationDays: 365 },
  };
  const profiles: Record<string, { searchBoost: number }> = { 'user-1': { searchBoost: 0 } };
  const unique = (field: string) => Object.assign(new Error(`Unique constraint failed on ${field}`), { code: 'P2002' });
  const prisma: any = {
    payment: {
      findUnique: async ({ where }: any) => payments.find((p) => p.providerEventId === where.providerEventId) ?? null,
      create: async ({ data }: any) => {
        if (payments.some((p) => p.providerEventId === data.providerEventId)) throw unique('providerEventId');
        payments.push({ id: `pay-${payments.length + 1}`, ...data });
      },
    },
    order: {
      findUnique: async ({ where }: any) => {
        const order = orders.find((o) => o.id === where.id);
        return order ? { ...order, plan: plans[order.planId] } : null;
      },
      updateMany: async ({ where, data }: any) => {
        const hits = orders.filter((o) => o.id === where.id && o.status === where.status);
        hits.forEach((o) => Object.assign(o, data));
        return { count: hits.length };
      },
      update: async ({ where, data }: any) => Object.assign(orders.find((o) => o.id === where.id), data),
    },
    membershipPlan: { findUnique: async ({ where }: any) => plans[where.id] ?? null },
    // SubscriptionService locks the member's row; nothing to lock here.
    $queryRaw: async () => [],
    subscription: {
      findUnique: async ({ where, include }: any) => {
        const row = subscriptions.find((s) => (where.orderId ? s.orderId === where.orderId : s.id === where.id));
        return row ? (include?.plan ? { ...row, plan: plans[row.planId] } : row) : null;
      },
      update: async ({ where, data, include }: any) => {
        const row = Object.assign(subscriptions.find((s) => s.id === where.id), data);
        return include?.plan ? { ...row, plan: plans[row.planId] } : row;
      },
      findFirst: async ({ where }: any) =>
        subscriptions
          .filter((s) => s.userId === where.userId && s.cancelledAt === null && s.expiresAt > where.expiresAt.gt)
          .sort((a, b) => b.expiresAt - a.expiresAt)[0] ?? null,
      // findActiveSubscription (recomputeSearchBoost).
      findMany: async ({ where }: any) =>
        subscriptions
          .filter((s) => s.userId === where.userId && s.cancelledAt === null && s.expiresAt > where.expiresAt.gt)
          .sort((a, b) => a.startedAt - b.startedAt)
          .map((s) => ({ ...s, plan: plans[s.planId] })),
      create: async ({ data }: any) => {
        if (subscriptions.some((s) => s.orderId === data.orderId)) throw unique('orderId');
        const row = { id: `sub-${subscriptions.length + 1}`, cancelledAt: null, createdAt: new Date(), ...data };
        subscriptions.push(row);
        return row;
      },
      updateMany: async ({ where, data }: any) => {
        const hits = subscriptions.filter((s) => s.orderId === where.orderId && s.cancelledAt === null);
        hits.forEach((s) => Object.assign(s, data));
        return { count: hits.length };
      },
    },
    profile: {
      updateMany: async ({ where, data }: any) => {
        const row = profiles[where.userId];
        if (!row || row.searchBoost === data.searchBoost) return { count: 0 };
        row.searchBoost = data.searchBoost;
        return { count: 1 };
      },
    },
    $transaction: async (fn: (tx: any) => Promise<unknown>) => {
      // Roll back on error, like a real transaction.
      const snapshot = JSON.stringify({ orders, payments, subscriptions });
      try {
        return await fn(prisma);
      } catch (error) {
        const restored = JSON.parse(snapshot, (key, value) => (['expiresAt', 'startedAt', 'paidAt', 'cancelledAt'].includes(key) && value ? new Date(value) : value));
        orders.splice(0, orders.length, ...restored.orders);
        payments.splice(0, payments.length, ...restored.payments);
        subscriptions.splice(0, subscriptions.length, ...restored.subscriptions);
        throw error;
      }
    },
  };
  const config = { get: (key: string) => ({ PAYMENT_WEBHOOK_SECRET: SECRET, NODE_ENV: 'test' })[key] };
  const notifications = { notify: vi.fn() };
  const service = new PaymentsService(
    prisma,
    new StubPaymentGatewayAdapter(config as never),
    config as never,
    new SubscriptionService(prisma, notifications as never),
  );

  const order = (id: string, planId = 'gold', userId = 'user-1') => {
    orders.push({ id, userId, planId, amountInPaise: plans[planId].priceInPaise, status: 'CREATED', paidAt: null });
  };
  // Sends the event exactly as a provider would: bytes + HMAC of those bytes.
  const send = (event: Partial<PaymentWebhookEvent> & { providerEventId: string; orderId: string; status: PaymentWebhookEvent['status'] }, opts: { tamper?: (raw: string) => string; signature?: string } = {}) => {
    const full = { amountInPaise: orders.find((o) => o.id === event.orderId)?.amountInPaise ?? 0, currency: 'INR', ...event };
    const raw = JSON.stringify(full);
    const signature = opts.signature ?? createHmac('sha256', SECRET).update(raw).digest('hex');
    const delivered = opts.tamper ? opts.tamper(raw) : raw;
    return service.handleWebhook(Buffer.from(delivered), signature, JSON.parse(delivered));
  };
  return { orders, payments, subscriptions, profiles, notifications, order, send };
}

describe('PaymentsService.handleWebhook', () => {
  it('a correctly signed PAID event activates the plan in the same transaction and notifies the member', async () => {
    const w = webhookWorld();
    w.order('o1');

    await expect(w.send({ providerEventId: 'e1', orderId: 'o1', status: 'PAID' })).resolves.toEqual({ outcome: 'processed' });

    expect(w.orders[0]).toMatchObject({ status: 'PAID', paidAt: expect.any(Date) });
    expect(w.subscriptions).toHaveLength(1);
    expect(w.subscriptions[0]).toMatchObject({ orderId: 'o1', userId: 'user-1', status: 'ACTIVE' });
    expect(w.subscriptions[0].expiresAt.getTime() - w.subscriptions[0].startedAt.getTime()).toBe(90 * DAY);
    expect(w.notifications.notify).toHaveBeenCalledWith(expect.objectContaining({ recipientUserId: 'user-1', type: 'PLAN_ACTIVATED' }));
  });

  it('verifies the signature over the raw bytes: a tampered body (same signature) is rejected with 400 and changes nothing', async () => {
    const w = webhookWorld();
    w.order('o1');

    await expect(
      w.send({ providerEventId: 'e1', orderId: 'o1', status: 'PAID' }, { tamper: (raw) => raw.replace('"PAID"', '"PAID" ') }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(w.payments).toHaveLength(0);
    expect(w.orders[0].status).toBe('CREATED');
  });

  it('a wrong or missing signature is rejected with 400', async () => {
    const w = webhookWorld();
    w.order('o1');
    await expect(w.send({ providerEventId: 'e1', orderId: 'o1', status: 'PAID' }, { signature: 'deadbeef' })).rejects.toBeInstanceOf(BadRequestException);
    await expect(w.send({ providerEventId: 'e1', orderId: 'o1', status: 'PAID' }, { signature: 'not-hex!' })).rejects.toBeInstanceOf(BadRequestException);
    expect(w.subscriptions).toHaveLength(0);
  });

  it('a wrong amount or currency is rejected and nothing is recorded', async () => {
    const w = webhookWorld();
    w.order('o1');

    await expect(w.send({ providerEventId: 'e1', orderId: 'o1', status: 'PAID', amountInPaise: 100 })).rejects.toThrow('Amount or currency does not match');
    await expect(w.send({ providerEventId: 'e2', orderId: 'o1', status: 'PAID', currency: 'USD' })).rejects.toThrow('Amount or currency does not match');
    expect(w.payments).toHaveLength(0);
    expect(w.orders[0].status).toBe('CREATED');
  });

  it('replaying the same providerEventId is a no-op', async () => {
    const w = webhookWorld();
    w.order('o1');
    await w.send({ providerEventId: 'e1', orderId: 'o1', status: 'PAID' });

    await expect(w.send({ providerEventId: 'e1', orderId: 'o1', status: 'PAID' })).resolves.toEqual({ outcome: 'duplicate' });
    expect(w.payments).toHaveLength(1);
    expect(w.subscriptions).toHaveLength(1);
  });

  it('a second, different PAID event for the same order is recorded but never creates a second subscription', async () => {
    const w = webhookWorld();
    w.order('o1');
    await w.send({ providerEventId: 'e1', orderId: 'o1', status: 'PAID' });

    await expect(w.send({ providerEventId: 'e2', orderId: 'o1', status: 'PAID' })).resolves.toEqual({ outcome: 'ignored' });
    expect(w.subscriptions).toHaveLength(1);
    expect(w.payments.map((p) => p.providerEventId)).toEqual(['e1', 'e2']);
  });

  it('a late FAILED (or CANCELLED) after PAID never downgrades the order', async () => {
    const w = webhookWorld();
    w.order('o1');
    await w.send({ providerEventId: 'e1', orderId: 'o1', status: 'PAID' });

    await expect(w.send({ providerEventId: 'e2', orderId: 'o1', status: 'FAILED' })).resolves.toEqual({ outcome: 'ignored' });
    await expect(w.send({ providerEventId: 'e3', orderId: 'o1', status: 'CANCELLED' })).resolves.toEqual({ outcome: 'ignored' });
    expect(w.orders[0].status).toBe('PAID');
    expect(w.subscriptions[0].status).toBe('ACTIVE');
  });

  it('CREATED -> FAILED is allowed, and a PAID after FAILED is ignored (no subscription)', async () => {
    const w = webhookWorld();
    w.order('o1');
    await expect(w.send({ providerEventId: 'e1', orderId: 'o1', status: 'FAILED' })).resolves.toEqual({ outcome: 'processed' });
    await expect(w.send({ providerEventId: 'e2', orderId: 'o1', status: 'PAID' })).resolves.toEqual({ outcome: 'ignored' });
    expect(w.orders[0].status).toBe('FAILED');
    expect(w.subscriptions).toHaveLength(0);
  });

  it('PAID -> REFUNDED cancels that order’s subscription', async () => {
    const w = webhookWorld();
    w.order('o1');
    await w.send({ providerEventId: 'e1', orderId: 'o1', status: 'PAID' });

    await expect(w.send({ providerEventId: 'e2', orderId: 'o1', status: 'REFUNDED' })).resolves.toEqual({ outcome: 'processed' });
    expect(w.orders[0].status).toBe('REFUNDED');
    expect(w.subscriptions[0]).toMatchObject({ status: 'CANCELLED', cancelledAt: expect.any(Date) });
  });

  it('buying again while a plan is active appends the new period after it (no overlap)', async () => {
    const w = webhookWorld();
    w.order('o1', 'gold');
    w.order('o2', 'plus');
    await w.send({ providerEventId: 'e1', orderId: 'o1', status: 'PAID' });
    await w.send({ providerEventId: 'e2', orderId: 'o2', status: 'PAID' });

    const [first, second] = w.subscriptions;
    expect(second.startedAt.getTime()).toBe(first.expiresAt.getTime());
    expect(second.expiresAt.getTime() - first.startedAt.getTime()).toBe(180 * DAY);
  });

  it('search tier follows the plan: Gold stays 0, Premium activation sets 2, refunding it drops back', async () => {
    const w = webhookWorld();
    w.order('o1', 'gold');
    await w.send({ providerEventId: 'e1', orderId: 'o1', status: 'PAID' });
    expect(w.profiles['user-1']!.searchBoost).toBe(0);

    const v = webhookWorld();
    v.order('o2', 'premium');
    await v.send({ providerEventId: 'e2', orderId: 'o2', status: 'PAID' });
    expect(v.profiles['user-1']!.searchBoost).toBe(2);
    await v.send({ providerEventId: 'e3', orderId: 'o2', status: 'REFUNDED' });
    expect(v.profiles['user-1']!.searchBoost).toBe(0);
  });

  it('a renewal queued behind the current plan does not change the tier until it starts', async () => {
    const w = webhookWorld();
    w.order('o1', 'gold');
    w.order('o2', 'plus');
    await w.send({ providerEventId: 'e1', orderId: 'o1', status: 'PAID' });
    await w.send({ providerEventId: 'e2', orderId: 'o2', status: 'PAID' });
    expect(w.profiles['user-1']!.searchBoost).toBe(0);
  });

  it('an unknown order is rejected with 400', async () => {
    const w = webhookWorld();
    await expect(w.send({ providerEventId: 'e1', orderId: 'nope', status: 'PAID', amountInPaise: 1 })).rejects.toThrow('Unknown order');
  });
});
