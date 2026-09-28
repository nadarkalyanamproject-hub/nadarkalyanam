import 'reflect-metadata';
import { ConflictException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { InterestsController } from './interests.controller.js';
import { InterestsService } from './interests.service.js';

// Two real users, A and B, each with a profile. senderId/targetId on
// Interest are USER ids; sendInterest takes the target's PROFILE id.
const A = { userId: 'user-a', profileId: 'profile-a' };
const B = { userId: 'user-b', profileId: 'profile-b' };
const C = { userId: 'user-c', profileId: 'profile-c' };
const ALL = [A, B, C];

interface Row {
  id: string;
  senderId: string;
  targetId: string;
  status: 'PENDING' | 'ACCEPTED' | 'DECLINED' | 'WITHDRAWN';
  conversationId?: string;
}

// A small in-memory stand-in that applies the same where-conditions the
// service sends, so the relationship query, the existing per-direction
// findFirst and the create all see one consistent set of interest rows.
function buildService(rows: Row[]) {
  const store = [...rows];
  const matchesPair = (r: Row, w: { senderId?: unknown; targetId?: unknown }) => {
    const inOrEq = (value: string, cond: unknown) =>
      cond === undefined ||
      (typeof cond === 'string' ? value === cond : (cond as { in: string[] }).in.includes(value));
    return inOrEq(r.senderId, w.senderId) && inOrEq(r.targetId, w.targetId);
  };
  const prisma = {
    profile: {
      findUnique: vi.fn(async ({ where }: { where: { id: string } }) => {
        const owner = ALL.find((u) => u.profileId === where.id);
        return owner ? { id: owner.profileId, userId: owner.userId, visibility: 'MEMBERS_ONLY' } : null;
      }),
    },
    block: { findFirst: vi.fn().mockResolvedValue(null) },
    interest: {
      // The relationship helper's query: OR of both directions, PENDING/ACCEPTED only.
      findMany: vi.fn(async ({ where }: { where: { status: { in: string[] }; OR: object[] } }) =>
        store
          .filter((r) => where.status.in.includes(r.status))
          .filter((r) => where.OR.some((clause) => matchesPair(r, clause)))
          .map((r) => ({
            senderId: r.senderId,
            targetId: r.targetId,
            status: r.status,
            conversation: r.conversationId ? { id: r.conversationId } : null,
          })),
      ),
      // The pre-existing, caller-direction-only check in sendInterest.
      findFirst: vi.fn(
        async ({ where }: { where: { senderId: string; targetId: string; status: { in: string[] } } }) =>
          store.find(
            (r) => r.senderId === where.senderId && r.targetId === where.targetId && where.status.in.includes(r.status),
          ) ?? null,
      ),
      create: vi.fn(async ({ data }: { data: { senderId: string; targetId: string } }) => {
        const created: Row = { id: `i-${store.length + 1}`, ...data, status: 'PENDING' };
        store.push(created);
        return created;
      }),
    },
  };
  const profilesService = {
    getOwnProfileOrThrow: vi.fn(async (userId: string) => {
      const u = ALL.find((x) => x.userId === userId)!;
      return { id: u.profileId, userId: u.userId };
    }),
  };
  const service = new InterestsService(prisma as never, profilesService as never, {} as never, { notify: vi.fn() } as never);
  return { service, prisma, store };
}

describe('sendInterest — relationship rules across both directions', () => {
  const accepted: Row = { id: 'i-1', senderId: A.userId, targetId: B.userId, status: 'ACCEPTED', conversationId: 'c-1' };

  it('rejects the REVERSE interest for a connected pair (A sent, B accepted, now B -> A)', async () => {
    const { service, prisma } = buildService([accepted]);

    const attempt = service.sendInterest(B.userId, A.profileId);

    await expect(attempt).rejects.toBeInstanceOf(ConflictException);
    await expect(service.sendInterest(B.userId, A.profileId)).rejects.toThrow('You are already connected with this member');
    expect(prisma.interest.create).not.toHaveBeenCalled();
  });

  it('rejects the same-direction interest for a connected pair (A -> B again) with the connected message', async () => {
    const { service, prisma } = buildService([accepted]);

    await expect(service.sendInterest(A.userId, B.profileId)).rejects.toThrow('You are already connected with this member');
    expect(prisma.interest.create).not.toHaveBeenCalled();
  });

  it('rejects a crossed pending pair: B already has a PENDING interest to A, so A must respond instead', async () => {
    const { service, prisma } = buildService([{ id: 'i-1', senderId: B.userId, targetId: A.userId, status: 'PENDING' }]);

    await expect(service.sendInterest(A.userId, B.profileId)).rejects.toThrow(
      'This member has already sent you an interest - accept it from your Interests page',
    );
    expect(prisma.interest.create).not.toHaveBeenCalled();
  });

  it('unchanged: my own PENDING interest still gives "already sent"', async () => {
    const { service } = buildService([{ id: 'i-1', senderId: A.userId, targetId: B.userId, status: 'PENDING' }]);

    await expect(service.sendInterest(A.userId, B.profileId)).rejects.toThrow(
      'You have already sent an interest to this profile',
    );
  });

  it('unchanged: a DECLINED interest blocks re-sending in that direction (not the reverse)', async () => {
    const declined: Row = { id: 'i-1', senderId: A.userId, targetId: B.userId, status: 'DECLINED' };
    const { service } = buildService([declined]);

    await expect(service.sendInterest(A.userId, B.profileId)).rejects.toThrow(
      'This person has already declined your interest',
    );
    // B (who declined) may still send A an interest, exactly as before.
    await expect(service.sendInterest(B.userId, A.profileId)).resolves.toMatchObject({ status: 'PENDING' });
  });

  it('unchanged: a WITHDRAWN interest allows sending again', async () => {
    const { service } = buildService([{ id: 'i-1', senderId: A.userId, targetId: B.userId, status: 'WITHDRAWN' }]);

    await expect(service.sendInterest(A.userId, B.profileId)).resolves.toMatchObject({ status: 'PENDING' });
  });

  it('a third user is unaffected by the A/B connection', async () => {
    const { service } = buildService([accepted]);

    await expect(service.sendInterest(C.userId, A.profileId)).resolves.toMatchObject({ status: 'PENDING' });
    await expect(service.sendInterest(C.userId, B.profileId)).resolves.toMatchObject({ status: 'PENDING' });
  });
});

describe('InterestsService.listConnections', () => {
  const profileRow = (userId: string, profileId: string, fullName: string) => ({
    id: profileId,
    userId,
    fullName,
    gender: 'FEMALE',
    dateOfBirth: new Date('1997-03-02'),
    visibility: 'HIDDEN',
    details: {
      email: `${userId}@example.com`,
      maritalStatus: 'NEVER_MARRIED',
      religion: 'Hindu',
      location: { city: 'Madurai', state: 'Tamil Nadu' },
      education: { profession: 'Engineer' },
    },
  });

  function build(rows: unknown[], total = rows.length, blocks: unknown[] = []) {
    const prisma = {
      block: { findMany: vi.fn().mockResolvedValue(blocks) },
      interest: { findMany: vi.fn().mockResolvedValue(rows), count: vi.fn().mockResolvedValue(total) },
      profile: {
        findMany: vi.fn(async ({ where }: { where: { userId: { in: string[] } } }) =>
          where.userId.in.map((id) => profileRow(id, `profile-of-${id}`, `Name ${id}`)),
        ),
      },
    };
    const photosService = {
      getPhotosForProfile: vi.fn(async (profileId: string) => [
        { id: 'p1', url: `https://signed.example/${profileId}?X-Amz-Signature=x`, isPrimary: true, sortOrder: 0 },
      ]),
    };
    const service = new InterestsService(prisma as never, {} as never, photosService as never, { notify: vi.fn() } as never);
    return { service, prisma };
  }

  const connectedRow = (senderId: string, targetId: string, conv: string, respondedAt: string) => ({
    senderId,
    targetId,
    createdAt: new Date('2026-09-01T00:00:00.000Z'),
    respondedAt: new Date(respondedAt),
    conversation: { id: conv },
  });

  it('lists connections from BOTH directions with the other member, conversationId and connectedAt', async () => {
    const { service } = build([
      connectedRow(A.userId, B.userId, 'c-ab', '2026-09-20T00:00:00.000Z'), // A sent, B accepted
      connectedRow(C.userId, A.userId, 'c-ca', '2026-09-10T00:00:00.000Z'), // C sent, A accepted
    ]);

    const result = await service.listConnections(A.userId, 0, 20);

    expect(result.items.map((item) => item.id)).toEqual(['profile-of-user-b', 'profile-of-user-c']);
    expect(result.items[0]).toMatchObject({
      relationshipStatus: 'CONNECTED',
      conversationId: 'c-ab',
      connectedAt: '2026-09-20T00:00:00.000Z',
      hasSentInterest: true,
      primaryPhotoUrl: 'https://signed.example/profile-of-user-b?X-Amz-Signature=x',
      location: { city: 'Madurai', state: 'Tamil Nadu' },
    });
  });

  it('never returns email or dateOfBirth', async () => {
    const { service } = build([connectedRow(A.userId, B.userId, 'c-ab', '2026-09-20T00:00:00.000Z')]);

    const result = await service.listConnections(A.userId, 0, 20);
    const json = JSON.stringify(result);

    expect(result.items[0]).not.toHaveProperty('email');
    expect(result.items[0]).not.toHaveProperty('dateOfBirth');
    expect(json).not.toContain('@example.com');
    expect(json).not.toContain('1997-03-02');
  });

  it('queries ACCEPTED rows either way, excluding blocked (either direction) and non-ACTIVE/profile-less members', async () => {
    const { service, prisma } = build([], 0, [
      { initiatorId: A.userId, targetId: 'blocked-by-me' },
      { initiatorId: 'blocked-me', targetId: A.userId },
    ]);

    await service.listConnections(A.userId, 0, 20);

    const where = prisma.interest.findMany.mock.calls[0][0].where;
    const eligibleOther = {
      status: 'ACTIVE',
      id: { notIn: ['blocked-by-me', 'blocked-me'] },
      profile: { isNot: null },
    };
    expect(where).toEqual({
      status: 'ACCEPTED',
      conversation: { isNot: null },
      OR: [
        { senderId: A.userId, target: eligibleOther },
        { targetId: A.userId, sender: eligibleOther },
      ],
    });
    expect(prisma.interest.count).toHaveBeenCalledWith({ where });
  });

  it('paginates with offset/limit and reports nextOffset', async () => {
    const { service, prisma } = build([connectedRow(A.userId, B.userId, 'c-ab', '2026-09-20T00:00:00.000Z')], 3);

    const result = await service.listConnections(A.userId, 1, 1);

    expect(prisma.interest.findMany.mock.calls[0][0]).toMatchObject({ skip: 1, take: 1 });
    expect(result).toMatchObject({ total: 3, nextOffset: 2 });
  });

  it('lists a pair only once even if legacy data has ACCEPTED rows in both directions', async () => {
    const { service } = build([
      connectedRow(A.userId, B.userId, 'c-ab', '2026-09-20T00:00:00.000Z'),
      connectedRow(B.userId, A.userId, 'c-ba', '2026-09-19T00:00:00.000Z'),
    ]);

    const result = await service.listConnections(A.userId, 0, 20);

    expect(result.items).toHaveLength(1);
  });
});

describe('InterestsController — auth + route', () => {
  it('guards every interests route (incl. /interests/connections) with JwtAuthGuard -> 401 when unauthenticated', () => {
    expect(Reflect.getMetadata('__guards__', InterestsController)).toEqual([JwtAuthGuard]);
    expect(Reflect.getMetadata('path', InterestsController.prototype.connections)).toBe('connections');
  });

  it('parses offset/limit (default 20, max 50) and passes the caller through', async () => {
    const interestsService = { listConnections: vi.fn().mockResolvedValue({ items: [], total: 0, nextOffset: null }) };
    const controller = new InterestsController(interestsService as never);

    await controller.connections({ userId: A.userId });
    await controller.connections({ userId: A.userId }, '40', '500');

    expect(interestsService.listConnections).toHaveBeenNthCalledWith(1, A.userId, 0, 20);
    expect(interestsService.listConnections).toHaveBeenNthCalledWith(2, A.userId, 40, 50);
  });
});
