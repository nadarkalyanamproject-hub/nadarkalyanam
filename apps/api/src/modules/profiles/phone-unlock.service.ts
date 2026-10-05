import { ForbiddenException, HttpException, HttpStatus, Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { PhoneStatusResponse, PhoneUnlockResponse, PhoneUnlockState } from '@nadar-kalyanam/schemas';
import { findActiveSubscription, type SubscriptionWithPlan } from '../../common/active-subscription.js';
import { istDayStart } from '../../common/ist-calendar.js';
import { visibleProfilesWhere } from '../../common/profile-cards.js';
import { getRelationshipStates } from '../../common/relationship.js';
import { Prisma } from '../../generated/prisma/client.js';
import type { Env } from '../config/env.schema.js';
import { PrismaService } from '../prisma/prisma.service.js';

type Db = PrismaService | Prisma.TransactionClient;

const REFUSALS: Record<Exclude<PhoneUnlockState, 'AVAILABLE' | 'UNLOCKED'>, (limit: number | null) => string> = {
  NOT_CONNECTED: () => "You can only unlock the phone number of a member you're connected with.",
  HIDDEN_BY_MEMBER: () => "This member hasn't chosen to share their phone number.",
  NO_PLAN: () => 'Unlocking phone numbers needs an active paid plan.',
  QUOTA_EXHAUSTED: (limit) => `You've used all ${limit} phone number unlocks in your current plan.`,
};

interface Evaluation {
  state: PhoneUnlockState;
  targetUserId: string;
  active: SubscriptionWithPlan | null;
  limit: number | null;
  remaining: number | null;
}

function isUniqueViolation(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002';
}

// Phone number unlocks. A viewer may see another member's number only while
// ALL of these hold: the target is visible to them and ACTIVE, neither has
// blocked the other (both via visibleProfilesWhere), they're CONNECTED, and
// the target allows it (phoneVisibility CONNECTED — the owner's setting
// always wins, even over an earlier unlock). A NEW unlock also needs an
// active paid plan with quota left (counted per subscription; null limit =
// unlimited) and stays under the daily cap. An earlier unlock keeps working
// after the plan ends, and showing it again never uses quota.
//
// The phone number leaves the API only in unlock()'s response.
@Injectable()
export class PhoneUnlockService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService<Env, true>,
  ) {}

  async status(viewerId: string, profileId: string, now: Date = new Date()): Promise<PhoneStatusResponse> {
    const { state, limit, remaining } = await this.evaluate(this.prisma, viewerId, profileId, now);
    return { state, limit, remaining };
  }

  async unlock(viewerId: string, profileId: string, now: Date = new Date()): Promise<PhoneUnlockResponse> {
    try {
      return await this.prisma.$transaction(async (tx) => {
        // Lock the viewer's current subscription row first: concurrent
        // unlocks against the same plan period queue up here, and each
        // re-checks every rule (and the quota) only once it holds the lock.
        const pre = await findActiveSubscription(tx, viewerId, now);
        if (pre) await tx.$queryRaw`SELECT "id" FROM "subscriptions" WHERE "id" = ${pre.current.id} FOR UPDATE`;

        const evaluation = await this.evaluate(tx, viewerId, profileId, now);
        if (evaluation.state === 'UNLOCKED') return this.reveal(tx, evaluation);
        if (evaluation.state !== 'AVAILABLE') throw this.refusal(evaluation);

        const cap = this.configService.get('UNLOCK_DAILY_CAP', { infer: true });
        const today = await tx.phoneUnlock.count({ where: { viewerId, createdAt: { gte: istDayStart(now) } } });
        if (today >= cap) {
          throw new HttpException(
            { statusCode: 429, message: `You can unlock at most ${cap} phone numbers a day. Please try again tomorrow.`, errorCode: 'UNLOCK_DAILY_CAP' },
            HttpStatus.TOO_MANY_REQUESTS,
          );
        }

        await tx.phoneUnlock.create({
          data: { viewerId, targetUserId: evaluation.targetUserId, subscriptionId: evaluation.active!.id },
        });
        return this.reveal(tx, {
          ...evaluation,
          state: 'UNLOCKED',
          remaining: evaluation.remaining === null ? null : evaluation.remaining - 1,
        });
      });
    } catch (error) {
      // The same pair unlocked twice at once: the second insert hits the
      // unique (viewerId, targetUserId). It's unlocked either way — show it
      // without using quota.
      if (isUniqueViolation(error)) {
        const evaluation = await this.evaluate(this.prisma, viewerId, profileId, now);
        if (evaluation.state === 'UNLOCKED') return this.reveal(this.prisma, evaluation);
        throw this.refusal(evaluation);
      }
      throw error;
    }
  }

  private async evaluate(db: Db, viewerId: string, profileId: string, now: Date): Promise<Evaluation> {
    // Same rule as the profile page: hidden, blocked (either way), inactive
    // or unknown all 404 alike.
    const target = await db.profile.findFirst({
      where: { AND: [await visibleProfilesWhere(db as PrismaService, viewerId), { id: profileId }] },
      select: { userId: true, phoneVisibility: true },
    });
    if (!target) throw new NotFoundException('Profile not found');

    const active = await findActiveSubscription(db, viewerId, now);
    const limit = active ? active.current.plan.phoneUnlockLimit : null;
    const used = active ? await db.phoneUnlock.count({ where: { subscriptionId: active.current.id } }) : 0;
    const remaining = active && limit !== null ? Math.max(0, limit - used) : null;
    const base = { targetUserId: target.userId, active: active?.current ?? null, limit, remaining };

    const relationship = (await getRelationshipStates(db as PrismaService, viewerId, [target.userId])).get(target.userId);
    if (relationship?.status !== 'CONNECTED') return { ...base, state: 'NOT_CONNECTED' };
    if (target.phoneVisibility !== 'CONNECTED') return { ...base, state: 'HIDDEN_BY_MEMBER' };

    const existing = await db.phoneUnlock.findUnique({
      where: { viewerId_targetUserId: { viewerId, targetUserId: target.userId } },
      select: { id: true },
    });
    if (existing) return { ...base, state: 'UNLOCKED' };
    if (!active) return { ...base, state: 'NO_PLAN' };
    if (remaining !== null && remaining <= 0) return { ...base, state: 'QUOTA_EXHAUSTED' };
    return { ...base, state: 'AVAILABLE' };
  }

  private async reveal(db: Db, evaluation: Evaluation): Promise<PhoneUnlockResponse> {
    const user = await db.user.findUnique({ where: { id: evaluation.targetUserId }, select: { phoneNumber: true } });
    return { state: 'UNLOCKED', phoneNumber: user!.phoneNumber, limit: evaluation.limit, remaining: evaluation.remaining };
  }

  private refusal(evaluation: Evaluation): ForbiddenException {
    const state = evaluation.state as keyof typeof REFUSALS;
    return new ForbiddenException({
      statusCode: 403,
      message: REFUSALS[state](evaluation.limit),
      errorCode: state,
      limit: evaluation.limit,
      remaining: evaluation.remaining,
    });
  }
}
