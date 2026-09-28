import { describe, expect, it, vi } from 'vitest';
import { AuditLogService } from './audit-log.service.js';

function buildService() {
  const prisma = {
    auditLog: {
      create: vi.fn(),
      findMany: vi.fn().mockResolvedValue([]),
      count: vi.fn().mockResolvedValue(0),
    },
  };
  return { service: new AuditLogService(prisma as never), prisma };
}

describe('AuditLogService.list', () => {
  it('lists newest first with no filter, paginated, with a total', async () => {
    const { service, prisma } = buildService();
    prisma.auditLog.count.mockResolvedValueOnce(120);

    const result = await service.list(40, 20);

    expect(prisma.auditLog.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: {}, orderBy: { createdAt: 'desc' }, skip: 40, take: 20 }),
    );
    expect(prisma.auditLog.count).toHaveBeenCalledWith({ where: {} });
    expect(result.total).toBe(120);
  });

  it('applies action, actor, target and inclusive date-range filters together', async () => {
    const { service, prisma } = buildService();
    const from = new Date('2026-09-01T00:00:00.000Z');
    const to = new Date('2026-09-30T23:59:59.999Z');

    await service.list(0, 50, {
      action: 'member.suspend',
      adminId: 'admin-1',
      targetType: 'User',
      targetId: 'user-1',
      from,
      to,
    });

    expect(prisma.auditLog.findMany.mock.calls[0][0].where).toEqual({
      action: 'member.suspend',
      adminId: 'admin-1',
      targetType: 'User',
      targetId: 'user-1',
      createdAt: { gte: from, lte: to },
    });
  });

  it("flattens the acting admin's email and phone onto each entry", async () => {
    const { service, prisma } = buildService();
    prisma.auditLog.findMany.mockResolvedValueOnce([
      {
        id: 'a1',
        adminId: 'admin-1',
        admin: { email: 'root@example.com', user: { phoneNumber: '+919876543200' } },
        action: 'member.suspend',
        targetType: 'User',
        targetId: 'user-1',
        metadata: { reason: 'spam' },
        createdAt: new Date('2026-09-28T00:00:00.000Z'),
      },
    ]);

    const { items } = await service.list(0, 10);

    expect(items[0]).toEqual({
      id: 'a1',
      adminId: 'admin-1',
      adminEmail: 'root@example.com',
      adminPhoneNumber: '+919876543200',
      action: 'member.suspend',
      targetType: 'User',
      targetId: 'user-1',
      metadata: { reason: 'spam' },
      createdAt: '2026-09-28T00:00:00.000Z',
    });
  });
});

describe('AuditLogService.latestReportNotes', () => {
  it('returns the newest non-empty note per report', async () => {
    const { service, prisma } = buildService();
    prisma.auditLog.findMany.mockResolvedValueOnce([
      { targetId: 'r1', metadata: { status: 'RESOLVED', note: 'warned the member' } },
      { targetId: 'r1', metadata: { status: 'IN_REVIEW', note: 'looking into it' } },
      { targetId: 'r2', metadata: { status: 'IN_REVIEW' } },
    ]);

    const notes = await service.latestReportNotes(['r1', 'r2']);

    expect(notes.get('r1')).toBe('warned the member');
    expect(notes.has('r2')).toBe(false);
  });

  it('skips the query entirely for an empty list', async () => {
    const { service, prisma } = buildService();

    await service.latestReportNotes([]);

    expect(prisma.auditLog.findMany).not.toHaveBeenCalled();
  });
});
