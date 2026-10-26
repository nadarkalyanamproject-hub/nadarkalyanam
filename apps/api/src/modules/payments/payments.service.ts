import { BadRequestException, Inject, Injectable, Logger, NotFoundException, Optional } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { MembershipPlanResponse, OrderResponse, OrderStatus } from '@nadar-kalyanam/schemas';
import { assertProviderConfigured } from '../../common/not-yet-available.exception.js';
import { planFeatures } from '../../common/plan-features.js';
import type { Env } from '../config/env.schema.js';
import { Prisma } from '../../generated/prisma/client.js';
import { SubscriptionService, type Activation } from '../membership/subscription.service.js';
import { NotificationsService } from '../notifications/notifications.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { PAYMENT_GATEWAY_ADAPTER, type PaymentGatewayAdapter, type PaymentWebhookEvent } from './adapters/payment-gateway.adapter.js';
import { generateReceiptPdf } from './receipt/receipt-generator.js';

function isUniqueConstraintViolation(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002';
}

// Every order is in Indian rupees (amounts are paise).
export const ORDER_CURRENCY = 'INR';

// The only order status changes a webhook may make. Anything else (a late
// FAILED after PAID, a second PAID, …) is recorded and ignored, so a paid
// order is never downgraded.
export const ALLOWED_ORDER_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  CREATED: ['PAID', 'FAILED', 'CANCELLED'],
  PAID: ['REFUNDED'],
  FAILED: [],
  CANCELLED: [],
  REFUNDED: [],
};

// Re-exported from adapter
export type { PaymentWebhookEvent } from './adapters/payment-gateway.adapter.js';

export type WebhookOutcome = 'processed' | 'duplicate' | 'ignored';

// Re-exported: existing imports of planFeatures keep working.
export { planFeatures } from '../../common/plan-features.js';

