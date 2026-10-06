import { Injectable, Logger } from '@nestjs/common';
import { recomputeSearchBoost } from '../../common/search-boost.js';
import { NotificationsService } from '../notifications/notifications.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { EntitlementsService } from './entitlements.service.js';

// Marks subscriptions whose expiresAt has passed as EXPIRED and tells the
// member their plan ended, unless an already-paid renewal takes over (then
// nothing has ended from their point of view). Also sends one "expires in 7
// days" reminder per running subscription (none if a renewal is already
// queued). Idempotent: a re-run finds nothing still ACTIVE and past due, and
// each reminder is claimed by setting expiryReminderSentAt first.

const REMINDER_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;
@Injectable()
export class SubscriptionExpiryService {
  private readonly logger = new Logger(SubscriptionExpiryService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly entitlements: EntitlementsService,
    private readonly notifications: NotificationsService,
  ) {}

  async run(now: Date = new Date()): Promise<{ expired: string[]; reminded: string[] }> {
    const due = await this.prisma.subscription.findMany({
      where: { status: 'ACTIVE', expiresAt: { lte: now } },
      select: { id: true, userId: true, plan: { select: { name: true } } },
    });

    const expired: string[] = [];
    for (const subscription of due) {
      // Conditional, so a concurrent run (or a refund) can't double-apply.
      const { count } = await this.prisma.subscription.updateMany({
        where: { id: subscription.id, status: 'ACTIVE' },
        data: { status: 'EXPIRED' },
      });
      if (count === 0) continue;
      expired.push(subscription.id);
      // The plan that ended may have carried a search tier (or a queued
      // renewal with a different one takes over now).
      await recomputeSearchBoost(this.prisma, subscription.userId, now);
      if (!(await this.entitlements.getActivePlan(subscription.userId, now))) {
        this.notifications.notify({
          recipientUserId: subscription.userId,
          type: 'PLAN_EXPIRED',
          targetType: 'Account',
          data: { planName: subscription.plan.name },
        });
      }
    }
    if (expired.length > 0) this.logger.log(`Marked ${expired.length} subscription(s) EXPIRED`);
    const reminded = await this.remindExpiringSoon(now);
    return { expired, reminded };
  }

  private async remindExpiringSoon(now: Date): Promise<string[]> {
    const soon = await this.prisma.subscription.findMany({
      where: {
        cancelledAt: null,
        expiryReminderSentAt: null,
        startedAt: { lte: now },
        expiresAt: { gt: now, lte: new Date(now.getTime() + REMINDER_WINDOW_MS) },
      },
      select: { id: true, userId: true, expiresAt: true, plan: { select: { name: true } } },
    });
    const reminded: string[] = [];
    for (const subscription of soon) {
      // A renewal already paid for (or granted) takes over: nothing to renew.
      const renewal = await this.prisma.subscription.findFirst({
        where: { userId: subscription.userId, cancelledAt: null, id: { not: subscription.id }, startedAt: { gte: subscription.expiresAt } },
        select: { id: true },
      });
      if (renewal) continue;
      // Claim it first, so a concurrent or repeated run can't send it twice.
      const { count } = await this.prisma.subscription.updateMany({
        where: { id: subscription.id, expiryReminderSentAt: null },
        data: { expiryReminderSentAt: now },
      });
      if (count === 0) continue;
      reminded.push(subscription.id);
      this.notifications.notify({
        recipientUserId: subscription.userId,
        type: 'PLAN_EXPIRING_SOON',
        targetType: 'Account',
        data: { planName: subscription.plan.name, expiresAt: subscription.expiresAt.toISOString() },
      });
    }
    if (reminded.length > 0) this.logger.log(`Sent ${reminded.length} expiring-soon reminder(s)`);
    return reminded;
  }
}
