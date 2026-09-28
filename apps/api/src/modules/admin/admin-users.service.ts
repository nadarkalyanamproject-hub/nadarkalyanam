import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { CreateAdminRequest, UpdateAdminRequest } from '@nadar-kalyanam/schemas';
import { Prisma } from '../../generated/prisma/client.js';
import { PERMISSIONS } from '../../common/permissions.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { AuditLogService } from './audit-log.service.js';
import type { AuthenticatedAdmin } from './guards/admin-auth.guard.js';

const adminInclude = {
  user: { select: { phoneNumber: true } },
  role: { select: { id: true, name: true } },
} satisfies Prisma.AdminUserInclude;

type AdminWithRole = Prisma.AdminUserGetPayload<{ include: typeof adminInclude }>;

function toAdminSummary(admin: AdminWithRole) {
  return {
    id: admin.id,
    userId: admin.userId,
    email: admin.email,
    phoneNumber: admin.user.phoneNumber,
    roleId: admin.role.id,
    roleName: admin.role.name,
    isActive: admin.isActive,
    createdAt: admin.createdAt.toISOString(),
  };
}

// "Can manage admins" is defined by permission, not by the SUPER_ADMIN role
// name (RBAC authority note in schema.prisma). Today only SUPER_ADMIN holds
// it, so the lockout rule below is "the last active super admin" in
// practice — but it keeps holding if another role is ever granted it.
const MANAGE_PERMISSION = PERMISSIONS.ADMIN_USERS_MANAGE;

function isUniqueConstraintViolation(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002';
}

// A Serializable transaction lost to a concurrent one. Prisma reports this
// as P2034, but through the pg driver adapter (@prisma/adapter-pg) it can
// also escape as a raw DriverAdapterError carrying Postgres' SQLSTATE 40001
// — seen live when two admins demoted each other at the same instant.
function isSerializationFailure(error: unknown): boolean {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    return error.code === 'P2034';
  }
  const cause = (error as { cause?: { originalCode?: string; kind?: string } } | null)?.cause;
  return (
    error instanceof Error &&
    error.name === 'DriverAdapterError' &&
    (cause?.originalCode === '40001' || cause?.kind === 'TransactionWriteConflict')
  );
}

