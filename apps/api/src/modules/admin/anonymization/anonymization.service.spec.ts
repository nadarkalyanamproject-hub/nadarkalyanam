import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AnonymizationService } from './anonymization.service.js';

const DAY_MS = 24 * 60 * 60 * 1000;
const NOW = new Date('2026-09-28T12:00:00.000Z');
const daysAgo = (days: number) => new Date(NOW.getTime() - days * DAY_MS);

interface FakeUser {
  id: string;
  phoneNumber: string;
  status: string;
  deletionRequestedAt: Date | null;
  isAdmin?: boolean;
}

// A tiny in-memory stand-in for the handful of Prisma calls the service
// makes, applying the same where-conditions a real DB would — so "inside the
// grace period", "restored" and "already DELETED" are decided by the
// service's actual query, not by what a mock was told to return.
function buildFakeDb(users: FakeUser[]) {
  const db = {
    users: users.map((u) => ({ ...u })),
    profiles: users.map((u) => ({
      userId: u.id,
      fullName: `Name of ${u.id}`,
      gender: 'FEMALE',
      dateOfBirth: new Date('1995-01-01'),
      visibility: 'MEMBERS_ONLY',
      isVerified: true,
      completionScore: 90,
      details: { email: `${u.id}@example.com`, about: 'personal text' } as object,
      fieldVisibility: {} as object,
    })),
    photos: users.flatMap((u) => [
      { userId: u.id, objectKey: `profiles/${u.id}/a.jpg` },
      { userId: u.id, objectKey: `profiles/${u.id}/b.jpg` },
    ]),
    sessions: users.map((u) => ({ userId: u.id, revokedAt: null as Date | null })),
    devices: users.map((u) => ({ userId: u.id })),
    notifications: users.map((u) => ({ userId: u.id })),
    auditLogs: users.map((u) => ({
      id: `removal-${u.id}`,
      adminId: 'admin-remover',
      action: 'member.remove',
      targetType: 'User',
      targetId: u.id,
      metadata: {} as unknown,
      createdAt: daysAgo(20),
    })),
  };

  const userMatches = (
    u: FakeUser,
    where: { id?: string; status?: string; deletionRequestedAt?: { lte: Date }; adminUser?: null },
  ) =>
    (where.id === undefined || u.id === where.id) &&
    (where.status === undefined || u.status === where.status) &&
    (where.deletionRequestedAt === undefined ||
      (u.deletionRequestedAt !== null && u.deletionRequestedAt <= where.deletionRequestedAt.lte)) &&
    (where.adminUser === undefined || !u.isAdmin);

  const client = {
    user: {
      findMany: vi.fn(async ({ where, take }: { where: Parameters<typeof userMatches>[1]; take: number }) =>
        db.users
          .filter((u) => userMatches(u, where))
          .sort((a, b) => a.deletionRequestedAt!.getTime() - b.deletionRequestedAt!.getTime())
          .slice(0, take)
          .map((u) => ({ id: u.id, deletionRequestedAt: u.deletionRequestedAt })),
      ),
      updateMany: vi.fn(async ({ where, data }: { where: Parameters<typeof userMatches>[1]; data: Partial<FakeUser> }) => {
        const matched = db.users.filter((u) => userMatches(u, where));
        matched.forEach((u) => Object.assign(u, data));
        return { count: matched.length };
      }),
    },
    auditLog: {
      findFirst: vi.fn(async ({ where }: { where: { action: string; targetId: string } }) =>
        db.auditLogs.find((a) => a.action === where.action && a.targetId === where.targetId) ?? null,
      ),
      create: vi.fn(async ({ data }: { data: (typeof db.auditLogs)[number] }) => {
        db.auditLogs.push({ ...data, id: `log-${db.auditLogs.length}`, createdAt: NOW });
        return data;
      }),
    },
    profilePhoto: {
      findMany: vi.fn(async ({ where }: { where: { profile: { userId: string } } }) =>
        db.photos.filter((p) => p.userId === where.profile.userId).map((p) => ({ objectKey: p.objectKey })),
      ),
      deleteMany: vi.fn(async ({ where }: { where: { profile: { userId: string } } }) => {
        db.photos = db.photos.filter((p) => p.userId !== where.profile.userId);
        return {};
      }),
    },
    profile: {
      updateMany: vi.fn(async ({ where, data }: { where: { userId: string }; data: object }) => {
        db.profiles.filter((p) => p.userId === where.userId).forEach((p) => Object.assign(p, data));
        return {};
      }),
    },
    session: {
      updateMany: vi.fn(async ({ where, data }: { where: { userId: string }; data: { revokedAt: Date } }) => {
        const matched = db.sessions.filter((s) => s.userId === where.userId && s.revokedAt === null);
        matched.forEach((s) => (s.revokedAt = data.revokedAt));
        return { count: matched.length };
      }),
    },
    device: {
      deleteMany: vi.fn(async ({ where }: { where: { userId: string } }) => {
        db.devices = db.devices.filter((d) => d.userId !== where.userId);
        return {};
      }),
    },
    notification: {
      deleteMany: vi.fn(async ({ where }: { where: { userId: string } }) => {
        db.notifications = db.notifications.filter((n) => n.userId !== where.userId);
        return {};
      }),
    },
    $transaction: vi.fn(async (fn: (tx: unknown) => unknown) => fn(client)),
  };
  return { db, client };
}

