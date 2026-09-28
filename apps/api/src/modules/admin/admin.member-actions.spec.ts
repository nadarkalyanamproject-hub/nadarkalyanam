import { ConflictException, NotFoundException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import { AdminService } from './admin.service.js';

const ADMIN_ID = 'admin-1';
const USER_ID = 'user-1';
const DAY_MS = 24 * 60 * 60 * 1000;

function buildService(user: Record<string, unknown> | null = { id: USER_ID, status: 'ACTIVE', adminUser: null }) {
  const prisma = {
    user: {
      findUnique: vi.fn().mockResolvedValue(user),
      findMany: vi.fn().mockResolvedValue([]),
      count: vi.fn().mockResolvedValue(0),
      update: vi.fn().mockImplementation(({ where, data }: { where: { id: string }; data: Record<string, unknown> }) =>
        Promise.resolve({ id: where.id, ...data }),
      ),
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
    },
  };
  const photosService = {
    getPhotosForProfile: vi.fn().mockResolvedValue([]),
    deletePhoto: vi.fn().mockResolvedValue({ id: 'photo-1', objectKey: 'profiles/p1/photo-1.jpg' }),
  };
  const auditLog = { record: vi.fn().mockResolvedValue({ id: 'audit-1' }) };
  const service = new AdminService(prisma as never, photosService as never, auditLog as never);
  return { service, prisma, photosService, auditLog };
}

describe('AdminService.listMembers filters', () => {
  it('filters by status alone without wrapping it in AND', async () => {
    const { service, prisma } = buildService();

    await service.listMembers(0, 20, undefined, { status: 'SUSPENDED' });

    expect(prisma.user.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { status: 'SUSPENDED' } }));
  });

  it('verified=true requires a verified profile; verified=false also matches members with no profile', async () => {
    const { service, prisma } = buildService();

    await service.listMembers(0, 20, undefined, { verified: true });
    await service.listMembers(0, 20, undefined, { verified: false });

    expect(prisma.user.findMany.mock.calls[0][0].where).toEqual({ profile: { isVerified: true } });
    expect(prisma.user.findMany.mock.calls[1][0].where).toEqual({
      OR: [{ profile: null }, { profile: { isVerified: false } }],
    });
  });

  it('ANDs search with filters, and uses the same where for the total count', async () => {
    const { service, prisma } = buildService();

    await service.listMembers(0, 20, 'priya', { status: 'ACTIVE', verified: true });

    const where = prisma.user.findMany.mock.calls[0][0].where;
    expect(where.AND).toHaveLength(3);
    expect(where.AND[1]).toEqual({ status: 'ACTIVE' });
    expect(prisma.user.count).toHaveBeenCalledWith({ where });
  });

  it('sorts newest-first by default and oldest-first on request', async () => {
    const { service, prisma } = buildService();

    await service.listMembers(0, 20);
    await service.listMembers(0, 20, undefined, { sort: 'oldest' });

    expect(prisma.user.findMany.mock.calls[0][0].orderBy).toEqual({ createdAt: 'desc' });
    expect(prisma.user.findMany.mock.calls[1][0].orderBy).toEqual({ createdAt: 'asc' });
  });
});

describe('AdminService.restoreMember', () => {
  it('sets a PENDING_DELETION member inside the grace period back to ACTIVE, clears the removal, and audits it', async () => {
    const deletionRequestedAt = new Date(Date.now() - 3 * DAY_MS);
    const { service, prisma, auditLog } = buildService({
      id: USER_ID,
      status: 'PENDING_DELETION',
      deletionRequestedAt,
      adminUser: null,
    });

    const result = await service.restoreMember(ADMIN_ID, USER_ID);

    expect(result).toEqual({ id: USER_ID, status: 'ACTIVE' });
    expect(prisma.user.updateMany).toHaveBeenCalledWith({
      where: { id: USER_ID, status: 'PENDING_DELETION', deletionRequestedAt },
      data: { status: 'ACTIVE', deletionRequestedAt: null },
    });
    expect(auditLog.record).toHaveBeenCalledWith(
      ADMIN_ID,
      'member.restore',
      'User',
      USER_ID,
      expect.objectContaining({ deletionRequestedAt: deletionRequestedAt.toISOString() }),
    );
  });

  it('refuses once the grace period has elapsed, without writing anything', async () => {
    const { service, prisma, auditLog } = buildService({
      id: USER_ID,
      status: 'PENDING_DELETION',
      deletionRequestedAt: new Date(Date.now() - 15 * DAY_MS),
      adminUser: null,
    });

    await expect(service.restoreMember(ADMIN_ID, USER_ID)).rejects.toBeInstanceOf(ConflictException);
    expect(prisma.user.updateMany).not.toHaveBeenCalled();
    expect(auditLog.record).not.toHaveBeenCalled();
  });

  it('refuses for a member who is not pending removal', async () => {
    const { service, auditLog } = buildService({ id: USER_ID, status: 'SUSPENDED', deletionRequestedAt: null, adminUser: null });

    await expect(service.restoreMember(ADMIN_ID, USER_ID)).rejects.toBeInstanceOf(ConflictException);
    expect(auditLog.record).not.toHaveBeenCalled();
  });

  it('refuses (and does not audit) if the state changed between read and write', async () => {
    const { service, prisma, auditLog } = buildService({
      id: USER_ID,
      status: 'PENDING_DELETION',
      deletionRequestedAt: new Date(Date.now() - DAY_MS),
      adminUser: null,
    });
    prisma.user.updateMany.mockResolvedValueOnce({ count: 0 });

    await expect(service.restoreMember(ADMIN_ID, USER_ID)).rejects.toBeInstanceOf(ConflictException);
    expect(auditLog.record).not.toHaveBeenCalled();
  });

  it('404s for a nonexistent member', async () => {
    const { service } = buildService(null);

    await expect(service.restoreMember(ADMIN_ID, 'missing')).rejects.toBeInstanceOf(NotFoundException);
  });
});

