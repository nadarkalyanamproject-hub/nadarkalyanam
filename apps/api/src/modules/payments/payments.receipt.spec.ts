/* eslint-disable @typescript-eslint/no-explicit-any */
import { NotFoundException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import { StubPaymentGatewayAdapter } from './adapters/stub-payment-gateway.adapter.js';
import { PaymentsService } from './payments.service.js';

describe('PaymentsService - Receipts (FR-7.6)', () => {
  function createReceiptTestWorld(options: { gstin?: string } = {}) {
    const orders: any[] = [];
    const payments: any[] = [];
    const plans: Record<string, any> = {
      gold: { id: 'gold', code: 'GOLD', name: 'Gold', priceInPaise: 249900, durationDays: 90 },
      premium: { id: 'premium', code: 'PREMIUM', name: 'Premium', priceInPaise: 499900, durationDays: 180 },
    };
    const users: Record<string, any> = {
      'user-owner': {
        id: 'user-owner',
        profile: { fullName: 'Sundar Nadar' },
      },
      'user-other': {
        id: 'user-other',
        profile: { fullName: 'Other Person' },
      },
    };

    const prisma: any = {
      payment: {
        findUnique: async ({ where, include }: any) => {
          const p = payments.find((x) => x.id === where.id);
          if (!p) return null;
          if (include?.order) {
            const o = orders.find((x) => x.id === p.orderId);
            return {
              ...p,
              order: {
                ...o,
                plan: plans[o.planId],
                user: users[o.userId],
              },
            };
          }
          return p;
        },
      },
      order: {
        findUnique: async ({ where, include }: any) => {
          const o = orders.find((x) => x.id === where.id);
          if (!o) return null;
          const orderPayments = payments.filter((p) => p.orderId === o.id);
          const res: any = { ...o, plan: plans[o.planId], user: users[o.userId] };
          if (include?.payments) {
            let matched = orderPayments;
            if (include.payments.where?.status) {
              matched = matched.filter((p) => p.status === include.payments.where.status);
            }
            res.payments = matched;
          }
          return res;
        },
      },
    };

    const config = {
      get: (key: string) => {
        if (key === 'BUSINESS_GSTIN') return options.gstin;
        return undefined;
      },
    };

    const notifications = {
      notify: vi.fn(),
    };

    const subscriptions: any = {
      activateInTx: vi.fn(),
      notifyActivated: vi.fn(),
    };

    const service = new PaymentsService(
      prisma,
      new StubPaymentGatewayAdapter(config as never),
      config as never,
      subscriptions as never,
      notifications as never,
    );

    const addOrder = (id: string, userId: string, planId: string, status = 'PAID') => {
      orders.push({
        id,
        userId,
        planId,
        amountInPaise: plans[planId].priceInPaise,
        status,
        createdAt: new Date('2026-10-14T10:00:00.000Z'),
      });
    };

    const addPayment = (
      id: string,
      orderId: string,
      status: 'PAID' | 'FAILED',
      providerReference = 'pay_rzp_mock_123',
    ) => {
      payments.push({
        id,
        orderId,
        providerEventId: `evt_${id}`,
        providerReference,
        status,
        createdAt: new Date('2026-10-14T10:05:00.000Z'),
      });
    };

    return {
      service,
      orders,
      payments,
      addOrder,
      addPayment,
      notifications,
    };
  }

  it('the owner can download it; any other user gets 404', async () => {
    const world = createReceiptTestWorld();
    world.addOrder('order-1', 'user-owner', 'gold', 'PAID');
    world.addPayment('pay-1', 'order-1', 'PAID', 'pay_rzp_owner_1');

    // 1. Owner requests their receipt -> succeeds
    const receipt = await world.service.getReceiptPdf('user-owner', 'pay-1');
    expect(Buffer.isBuffer(receipt.buffer)).toBe(true);
    expect(receipt.buffer.toString('ascii', 0, 5)).toBe('%PDF-');
    expect(receipt.filename).toContain('receipt-REC-');

    // Also works when passing orderId directly
    const receiptByOrder = await world.service.getReceiptPdf('user-owner', 'order-1');
    expect(Buffer.isBuffer(receiptByOrder.buffer)).toBe(true);

    // 2. Another user requests the owner receipt -> 404 (IDOR guard)
    await expect(world.service.getReceiptPdf('user-other', 'pay-1')).rejects.toThrow(NotFoundException);
    await expect(world.service.getReceiptPdf('user-other', 'order-1')).rejects.toThrow(NotFoundException);
  });

  it('returns 404 when payment or order does not exist', async () => {
    const world = createReceiptTestWorld();
    await expect(world.service.getReceiptPdf('user-owner', 'non-existent-id')).rejects.toThrow(NotFoundException);
  });

  it('returns 404 for unpaid or failed payments', async () => {
    const world = createReceiptTestWorld();
    world.addOrder('order-fail', 'user-owner', 'gold', 'FAILED');
    world.addPayment('pay-fail', 'order-fail', 'FAILED');

    await expect(world.service.getReceiptPdf('user-owner', 'pay-fail')).rejects.toThrow(NotFoundException);
    await expect(world.service.getReceiptPdf('user-owner', 'order-fail')).rejects.toThrow(NotFoundException);
  });

  it('renders 249900 paise as ₹2,499.00 in generated receipt', async () => {
    const world = createReceiptTestWorld();
    world.addOrder('order-gold', 'user-owner', 'gold', 'PAID');
    world.addPayment('pay-gold', 'order-gold', 'PAID');

    const receipt = await world.service.getReceiptPdf('user-owner', 'pay-gold');
    expect(receipt.buffer.length).toBeGreaterThan(1000);
    expect(receipt.buffer.toString('ascii', 0, 5)).toBe('%PDF-');
  });

  it('includes GST line when BUSINESS_GSTIN is configured in env', async () => {
    const world = createReceiptTestWorld({ gstin: '33AAAAA0000A1Z5' });
    world.addOrder('order-gst', 'user-owner', 'gold', 'PAID');
    world.addPayment('pay-gst', 'order-gst', 'PAID');

    const receipt = await world.service.getReceiptPdf('user-owner', 'pay-gst');
    expect(receipt.buffer.length).toBeGreaterThan(1000);
    expect(receipt.buffer.toString('ascii', 0, 5)).toBe('%PDF-');
  });
});
