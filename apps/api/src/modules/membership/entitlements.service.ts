import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { MembershipHistoryItem, MyMembershipResponse } from '@nadar-kalyanam/schemas';
import { findActiveSubscription } from '../../common/active-subscription.js';
import { istMonthWindow } from '../../common/ist-calendar.js';
import { planFeatures } from '../../common/plan-features.js';
import { searchBoostForPlanCode } from '../../common/search-boost.js';
import type { Env } from '../config/env.schema.js';
import { PrismaService } from '../prisma/prisma.service.js';

export interface ActivePlan {
  subscriptionId: string;
  plan: { code: string; name: string; isAssisted: boolean; phoneUnlockLimit: number | null };
  startedAt: Date;
  expiresAt: Date;
  // End of the last already-paid renewal queued after this one.
  paidThroughAt: Date;
}

// The one place that decides what plan a member has and what it allows.
// Dates are the source of truth: a subscription counts while startedAt <=
// now < expiresAt and it hasn't been cancelled (refunded), whatever the
// status column says. The expiry job only tidies that column, so a late or
// skipped run never grants extra time.
@Injectable()
export class EntitlementsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService<Env, true>,
  ) {}

  async getActivePlan(userId: string, now: Date = new Date()): Promise<ActivePlan | null> {
    const active = await findActiveSubscription(this.prisma, userId, now);
    if (!active) return null;
    const { current } = active;
    return {
      subscriptionId: current.id,
      plan: {
        code: current.plan.code,
        name: current.plan.name,
        isAssisted: current.plan.isAssisted,
        phoneUnlockLimit: current.plan.phoneUnlockLimit,
      },
      startedAt: current.startedAt,
      expiresAt: current.expiresAt,
      paidThroughAt: active.paidThroughAt,
    };
  }

  // Free members' monthly interest allowance (FREE_INTERESTS_PER_MONTH).
  freeInterestsPerMonth(): number {
    return this.configService.get('FREE_INTERESTS_PER_MONTH', { infer: true });
  }

  // Every interest the member SENT this IST calendar month counts, whatever
  // happened to it since (pending, accepted, declined or withdrawn).
  async interestUsage(userId: string, now: Date = new Date()): Promise<{ used: number; limit: number; resetsAt: Date }> {
    const { start, resetsAt } = istMonthWindow(now);
    const used = await this.prisma.interest.count({ where: { senderId: userId, createdAt: { gte: start, lt: resetsAt } } });
    return { used, limit: this.freeInterestsPerMonth(), resetsAt };
  }

  // Unlocks are counted per subscription (the plan period).
  async phoneUnlockUsage(subscriptionId: string, limit: number | null): Promise<{ used: number; remaining: number | null }> {
    const used = await this.prisma.phoneUnlock.count({ where: { subscriptionId } });
    return { used, remaining: limit === null ? null : Math.max(0, limit - used) };
  }

  // The member's own membership page: current plan (with its features and
  // search tier), queued renewals, history and usage. Only ever returned to
  // the member themselves. Admin identity, grant/cancel reasons and payment
  // references are never included.
  async getMyMembership(userId: string, now: Date = new Date()): Promise<MyMembershipResponse> {
    const [active, rows] = await Promise.all([
      findActiveSubscription(this.prisma, userId, now),
      this.prisma.subscription.findMany({
        where: { userId },
        include: { plan: true },
        orderBy: [{ startedAt: 'desc' }, { createdAt: 'desc' }],
        take: 50,
      }),
    ]);
    const statusOf = (s: (typeof rows)[number]) =>
      s.cancelledAt ? 'CANCELLED' : s.expiresAt <= now ? 'EXPIRED' : s.startedAt > now ? 'QUEUED' : 'ACTIVE';
    const toItem = (s: (typeof rows)[number]): MembershipHistoryItem => ({
      planCode: s.plan.code,
      planName: s.plan.name,
      startedAt: s.startedAt.toISOString(),
      endsAt: (s.cancelledAt ?? s.expiresAt).toISOString(),
      source: s.source === 'ADMIN_GRANT' ? 'GRANTED' : 'PURCHASED',
      status: statusOf(s),
    });
    const history = rows.slice(0, 20).map(toItem);
    const queued = rows
      .filter((s) => statusOf(s) === 'QUEUED')
      .sort((a, b) => a.startedAt.getTime() - b.startedAt.getTime())
      .map(toItem);

    if (!active) {
      const interests = await this.interestUsage(userId, now);
      const ended = rows
        .filter((s) => statusOf(s) === 'EXPIRED' || statusOf(s) === 'CANCELLED')
        .map((s) => ({ s, endedAt: s.cancelledAt ?? s.expiresAt }))
        .sort((a, b) => b.endedAt.getTime() - a.endedAt.getTime())[0];
      return {
        plan: null,
        status: 'FREE',
        startedAt: null,
        expiresAt: null,
        paidThroughAt: null,
        queued,
        history,
        lastEnded: ended
          ? { planName: ended.s.plan.name, endedAt: ended.endedAt.toISOString(), kind: ended.s.cancelledAt ? 'CANCELLED' : 'EXPIRED' }
          : null,
        phoneUnlocksUsed: null,
        phoneUnlocksRemaining: null,
        interestsUsedThisMonth: interests.used,
        interestsLimit: interests.limit,
        resetsAt: interests.resetsAt.toISOString(),
      };
    }
    const { current } = active;
    const unlocks = await this.phoneUnlockUsage(current.id, current.plan.phoneUnlockLimit);
    return {
      plan: {
        code: current.plan.code,
        name: current.plan.name,
        isAssisted: current.plan.isAssisted,
        phoneUnlockLimit: current.plan.phoneUnlockLimit,
        features: planFeatures(current.plan.entitlements),
        searchTier: searchBoostForPlanCode(current.plan.code),
      },
      status: 'ACTIVE',
      startedAt: current.startedAt.toISOString(),
      expiresAt: current.expiresAt.toISOString(),
      paidThroughAt: active.paidThroughAt.toISOString(),
      queued,
      history,
      lastEnded: null,
      phoneUnlocksUsed: unlocks.used,
      phoneUnlocksRemaining: unlocks.remaining,
      interestsUsedThisMonth: null,
      interestsLimit: null,
      resetsAt: null,
    };
  }
}
