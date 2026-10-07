import 'reflect-metadata';
import { ForbiddenException, RequestMethod, UnauthorizedException, type ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { describe, expect, it, vi } from 'vitest';
import { PERMISSIONS, type PermissionCode } from '../../common/permissions.js';
import { ROLE_PERMISSIONS } from '../../common/role-permissions.js';
import { AdminMemberExtrasController } from './admin-member-extras.controller.js';
import { PERMISSION_METADATA_KEY } from './decorators/require-permission.decorator.js';
import { AdminAuthGuard } from './guards/admin-auth.guard.js';
import { PermissionsGuard } from './guards/permissions.guard.js';

// Member preferences/horoscope (read-only, members.view) and chart
// moderation (members.edit, like photos), against the real guards and the
// seeded role -> permission mapping.
type Handler = keyof AdminMemberExtrasController;

const ROUTES: {
  handler: Handler;
  method: RequestMethod;
  path: string;
  permission: PermissionCode;
}[] = [
  {
    handler: 'preferencesAndHoroscope',
    method: RequestMethod.GET,
    path: 'members/:userId/preferences-horoscope',
    permission: PERMISSIONS.MEMBERS_VIEW,
  },
  {
    handler: 'approveChart',
    method: RequestMethod.POST,
    path: 'members/:userId/horoscope-chart/approve',
    permission: PERMISSIONS.MEMBERS_EDIT,
  },
  {
    handler: 'rejectChart',
    method: RequestMethod.POST,
    path: 'members/:userId/horoscope-chart/reject',
    permission: PERMISSIONS.MEMBERS_EDIT,
  },
];

const TOKENS: Record<string, { sub: string; typ?: string; sid: string }> = {
  member: { sub: 'member-1', sid: 'session-member' },
  ...Object.fromEntries(Object.keys(ROLE_PERMISSIONS).map((role) => [role, { sub: `admin-${role}`, typ: 'admin', sid: `session-${role}` }])),
};

async function runGuards(handler: Handler, token: string) {
  const jwtService = {
    verifyAsync: vi.fn(async (t: string) => {
      if (!TOKENS[t]) throw new Error('bad token');
      return TOKENS[t];
    }),
  };
  const prisma = {
    adminUser: {
      findUnique: vi.fn(async ({ where }: { where: { id: string } }) => {
        const role = where.id.replace(/^admin-/, '');
        return {
          id: where.id,
          userId: `user-${role}`,
          roleId: `role-${role}`,
          isActive: true,
          role: {
            name: role,
            permissions: ROLE_PERMISSIONS[role]!.map((code) => ({
              permission: { code },
            })),
          },
        };
      }),
    },
    session: {
      findUnique: vi.fn(async ({ where }: { where: { id: string } }) => ({
        userId: `user-${where.id.replace(/^session-/, '')}`,
        revokedAt: null,
        expiresAt: new Date(Date.now() + 3600000),
      })),
    },
  };
  const request = { headers: { authorization: `Bearer ${token}` } };
  const context = {
    getHandler: () => AdminMemberExtrasController.prototype[handler],
    getClass: () => AdminMemberExtrasController,
    switchToHttp: () => ({ getRequest: () => request }),
  } as unknown as ExecutionContext;
  await new AdminAuthGuard(jwtService as never, prisma as never).canActivate(context);
  return new PermissionsGuard(new Reflector()).canActivate(context);
}

const rolesWith = (p: PermissionCode) =>
  Object.entries(ROLE_PERMISSIONS)
    .filter(([, c]) => c.includes(p))
    .map(([r]) => r);
const rolesWithout = (p: PermissionCode) =>
  Object.entries(ROLE_PERMISSIONS)
    .filter(([, c]) => !c.includes(p))
    .map(([r]) => r);

describe('AdminMemberExtrasController route authorization', () => {
  it('guards the whole controller with AdminAuthGuard then PermissionsGuard', () => {
    expect(Reflect.getMetadata('__guards__', AdminMemberExtrasController)).toEqual([AdminAuthGuard, PermissionsGuard]);
  });

  describe.each(ROUTES)('$handler', ({ handler, method, path, permission }) => {
    const fn = AdminMemberExtrasController.prototype[handler];
    it(`is ${RequestMethod[method]} /admin/${path} requiring ${permission}`, () => {
      expect(Reflect.getMetadata('path', fn)).toBe(path);
      expect(Reflect.getMetadata('method', fn)).toBe(method);
      expect(Reflect.getMetadata(PERMISSION_METADATA_KEY, fn)).toBe(permission);
    });
    it('rejects a member token with 401', async () => {
      await expect(runGuards(handler, 'member')).rejects.toBeInstanceOf(UnauthorizedException);
    });
    it.each(rolesWithout(permission))('rejects %s with 403', async (role) => {
      await expect(runGuards(handler, role)).rejects.toBeInstanceOf(ForbiddenException);
    });
    it.each(rolesWith(permission))('allows %s', async (role) => {
      await expect(runGuards(handler, role)).resolves.toBe(true);
    });
  });
});

describe('chart moderation is audited and refuses removed members', () => {
  function build(assert = vi.fn(async () => undefined)) {
    const horoscope = {
      moderateChart: vi.fn(async () => ({
        profileId: 'profile-1',
        chart: { url: 'u', status: 'APPROVED', rejectionReason: null },
      })),
    };
    const auditLog = { record: vi.fn() };
    const ctl = new AdminMemberExtrasController(
      {} as never,
      { assertMemberNotDeleted: assert } as never,
      {} as never,
      horoscope as never,
      auditLog as never,
    );
    return { ctl, horoscope, auditLog };
  }
  const admin = { adminId: 'a1' } as never;

  it('approve and reject write audit entries (reject with its reason)', async () => {
    const { ctl, horoscope, auditLog } = build();
    await ctl.approveChart(admin, 'u1');
    await ctl.rejectChart(admin, 'u1', { reason: 'Not a chart' });
    expect(horoscope.moderateChart).toHaveBeenCalledWith('u1', {
      approve: false,
      reason: 'Not a chart',
    });
    expect(auditLog.record.mock.calls).toEqual([
      ['a1', 'member.horoscope_chart.approve', 'Profile', 'profile-1', { userId: 'u1' }],
      ['a1', 'member.horoscope_chart.reject', 'Profile', 'profile-1', { userId: 'u1', reason: 'Not a chart' }],
    ]);
  });

  it('an anonymized member cannot be moderated and nothing is audited', async () => {
    const { ctl, horoscope, auditLog } = build(
      vi.fn(async () => {
        throw new Error('This account has been anonymized');
      }),
    );
    await expect(ctl.approveChart(admin, 'u1')).rejects.toThrow('anonymized');
    expect(horoscope.moderateChart).not.toHaveBeenCalled();
    expect(auditLog.record).not.toHaveBeenCalled();
  });
});
