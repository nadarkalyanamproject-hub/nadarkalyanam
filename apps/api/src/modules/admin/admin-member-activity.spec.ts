import 'reflect-metadata';
import { ForbiddenException, NotFoundException, RequestMethod, UnauthorizedException, type ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { describe, expect, it, vi } from 'vitest';
import { PERMISSIONS, type PermissionCode } from '../../common/permissions.js';
import { ROLE_PERMISSIONS } from '../../common/role-permissions.js';
import { AdminMemberActivityController } from './admin-member-activity.controller.js';
import { PERMISSION_METADATA_KEY } from './decorators/require-permission.decorator.js';
import { AdminAuthGuard } from './guards/admin-auth.guard.js';
import { PermissionsGuard } from './guards/permissions.guard.js';

// The member activity page (members.view) and reading a chat (messages.view,
// Super Admin only by default), against the real guards and the seeded
// role -> permission mapping.
type Handler = keyof AdminMemberActivityController;

const ROUTES: {
  handler: Handler;
  method: RequestMethod;
  path: string;
  permission: PermissionCode;
}[] = [
  { handler: 'memberActivity', method: RequestMethod.GET, path: 'members/:userId/activity', permission: PERMISSIONS.MEMBERS_VIEW },
  {
    handler: 'conversationMessages',
    method: RequestMethod.GET,
    path: 'members/:userId/conversations/:conversationId/messages',
    permission: PERMISSIONS.MESSAGES_VIEW,
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
    getHandler: () => AdminMemberActivityController.prototype[handler],
    getClass: () => AdminMemberActivityController,
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

describe('AdminMemberActivityController route authorization', () => {
  it('guards the whole controller with AdminAuthGuard then PermissionsGuard', () => {
    expect(Reflect.getMetadata('__guards__', AdminMemberActivityController)).toEqual([AdminAuthGuard, PermissionsGuard]);
  });

  describe.each(ROUTES)('$handler', ({ handler, method, path, permission }) => {
    const fn = AdminMemberActivityController.prototype[handler];
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

describe('reading a chat', () => {
  function build(conversation: unknown) {
    const prisma = {
      conversation: { findFirst: vi.fn(async () => conversation) },
      message: {
        findMany: vi.fn(async () => [
          { id: 'm2', senderId: 'u2', body: 'Second', status: 'READ', createdAt: new Date('2026-10-09T10:01:00Z') },
          { id: 'm1', senderId: 'u1', body: 'First', status: 'READ', createdAt: new Date('2026-10-09T10:00:00Z') },
        ]),
        count: vi.fn(async () => 2),
      },
      user: {
        findMany: vi.fn(async () => [
          { id: 'u1', phoneNumber: '+911', profile: { fullName: 'Priya' } },
          { id: 'u2', phoneNumber: '+912', profile: { fullName: 'Karthik' } },
        ]),
      },
    };
    const auditLog = { record: vi.fn() };
    return { ctl: new AdminMemberActivityController(prisma as never, auditLog as never), prisma, auditLog };
  }
  const admin = { adminId: 'a1' } as never;

  it('returns messages oldest first and records who read the chat', async () => {
    const { ctl, auditLog } = build({ id: 'c1', createdAt: new Date('2026-10-09T09:00:00Z'), participants: [{ userId: 'u1' }, { userId: 'u2' }] });
    const chat = await ctl.conversationMessages(admin, 'u1', 'c1');
    expect(chat.messages.map((m) => m.body)).toEqual(['First', 'Second']);
    expect(chat.participants.map((p) => p.fullName)).toEqual(['Priya', 'Karthik']);
    expect(auditLog.record).toHaveBeenCalledWith('a1', 'member.conversation.view', 'Conversation', 'c1', {
      userId: 'u1',
      participants: ['u1', 'u2'],
      messagesShown: 2,
    });
  });

  it('refuses a chat the member is not in, and records nothing', async () => {
    const { ctl, prisma, auditLog } = build(null);
    await expect(ctl.conversationMessages(admin, 'u9', 'c1')).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.conversation.findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 'c1', participants: { some: { userId: 'u9' } } } }));
    expect(prisma.message.findMany).not.toHaveBeenCalled();
    expect(auditLog.record).not.toHaveBeenCalled();
  });
});