@Injectable()
export class AdminUsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLog: AuditLogService,
  ) {}

  async getCurrentAdmin(admin: AuthenticatedAdmin) {
    const row = await this.prisma.adminUser.findUniqueOrThrow({ where: { id: admin.adminId }, include: adminInclude });
    return { ...toAdminSummary(row), permissions: admin.permissions };
  }

  async listAdmins() {
    const admins = await this.prisma.adminUser.findMany({ include: adminInclude, orderBy: { createdAt: 'asc' } });
    return { items: admins.map(toAdminSummary) };
  }

  async listRoles() {
    const roles = await this.prisma.role.findMany({
      orderBy: { name: 'asc' },
      include: { permissions: { include: { permission: { select: { code: true } } } } },
    });
    return {
      items: roles.map((role) => ({
        id: role.id,
        name: role.name,
        permissions: role.permissions.map((rp) => rp.permission.code).sort(),
      })),
    };
  }

  // Admin accounts log in through the member phone/OTP flow (see
  // auth.service.ts), keyed on a User row — so an admin needs a User, but
  // never a matrimonial Profile. A number that already belongs to a member
  // with a Profile is refused: linking it would turn that member's login
  // into an admin-only login and cut them off from their own profile.
  async createAdmin(actorAdminId: string, input: CreateAdminRequest) {
    const role = await this.prisma.role.findUnique({ where: { id: input.roleId } });
    if (!role) {
      throw new BadRequestException('Unknown roleId');
    }

    const existingUser = await this.prisma.user.findUnique({
      where: { phoneNumber: input.phoneNumber },
      include: { profile: { select: { id: true } }, adminUser: { select: { id: true } } },
    });
    if (existingUser?.adminUser) {
      throw new ConflictException('This phone number already belongs to an admin');
    }
    if (existingUser?.profile) {
      throw new ConflictException(
        'This phone number belongs to a member with a matrimonial profile — use a separate number for admin access',
      );
    }
    if (existingUser && existingUser.status !== 'ACTIVE') {
      throw new ConflictException(`This phone number belongs to a ${existingUser.status} account`);
    }

    let created: AdminWithRole;
    try {
      created = await this.prisma.$transaction(async (tx) => {
        const user = existingUser ?? (await tx.user.create({ data: { phoneNumber: input.phoneNumber } }));
        return tx.adminUser.create({
          data: { userId: user.id, email: input.email, roleId: role.id },
          include: adminInclude,
        });
      });
    } catch (error) {
      if (isUniqueConstraintViolation(error)) {
        throw new ConflictException('An admin with this email or phone number already exists');
      }
      throw error;
    }

    await this.auditLog.record(actorAdminId, 'admin.create', 'AdminUser', created.id, {
      phoneNumber: input.phoneNumber,
      email: input.email,
      roleName: role.name,
      createdUserRow: !existingUser,
    });
    return toAdminSummary(created);
  }

  // Safety rules, enforced here (not just hidden in the UI):
  //  - an admin can't deactivate themselves or change their own role;
  //  - the last active admin holding admin_users.manage can't lose it (by
  //    deactivation or by a role change), or nobody could manage admins.
  // The check-then-write runs in a Serializable transaction so two
  // concurrent demotions of the last two managers can't both pass the count.
  async updateAdmin(actor: AuthenticatedAdmin, targetAdminId: string, input: UpdateAdminRequest) {
    let result: { before: AdminWithRole; after: AdminWithRole };
    try {
      result = await this.prisma.$transaction(
        async (tx) => {
          const target = await tx.adminUser.findUnique({
            where: { id: targetAdminId },
            include: { ...adminInclude, role: { include: { permissions: { include: { permission: true } } } } },
          });
          if (!target) {
            throw new NotFoundException('Admin not found');
          }

          const nextRole =
            input.roleId && input.roleId !== target.roleId
              ? await tx.role.findUnique({
                  where: { id: input.roleId },
                  include: { permissions: { include: { permission: true } } },
                })
              : target.role;
          if (!nextRole) {
            throw new BadRequestException('Unknown roleId');
          }
          const nextIsActive = input.isActive ?? target.isActive;

          if (target.id === actor.adminId) {
            if (!nextIsActive) {
              throw new ForbiddenException('You cannot deactivate your own admin account');
            }
            if (nextRole.id !== target.roleId) {
              throw new ForbiddenException('You cannot change your own role');
            }
          }

          const holdsManage = (role: typeof nextRole) =>
            role.permissions.some((rp) => rp.permission.code === MANAGE_PERMISSION);
          const losesManage = target.isActive && holdsManage(target.role) && !(nextIsActive && holdsManage(nextRole));
          if (losesManage) {
            const otherManagers = await tx.adminUser.count({
              where: {
                id: { not: target.id },
                isActive: true,
                role: { permissions: { some: { permission: { code: MANAGE_PERMISSION } } } },
              },
            });
            if (otherManagers === 0) {
              throw new ConflictException(
                'This is the last active admin who can manage admins — it cannot be deactivated or demoted',
              );
            }
          }

          const after = await tx.adminUser.update({
            where: { id: target.id },
            data: { roleId: nextRole.id, isActive: nextIsActive },
            include: adminInclude,
          });
          return { before: target, after };
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      );
    } catch (error) {
      if (isSerializationFailure(error)) {
        throw new ConflictException('Another admin change happened at the same time; reload and try again');
      }
      throw error;
    }

    const { before, after } = result;
    const changes: Record<string, { from: unknown; to: unknown }> = {};
    if (before.roleId !== after.roleId) {
      changes.role = { from: before.role.name, to: after.role.name };
    }
    if (before.isActive !== after.isActive) {
      changes.isActive = { from: before.isActive, to: after.isActive };
    }
    if (Object.keys(changes).length > 0) {
      await this.auditLog.record(actor.adminId, 'admin.update', 'AdminUser', after.id, { changes });
    }
    return toAdminSummary(after);
  }
}
