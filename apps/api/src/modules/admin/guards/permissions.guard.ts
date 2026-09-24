import { type CanActivate, type ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { PermissionCode } from '../../../common/permissions.js';
import type { AuthenticatedAdmin } from './admin-auth.guard.js';
import { PERMISSION_METADATA_KEY } from '../decorators/require-permission.decorator.js';

// Runs after AdminAuthGuard has populated request.adminUser. Checks the
// permission set resolved from the admin's Role, never the role name itself
// — see the RBAC authority note in schema.prisma.
@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.get<PermissionCode | undefined>(
      PERMISSION_METADATA_KEY,
      context.getHandler(),
    );
    if (!required) {
      return true;
    }

    const request = context.switchToHttp().getRequest<{ adminUser: AuthenticatedAdmin }>();
    if (!request.adminUser.permissions.includes(required)) {
      throw new ForbiddenException(`Missing required permission: ${required}`);
    }
    return true;
  }
}
