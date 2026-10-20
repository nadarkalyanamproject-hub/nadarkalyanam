import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { LaunchOffer } from '@nadar-kalyanam/schemas';
import { launchTrialWindow, type LaunchTrialWindow } from '../../common/launch.js';
import type { Env } from '../config/env.schema.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { SubscriptionService } from './subscription.service.js';

export interface TrialFacts {
  accountStatus: string;
  accountCreatedAt: Date;
  hasProfile: boolean;
  // Photos that aren't rejected (pending moderation counts: a slow
  // moderator never costs a member the offer).
  photoCount: number;
  // Any earlier TRIAL subscription, even a cancelled one: the offer is
  // given once, and a trial staff cancelled is never given back.
  hadTrial: boolean;
}

// Who the offer is for: an account created from signupFrom (so accounts
// made earlier, staff and test ones included, don't count) that has a
// profile and a photo before launch.
export function launchTrialNeeds(facts: TrialFacts): { profile: boolean; photo: boolean } {
  return { profile: !facts.hasProfile, photo: facts.photoCount === 0 };
}

export function qualifiesForLaunchTrial(window: LaunchTrialWindow, facts: TrialFacts, now: Date): boolean {
  if (now >= window.qualifyBy || facts.hadTrial) return false;
  if (facts.accountStatus !== 'ACTIVE' || facts.accountCreatedAt < window.signupFrom) return false;
  const needs = launchTrialNeeds(facts);
  return !needs.profile && !needs.photo;
}

// The launch offer (LAUNCH_DATE, LAUNCH_TRIAL_*): members who sign up during
// the pre-launch campaign and finish their profile with a photo before
// launch day get a free plan from launch day. The trial is an ordinary
// subscription (source TRIAL), queued to start at launch, so every plan
// check treats it like a paid plan and it simply runs out on its date.
@Injectable()
export class LaunchTrialService {
  private readonly logger = new Logger(LaunchTrialService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService<Env, true>,
    private readonly subscriptions: SubscriptionService,
  ) {}

  private async facts(userId: string): Promise<TrialFacts | null> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { status: true, createdAt: true, profile: { select: { id: true } } },
    });
    if (!user) return null;
    const [photoCount, trials] = await Promise.all([
      user.profile
        ? this.prisma.profilePhoto.count({ where: { profileId: user.profile.id, NOT: { isModerated: true, isApproved: false } } })
        : Promise.resolve(0),
      this.prisma.subscription.count({ where: { userId, source: 'TRIAL' } }),
    ]);
    return {
      accountStatus: user.status,
      accountCreatedAt: user.createdAt,
      hasProfile: user.profile !== null,
      photoCount,
      hadTrial: trials > 0,
    };
  }

  // Gives the trial if the member qualifies now. Safe to call any number of
  // times: the member's row lock plus the re-check inside the transaction
  // mean two calls at once still create one trial.
  async grantIfEligible(userId: string, now: Date = new Date()): Promise<boolean> {
    const window = launchTrialWindow(this.config);
    if (!window || now >= window.qualifyBy) return false;
    const facts = await this.facts(userId);
    if (!facts || !qualifiesForLaunchTrial(window, facts, now)) return false;

    const plan = await this.prisma.membershipPlan.findUnique({ where: { code: window.planCode } });
    if (!plan) {
      this.logger.error(`Launch offer: plan ${window.planCode} (LAUNCH_TRIAL_PLAN_CODE) does not exist; no trial given to ${userId}`);
      return false;
    }
    return this.prisma.$transaction(async (tx) => {
      await this.subscriptions.lockMember(tx, userId);
      if ((await tx.subscription.count({ where: { userId, source: 'TRIAL' } })) > 0) return false;
      await this.subscriptions.activateInTx(
        tx,
        { userId, planId: plan.id, source: 'TRIAL', reason: 'Launch offer', durationDays: window.durationDays },
        now,
      );
      return true;
    });
  }

  // For hooks after a profile or photo save: the save has already happened,
  // so a failure here is logged and never fails the member's request.
  async tryGrant(userId: string): Promise<void> {
    try {
      await this.grantIfEligible(userId);
    } catch (error) {
      this.logger.error(`Launch offer: could not check/give the trial for ${userId}`, error instanceof Error ? error.stack : error);
    }
  }

  // The offer as the member sees it (GET /me/membership), or null when it
  // doesn't apply to them: no offer configured, an account from before the
  // campaign, or the deadline passed without them qualifying.
  async offerFor(userId: string, now: Date = new Date()): Promise<LaunchOffer | null> {
    const window = launchTrialWindow(this.config);
    if (!window) return null;
    const [facts, trial] = await Promise.all([
      this.facts(userId),
      this.prisma.subscription.findFirst({
        where: { userId, source: 'TRIAL', cancelledAt: null },
        include: { plan: { select: { name: true } } },
        orderBy: { createdAt: 'asc' },
      }),
    ]);
    if (!facts || facts.accountCreatedAt < window.signupFrom) return null;
    if (!trial && (now >= window.qualifyBy || facts.hadTrial)) return null;
    const plan = trial ? trial.plan : await this.prisma.membershipPlan.findUnique({ where: { code: window.planCode }, select: { name: true } });
    if (!plan) return null;
    return {
      planName: plan.name,
      qualifyBy: window.qualifyBy.toISOString(),
      startsAt: (trial?.startedAt ?? window.startsAt).toISOString(),
      endsAt: (trial?.expiresAt ?? window.endsAt).toISOString(),
      earned: trial !== null,
      needs: launchTrialNeeds(facts),
    };
  }
}
