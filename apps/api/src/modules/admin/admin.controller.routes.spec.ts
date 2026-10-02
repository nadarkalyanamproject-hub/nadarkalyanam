import 'reflect-metadata';
import { ForbiddenException, RequestMethod, UnauthorizedException, type ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { describe, expect, it, vi } from 'vitest';
import { PERMISSIONS, type PermissionCode } from '../../common/permissions.js';
import { ROLE_PERMISSIONS } from '../../common/role-permissions.js';
import { AdminController } from './admin.controller.js';
import { PERMISSION_METADATA_KEY } from './decorators/require-permission.decorator.js';
import { AdminAuthGuard } from './guards/admin-auth.guard.js';
import { PermissionsGuard } from './guards/permissions.guard.js';

// Route-level authorization for every route added in this phase, checked
// against the real controller metadata, the real guards, and the exact
// role -> permission mapping prisma/seed.ts writes (ROLE_PERMISSIONS).

type Handler = keyof AdminController;

const NEW_ROUTES: { handler: Handler; method: RequestMethod; path: string; permission: PermissionCode | null }[] = [
  { handler: 'getMe', method: RequestMethod.GET, path: 'me', permission: null },
  { handler: 'listMembers', method: RequestMethod.GET, path: 'members', permission: PERMISSIONS.MEMBERS_VIEW },
  { handler: 'restoreMember', method: RequestMethod.POST, path: 'members/:userId/restore', permission: PERMISSIONS.MEMBERS_REMOVE },
  {
    handler: 'removeMemberPhoto',
    method: RequestMethod.DELETE,
    path: 'members/:userId/photos/:photoId',
    permission: PERMISSIONS.MEMBERS_EDIT,
  },
  { handler: 'listReportQueue', method: RequestMethod.GET, path: 'reports', permission: PERMISSIONS.REPORTS_REVIEW },
  { handler: 'updateReport', method: RequestMethod.PATCH, path: 'reports/:id', permission: PERMISSIONS.REPORTS_REVIEW },
  { handler: 'listAuditLogs', method: RequestMethod.GET, path: 'audit-logs', permission: PERMISSIONS.ADMIN_USERS_MANAGE },
  { handler: 'listAdmins', method: RequestMethod.GET, path: 'admins', permission: PERMISSIONS.ADMIN_USERS_MANAGE },
  { handler: 'listRoles', method: RequestMethod.GET, path: 'roles', permission: PERMISSIONS.ADMIN_USERS_MANAGE },
  { handler: 'createAdmin', method: RequestMethod.POST, path: 'admins', permission: PERMISSIONS.ADMIN_USERS_MANAGE },
  { handler: 'updateAdmin', method: RequestMethod.PATCH, path: 'admins/:id', permission: PERMISSIONS.ADMIN_USERS_MANAGE },
];

// Tokens are just labels here: the mocked JwtService maps each to the
// payload a real token of that kind carries.
const TOKEN_PAYLOADS: Record<string, { sub: string; typ?: string; sid?: string }> = {
  member: { sub: 'member-user-1', sid: 'session-member' },
  ...Object.fromEntries(
    Object.keys(ROLE_PERMISSIONS).map((role) => [role, { sub: `admin-${role}`, typ: 'admin', sid: `session-${role}` }]),
  ),
};

async function runGuards(handler: Handler, token: string) {
  const jwtService = {
    verifyAsync: vi.fn(async (t: string) => {
      const payload = TOKEN_PAYLOADS[t];
      if (!payload) throw new Error('bad token');
      return payload;
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
          role: { name: role, permissions: ROLE_PERMISSIONS[role].map((code) => ({ permission: { code } })) },
        };
      }),
    },
    // Every admin's login session is live in these route tests.
    session: {
      findUnique: vi.fn(async ({ where }: { where: { id: string } }) => ({
        userId: `user-${where.id.replace(/^session-/, '')}`,
        revokedAt: null,
        expiresAt: new Date(Date.now() + 60 * 60 * 1000),
      })),
    },
  };
  const request = { headers: { authorization: `Bearer ${token}` } };
  const context = {
    getHandler: () => AdminController.prototype[handler],
    getClass: () => AdminController,
    switchToHttp: () => ({ getRequest: () => request }),
  } as unknown as ExecutionContext;

  const authGuard = new AdminAuthGuard(jwtService as never, prisma as never);
  const permissionsGuard = new PermissionsGuard(new Reflector());
  await authGuard.canActivate(context);
  return permissionsGuard.canActivate(context);
}

const rolesWith = (permission: PermissionCode) =>
  Object.entries(ROLE_PERMISSIONS)
    .filter(([, codes]) => codes.includes(permission))
    .map(([role]) => role);
const rolesWithout = (permission: PermissionCode) =>
  Object.entries(ROLE_PERMISSIONS)
    .filter(([, codes]) => !codes.includes(permission))
    .map(([role]) => role);

