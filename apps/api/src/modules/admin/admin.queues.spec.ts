import { ConflictException, NotFoundException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import { photoStatus, isVisibleToOtherMembers } from '../../common/photo-visibility.js';
import { AdminService } from './admin.service.js';

const ADMIN_ID = 'admin-1';
const USER_ID = 'user-1';

function buildService(user: Record<string, unknown> | null = { id: USER_ID, status: 'ACTIVE', adminUser: null }) {
  const prisma = {
    user: {
      findUnique: vi.fn().mockResolvedValue(user),
    },
    profilePhoto: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      count: vi.fn(),
      update: vi.fn(),
    },
    verificationRequest: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn(),
      count: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
    },
    profile: {
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
    },
    $transaction: vi.fn(async (callback: (tx: unknown) => Promise<unknown>) => callback(prisma)),
  };

  const photosService = {
    listPendingPhotos: vi.fn().mockResolvedValue({
      items: [
        {
          id: 'photo-1',
          url: 'https://storage.example/photo-1.jpg',
          profileId: 'profile-1',
          userId: USER_ID,
          memberName: 'Kavitha Nadar',
          phoneNumber: '+919876543210',
          isPrimary: true,
          sortOrder: 0,
          createdAt: new Date().toISOString(),
        },
      ],
      total: 1,
    }),
    findPhotoWithProfile: vi.fn(),
    moderatePhoto: vi.fn().mockImplementation((_userId: string, photoId: string, decision: { approve: boolean; reason?: string }) =>
      Promise.resolve({
        id: photoId,
        status: decision.approve ? 'APPROVED' : 'REJECTED',
        rejectionReason: decision.approve ? null : decision.reason,
      }),
    ),
  };

  const auditLog = { record: vi.fn().mockResolvedValue({ id: 'audit-1' }) };
  const notifications = { notify: vi.fn() };

  const service = new AdminService(prisma as never, photosService as never, auditLog as never, notifications as never);

  return { service, prisma, photosService, auditLog, notifications };
}

