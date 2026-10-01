import { type CanActivate, type ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
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
    return true;
  }
}
