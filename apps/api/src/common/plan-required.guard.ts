import { type CanActivate, type ExecutionContext, ForbiddenException, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { AuthenticatedRequest } from '../modules/auth/guards/jwt-auth.guard.js';
import type { Env } from '../modules/config/env.schema.js';
import { PrismaService } from '../modules/prisma/prisma.service.js';
import { findActiveSubscription } from './active-subscription.js';

export const PLAN_REQUIRED_MESSAGE =
  'A membership plan is required to view profiles, search and connect with members.';

export function planRequiredException(): ForbiddenException {
  return new ForbiddenException({ statusCode: 403, errorCode: 'PLAN_REQUIRED', message: PLAN_REQUIRED_MESSAGE });
}

// True when the member may use paid-only features: always while
// REQUIRE_PAID_PLAN is off, otherwise only with an active plan (same date
// rule as EntitlementsService). Shared by the guard and the chat socket.
export async function hasPlanAccess(
  prisma: PrismaService,
  config: ConfigService<Env, true>,
  userId: string,
  now: Date = new Date(),
): Promise<boolean> {
  if (!config.get('REQUIRE_PAID_PLAN', { infer: true })) return true;
  return Boolean(await findActiveSubscription(prisma, userId, now));
}

// Put AFTER JwtAuthGuard: browsing other members, search, matches,
// interests, chat, shortlists and phone unlocks need a plan when
// REQUIRE_PAID_PLAN is on. A member's own profile, photos, membership,
// notifications, blocks and reports never go through it.
@Injectable()
export class PlanRequiredGuard implements CanActivate {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService<Env, true>,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const userId = context.switchToHttp().getRequest<AuthenticatedRequest>().user?.userId;
    if (!userId) throw new UnauthorizedException('Missing bearer token');
    if (await hasPlanAccess(this.prisma, this.config, userId)) return true;
    throw planRequiredException();
  }
}