describe('AdminService — Photo Moderation Queue', () => {
  it('listPendingPhotos delegates to PhotosService.listPendingPhotos', async () => {
    const { service, photosService } = buildService();

    const result = await service.listPendingPhotos(0, 20);

    expect(photosService.listPendingPhotos).toHaveBeenCalledWith(0, 20);
    expect(result.items).toHaveLength(1);
    expect(result.total).toBe(1);
  });

  it('moderatePhotoFromQueue approves a pending photo: updates status, audits, and notifies member', async () => {
    const { service, photosService, auditLog, notifications } = buildService();

    photosService.findPhotoWithProfile.mockResolvedValueOnce({
      id: 'photo-1',
      profileId: 'profile-1',
      profile: { id: 'profile-1', userId: USER_ID },
    });

    const result = await service.moderatePhotoFromQueue(ADMIN_ID, 'photo-1', { approve: true });

    expect(result.status).toBe('APPROVED');
    expect(photosService.moderatePhoto).toHaveBeenCalledWith(USER_ID, 'photo-1', { approve: true }, { pendingOnly: true });
    expect(auditLog.record).toHaveBeenCalledWith(ADMIN_ID, 'member.photo.approve', 'ProfilePhoto', 'photo-1', {
      userId: USER_ID,
    });
    expect(notifications.notify).toHaveBeenCalledWith({
      recipientUserId: USER_ID,
      type: 'PHOTO_APPROVED',
      targetType: 'ProfilePhoto',
    });
  });

  it('moderatePhotoFromQueue rejects a pending photo: records reason, audits, and notifies member with reason', async () => {
    const { service, photosService, auditLog, notifications } = buildService();

    photosService.findPhotoWithProfile.mockResolvedValueOnce({
      id: 'photo-1',
      profileId: 'profile-1',
      profile: { id: 'profile-1', userId: USER_ID },
    });

    const result = await service.moderatePhotoFromQueue(ADMIN_ID, 'photo-1', {
      approve: false,
      reason: 'Blurred image',
    });

    expect(result.status).toBe('REJECTED');
    expect(photosService.moderatePhoto).toHaveBeenCalledWith(
      USER_ID,
      'photo-1',
      { approve: false, reason: 'Blurred image' },
      { pendingOnly: true },
    );
    expect(auditLog.record).toHaveBeenCalledWith(ADMIN_ID, 'member.photo.reject', 'ProfilePhoto', 'photo-1', {
      userId: USER_ID,
      reason: 'Blurred image',
    });
    expect(notifications.notify).toHaveBeenCalledWith({
      recipientUserId: USER_ID,
      type: 'PHOTO_REJECTED',
      targetType: 'ProfilePhoto',
      data: { reason: 'Blurred image' },
    });
  });

  it('moderatePhotoFromQueue throws 404 when photo does not exist', async () => {
    const { service, photosService } = buildService();

    photosService.findPhotoWithProfile.mockResolvedValueOnce(null);

    await expect(service.moderatePhotoFromQueue(ADMIN_ID, 'missing-photo', { approve: true })).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('moderatePhotoFromQueue refuses for a deleted (anonymized) user', async () => {
    const { service, photosService } = buildService({ id: USER_ID, status: 'DELETED', adminUser: null });

    photosService.findPhotoWithProfile.mockResolvedValueOnce({
      id: 'photo-1',
      profileId: 'profile-1',
      profile: { id: 'profile-1', userId: USER_ID },
    });

    await expect(service.moderatePhotoFromQueue(ADMIN_ID, 'photo-1', { approve: true })).rejects.toBeInstanceOf(
      ConflictException,
    );
  });

  it('Check 1 (Done when): approved photo becomes visible to others; rejected photo is hidden from others', () => {
    const pendingPhoto = { isModerated: false, isApproved: false };
    expect(photoStatus(pendingPhoto)).toBe('PENDING');
    expect(isVisibleToOtherMembers(pendingPhoto)).toBe(false);

    const approvedPhoto = { isModerated: true, isApproved: true };
    expect(photoStatus(approvedPhoto)).toBe('APPROVED');
    expect(isVisibleToOtherMembers(approvedPhoto)).toBe(true);

    const rejectedPhoto = { isModerated: true, isApproved: false };
    expect(photoStatus(rejectedPhoto)).toBe('REJECTED');
    expect(isVisibleToOtherMembers(rejectedPhoto)).toBe(false);
  });
});

describe('AdminService — Identity Verification Queue', () => {
  it('listVerifications returns mapped list and hides Aadhaar / raw identity data', async () => {
    const { service, prisma } = buildService();

    const createdAt = new Date('2026-10-28T10:00:00Z');
    prisma.verificationRequest.count.mockResolvedValueOnce(1);
    prisma.verificationRequest.findMany.mockResolvedValueOnce([
      {
        id: 'req-1',
        userId: USER_ID,
        providerReference: 'opaque-ref-123',
        status: 'PENDING',
        createdAt,
        decidedAt: null,
        user: {
          id: USER_ID,
          phoneNumber: '+919876543210',
          status: 'ACTIVE',
          profile: {
            fullName: 'Raj Nadar',
            isVerified: false,
          },
        },
      },
    ]);

    const result = await service.listVerifications(0, 20, 'PENDING');

    expect(prisma.verificationRequest.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { status: 'PENDING' },
        skip: 0,
        take: 20,
      }),
    );
    expect(result.items).toHaveLength(1);
    expect(result.items[0]).toEqual({
      id: 'req-1',
      userId: USER_ID,
      memberName: 'Raj Nadar',
      phoneNumber: '+919876543210',
      providerReference: 'opaque-ref-123',
      status: 'PENDING',
      isProfileVerified: false,
      createdAt: createdAt.toISOString(),
      decidedAt: null,
    });
  });

  it('approveVerification marks request SUCCEEDED, updates profile isVerified=true, notifies member and audits', async () => {
    const { service, prisma, auditLog, notifications } = buildService();

    prisma.verificationRequest.findUnique.mockResolvedValueOnce({
      id: 'req-1',
      userId: USER_ID,
      status: 'PENDING',
      user: { id: USER_ID, status: 'ACTIVE' },
    });

    const result = await service.approveVerification(ADMIN_ID, 'req-1');

    expect(result.status).toBe('SUCCEEDED');
    expect(prisma.verificationRequest.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'req-1', status: 'PENDING' },
        data: expect.objectContaining({ status: 'SUCCEEDED' }),
      }),
    );
    expect(prisma.profile.updateMany).toHaveBeenCalledWith({
      where: { userId: USER_ID },
      data: { isVerified: true },
    });
    expect(notifications.notify).toHaveBeenCalledWith({
      recipientUserId: USER_ID,
      type: 'VERIFICATION_APPROVED',
      targetType: 'Account',
    });
    expect(auditLog.record).toHaveBeenCalledWith(ADMIN_ID, 'verification.approve', 'VerificationRequest', 'req-1', {
      userId: USER_ID,
    });
  });

  it('rejectVerification without existing success marks profile isVerified=false', async () => {
    const { service, prisma, auditLog, notifications } = buildService();

    prisma.verificationRequest.findUnique.mockResolvedValueOnce({
      id: 'req-1',
      userId: USER_ID,
      status: 'PENDING',
      user: { id: USER_ID, status: 'ACTIVE' },
    });
    // No other SUCCEEDED verification requests exist
    prisma.verificationRequest.findFirst.mockResolvedValueOnce(null);

    const result = await service.rejectVerification(ADMIN_ID, 'req-1', 'Document blurry');

    expect(result.status).toBe('FAILED');
    expect(prisma.profile.updateMany).toHaveBeenCalledWith({
      where: { userId: USER_ID },
      data: { isVerified: false },
    });
    expect(notifications.notify).toHaveBeenCalledWith({
      recipientUserId: USER_ID,
      type: 'VERIFICATION_REJECTED',
      targetType: 'Account',
      data: { reason: 'Document blurry' },
    });
    expect(auditLog.record).toHaveBeenCalledWith(ADMIN_ID, 'verification.reject', 'VerificationRequest', 'req-1', {
      userId: USER_ID,
      reason: 'Document blurry',
    });
  });

  // CRITICAL "Done when" Check 2: A failed older verification can't overwrite a newer success
  it('Check 2 (Done when): a failed older verification CANNOT overwrite a newer success (FR-8.6 guardrail)', async () => {
    const { service, prisma, notifications } = buildService();

    // The request being rejected is req-older
    prisma.verificationRequest.findUnique.mockResolvedValueOnce({
      id: 'req-older',
      userId: USER_ID,
      status: 'PENDING',
      user: { id: USER_ID, status: 'ACTIVE' },
    });

    // The member ALREADY has a newer (or another) SUCCEEDED verification request
    prisma.verificationRequest.findFirst.mockResolvedValueOnce({
      id: 'req-newer',
      userId: USER_ID,
      status: 'SUCCEEDED',
    });

    const result = await service.rejectVerification(ADMIN_ID, 'req-older', 'Old attempt timed out');

    expect(result.status).toBe('FAILED');
    expect(prisma.verificationRequest.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'req-older', status: 'PENDING' },
        data: expect.objectContaining({ status: 'FAILED' }),
      }),
    );
    // Profile isVerified MUST NOT be downgraded to false!
    expect(prisma.profile.updateMany).not.toHaveBeenCalled();
    expect(notifications.notify).toHaveBeenCalledWith({
      recipientUserId: USER_ID,
      type: 'VERIFICATION_REJECTED',
      targetType: 'Account',
      data: { reason: 'Old attempt timed out' },
    });
  });

  it.each([
    ['approve', 'FAILED'],
    ['approve', 'EXPIRED'],
    ['reject', 'SUCCEEDED'],
    ['reject', 'FAILED'],
  ] as const)('refuses to %s a request that is already %s, changing nothing', async (action, status) => {
    const { service, prisma, notifications, auditLog } = buildService();
    prisma.verificationRequest.findUnique.mockResolvedValueOnce({ id: 'req-1', userId: USER_ID, status });

    const call =
      action === 'approve' ? service.approveVerification(ADMIN_ID, 'req-1') : service.rejectVerification(ADMIN_ID, 'req-1', 'x');
    await expect(call).rejects.toBeInstanceOf(ConflictException);
    expect(prisma.verificationRequest.updateMany).not.toHaveBeenCalled();
    expect(prisma.profile.updateMany).not.toHaveBeenCalled();
    expect(notifications.notify).not.toHaveBeenCalled();
    expect(auditLog.record).not.toHaveBeenCalled();
  });

  it('409s when another agent decided the request between the read and the update', async () => {
    const { service, prisma, notifications } = buildService();
    prisma.verificationRequest.findUnique.mockResolvedValueOnce({ id: 'req-1', userId: USER_ID, status: 'PENDING' });
    prisma.verificationRequest.updateMany.mockResolvedValueOnce({ count: 0 });

    await expect(service.rejectVerification(ADMIN_ID, 'req-1', 'x')).rejects.toBeInstanceOf(ConflictException);
    expect(prisma.profile.updateMany).not.toHaveBeenCalled();
    expect(notifications.notify).not.toHaveBeenCalled();
  });
});
