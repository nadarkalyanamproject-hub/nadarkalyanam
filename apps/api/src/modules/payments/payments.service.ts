import { BadRequestException, Inject, Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
import type { MembershipPlanResponse, OrderResponse } from '@nadar-kalyanam/schemas';
import { Prisma } from '../../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { PAYMENT_GATEWAY_ADAPTER, type PaymentGatewayAdapter } from './adapters/payment-gateway.adapter.js';

function isUniqueConstraintViolation(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002';
}

// The raw provider webhook payload shape is provider-specific and unknown
// until a gateway is contracted; this is the minimal envelope PaymentsService
// needs regardless of provider.
export interface PaymentWebhookEvent {
  providerEventId: string;
  orderId: string;
  status: 'PAID' | 'FAILED';
}

@Injectable()
export class PaymentsService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(PAYMENT_GATEWAY_ADAPTER) private readonly gateway: PaymentGatewayAdapter,
  ) {}

  async listPlans(): Promise<{ items: MembershipPlanResponse[] }> {
    const plans = await this.prisma.membershipPlan.findMany({ where: { isActive: true } });
    return {
      items: plans.map((plan) => ({
        id: plan.id,
        name: plan.name,
        priceInPaise: plan.priceInPaise,
        durationDays: plan.durationDays,
        entitlements: plan.entitlements as Record<string, unknown>,
      })),
    };
  }

  // FR-7.2: the client never supplies the amount — it is looked up
  // server-side from the plan row.
  async createOrder(userId: string, planId: string): Promise<OrderResponse> {
    const plan = await this.prisma.membershipPlan.findUnique({ where: { id: planId } });
    if (!plan || !plan.isActive) {
      throw new NotFoundException('Membership plan not found');
    }

    const order = await this.prisma.order.create({
      data: { userId, planId, amountInPaise: plan.priceInPaise, status: 'CREATED' },
    });
    return {
      id: order.id,
      planId: order.planId,
      amountInPaise: order.amountInPaise,
      status: order.status,
      createdAt: order.createdAt.toISOString(),
    };
  }

  // FR-7.3/7.4/7.5: verify signature, then process idempotently — a
  // duplicate providerEventId is a no-op, never a duplicate entitlement
  // activation. Mirrors Figure 6's alt block exactly.
  async handleWebhook(rawBody: string, signature: string | undefined, event: PaymentWebhookEvent): Promise<void> {
    if (!this.gateway.verifyWebhookSignature(rawBody, signature)) {
      throw new UnauthorizedException('Invalid webhook signature');
    }

    const order = await this.prisma.order.findUnique({ where: { id: event.orderId }, include: { plan: true } });
    if (!order) {
      throw new BadRequestException('Unknown order');
    }

    try {
      await this.prisma.$transaction(async (tx) => {
        await tx.payment.create({
          data: {
            orderId: order.id,
            providerEventId: event.providerEventId,
            status: event.status,
            rawPayload: JSON.parse(rawBody) as Prisma.InputJsonValue,
          },
        });

        await tx.order.update({ where: { id: order.id }, data: { status: event.status } });

        if (event.status === 'PAID') {
          const expiresAt = new Date(Date.now() + order.plan.durationDays * 24 * 60 * 60 * 1000);
          await tx.subscription.create({
            data: { userId: order.userId, planId: order.planId, status: 'ACTIVE', expiresAt },
          });
        }
      });
    } catch (error) {
      if (isUniqueConstraintViolation(error)) {
        // [duplicate event] branch — already processed, no-op.
        return;
      }
      throw error;
    }
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
}
