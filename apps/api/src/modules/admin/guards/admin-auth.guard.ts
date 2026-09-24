import { type CanActivate, type ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../../prisma/prisma.service.js';

export interface AuthenticatedAdmin {
  adminId: string;
  roleId: string;
  roleName: string;
  permissions: string[];
}

interface AuthenticatedAdminRequest {
  headers: { authorization?: string };
  adminUser?: AuthenticatedAdmin;
}

// Structurally parallel to JwtAuthGuard, but for the separate admin identity
// (AdminUser, not User) — an admin token is distinguished by a `typ: 'admin'`
// claim so a member access token can never be replayed here. There is no
// admin login endpoint yet (FR-11.3's MFA mechanism is still an open product
// decision, and none of the SRS sequence diagrams cover admin login), so
// nothing issues this token today; the guard itself is real and ready for
// whatever issues it once that flow is built.
@Injectable()
export class AdminAuthGuard implements CanActivate {
  constructor(
    private readonly jwtService: JwtService,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedAdminRequest>();
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
    if (payload.typ !== 'admin') {
      throw new UnauthorizedException('Not an admin token');
    }

    const admin = await this.prisma.adminUser.findUnique({
      where: { id: payload.sub },
      include: { role: { include: { permissions: { include: { permission: true } } } } },
    });
    if (!admin || !admin.isActive) {
      throw new UnauthorizedException('Admin account is inactive');
    }

    request.adminUser = {
      adminId: admin.id,
      roleId: admin.roleId,
      roleName: admin.role.name,
      permissions: admin.role.permissions.map((rolePermission) => rolePermission.permission.code),
    };
    return true;
  }
}
