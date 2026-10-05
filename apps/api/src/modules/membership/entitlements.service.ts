import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { MyMembershipResponse } from '@nadar-kalyanam/schemas';
import { findActiveSubscription } from '../../common/active-subscription.js';
import { istMonthWindow } from '../../common/ist-calendar.js';
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

  async getMyMembership(userId: string): Promise<MyMembershipResponse> {
    const active = await this.getActivePlan(userId);
    if (!active) {
      const interests = await this.interestUsage(userId);
      return {
        plan: null,
        status: 'FREE',
        expiresAt: null,
        paidThroughAt: null,
        phoneUnlocksUsed: null,
        phoneUnlocksRemaining: null,
        interestsUsedThisMonth: interests.used,
        interestsLimit: interests.limit,
        resetsAt: interests.resetsAt.toISOString(),
      };
    }
    const unlocks = await this.phoneUnlockUsage(active.subscriptionId, active.plan.phoneUnlockLimit);
    return {
      plan: active.plan,
      status: 'ACTIVE',
      expiresAt: active.expiresAt.toISOString(),
      paidThroughAt: active.paidThroughAt.toISOString(),
      phoneUnlocksUsed: unlocks.used,
      phoneUnlocksRemaining: unlocks.remaining,
      interestsUsedThisMonth: null,
      interestsLimit: null,
      resetsAt: null,
    };
  }
}
