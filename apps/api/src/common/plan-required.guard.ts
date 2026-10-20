import { type CanActivate, type ExecutionContext, ForbiddenException, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { AuthenticatedRequest } from '../modules/auth/guards/jwt-auth.guard.js';
import type { Env } from '../modules/config/env.schema.js';
import { PrismaService } from '../modules/prisma/prisma.service.js';
import { findActiveSubscription } from './active-subscription.js';
import { isPreLaunch, launchAt } from './launch.js';

export const PLAN_REQUIRED_MESSAGE =
  'A membership plan is required to view profiles, search and connect with members.';

export function planRequiredException(): ForbiddenException {
  return new ForbiddenException({ statusCode: 403, errorCode: 'PLAN_REQUIRED', message: PLAN_REQUIRED_MESSAGE });
}

export function preLaunchMessage(opensAt: Date): string {
  const day = opensAt.toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Asia/Kolkata' });
  return `Matching opens on ${day}. Until then you can complete your profile and add photos.`;
}

export type PlanAccessDenial = 'PRE_LAUNCH' | 'PLAN_REQUIRED';

// Why the member may not use paid-only features right now, or null when
// they may. Before LAUNCH_DATE nobody may (pre-launch, plan or not). After
// that: always while REQUIRE_PAID_PLAN is off, otherwise only with an active
// plan (same date rule as EntitlementsService). Shared by the guard and the
// chat socket.
export async function planAccessDenial(
  prisma: PrismaService,
  config: ConfigService<Env, true>,
  userId: string,
  now: Date = new Date(),
): Promise<PlanAccessDenial | null> {
  if (isPreLaunch(config, now)) return 'PRE_LAUNCH';
  if (!config.get('REQUIRE_PAID_PLAN', { infer: true })) return null;
  return (await findActiveSubscription(prisma, userId, now)) ? null : 'PLAN_REQUIRED';
}

export async function hasPlanAccess(
  prisma: PrismaService,
  config: ConfigService<Env, true>,
  userId: string,
  now: Date = new Date(),
): Promise<boolean> {
  return (await planAccessDenial(prisma, config, userId, now)) === null;
}

// Put AFTER JwtAuthGuard: browsing other members, search, matches,
// interests, chat, shortlists and phone unlocks need a plan when
// REQUIRE_PAID_PLAN is on, and are closed to everyone before launch. A
// member's own profile, photos, membership, notifications, blocks and
// reports never go through it.
@Injectable()
export class PlanRequiredGuard implements CanActivate {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService<Env, true>,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const userId = context.switchToHttp().getRequest<AuthenticatedRequest>().user?.userId;
    if (!userId) throw new UnauthorizedException('Missing bearer token');
    const denial = await planAccessDenial(this.prisma, this.config, userId);
    if (denial === null) return true;
    if (denial === 'PRE_LAUNCH') {
      throw new ForbiddenException({ statusCode: 403, errorCode: 'PRE_LAUNCH', message: preLaunchMessage(launchAt(this.config)!) });
    }
    throw planRequiredException();
  }
}
