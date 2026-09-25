import { NotFoundException } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AdminService } from './admin.service.js';

const ADMIN_ID = 'admin-1';
const USER_ID = 'user-1';

function buildService(overrides?: {
  findUniqueResult?: unknown;
  findManyResult?: unknown[];
  countResult?: number;
}) {
  const findUniqueResult =
    overrides && 'findUniqueResult' in overrides ? overrides.findUniqueResult : { id: USER_ID, status: 'ACTIVE' };
  const prisma = {
    user: {
      findUnique: vi.fn().mockResolvedValue(findUniqueResult),
      findMany: vi.fn().mockResolvedValue(overrides?.findManyResult ?? []),
      count: vi.fn().mockResolvedValue(overrides?.countResult ?? 0),
      update: vi.fn().mockImplementation(({ where, data }: { where: { id: string }; data: Record<string, unknown> }) =>
        Promise.resolve({ id: where.id, status: 'ACTIVE', ...data }),
      ),
    },
  };
  const photosService = { getPhotosForProfile: vi.fn().mockResolvedValue([]) };
  const auditLog = { record: vi.fn().mockResolvedValue({ id: 'audit-1' }) };

  const service = new AdminService(prisma as never, photosService as never, auditLog as never);
  return { service, prisma, photosService, auditLog };
}

describe('AdminService.listMembers', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('queries without a filter when no search term is given', async () => {
    const { service, prisma } = buildService();

    await service.listMembers(0, 20);

    expect(prisma.user.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: {}, skip: 0, take: 20 }),
    );
  });

  it('searches by phone, profile fullName, and email when a search term is given', async () => {
    const { service, prisma } = buildService();

    await service.listMembers(0, 20, 'priya');

    expect(prisma.user.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          OR: [
            { phoneNumber: { contains: 'priya', mode: 'insensitive' } },
            { profile: { fullName: { contains: 'priya', mode: 'insensitive' } } },
            { profile: { details: { path: ['email'], string_contains: 'priya' } } },
          ],
        },
      }),
    );
  });

  it('maps a user with no profile to nulls, not a crash', async () => {
    const { service } = buildService({
      findManyResult: [{ id: USER_ID, phoneNumber: '+919876543210', status: 'ACTIVE', createdAt: new Date(), profile: null }],
      countResult: 1,
    });

    const result = await service.listMembers(0, 20);

    expect(result.items[0]).toMatchObject({ id: USER_ID, profileId: null, fullName: null, isVerified: false });
    expect(result.total).toBe(1);
  });
});

describe('AdminService.getMemberDetail', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('throws NotFoundException for a nonexistent member', async () => {
    const { service } = buildService({ findUniqueResult: null });

    await expect(service.getMemberDetail('missing')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('returns profile: null (not a crash) for a user with no profile yet', async () => {
    const { service, photosService } = buildService({
      findUniqueResult: { id: USER_ID, phoneNumber: '+919876543210', status: 'ACTIVE', createdAt: new Date(), deletionRequestedAt: null, profile: null },
    });

    const result = await service.getMemberDetail(USER_ID);

    expect(result.profile).toBeNull();
    expect(photosService.getPhotosForProfile).not.toHaveBeenCalled();
  });

  it('includes signed photo URLs (via PhotosService) for a user with a profile', async () => {
    const signedUrl = 'https://s3.example.com/bucket/photo.jpg?X-Amz-Signature=abc';
    const { service, photosService } = buildService({
      findUniqueResult: {
        id: USER_ID,
        phoneNumber: '+919876543210',
        status: 'ACTIVE',
        createdAt: new Date(),
        deletionRequestedAt: null,
        profile: {
          id: 'profile-1',
          fullName: 'Test User',
          gender: 'MALE',
          dateOfBirth: new Date('1990-01-01'),
          visibility: 'MEMBERS_ONLY',
          completionScore: 80,
          isVerified: false,
          details: {},
        },
      },
    });
    photosService.getPhotosForProfile.mockResolvedValueOnce([
      { id: 'photo-1', url: signedUrl, isPrimary: true, sortOrder: 0 },
    ]);

    const result = await service.getMemberDetail(USER_ID);

    expect(photosService.getPhotosForProfile).toHaveBeenCalledWith('profile-1');
    expect(result.profile?.photos[0].url).toBe(signedUrl);
  });

  it('computes scheduledAnonymizationAt as deletionRequestedAt + 14 days when pending deletion', async () => {
    const deletionRequestedAt = new Date('2026-01-01T00:00:00.000Z');
    const { service } = buildService({
      findUniqueResult: {
        id: USER_ID,
        phoneNumber: '+919876543210',
        status: 'PENDING_DELETION',
        createdAt: new Date(),
        deletionRequestedAt,
        profile: null,
      },
    });

    const result = await service.getMemberDetail(USER_ID);

    expect(result.scheduledAnonymizationAt).toBe('2026-01-15T00:00:00.000Z');
  });
});

describe('AdminService.removeMember', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('throws NotFoundException for a nonexistent member, without writing an audit log', async () => {
    const { service, auditLog } = buildService({ findUniqueResult: null });

    await expect(service.removeMember(ADMIN_ID, 'missing', 'spam account')).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(auditLog.record).not.toHaveBeenCalled();
  });

  it('sets status to PENDING_DELETION with a deletionRequestedAt timestamp, and records an audit log entry', async () => {
    const { service, prisma, auditLog } = buildService();

    const result = await service.removeMember(ADMIN_ID, USER_ID, 'requested by user via support ticket');

    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: USER_ID },
      data: { status: 'PENDING_DELETION', deletionRequestedAt: expect.any(Date) },
    });
    expect(result.status).toBe('PENDING_DELETION');
    expect(result.scheduledAnonymizationAt).toBeTruthy();

    expect(auditLog.record).toHaveBeenCalledWith(
      ADMIN_ID,
      'member.remove',
      'User',
      USER_ID,
      expect.objectContaining({ reason: 'requested by user via support ticket' }),
    );
  });

  it('schedules anonymization exactly 14 days after the removal, not immediate deletion', async () => {
    const { service } = buildService();

    const before = Date.now();
    const result = await service.removeMember(ADMIN_ID, USER_ID, 'reason');
    const after = Date.now();

    const scheduled = new Date(result.scheduledAnonymizationAt).getTime();
    const requested = new Date(result.deletionRequestedAt).getTime();
    const fourteenDaysMs = 14 * 24 * 60 * 60 * 1000;

    expect(requested).toBeGreaterThanOrEqual(before);
    expect(requested).toBeLessThanOrEqual(after);
    expect(scheduled - requested).toBe(fourteenDaysMs);
  });
});