describe('AdminController route authorization', () => {
  it('applies AdminAuthGuard then PermissionsGuard to the whole controller', () => {
    expect(Reflect.getMetadata('__guards__', AdminController)).toEqual([AdminAuthGuard, PermissionsGuard]);
  });

  describe.each(NEW_ROUTES)('$handler', ({ handler, method, path, permission }) => {
    const fn = AdminController.prototype[handler];

    it(`is mounted at ${RequestMethod[method]} /admin/${path} with the expected permission`, () => {
      expect(Reflect.getMetadata('path', fn)).toBe(path);
      expect(Reflect.getMetadata('method', fn)).toBe(method);
      expect(Reflect.getMetadata(PERMISSION_METADATA_KEY, fn)).toBe(permission ?? undefined);
    });

    it('rejects a valid MEMBER access token with 401', async () => {
      await expect(runGuards(handler, 'member')).rejects.toBeInstanceOf(UnauthorizedException);
    });

    it('rejects a missing/invalid token with 401', async () => {
      await expect(runGuards(handler, 'garbage')).rejects.toBeInstanceOf(UnauthorizedException);
    });

    if (permission) {
      it.each(rolesWithout(permission))('rejects an admin whose role (%s) lacks the permission with 403', async (role) => {
        await expect(runGuards(handler, role)).rejects.toBeInstanceOf(ForbiddenException);
      });
      it.each(rolesWith(permission))('allows an admin whose role (%s) holds the permission', async (role) => {
        await expect(runGuards(handler, role)).resolves.toBe(true);
      });
    } else {
      it.each(Object.keys(ROLE_PERMISSIONS))('allows any active admin (%s)', async (role) => {
        await expect(runGuards(handler, role)).resolves.toBe(true);
      });
    }
  });

  it('keeps admin management SUPER_ADMIN-only in the seeded mapping', () => {
    expect(rolesWith(PERMISSIONS.ADMIN_USERS_MANAGE)).toEqual(['SUPER_ADMIN']);
  });
});

describe('AdminController report + profile handlers', () => {
  function buildController() {
    const moderationService = {
      listForAdmin: vi.fn().mockResolvedValue({ items: [{ id: 'r1' }, { id: 'r2' }], total: 2 }),
      updateStatus: vi.fn().mockImplementation((id: string, status: string) => Promise.resolve({ id, status })),
    };
    const auditLogService = {
      record: vi.fn().mockResolvedValue({}),
      latestReportNotes: vi.fn().mockResolvedValue(new Map([['r1', 'warned']])),
      list: vi.fn(),
    };
    const adminService = { assertMemberNotDeleted: vi.fn().mockResolvedValue(undefined), listMembers: vi.fn() };
    const profilesService = { updateProfile: vi.fn().mockResolvedValue({ id: 'profile-1' }) };
    const controller = new AdminController(
      adminService as never,
      {} as never,
      moderationService as never,
      profilesService as never,
      auditLogService as never,
      {} as never,
    );
    return { controller, moderationService, auditLogService, adminService, profilesService };
  }
  const admin = { adminId: 'admin-1', userId: 'user-1', sessionId: 'session-test', roleId: 'r', roleName: 'MODERATOR', permissions: [] };

  it('moving a report to IN_REVIEW is audited as report.review, with the note', async () => {
    const { controller, auditLogService } = buildController();

    await controller.updateReport(admin, 'r1', { status: 'IN_REVIEW', note: 'looking' });

    expect(auditLogService.record).toHaveBeenCalledWith('admin-1', 'report.review', 'Report', 'r1', {
      status: 'IN_REVIEW',
      note: 'looking',
    });
  });

  it('resolving/dismissing is audited as report.resolve', async () => {
    const { controller, auditLogService } = buildController();

    await controller.updateReport(admin, 'r1', { status: 'DISMISSED' });

    expect(auditLogService.record).toHaveBeenCalledWith('admin-1', 'report.resolve', 'Report', 'r1', {
      status: 'DISMISSED',
    });
  });

  it('attaches each report its latest moderator note', async () => {
    const { controller } = buildController();

    const result = await controller.listReportQueue({});

    expect(result.items).toEqual([
      { id: 'r1', note: 'warned' },
      { id: 'r2', note: null },
    ]);
  });

  it('maps members query strings to typed filters', async () => {
    const { controller, adminService } = buildController();

    await controller.listMembers({ status: 'PENDING_DELETION', verified: 'false', sort: 'oldest', search: '' });

    expect(adminService.listMembers).toHaveBeenCalledWith(0, 100, undefined, {
      status: 'PENDING_DELETION',
      verified: false,
      sort: 'oldest',
    });
  });

  it('refuses to edit an anonymized profile before touching ProfilesService', async () => {
    const { controller, adminService, profilesService } = buildController();
    adminService.assertMemberNotDeleted.mockRejectedValueOnce(new Error('deleted'));

    await expect(controller.updateMemberProfile(admin, 'user-1', {} as never)).rejects.toThrow('deleted');
    expect(profilesService.updateProfile).not.toHaveBeenCalled();
  });
});
