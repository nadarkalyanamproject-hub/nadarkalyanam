import { BadRequestException, ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import { Prisma } from '../../generated/prisma/client.js';
import { AdminUsersService } from './admin-users.service.js';
import type { AuthenticatedAdmin } from './guards/admin-auth.guard.js';

const MANAGE = 'admin_users.manage';

const superRole = {
  id: 'role-super',
  name: 'SUPER_ADMIN',
  permissions: [{ permission: { code: MANAGE } }, { permission: { code: 'members.view' } }],
};
const moderatorRole = { id: 'role-mod', name: 'MODERATOR', permissions: [{ permission: { code: 'members.view' } }] };

function adminRow(id: string, role: typeof superRole | typeof moderatorRole, isActive = true) {
  return {
    id,
    userId: `user-of-${id}`,
    email: `${id}@example.com`,
    roleId: role.id,
    role,
    isActive,
    createdAt: new Date('2026-09-01T00:00:00.000Z'),
    user: { phoneNumber: `+9100000${id.length}` },
  };
}

const actor = (adminId: string): AuthenticatedAdmin => ({
  adminId,
  userId: `user-${adminId}`,
  sessionId: 'session-test',
  roleId: 'role-super',
  roleName: 'SUPER_ADMIN',
  permissions: [MANAGE],
});

function buildService() {
  const prisma = {
    role: { findUnique: vi.fn(), findMany: vi.fn().mockResolvedValue([]) },
    user: { findUnique: vi.fn().mockResolvedValue(null), create: vi.fn() },
    adminUser: {
      findUnique: vi.fn(),
      findUniqueOrThrow: vi.fn(),
      findMany: vi.fn().mockResolvedValue([]),
      create: vi.fn(),
      update: vi.fn(),
      count: vi.fn().mockResolvedValue(0),
    },
    $transaction: vi.fn(),
  };
  // Interactive transactions just run against the same mock client.
  prisma.$transaction.mockImplementation((fn: (tx: typeof prisma) => unknown) => fn(prisma));
  prisma.adminUser.update.mockImplementation(({ where, data }: { where: { id: string }; data: { roleId: string; isActive: boolean } }) =>
    Promise.resolve({
      ...adminRow(where.id, data.roleId === superRole.id ? superRole : moderatorRole, data.isActive),
    }),
  );
  const auditLog = { record: vi.fn().mockResolvedValue({}) };
  return { service: new AdminUsersService(prisma as never, auditLog as never), prisma, auditLog };
}

describe('AdminUsersService.createAdmin', () => {
  const input = { phoneNumber: '+919800000001', email: 'new@example.com', roleId: moderatorRole.id };

  it('creates a bare User (never a Profile) plus the AdminUser when the phone is new, and audits it', async () => {
    const { service, prisma, auditLog } = buildService();
    prisma.role.findUnique.mockResolvedValueOnce(moderatorRole);
    prisma.user.create.mockResolvedValueOnce({ id: 'new-user' });
    prisma.adminUser.create.mockResolvedValueOnce(adminRow('new-admin', moderatorRole));

    const result = await service.createAdmin('admin-actor', input);

    expect(prisma.user.create).toHaveBeenCalledWith({ data: { phoneNumber: input.phoneNumber } });
    expect(JSON.stringify(prisma.user.create.mock.calls[0][0])).not.toContain('profile');
    expect(prisma.adminUser.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: { userId: 'new-user', email: input.email, roleId: moderatorRole.id } }),
    );
    expect(result).toMatchObject({ id: 'new-admin', roleName: 'MODERATOR', isActive: true });
    expect(auditLog.record).toHaveBeenCalledWith(
      'admin-actor',
      'admin.create',
      'AdminUser',
      'new-admin',
      expect.objectContaining({ roleName: 'MODERATOR', createdUserRow: true }),
    );
  });

  it('links an existing profile-less User instead of creating a second one', async () => {
    const { service, prisma } = buildService();
    prisma.role.findUnique.mockResolvedValueOnce(moderatorRole);
    prisma.user.findUnique.mockResolvedValueOnce({ id: 'existing', status: 'ACTIVE', profile: null, adminUser: null });
    prisma.adminUser.create.mockResolvedValueOnce(adminRow('new-admin', moderatorRole));

    await service.createAdmin('admin-actor', input);

    expect(prisma.user.create).not.toHaveBeenCalled();
    expect(prisma.adminUser.create.mock.calls[0][0].data.userId).toBe('existing');
  });

  it('refuses a phone that belongs to a member with a matrimonial profile', async () => {
    const { service, prisma, auditLog } = buildService();
    prisma.role.findUnique.mockResolvedValueOnce(moderatorRole);
    prisma.user.findUnique.mockResolvedValueOnce({ id: 'm', status: 'ACTIVE', profile: { id: 'p' }, adminUser: null });

    await expect(service.createAdmin('admin-actor', input)).rejects.toBeInstanceOf(ConflictException);
    expect(prisma.adminUser.create).not.toHaveBeenCalled();
    expect(auditLog.record).not.toHaveBeenCalled();
  });

  it('refuses a phone that is already an admin', async () => {
    const { service, prisma } = buildService();
    prisma.role.findUnique.mockResolvedValueOnce(moderatorRole);
    prisma.user.findUnique.mockResolvedValueOnce({ id: 'a', status: 'ACTIVE', profile: null, adminUser: { id: 'x' } });

    await expect(service.createAdmin('admin-actor', input)).rejects.toBeInstanceOf(ConflictException);
  });

  it('rejects an unknown role', async () => {
    const { service, prisma } = buildService();
    prisma.role.findUnique.mockResolvedValueOnce(null);

    await expect(service.createAdmin('admin-actor', input)).rejects.toBeInstanceOf(BadRequestException);
  });

  it('maps a duplicate-email unique violation to 409', async () => {
    const { service, prisma } = buildService();
    prisma.role.findUnique.mockResolvedValueOnce(moderatorRole);
    prisma.user.create.mockResolvedValueOnce({ id: 'new-user' });
    prisma.adminUser.create.mockRejectedValueOnce(
      new Prisma.PrismaClientKnownRequestError('dup', { code: 'P2002', clientVersion: 'test' }),
    );

    await expect(service.createAdmin('admin-actor', input)).rejects.toBeInstanceOf(ConflictException);
  });
});

