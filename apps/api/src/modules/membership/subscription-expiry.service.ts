import { Injectable, Logger } from '@nestjs/common';
import { recomputeSearchBoost } from '../../common/search-boost.js';
import { NotificationsService } from '../notifications/notifications.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { EntitlementsService } from './entitlements.service.js';

// Marks subscriptions whose expiresAt has passed as EXPIRED and tells the
// member their plan ended, unless an already-paid renewal takes over (then
// nothing has ended from their point of view). Idempotent: a re-run finds
// nothing still ACTIVE and past due.
@Injectable()
export class SubscriptionExpiryService {
  private readonly logger = new Logger(SubscriptionExpiryService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly entitlements: EntitlementsService,
    private readonly notifications: NotificationsService,
  ) {}

  async run(now: Date = new Date()): Promise<{ expired: string[] }> {
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
    return { expired };
  }
}
