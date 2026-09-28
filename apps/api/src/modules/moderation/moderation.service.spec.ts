import { ConflictException, NotFoundException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import { ModerationService } from './moderation.service.js';

const baseReport = {
  reporterId: 'reporter-user',
  reason: 'fake profile',
  createdAt: new Date('2026-09-20T00:00:00.000Z'),
  resolvedAt: null,
};

function buildService() {
  const prisma = {
    report: {
      findMany: vi.fn().mockResolvedValue([]),
      count: vi.fn().mockResolvedValue(0),
      findUnique: vi.fn(),
      findUniqueOrThrow: vi.fn(),
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
    },
    profile: { findMany: vi.fn().mockResolvedValue([]) },
    message: { findMany: vi.fn().mockResolvedValue([]) },
    user: { findMany: vi.fn().mockResolvedValue([]) },
  };
  return { service: new ModerationService(prisma as never), prisma };
}

describe('ModerationService.listForAdmin', () => {
  it('defaults to the open queue (OPEN + IN_REVIEW), oldest first, and returns a total', async () => {
    const { service, prisma } = buildService();
    prisma.report.count.mockResolvedValueOnce(7);

    const result = await service.listForAdmin(undefined, 0, 20);

    expect(prisma.report.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { status: { in: ['OPEN', 'IN_REVIEW'] } }, orderBy: { createdAt: 'asc' } }),
    );
    expect(result.total).toBe(7);
  });

  it('filters by a single closed status, most recent first', async () => {
    const { service, prisma } = buildService();

    await service.listForAdmin('DISMISSED', 0, 20);

    expect(prisma.report.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { status: 'DISMISSED' }, orderBy: { createdAt: 'desc' } }),
    );
  });

  it('resolves reporter and reported member for PROFILE reports, and the sender + message for MESSAGE reports', async () => {
    const { service, prisma } = buildService();
    prisma.report.findMany.mockResolvedValueOnce([
      { ...baseReport, id: 'r1', targetType: 'PROFILE', targetId: 'profile-target', status: 'OPEN' },
      { ...baseReport, id: 'r2', targetType: 'MESSAGE', targetId: 'message-1', status: 'OPEN' },
    ]);
    prisma.profile.findMany.mockResolvedValueOnce([{ id: 'profile-target', userId: 'target-user' }]);
    prisma.message.findMany.mockResolvedValueOnce([
      { id: 'message-1', senderId: 'sender-user', body: 'rude message', createdAt: new Date('2026-09-19T00:00:00.000Z') },
    ]);
    prisma.user.findMany.mockResolvedValueOnce([
      { id: 'reporter-user', phoneNumber: '+911', status: 'ACTIVE', profile: { id: 'p-rep', fullName: 'Reporter' } },
      { id: 'target-user', phoneNumber: '+912', status: 'ACTIVE', profile: { id: 'profile-target', fullName: 'Target' } },
      { id: 'sender-user', phoneNumber: '+913', status: 'SUSPENDED', profile: null },
    ]);

    const { items } = await service.listForAdmin(undefined, 0, 20);

    expect(prisma.user.findMany.mock.calls[0][0].where.id.in.sort()).toEqual(['reporter-user', 'sender-user', 'target-user']);
    expect(items[0].reporter).toMatchObject({ userId: 'reporter-user', fullName: 'Reporter' });
    expect(items[0].reportedMember).toMatchObject({ userId: 'target-user', profileId: 'profile-target', fullName: 'Target' });
    expect(items[0].reportedMessage).toBeNull();
    expect(items[1].reportedMember).toMatchObject({ userId: 'sender-user', fullName: null, status: 'SUSPENDED' });
    expect(items[1].reportedMessage).toMatchObject({ id: 'message-1', body: 'rude message' });
  });

  it('returns null context (not a crash) when a target no longer exists', async () => {
    const { service, prisma } = buildService();
    prisma.report.findMany.mockResolvedValueOnce([
      { ...baseReport, id: 'r1', targetType: 'PROFILE', targetId: 'gone', status: 'OPEN' },
    ]);

    const { items } = await service.listForAdmin(undefined, 0, 20);

    expect(items[0].reportedMember).toBeNull();
    expect(items[0].reporter).toBeNull();
  });
});

describe('ModerationService.updateStatus', () => {
  it('moves OPEN -> IN_REVIEW without setting resolvedAt', async () => {
    const { service, prisma } = buildService();
    prisma.report.findUnique.mockResolvedValueOnce({ ...baseReport, id: 'r1', targetType: 'PROFILE', targetId: 'x', status: 'OPEN' });
    prisma.report.findUniqueOrThrow.mockResolvedValueOnce({
      ...baseReport,
      id: 'r1',
      targetType: 'PROFILE',
      targetId: 'x',
      status: 'IN_REVIEW',
    });

    const result = await service.updateStatus('r1', 'IN_REVIEW');

    expect(prisma.report.updateMany).toHaveBeenCalledWith({
      where: { id: 'r1', status: 'OPEN' },
      data: { status: 'IN_REVIEW', resolvedAt: null },
    });
    expect(result.status).toBe('IN_REVIEW');
  });

  it('closes an IN_REVIEW report with a resolvedAt timestamp', async () => {
    const { service, prisma } = buildService();
    prisma.report.findUnique.mockResolvedValueOnce({ ...baseReport, id: 'r1', targetType: 'PROFILE', targetId: 'x', status: 'IN_REVIEW' });
    prisma.report.findUniqueOrThrow.mockResolvedValueOnce({
      ...baseReport,
      id: 'r1',
      targetType: 'PROFILE',
      targetId: 'x',
      status: 'RESOLVED',
      resolvedAt: new Date(),
    });

    await service.updateStatus('r1', 'RESOLVED');

    expect(prisma.report.updateMany).toHaveBeenCalledWith({
      where: { id: 'r1', status: 'IN_REVIEW' },
      data: { status: 'RESOLVED', resolvedAt: expect.any(Date) },
    });
  });

  it.each([
    ['RESOLVED', 'DISMISSED'],
    ['DISMISSED', 'IN_REVIEW'],
    ['IN_REVIEW', 'IN_REVIEW'],
  ] as const)('rejects %s -> %s', async (from, to) => {
    const { service, prisma } = buildService();
    prisma.report.findUnique.mockResolvedValueOnce({ ...baseReport, id: 'r1', targetType: 'PROFILE', targetId: 'x', status: from });

    await expect(service.updateStatus('r1', to)).rejects.toBeInstanceOf(ConflictException);
    expect(prisma.report.updateMany).not.toHaveBeenCalled();
  });

  it('rejects when another moderator changed the report first', async () => {
    const { service, prisma } = buildService();
    prisma.report.findUnique.mockResolvedValueOnce({ ...baseReport, id: 'r1', targetType: 'PROFILE', targetId: 'x', status: 'OPEN' });
    prisma.report.updateMany.mockResolvedValueOnce({ count: 0 });

    await expect(service.updateStatus('r1', 'RESOLVED')).rejects.toBeInstanceOf(ConflictException);
  });

  it('404s for an unknown report', async () => {
    const { service, prisma } = buildService();
    prisma.report.findUnique.mockResolvedValueOnce(null);

    await expect(service.updateStatus('nope', 'RESOLVED')).rejects.toBeInstanceOf(NotFoundException);
  });
});