describe('AdminUsersService.updateAdmin safety rules', () => {
  it('forbids an admin from deactivating themselves', async () => {
    const { service, prisma, auditLog } = buildService();
    prisma.adminUser.findUnique.mockResolvedValueOnce(adminRow('me', superRole));
    prisma.adminUser.count.mockResolvedValue(5);

    await expect(service.updateAdmin(actor('me'), 'me', { isActive: false })).rejects.toBeInstanceOf(ForbiddenException);
    expect(prisma.adminUser.update).not.toHaveBeenCalled();
    expect(auditLog.record).not.toHaveBeenCalled();
  });

  it('forbids an admin from changing (demoting) their own role', async () => {
    const { service, prisma } = buildService();
    prisma.adminUser.findUnique.mockResolvedValueOnce(adminRow('me', superRole));
    prisma.role.findUnique.mockResolvedValueOnce(moderatorRole);
    prisma.adminUser.count.mockResolvedValue(5);

    await expect(service.updateAdmin(actor('me'), 'me', { roleId: moderatorRole.id })).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    expect(prisma.adminUser.update).not.toHaveBeenCalled();
  });

  it('refuses to deactivate the last active admin who can manage admins', async () => {
    const { service, prisma } = buildService();
    prisma.adminUser.findUnique.mockResolvedValueOnce(adminRow('other-super', superRole));
    prisma.adminUser.count.mockResolvedValueOnce(0);

    await expect(service.updateAdmin(actor('me'), 'other-super', { isActive: false })).rejects.toBeInstanceOf(
      ConflictException,
    );
    expect(prisma.adminUser.count).toHaveBeenCalledWith({
      where: {
        id: { not: 'other-super' },
        isActive: true,
        role: { permissions: { some: { permission: { code: MANAGE } } } },
      },
    });
    expect(prisma.adminUser.update).not.toHaveBeenCalled();
  });

  it('refuses to demote the last active admin who can manage admins to a role without that permission', async () => {
    const { service, prisma } = buildService();
    prisma.adminUser.findUnique.mockResolvedValueOnce(adminRow('other-super', superRole));
    prisma.role.findUnique.mockResolvedValueOnce(moderatorRole);
    prisma.adminUser.count.mockResolvedValueOnce(0);

    await expect(
      service.updateAdmin(actor('me'), 'other-super', { roleId: moderatorRole.id }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('allows demoting a super admin when another active one remains, and audits the change', async () => {
    const { service, prisma, auditLog } = buildService();
    prisma.adminUser.findUnique.mockResolvedValueOnce(adminRow('other-super', superRole));
    prisma.role.findUnique.mockResolvedValueOnce(moderatorRole);
    prisma.adminUser.count.mockResolvedValueOnce(1);

    const result = await service.updateAdmin(actor('me'), 'other-super', { roleId: moderatorRole.id });

    expect(result.roleName).toBe('MODERATOR');
    expect(auditLog.record).toHaveBeenCalledWith('me', 'admin.update', 'AdminUser', 'other-super', {
      changes: { role: { from: 'SUPER_ADMIN', to: 'MODERATOR' } },
    });
  });

  it('deactivates a non-managing admin without any last-manager count', async () => {
    const { service, prisma, auditLog } = buildService();
    prisma.adminUser.findUnique.mockResolvedValueOnce(adminRow('mod', moderatorRole));

    const result = await service.updateAdmin(actor('me'), 'mod', { isActive: false });

    expect(result.isActive).toBe(false);
    expect(prisma.adminUser.count).not.toHaveBeenCalled();
    expect(auditLog.record).toHaveBeenCalledWith('me', 'admin.update', 'AdminUser', 'mod', {
      changes: { isActive: { from: true, to: false } },
    });
  });

  it('runs the check-then-write in a Serializable transaction and maps a serialization failure to 409', async () => {
    const { service, prisma } = buildService();
    prisma.$transaction.mockRejectedValueOnce(
      new Prisma.PrismaClientKnownRequestError('conflict', { code: 'P2034', clientVersion: 'test' }),
    );

    await expect(service.updateAdmin(actor('me'), 'x', { isActive: false })).rejects.toBeInstanceOf(ConflictException);
    expect(prisma.$transaction.mock.calls[0][1]).toEqual({ isolationLevel: 'Serializable' });
  });

  it('also maps the pg driver adapter\'s raw serialization error (SQLSTATE 40001) to 409, not 500', async () => {
    const { service, prisma } = buildService();
    const adapterError = Object.assign(new Error('TransactionWriteConflict'), {
      name: 'DriverAdapterError',
      cause: { originalCode: '40001', kind: 'TransactionWriteConflict' },
    });
    prisma.$transaction.mockRejectedValueOnce(adapterError);

    await expect(service.updateAdmin(actor('me'), 'x', { isActive: false })).rejects.toBeInstanceOf(ConflictException);
  });

  it('404s for an unknown admin id', async () => {
    const { service, prisma } = buildService();
    prisma.adminUser.findUnique.mockResolvedValueOnce(null);

    await expect(service.updateAdmin(actor('me'), 'nope', { isActive: true })).rejects.toBeInstanceOf(NotFoundException);
  });
});
