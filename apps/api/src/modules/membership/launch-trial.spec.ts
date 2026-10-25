import { ForbiddenException, type ExecutionContext } from '@nestjs/common';
import { describe, expect, it } from 'vitest';
import { istMidnight, isPreLaunch, launchTrialWindow } from '../../common/launch.js';
import { PlanRequiredGuard } from '../../common/plan-required.guard.js';
import { validateEnv } from '../config/env.schema.js';
import { LaunchTrialService, qualifiesForLaunchTrial, type TrialFacts } from './launch-trial.service.js';
import { SubscriptionService } from './subscription.service.js';
import { billingWorld } from '../../common/testing/billing-world.js';

/* eslint-disable @typescript-eslint/no-explicit-any */
const DAY = 86400000;
// The campaign: sign-ups from 20 Jan, matching opens 20 Feb (India time).
const LAUNCH = istMidnight('2027-02-20');
const SIGNUP_FROM = istMidnight('2027-01-20');
const PRE = new Date(LAUNCH.getTime() - 5 * DAY);

function config(values: Record<string, unknown> = {}) {
  const all: Record<string, unknown> = {
    LAUNCH_DATE: '2027-02-20',
    LAUNCH_TRIAL_SIGNUP_FROM: '2027-01-20',
    LAUNCH_TRIAL_DAYS: 31,
    LAUNCH_TRIAL_PLAN_CODE: 'GOLD',
    REQUIRE_PAID_PLAN: true,
    ...values,
  };
  return { get: (key: string) => all[key] } as any;
}

const facts = (over: Partial<TrialFacts> = {}): TrialFacts => ({
  accountStatus: 'ACTIVE',
  accountCreatedAt: new Date(SIGNUP_FROM.getTime() + DAY),
  hasProfile: true,
  photoCount: 1,
  hadTrial: false,
  ...over,
});

describe('launch dates', () => {
  it('reads each date as 00:00 India time; 31 days from 20 Feb runs through 22 Mar', () => {
    expect(LAUNCH.toISOString()).toBe('2027-02-19T18:30:00.000Z');
    const window = launchTrialWindow(config())!;
    expect(window.signupFrom.toISOString()).toBe('2027-01-19T18:30:00.000Z');
    expect(window.startsAt).toEqual(LAUNCH);
    // 23 Mar 00:00 IST: the trial's last day is 22 Mar.
    expect(window.endsAt.toISOString()).toBe('2027-03-22T18:30:00.000Z');
  });

  it('pre-launch until 00:00 IST on launch day; no offer or pre-launch when unset', () => {
    expect(isPreLaunch(config(), new Date(LAUNCH.getTime() - 1))).toBe(true);
    expect(isPreLaunch(config(), LAUNCH)).toBe(false);
    expect(isPreLaunch(config({ LAUNCH_DATE: undefined }), PRE)).toBe(false);
    expect(launchTrialWindow(config({ LAUNCH_TRIAL_SIGNUP_FROM: undefined }))).toBeNull();
  });

  it('env: the offer needs a launch date after its sign-up date', () => {
    const base = { DATABASE_URL: 'x', REDIS_URL: 'x', JWT_ACCESS_TOKEN_SECRET: 'x', MINIO_ENDPOINT: 'x', MINIO_ACCESS_KEY: 'x', MINIO_SECRET_KEY: 'x', MINIO_BUCKET_NAME: 'x', PAYMENT_WEBHOOK_SECRET: 'x' };
    expect(() => validateEnv({ ...base, LAUNCH_TRIAL_SIGNUP_FROM: '2027-01-20' })).toThrow(/LAUNCH_DATE is required/);
    expect(() => validateEnv({ ...base, LAUNCH_DATE: '2027-01-20', LAUNCH_TRIAL_SIGNUP_FROM: '2027-02-20' })).toThrow(/before LAUNCH_DATE/);
    expect(() => validateEnv({ ...base, LAUNCH_DATE: '2027-02-30' })).toThrow(/not a real date/);
    expect(validateEnv({ ...base, LAUNCH_DATE: '', LAUNCH_TRIAL_SIGNUP_FROM: '' }).LAUNCH_DATE).toBeUndefined();
  });
});

