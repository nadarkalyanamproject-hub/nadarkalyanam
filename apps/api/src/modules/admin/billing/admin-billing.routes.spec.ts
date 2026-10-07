import 'reflect-metadata';
import { ForbiddenException, RequestMethod, UnauthorizedException, type ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { describe, expect, it, vi } from 'vitest';
import { PERMISSIONS, type PermissionCode } from '../../../common/permissions.js';
import { ROLE_PERMISSIONS } from '../../../common/role-permissions.js';
import { PERMISSION_METADATA_KEY } from '../decorators/require-permission.decorator.js';
import { AdminAuthGuard } from '../guards/admin-auth.guard.js';
import { PermissionsGuard } from '../guards/permissions.guard.js';
import { AdminBillingController } from './admin-billing.controller.js';

// Every Batch 3 admin route, checked against the real controller metadata,
// the real guards and the seeded role -> permission mapping.
type Handler = keyof AdminBillingController;

const ROUTES: { handler: Handler; method: RequestMethod; path: string; permission: PermissionCode }[] = [
  { handler: 'listPlans', method: RequestMethod.GET, path: 'plans', permission: PERMISSIONS.PLANS_MANAGE },
  { handler: 'updatePlan', method: RequestMethod.PATCH, path: 'plans/:id', permission: PERMISSIONS.PLANS_MANAGE },
  { handler: 'listSubscriptions', method: RequestMethod.GET, path: 'subscriptions', permission: PERMISSIONS.SUBSCRIPTIONS_MANAGE },
  { handler: 'grantSubscription', method: RequestMethod.POST, path: 'subscriptions/grant', permission: PERMISSIONS.SUBSCRIPTIONS_MANAGE },
  { handler: 'getSubscription', method: RequestMethod.GET, path: 'subscriptions/:id', permission: PERMISSIONS.SUBSCRIPTIONS_MANAGE },
  { handler: 'cancelSubscription', method: RequestMethod.POST, path: 'subscriptions/:id/cancel', permission: PERMISSIONS.SUBSCRIPTIONS_MANAGE },
  { handler: 'memberMembership', method: RequestMethod.GET, path: 'members/:userId/membership', permission: PERMISSIONS.MEMBERS_VIEW },
  { handler: 'listOrders', method: RequestMethod.GET, path: 'orders', permission: PERMISSIONS.FINANCE_DASHBOARD_VIEW },
  { handler: 'ordersNeedingAttention', method: RequestMethod.GET, path: 'orders/attention', permission: PERMISSIONS.FINANCE_DASHBOARD_VIEW },
  { handler: 'getOrder', method: RequestMethod.GET, path: 'orders/:id', permission: PERMISSIONS.FINANCE_DASHBOARD_VIEW },
  { handler: 'activateOrder', method: RequestMethod.POST, path: 'orders/:id/activate', permission: PERMISSIONS.SUBSCRIPTIONS_MANAGE },
  { handler: 'refundOrder', method: RequestMethod.POST, path: 'orders/:id/refund', permission: PERMISSIONS.PAYMENTS_REFUND },
  { handler: 'getFinanceDashboard', method: RequestMethod.GET, path: 'finance/dashboard', permission: PERMISSIONS.FINANCE_DASHBOARD_VIEW },
  { handler: 'listVipEnquiries', method: RequestMethod.GET, path: 'vip-enquiries', permission: PERMISSIONS.VIP_MANAGE },
  { handler: 'vipAssignees', method: RequestMethod.GET, path: 'vip-enquiries/assignees', permission: PERMISSIONS.VIP_MANAGE },
  { handler: 'getVipEnquiry', method: RequestMethod.GET, path: 'vip-enquiries/:id', permission: PERMISSIONS.VIP_MANAGE },
  { handler: 'addVipNote', method: RequestMethod.POST, path: 'vip-enquiries/:id/notes', permission: PERMISSIONS.VIP_MANAGE },
  { handler: 'memberPhoneUnlocks', method: RequestMethod.GET, path: 'members/:userId/phone-unlocks', permission: PERMISSIONS.MEMBERS_VIEW },
  { handler: 'updateVipEnquiry', method: RequestMethod.PATCH, path: 'vip-enquiries/:id', permission: PERMISSIONS.VIP_MANAGE },
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
          role: { name: role, permissions: ROLE_PERMISSIONS[role]!.map((code) => ({ permission: { code } })) },
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
    getHandler: () => AdminBillingController.prototype[handler],
    getClass: () => AdminBillingController,
    switchToHttp: () => ({ getRequest: () => request }),
  } as unknown as ExecutionContext;
  await new AdminAuthGuard(jwtService as never, prisma as never).canActivate(context);
  return new PermissionsGuard(new Reflector()).canActivate(context);
}

const rolesWith = (p: PermissionCode) => Object.entries(ROLE_PERMISSIONS).filter(([, c]) => c.includes(p)).map(([r]) => r);
const rolesWithout = (p: PermissionCode) => Object.entries(ROLE_PERMISSIONS).filter(([, c]) => !c.includes(p)).map(([r]) => r);

describe('AdminBillingController route authorization', () => {
  it('guards the whole controller with AdminAuthGuard then PermissionsGuard', () => {
    expect(Reflect.getMetadata('__guards__', AdminBillingController)).toEqual([AdminAuthGuard, PermissionsGuard]);
  });

  describe.each(ROUTES)('$handler', ({ handler, method, path, permission }) => {
    const fn = AdminBillingController.prototype[handler];
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

describe('seeded role scopes', () => {
  it('FINANCE_ADMIN: refunds, finance, plans, subscriptions and member view — not VIP or admin management', () => {
    expect([...ROLE_PERMISSIONS.FINANCE_ADMIN!].sort()).toEqual(
      ['finance.dashboard.view', 'members.view', 'payments.refund', 'plans.manage', 'subscriptions.manage'].sort(),
    );
  });

  it('OPERATIONS_ADMIN gains VIP enquiries only: no subscriptions, plans, refunds or finance', () => {
    const ops = ROLE_PERMISSIONS.OPERATIONS_ADMIN!;
    expect(ops).toContain(PERMISSIONS.VIP_MANAGE);
    expect(ops).toContain(PERMISSIONS.MEMBERS_VIEW);
    for (const p of [PERMISSIONS.SUBSCRIPTIONS_MANAGE, PERMISSIONS.PLANS_MANAGE, PERMISSIONS.PAYMENTS_REFUND, PERMISSIONS.FINANCE_DASHBOARD_VIEW]) {
      expect(ops).not.toContain(p);
    }
  });

  it('SUPER_ADMIN holds every permission, including the new ones', () => {
    for (const p of [PERMISSIONS.PLANS_MANAGE, PERMISSIONS.SUBSCRIPTIONS_MANAGE, PERMISSIONS.VIP_MANAGE]) {
      expect(ROLE_PERMISSIONS.SUPER_ADMIN).toContain(p);
    }
  });
});