describe('AdminService member-state guards', () => {
  it('will not suspend or reinstate a PENDING_DELETION member (that would silently cancel the removal)', async () => {
    const pending = { id: USER_ID, status: 'PENDING_DELETION', deletionRequestedAt: new Date(), adminUser: null };
    const { service, prisma, auditLog } = buildService(pending);

    await expect(service.suspendMember(ADMIN_ID, USER_ID, 'x')).rejects.toBeInstanceOf(ConflictException);
    await expect(service.reinstateMember(ADMIN_ID, USER_ID)).rejects.toBeInstanceOf(ConflictException);
    expect(prisma.user.update).not.toHaveBeenCalled();
    expect(auditLog.record).not.toHaveBeenCalled();
  });

  it('refuses every action on a DELETED (anonymized) member', async () => {
    const { service, photosService } = buildService({ id: USER_ID, status: 'DELETED', adminUser: null });

    await expect(service.suspendMember(ADMIN_ID, USER_ID, 'x')).rejects.toBeInstanceOf(ConflictException);
    await expect(service.reinstateMember(ADMIN_ID, USER_ID)).rejects.toBeInstanceOf(ConflictException);
    await expect(service.removeMember(ADMIN_ID, USER_ID, 'x')).rejects.toBeInstanceOf(ConflictException);
    await expect(service.restoreMember(ADMIN_ID, USER_ID)).rejects.toBeInstanceOf(ConflictException);
    await expect(service.removeMemberPhoto(ADMIN_ID, USER_ID, 'photo-1', 'x')).rejects.toBeInstanceOf(
      ConflictException,
    );
    await expect(service.assertMemberNotDeleted(USER_ID, 'edit')).rejects.toBeInstanceOf(ConflictException);
    expect(photosService.deletePhoto).not.toHaveBeenCalled();
  });

  it('will not re-remove a member already pending removal (which would reset the grace clock)', async () => {
    const { service, prisma } = buildService({
      id: USER_ID,
      status: 'PENDING_DELETION',
      deletionRequestedAt: new Date(),
      adminUser: null,
    });

    await expect(service.removeMember(ADMIN_ID, USER_ID, 'again')).rejects.toBeInstanceOf(ConflictException);
    expect(prisma.user.update).not.toHaveBeenCalled();
  });

  it('will not remove a User linked to an admin account', async () => {
    const { service, prisma } = buildService({ id: USER_ID, status: 'ACTIVE', adminUser: { id: 'admin-2' } });

    await expect(service.removeMember(ADMIN_ID, USER_ID, 'x')).rejects.toBeInstanceOf(ConflictException);
    expect(prisma.user.update).not.toHaveBeenCalled();
  });
});

describe('AdminService.removeMemberPhoto', () => {
  it("deletes via PhotosService (scoped to that member's profile) and audits the reason", async () => {
    const { service, photosService, auditLog } = buildService();

    const result = await service.removeMemberPhoto(ADMIN_ID, USER_ID, 'photo-1', 'nudity');

    expect(photosService.deletePhoto).toHaveBeenCalledWith(USER_ID, 'photo-1');
    expect(result).toEqual({ id: 'photo-1', removed: true });
    expect(auditLog.record).toHaveBeenCalledWith(ADMIN_ID, 'member.photo.remove', 'ProfilePhoto', 'photo-1', {
      reason: 'nudity',
      userId: USER_ID,
      objectKey: 'profiles/p1/photo-1.jpg',
    });
  });

  it('writes no audit entry when the photo does not belong to that member', async () => {
    const { service, photosService, auditLog } = buildService();
    photosService.deletePhoto.mockRejectedValueOnce(new NotFoundException('Photo not found for this profile'));

    await expect(service.removeMemberPhoto(ADMIN_ID, USER_ID, 'other-photo', 'x')).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(auditLog.record).not.toHaveBeenCalled();
  });
});