describe('qualifiesForLaunchTrial', () => {
  const window = launchTrialWindow(config())!;

  it('a campaign sign-up with a profile and a photo before launch qualifies', () => {
    expect(qualifiesForLaunchTrial(window, facts(), PRE)).toBe(true);
  });

  it.each([
    ['no profile yet', facts({ hasProfile: false, photoCount: 0 }), PRE],
    ['no photo (or only rejected ones)', facts({ photoCount: 0 }), PRE],
    ['account from before the campaign', facts({ accountCreatedAt: new Date(SIGNUP_FROM.getTime() - 1) }), PRE],
    ['already had a trial', facts({ hadTrial: true }), PRE],
    ['suspended', facts({ accountStatus: 'SUSPENDED' }), PRE],
    ['finished on launch day (too late)', facts(), LAUNCH],
  ])('%s: no trial', (_label, f, now) => {
    expect(qualifiesForLaunchTrial(window, f, now)).toBe(false);
  });
});

// billingWorld plus the user/photo rows LaunchTrialService reads.
function trialWorld(user: { createdAt: Date; status?: string; hasProfile?: boolean; photos?: number }) {
  const w = billingWorld();
  const service = new SubscriptionService(w.db, w.notifications as never, config());
  const byId = w.db.membershipPlan.findUnique;
  w.db.membershipPlan.findUnique = async (args: any) =>
    args.where.code ? (Object.values(w.plans).find((p: any) => p.code === args.where.code) ?? null) : byId(args);
  w.db.user = {
    findUnique: async () => ({ status: user.status ?? 'ACTIVE', createdAt: user.createdAt, profile: user.hasProfile === false ? null : { id: 'p1' } }),
  };
  w.db.profilePhoto = { count: async () => user.photos ?? 1 };
  w.db.subscription.count = async ({ where }: any) => w.subscriptions.filter((s) => s.userId === where.userId && s.source === where.source).length;
  const findFirst = w.db.subscription.findFirst;
  w.db.subscription.findFirst = async (args: any) =>
    args.where.source
      ? (w.subscriptions
          .filter((s) => s.userId === args.where.userId && s.source === args.where.source && s.cancelledAt === null)
          .map((s) => ({ ...s, plan: w.plans[s.planId] }))[0] ?? null)
      : findFirst(args);
  const trials = new LaunchTrialService(w.db, config(), service);
  return { ...w, service, trials };
}

describe('LaunchTrialService', () => {
  it('gives one Gold trial from launch day through 22 Mar, even when asked twice at once', async () => {
    const w = trialWorld({ createdAt: new Date(SIGNUP_FROM.getTime() + DAY) });
    const results = await Promise.all([w.trials.grantIfEligible('u1', PRE), w.trials.grantIfEligible('u1', PRE)]);
    expect(results.filter(Boolean)).toHaveLength(1);
    expect(w.subscriptions).toHaveLength(1);
    expect(w.subscriptions[0]).toMatchObject({ planId: 'gold', source: 'TRIAL', startedAt: LAUNCH });
    expect(w.subscriptions[0].expiresAt.toISOString()).toBe('2027-03-22T18:30:00.000Z');
  });

  it('gives nothing without a photo, or after the deadline', async () => {
    const noPhoto = trialWorld({ createdAt: new Date(SIGNUP_FROM.getTime() + DAY), photos: 0 });
    expect(await noPhoto.trials.grantIfEligible('u1', PRE)).toBe(false);
    const late = trialWorld({ createdAt: new Date(SIGNUP_FROM.getTime() + DAY) });
    expect(await late.trials.grantIfEligible('u1', LAUNCH)).toBe(false);
    expect([...noPhoto.subscriptions, ...late.subscriptions]).toHaveLength(0);
  });

  it('shows the member what is missing, then that they have it', async () => {
    const w = trialWorld({ createdAt: new Date(SIGNUP_FROM.getTime() + DAY), photos: 0 });
    expect(await w.trials.offerFor('u1', PRE)).toMatchObject({ planName: 'Gold', earned: false, needs: { profile: false, photo: true } });
    w.db.profilePhoto.count = async () => 1;
    await w.trials.grantIfEligible('u1', PRE);
    expect(await w.trials.offerFor('u1', PRE)).toMatchObject({ earned: true, startsAt: LAUNCH.toISOString() });
  });

  it('is not offered to accounts from before the campaign', async () => {
    const w = trialWorld({ createdAt: new Date(SIGNUP_FROM.getTime() - DAY) });
    expect(await w.trials.offerFor('u1', PRE)).toBeNull();
    expect(await w.trials.grantIfEligible('u1', PRE)).toBe(false);
  });
});

