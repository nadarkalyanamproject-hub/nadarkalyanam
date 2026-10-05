import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { recomputeSearchBoost } from '../../common/search-boost.js';
import { Prisma, type MembershipPlan, type Subscription } from '../../generated/prisma/client.js';
import { NotificationsService } from '../notifications/notifications.service.js';
import { PrismaService } from '../prisma/prisma.service.js';

type Tx = Prisma.TransactionClient;

const DAY_MS = 24 * 60 * 60 * 1000;

export interface ActivateInput {
  userId: string;
  planId: string;
  source: 'PAYMENT' | 'ADMIN_GRANT';
  // A payment-backed activation: at most one subscription per order.
  orderId?: string;
  grantedByAdminId?: string;
  reason?: string;
  // Free text for an offline payment (admin grants); never summed as revenue.
  paymentReference?: string;
  // Defaults to the plan's own duration.
  durationDays?: number;
}

export interface Activation {
  subscription: Subscription;
  plan: MembershipPlan;
  // false when the order already had its subscription (idempotent no-op).
  created: boolean;
}

function isUniqueViolation(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002';
}

// The ONE place subscriptions are created, cancelled and re-sequenced.
//
// Chaining rule: a member's subscriptions never overlap. A new one starts
// when the member's latest live (not cancelled, not yet expired) one ends,
// or now if there is none.
//
// Every write takes a lock on the member's users row first, so a webhook
// activation, an admin grant and a cancel/refund for the same member run
// one after another and always see each other's result.
@Injectable()
export class SubscriptionService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
  ) {}

  // Serializes every subscription change for one member (see class note).
  async lockMember(tx: Tx, userId: string): Promise<void> {
    await tx.$queryRaw`SELECT "id" FROM "users" WHERE "id" = ${userId} FOR UPDATE`;
  }

  // For callers that already hold a transaction (the payment webhook, which
  // must record the payment and activate atomically). The caller sends
  // notifyActivated() after commit.
  async activateInTx(tx: Tx, input: ActivateInput, now: Date = new Date()): Promise<Activation> {
    await this.lockMember(tx, input.userId);
    if (input.orderId) {
      const existing = await tx.subscription.findUnique({ where: { orderId: input.orderId }, include: { plan: true } });
      if (existing) {
        const { plan, ...subscription } = existing;
        return { subscription, plan, created: false };
      }
    }
    const plan = await tx.membershipPlan.findUnique({ where: { id: input.planId } });
    if (!plan) throw new NotFoundException('Membership plan not found');
    const durationDays = input.durationDays ?? plan.durationDays;

    const latest = await tx.subscription.findFirst({
      where: { userId: input.userId, cancelledAt: null, expiresAt: { gt: now } },
      orderBy: { expiresAt: 'desc' },
    });
    const startedAt = latest ? latest.expiresAt : now;
    const subscription = await tx.subscription.create({
      data: {
        userId: input.userId,
        planId: plan.id,
        status: 'ACTIVE',
        source: input.source,
        orderId: input.orderId ?? null,
        grantedByAdminId: input.grantedByAdminId ?? null,
        grantReason: input.reason ?? null,
        paymentReference: input.paymentReference ?? null,
        startedAt,
        expiresAt: new Date(startedAt.getTime() + durationDays * DAY_MS),
      },
    });
    await recomputeSearchBoost(tx, input.userId, now);
    return { subscription, plan, created: true };
  }

  async activate(input: ActivateInput, now: Date = new Date()): Promise<Activation> {
    let result: Activation;
    try {
      result = await this.prisma.$transaction((tx) => this.activateInTx(tx, input, now));
    } catch (error) {
      // Two activations of one order at once: the unique orderId stops the
      // second; it's already done.
      if (input.orderId && isUniqueViolation(error)) {
        const existing = await this.prisma.subscription.findUnique({ where: { orderId: input.orderId }, include: { plan: true } });
        if (existing) {
          const { plan, ...subscription } = existing;
          return { subscription, plan, created: false };
        }
      }
      throw error;
    }
    if (result.created) this.notifyActivated(result);
    return result;
  }

  notifyActivated({ subscription, plan }: Pick<Activation, 'subscription' | 'plan'>): void {
    this.notifications.notify({
      recipientUserId: subscription.userId,
      type: 'PLAN_ACTIVATED',
      targetType: 'Account',
      data: { planName: plan.name, expiresAt: subscription.expiresAt.toISOString() },
    });
  }

  // Re-sequences the member's plans after a cancel or refund. Plans that have
  // already started are left exactly as they are; every queued (not yet
  // started, not cancelled) plan is placed back to back after them — or from
  // now if nothing is running — each keeping its own length. So cancelling
  // or refunding the running plan starts the next one immediately, with no
  // gap and no overlap.
  async rechainInTx(tx: Tx, userId: string, now: Date = new Date()): Promise<void> {
    const live = await tx.subscription.findMany({
      where: { userId, cancelledAt: null, expiresAt: { gt: now } },
      orderBy: [{ startedAt: 'asc' }, { createdAt: 'asc' }],
    });
    const running = live.filter((s) => s.startedAt <= now);
    const queued = live.filter((s) => s.startedAt > now);
    let cursor = running.reduce((latest, s) => (s.expiresAt > latest ? s.expiresAt : latest), now);
    for (const subscription of queued) {
      const length = subscription.expiresAt.getTime() - subscription.startedAt.getTime();
      const startedAt = cursor;
      const expiresAt = new Date(startedAt.getTime() + length);
      if (subscription.startedAt.getTime() !== startedAt.getTime()) {
        await tx.subscription.update({ where: { id: subscription.id }, data: { startedAt, expiresAt } });
      }
      cursor = expiresAt;
    }
    await recomputeSearchBoost(tx, userId, now);
  }

  // Cancels one subscription (admin cancel, refund, or a provider refund)
  // and re-sequences what's left. Phone unlocks already made stay.
  async cancelInTx(
    tx: Tx,
    subscriptionId: string,
    by: { adminId: string | null; reason: string },
    now: Date = new Date(),
  ): Promise<Subscription & { plan: MembershipPlan }> {
    const found = await tx.subscription.findUnique({ where: { id: subscriptionId } });
    if (!found) throw new NotFoundException('Subscription not found');
    await this.lockMember(tx, found.userId);
    const subscription = await tx.subscription.findUnique({ where: { id: subscriptionId }, include: { plan: true } });
    if (!subscription || subscription.cancelledAt) throw new ConflictException('This subscription is already cancelled');
    if (subscription.expiresAt <= now) throw new ConflictException('This subscription has already ended');

    const cancelled = await tx.subscription.update({
      where: { id: subscriptionId },
      data: { status: 'CANCELLED', cancelledAt: now, cancelledByAdminId: by.adminId, cancelReason: by.reason },
      include: { plan: true },
    });
    await this.rechainInTx(tx, subscription.userId, now);
    return cancelled;
  }

  async cancel(subscriptionId: string, by: { adminId: string; reason: string }, now: Date = new Date()) {
    const cancelled = await this.prisma.$transaction((tx) => this.cancelInTx(tx, subscriptionId, by, now));
    this.notifyCancelled(cancelled);
    return cancelled;
  }

  notifyCancelled(subscription: Subscription & { plan: MembershipPlan }): void {
    this.notifications.notify({
      recipientUserId: subscription.userId,
      type: 'PLAN_CANCELLED',
      targetType: 'Account',
      data: { planName: subscription.plan.name },
    });
  }
}