@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);

  constructor(
    private readonly prisma: PrismaService,
    @Inject(PAYMENT_GATEWAY_ADAPTER) private readonly gateway: PaymentGatewayAdapter,
    private readonly configService: ConfigService<Env, true>,
    private readonly subscriptions: SubscriptionService,
    @Optional() private readonly notifications?: NotificationsService,
  ) {}

  async listPlans(): Promise<{ items: MembershipPlanResponse[]; freeInterestsPerMonth: number }> {
    const plans = await this.prisma.membershipPlan.findMany({ where: { isActive: true }, orderBy: { sortOrder: 'asc' } });
    return {
      items: plans.map((plan) => ({
        id: plan.id,
        code: plan.code,
        name: plan.name,
        description: plan.description,
        priceInPaise: plan.priceInPaise,
        durationDays: plan.durationDays,
        sortOrder: plan.sortOrder,
        phoneUnlockLimit: plan.phoneUnlockLimit,
        isAssisted: plan.isAssisted,
        features: planFeatures(plan.entitlements),
      })),
      // So member-facing copy follows the setting instead of hardcoding it.
      freeInterestsPerMonth: this.configService.get('FREE_INTERESTS_PER_MONTH', { infer: true }),
    };
  }

  // FR-7.2: the client never supplies the amount — it is looked up
  // server-side from the plan row, by id.
  async createOrder(userId: string, planId: string): Promise<OrderResponse> {
    assertProviderConfigured(this.configService, this.gateway, 'Membership payments');

    const plan = await this.prisma.membershipPlan.findUnique({ where: { id: planId } });
    if (!plan || !plan.isActive) {
      throw new NotFoundException('Membership plan not found');
    }

    const order = await this.prisma.order.create({
      data: { userId, planId, amountInPaise: plan.priceInPaise, status: 'CREATED' },
    });

    let providerOrderId: string | null = null;
    let checkoutParams: Record<string, unknown> | null = null;

    if (!this.gateway.isStub) {
      const providerOrder = await this.gateway.createProviderOrder(order.id, order.amountInPaise);
      providerOrderId = providerOrder.providerOrderId;
      checkoutParams = providerOrder.checkoutParams;
      await this.prisma.order.update({
        where: { id: order.id },
        data: { providerOrderId },
      });
    }

    return {
      id: order.id,
      planId: order.planId,
      amountInPaise: order.amountInPaise,
      status: order.status,
      createdAt: order.createdAt.toISOString(),
      providerOrderId,
      checkoutParams,
    };
  }

  // FR-7.3/7.4/7.5. The signature is checked over the exact bytes the
  // provider sent. Then:
  //  - a providerEventId seen before is a no-op (duplicate);
  //  - the amount and currency must equal the order's, or it's rejected;
  //  - the order may only move along ALLOWED_ORDER_TRANSITIONS — any other
  //    event is recorded but changes nothing (ignored);
  //  - PAID creates the subscription in the same transaction, once per
  //    order. A member who already has a plan gets the new period appended
  //    after it (renewal extends; periods never overlap);
  //  - REFUNDED cancels that order's subscription.
  async handleWebhook(rawBody: Buffer, signature: string | undefined, payload?: unknown): Promise<{ outcome: WebhookOutcome }> {
    if (!this.gateway.verifyWebhookSignature(rawBody, signature)) {
      throw new BadRequestException('Invalid webhook signature');
    }

    let event: PaymentWebhookEvent | null = null;
    if (payload && typeof payload === 'object' && 'providerEventId' in payload && 'orderId' in payload && 'status' in payload) {
      event = payload as PaymentWebhookEvent;
    } else if (this.gateway.parseWebhookEvent) {
      event = this.gateway.parseWebhookEvent(rawBody);
    }

    if (!event) {
      return { outcome: 'ignored' };
    }

    const seen = await this.prisma.payment.findUnique({ where: { providerEventId: event.providerEventId } });
    if (seen) return { outcome: 'duplicate' };

    let order = await this.prisma.order.findUnique({ where: { id: event.orderId }, include: { plan: true } });
    if (!order && typeof this.prisma.order.findFirst === 'function') {
      order = await this.prisma.order.findFirst({
        where: {
          OR: [
            { id: event.orderId },
            { providerOrderId: event.orderId },
            { payments: { some: { providerReference: event.orderId } } },
          ],
        },
        include: { plan: true },
      });
    }
    if (!order && typeof this.prisma.payment?.findFirst === 'function') {
      const payment = await this.prisma.payment.findFirst({
        where: { providerReference: event.orderId },
      });
      if (payment) {
        order = await this.prisma.order.findUnique({ where: { id: payment.orderId }, include: { plan: true } });
      }
    }
    if (!order) {
      throw new BadRequestException('Unknown order');
    }
    if (event.amountInPaise !== order.amountInPaise || event.currency.toUpperCase() !== ORDER_CURRENCY) {
      throw new BadRequestException('Amount or currency does not match the order');
    }

    let activated: Activation | null = null;
    let outcome: WebhookOutcome;
    try {
      outcome = await this.prisma.$transaction(async (tx) => {
        await tx.payment.create({
          data: {
            orderId: order.id,
            providerEventId: event.providerEventId,
            providerReference: event.providerReference ?? null,
            status: event.status,
            rawPayload: JSON.parse(rawBody.toString('utf8')) as Prisma.InputJsonValue,
          },
        });

        if (!ALLOWED_ORDER_TRANSITIONS[order.status].includes(event.status)) return 'ignored';

        const now = new Date();
        // Conditional on the status read above, so two different events
        // racing on one order can't both apply.
        const { count } = await tx.order.updateMany({
          where: { id: order.id, status: order.status },
          data: { status: event.status, ...(event.status === 'PAID' ? { paidAt: now } : {}) },
        });
        if (count === 0) return 'ignored';

        // Activation and cancellation go through SubscriptionService (the one
        // place that holds the chaining rule), inside this transaction.
        if (event.status === 'PAID') {
          const result = await this.subscriptions.activateInTx(
            tx,
            { userId: order.userId, planId: order.planId, source: 'PAYMENT', orderId: order.id },
            now,
          );
          if (result.created) activated = result;
        }
        if (event.status === 'REFUNDED') {
          const subscription = await tx.subscription.findUnique({ where: { orderId: order.id } });
          if (subscription && !subscription.cancelledAt && subscription.expiresAt > now) {
            await this.subscriptions.cancelInTx(tx, subscription.id, { adminId: null, reason: 'Refunded by the payment provider' }, now);
          }
          await tx.order.update({ where: { id: order.id }, data: { refundedAt: now, refundReason: 'Refunded by the payment provider' } });
        }
        return 'processed';
      });
    } catch (error) {
      // Same event delivered twice at once: the second insert hits the
      // unique providerEventId (or orderId on subscriptions).
      if (isUniqueConstraintViolation(error)) return { outcome: 'duplicate' };
      throw error;
    }

    if (outcome === 'ignored') {
      this.logger.warn(`Ignored ${event.status} event ${event.providerEventId} for order ${order.id} in status ${order.status}`);
    }
    if (activated) {
      this.subscriptions.notifyActivated(activated);
      this.notifications?.notify({
        recipientUserId: order.userId,
        type: 'PAYMENT_SUCCEEDED',
        targetType: 'Payment',
        targetId: event.providerReference ?? event.providerEventId,
        data: {
          orderId: order.id,
          planName: order.plan.name,
          amountInPaise: order.amountInPaise,
        },
      });
    }
    return { outcome };
  }

  async listHistory(userId: string) {
    const orders = await this.prisma.order.findMany({
      where: { userId },
      include: { payments: true },
      orderBy: { createdAt: 'desc' },
    });
    return {
      items: orders.flatMap((order) =>
        order.payments.map((payment) => ({
          id: payment.id,
          orderId: order.id,
          status: payment.status,
          createdAt: payment.createdAt.toISOString(),
        })),
      ),
    };
  }

  // FR-7.6: Members can download a PDF receipt for each successful payment.
  // The owner can download it; any other user gets 404 (IDOR protection).
  async getReceiptPdf(currentUserId: string, paymentOrOrderId: string): Promise<{ buffer: Buffer; filename: string }> {
    // 1. Try to find Payment by id with order and user profile
    let payment = await this.prisma.payment.findUnique({
      where: { id: paymentOrOrderId },
      include: {
        order: {
          include: {
            plan: true,
            user: {
              include: {
                profile: true,
              },
            },
          },
        },
      },
    });

    // If not found, check if paymentOrOrderId is an order ID
    if (!payment) {
      const order = await this.prisma.order.findUnique({
        where: { id: paymentOrOrderId },
        include: {
          plan: true,
          user: {
            include: {
              profile: true,
            },
          },
          payments: {
            where: { status: 'PAID' },
            orderBy: { createdAt: 'desc' },
          },
        },
      });

      if (order && order.payments.length > 0) {
        payment = {
          ...order.payments[0],
          order,
        };
      }
    }

    // 2. Validate existence, status, and ownership
    // "The owner can download it; any other user gets 404."
    if (!payment || payment.status !== 'PAID' || payment.order.userId !== currentUserId) {
      throw new NotFoundException('Receipt not found');
    }

    const receiptNumber = `REC-${payment.id.replace(/-/g, '').slice(0, 8).toUpperCase()}`;
    const memberName = payment.order.user.profile?.fullName ?? 'Valued Member';
    const planName = payment.order.plan.name;
    const durationDays = payment.order.plan.durationDays;
    const amountInPaise = payment.order.amountInPaise;
    const paymentDate = payment.createdAt;
    const providerPaymentId = payment.providerReference ?? payment.providerEventId;
    const gstin = this.configService.get('BUSINESS_GSTIN', { infer: true }) ?? null;

    const buffer = await generateReceiptPdf({
      receiptNumber,
      memberName,
      planName,
      durationDays,
      amountInPaise,
      paymentDate,
      providerPaymentId,
      gstin,
    });

    const filename = `receipt-${receiptNumber}.pdf`;
    return { buffer, filename };
  }
}