describe('plans before launch', () => {
  it('a plan bought before launch starts on launch day; after launch, at once', async () => {
    const w = trialWorld({ createdAt: PRE });
    const before = await w.service.activate({ userId: 'u1', planId: 'gold', source: 'PAYMENT', orderId: 'o1' }, PRE);
    expect(before.subscription.startedAt).toEqual(LAUNCH);
    const after = new Date(LAUNCH.getTime() + 100 * DAY);
    const later = await w.service.activate({ userId: 'u1', planId: 'plus', source: 'PAYMENT', orderId: 'o2' }, after);
    expect(later.subscription.startedAt).toEqual(after);
  });

  it('a plan bought after earning the trial runs after the trial', async () => {
    const w = trialWorld({ createdAt: new Date(SIGNUP_FROM.getTime() + DAY) });
    await w.trials.grantIfEligible('u1', PRE);
    const { subscription } = await w.service.activate({ userId: 'u1', planId: 'plus', source: 'PAYMENT', orderId: 'o1' }, PRE);
    expect(subscription.startedAt.toISOString()).toBe('2027-03-22T18:30:00.000Z');
  });

  it('cancelling the trial before launch moves a queued plan to launch day, not to now', async () => {
    const w = trialWorld({ createdAt: new Date(SIGNUP_FROM.getTime() + DAY) });
    await w.trials.grantIfEligible('u1', PRE);
    const { subscription } = await w.service.activate({ userId: 'u1', planId: 'plus', source: 'PAYMENT', orderId: 'o1' }, PRE);
    await w.service.cancel(w.subscriptions[0].id, { adminId: 'a1', reason: 'test' }, PRE);
    expect(w.subscriptions.find((s) => s.id === subscription.id).startedAt).toEqual(LAUNCH);
  });
});

describe('PlanRequiredGuard before launch', () => {
  const context = {
    switchToHttp: () => ({ getRequest: () => ({ headers: {}, user: { userId: 'u1' } }) }),
  } as unknown as ExecutionContext;

  it('refuses everyone with PRE_LAUNCH, plan or not, until launch day', async () => {
    const prisma = { subscription: { findMany: async () => [{ id: 's1', plan: {}, startedAt: new Date(0), expiresAt: new Date(8.64e15) }] } };
    const guard = new PlanRequiredGuard(prisma as never, config({ LAUNCH_DATE: '2999-01-01' }));
    const error = await guard.canActivate(context).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ForbiddenException);
    expect((error as ForbiddenException).getResponse()).toMatchObject({ errorCode: 'PRE_LAUNCH', message: expect.stringContaining('01-01-2999') });
    await expect(new PlanRequiredGuard(prisma as never, config({ LAUNCH_DATE: '2000-01-01' })).canActivate(context)).resolves.toBe(true);
  });
});
