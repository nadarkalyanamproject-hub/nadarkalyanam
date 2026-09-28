import { type CanActivate, type ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';

export interface AuthenticatedUser {
  userId: string;
}

export interface AuthenticatedRequest {
  headers: { authorization?: string };
  user?: AuthenticatedUser;
}

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(private readonly jwtService: JwtService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const authHeader = request.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      throw new UnauthorizedException('Missing bearer token');
    }

    const token = authHeader.slice('Bearer '.length);
    let payload: { sub: string; typ?: string };
    try {
      payload = await this.jwtService.verifyAsync<{ sub: string; typ?: string }>(token);
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
    request.user = { userId: payload.sub };
    return true;
  }
}