function buildService(users: FakeUser[]) {
  const { db, client } = buildFakeDb(users);
  const storage = { deleteObject: vi.fn().mockResolvedValue(undefined) };
  const service = new AnonymizationService(client as never, storage as never);
  return { service, db, client, storage };
}

const eligible: FakeUser = {
  id: 'eligible',
  phoneNumber: '+919800000001',
  status: 'PENDING_DELETION',
  deletionRequestedAt: daysAgo(15),
};
const insideGrace: FakeUser = {
  id: 'inside-grace',
  phoneNumber: '+919800000002',
  status: 'PENDING_DELETION',
  deletionRequestedAt: daysAgo(13),
};
// What restoreMember leaves behind: ACTIVE, deletionRequestedAt cleared (its
// member.remove audit entry still exists).
const restored: FakeUser = {
  id: 'restored',
  phoneNumber: '+919800000003',
  status: 'ACTIVE',
  deletionRequestedAt: null,
};

describe('AnonymizationService', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('anonymizes an eligible member: DELETED, PII scrubbed, photos + objects gone, sessions revoked, audited', async () => {
    const { service, db, storage } = buildService([eligible]);

    const result = await service.run({ dryRun: false, now: NOW });

    expect(result.anonymized).toEqual(['eligible']);
    const user = db.users[0];
    expect(user.status).toBe('DELETED');
    expect(user.phoneNumber).toBe('deleted:eligible');
    expect(user.phoneNumber).not.toContain('98000');

    const profile = db.profiles[0];
    expect(profile).toMatchObject({
      fullName: 'Deleted member',
      gender: 'UNSPECIFIED',
      visibility: 'HIDDEN',
      isVerified: false,
      details: {},
      fieldVisibility: {},
    });
    expect(JSON.stringify(profile)).not.toContain('@example.com');

    expect(db.photos).toHaveLength(0);
    expect(storage.deleteObject).toHaveBeenCalledWith('profiles/eligible/a.jpg');
    expect(storage.deleteObject).toHaveBeenCalledWith('profiles/eligible/b.jpg');
    expect(db.sessions[0].revokedAt).toEqual(NOW);
    expect(db.devices).toHaveLength(0);
    expect(db.notifications).toHaveLength(0);

    const entry = db.auditLogs.find((a) => a.action === 'member.anonymize');
    expect(entry).toMatchObject({
      adminId: 'admin-remover',
      targetType: 'User',
      targetId: 'eligible',
      metadata: expect.objectContaining({ actor: 'system:anonymization-job', photosDeleted: 2, sessionsRevoked: 1 }),
    });
  });

  it('leaves a member still inside the grace period completely untouched', async () => {
    const { service, db, storage } = buildService([insideGrace]);

    const result = await service.run({ dryRun: false, now: NOW });

    expect(result.eligible).toEqual([]);
    expect(db.users[0]).toMatchObject({ status: 'PENDING_DELETION', phoneNumber: '+919800000002' });
    expect(db.profiles[0].fullName).toBe('Name of inside-grace');
    expect(db.photos).toHaveLength(2);
    expect(storage.deleteObject).not.toHaveBeenCalled();
  });

  it('leaves a restored member completely untouched', async () => {
    const { service, db, storage } = buildService([restored]);

    const result = await service.run({ dryRun: false, now: NOW });

    expect(result.eligible).toEqual([]);
    expect(db.users[0]).toMatchObject({ status: 'ACTIVE', phoneNumber: '+919800000003' });
    expect(db.photos).toHaveLength(2);
    expect(storage.deleteObject).not.toHaveBeenCalled();
  });

  it('is idempotent: a second run finds nothing and writes nothing more', async () => {
    const { service, db, storage } = buildService([eligible, insideGrace, restored]);

    const first = await service.run({ dryRun: false, now: NOW });
    const logsAfterFirst = db.auditLogs.length;
    storage.deleteObject.mockClear();
    const second = await service.run({ dryRun: false, now: NOW });

    expect(first.anonymized).toEqual(['eligible']);
    expect(second).toMatchObject({ eligible: [], anonymized: [], failed: [] });
    expect(db.auditLogs).toHaveLength(logsAfterFirst);
    expect(storage.deleteObject).not.toHaveBeenCalled();
  });

  it('dry run reports who WOULD be anonymized and changes nothing', async () => {
    const { service, db, storage, client } = buildService([eligible, insideGrace]);

    const result = await service.run({ dryRun: true, now: NOW });

    expect(result).toMatchObject({ dryRun: true, eligible: ['eligible'], anonymized: [] });
    expect(db.users[0].status).toBe('PENDING_DELETION');
    expect(db.photos).toHaveLength(4);
    expect(storage.deleteObject).not.toHaveBeenCalled();
    expect(client.$transaction).not.toHaveBeenCalled();
  });

  it("continues past one member's failure; the failed member stays PENDING_DELETION for the next run", async () => {
    const second: FakeUser = { ...eligible, id: 'eligible-2', phoneNumber: '+919800000009', deletionRequestedAt: daysAgo(16) };
    const { service, db, storage } = buildService([eligible, second]);
    storage.deleteObject.mockImplementation(async (key: string) => {
      if (key.startsWith('profiles/eligible-2/')) throw new Error('storage unavailable');
    });

    const result = await service.run({ dryRun: false, now: NOW });

    expect(result.failed).toEqual([{ userId: 'eligible-2', error: 'storage unavailable' }]);
    expect(result.anonymized).toEqual(['eligible']);
    expect(db.users.find((u) => u.id === 'eligible-2')?.status).toBe('PENDING_DELETION');
    expect(db.users.find((u) => u.id === 'eligible')?.status).toBe('DELETED');
  });

  it('refuses to anonymize a member with no attributable member.remove audit entry', async () => {
    const { service, db } = buildService([eligible]);
    db.auditLogs = [];

    const result = await service.run({ dryRun: false, now: NOW });

    expect(result.failed[0]).toMatchObject({ userId: 'eligible' });
    expect(db.users[0].status).toBe('PENDING_DELETION');
  });

  it('never selects a User linked to an admin account', async () => {
    const { service } = buildService([{ ...eligible, isAdmin: true }]);

    const result = await service.run({ dryRun: false, now: NOW });

    expect(result.eligible).toEqual([]);
  });

  it('respects the batch size', async () => {
    const users = Array.from({ length: 5 }, (_, i) => ({
      ...eligible,
      id: `u${i}`,
      phoneNumber: `+91980000010${i}`,
      deletionRequestedAt: daysAgo(20 + i),
    }));
    const { service } = buildService(users);

    const result = await service.run({ dryRun: false, now: NOW, batchSize: 2 });

    expect(result.anonymized).toHaveLength(2);
  });

  it('skips (does not double-process) a member whose state changed between selection and the claim', async () => {
    const { service, db, client } = buildService([eligible]);
    // Simulate a concurrent run claiming the user first.
    client.user.updateMany.mockImplementationOnce(async () => {
      db.users[0].status = 'DELETED';
      return { count: 0 };
    });

    const result = await service.run({ dryRun: false, now: NOW });

    expect(result.skipped).toEqual(['eligible']);
    expect(db.auditLogs.filter((a) => a.action === 'member.anonymize')).toHaveLength(0);
  });
});
