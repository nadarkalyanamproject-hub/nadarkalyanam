import { ForbiddenException, type ExecutionContext } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import { PermissionsGuard } from './permissions.guard.js';

function buildContext(requiredPermission: string | undefined, adminPermissions: string[]) {
  const reflector = { get: vi.fn().mockReturnValue(requiredPermission) };
  const request = { adminUser: { adminId: 'admin-1', roleId: 'role-1', roleName: 'MODERATOR', permissions: adminPermissions } };
  const context = {
    getHandler: () => ({}),
    switchToHttp: () => ({ getRequest: () => request }),
  } as unknown as ExecutionContext;
  return { guard: new PermissionsGuard(reflector as never), context };
}

describe('PermissionsGuard', () => {
  it('allows the request through when the route has no @RequirePermission decorator at all', () => {
    const { guard, context } = buildContext(undefined, []);

    expect(guard.canActivate(context)).toBe(true);
  });

  it('allows the request through when the admin has the required permission', () => {
    const { guard, context } = buildContext('members.view', ['members.view', 'reports.review']);

    expect(guard.canActivate(context)).toBe(true);
  });

  it('rejects with ForbiddenException when the admin lacks the required permission', () => {
    const { guard, context } = buildContext('members.remove', ['members.view', 'reports.review']);

    expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
  });

  it('rejects an admin with zero permissions on any permission-gated route', () => {
    const { guard, context } = buildContext('members.view', []);

    expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
  });
});
