import { type CanActivate, type ExecutionContext, Injectable, Optional, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import {
  ALLOW_UNVERIFIED_IDENTITY,
  identityRequiredException,
  identityRequiredFrom,
  needsIdentityVerification,
} from '../../../common/identity-gate.js';
import type { Env } from '../../config/env.schema.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { assertActiveSession } from '../session.util.js';

export interface AuthenticatedUser {
  userId: string;
  // The login session this request's token belongs to (what logout revokes).
  sessionId: string;
}

export interface AuthenticatedRequest {
  headers: { authorization?: string };
  user?: AuthenticatedUser;
}

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly jwtService: JwtService,
    private readonly prisma: PrismaService,
    @Optional() private readonly config?: ConfigService<Env, true>,
    @Optional() private readonly reflector?: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const authHeader = request.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      throw new UnauthorizedException('Missing bearer token');
    }

    const token = authHeader.slice('Bearer '.length);
    let payload: { sub: string; typ?: string; sid?: string };
    try {
      payload = await this.jwtService.verifyAsync<{ sub: string; typ?: string; sid?: string }>(token);
    } catch {
      throw new UnauthorizedException('Invalid or expired token');
    }
    // Mirror of AdminAuthGuard's typ check, in the other direction: an admin
    // token's `sub` is an AdminUser id, not a User id, so letting it through
    // here would act on whatever member happened to share that id. Rejected
    // explicitly so the member/admin boundary doesn't rest on that lookup
    // happening to miss.
    if (payload.typ === 'admin') {
      throw new UnauthorizedException('Admin tokens cannot be used on member routes');
    }
    // Signature and expiry alone don't make a token valid: its session must
    // still be live, so a logged-out token is refused straight away.
    await assertActiveSession(this.prisma, payload.sid, payload.sub);
    request.user = { userId: payload.sub, sessionId: payload.sid! };
    await this.assertIdentityVerified(context, payload.sub);
    return true;
  }

  // The DigiLocker gate (common/identity-gate.ts). Only looks the member up
  // when the gate is on and the route isn't one an unverified account needs.
  private async assertIdentityVerified(context: ExecutionContext, userId: string): Promise<void> {
    if (!this.config || !identityRequiredFrom(this.config)) return;
    const allowed = this.reflector?.getAllAndOverride<boolean>(ALLOW_UNVERIFIED_IDENTITY, [context.getHandler(), context.getClass()]);
    if (allowed) return;
    const user = await this.prisma.user.findUnique({ where: { id: userId }, select: { createdAt: true, identityVerifiedAt: true } });
    if (user && needsIdentityVerification(this.config, user)) throw identityRequiredException();
  }
}
