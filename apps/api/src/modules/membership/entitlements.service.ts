import { Injectable } from '@nestjs/common';
import type { MyMembershipResponse } from '@nadar-kalyanam/schemas';
import { PrismaService } from '../prisma/prisma.service.js';

export interface ActivePlan {
  subscriptionId: string;
  plan: { code: string; name: string; isAssisted: boolean; phoneUnlockLimit: number | null };
  startedAt: Date;
  expiresAt: Date;
  // End of the last already-paid renewal queued after this one.
  paidThroughAt: Date;
}

// The one place that decides what plan a member has. Dates are the source
// of truth: a subscription counts while startedAt <= now < expiresAt and it
// hasn't been cancelled (refunded), whatever the status column says. The
// expiry job only tidies that column, so a late or skipped run never grants
// extra time, and a row marked EXPIRED too early never takes any away.
@Injectable()
export class EntitlementsService {
  constructor(private readonly prisma: PrismaService) {}

  async getActivePlan(userId: string, now: Date = new Date()): Promise<ActivePlan | null> {
    const live = await this.prisma.subscription.findMany({
      where: { userId, cancelledAt: null, expiresAt: { gt: now } },
      include: { plan: true },
      orderBy: { startedAt: 'asc' },
    });
    const current = live.find((subscription) => subscription.startedAt <= now);
    if (!current) return null;
    const paidThroughAt = live.reduce((latest, s) => (s.expiresAt > latest ? s.expiresAt : latest), current.expiresAt);
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
      paidThroughAt,
    };
  }

  async getMyMembership(userId: string): Promise<MyMembershipResponse> {
    const active = await this.getActivePlan(userId);
    if (!active) return { plan: null, status: 'FREE', expiresAt: null, paidThroughAt: null };
    return {
      plan: active.plan,
      status: 'ACTIVE',
      expiresAt: active.expiresAt.toISOString(),
      paidThroughAt: active.paidThroughAt.toISOString(),
    };
  }
}
