import { NotFoundException } from '@nestjs/common';
import { blockRequestSchema } from '@nadar-kalyanam/schemas';
import { describe, expect, it, vi } from 'vitest';
import { BlocksService } from './blocks.service.js';

/* eslint-disable @typescript-eslint/no-explicit-any */
function buildService(blocks: { initiatorId: string; targetId: string; createdAt: Date }[]) {
  const users: Record<string, { id: string; status: string; profile: { id: string; fullName: string } | null }> = {
    'user-b': { id: 'user-b', status: 'ACTIVE', profile: { id: 'profile-b', fullName: 'Bala' } },
    'user-c': { id: 'user-c', status: 'DELETED', profile: { id: 'profile-c', fullName: 'Deleted member' } },
  };
  const prisma = {
    profile: {
      findUnique: vi.fn(async ({ where }: any) =>
        Object.values(users).find((u) => u.profile?.id === where.id) ? { userId: Object.values(users).find((u) => u.profile?.id === where.id)!.id } : null,
      ),
    },
    block: {
      findMany: vi.fn(async ({ where }: any) =>
        blocks
          .filter((b) => b.initiatorId === where.initiatorId)
          .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
          .map((b) => ({ ...b, target: users[b.targetId] })),
      ),
      deleteMany: vi.fn(async ({ where }: any) => {
        const before = blocks.length;
        blocks.splice(0, blocks.length, ...blocks.filter((b) => !(b.initiatorId === where.initiatorId && b.targetId === where.targetId)));
        return { count: before - blocks.length };
      }),
    },
  };
  const photosService = { getPhotosForProfile: vi.fn().mockResolvedValue([{ id: 'ph', url: 'https://x/ph.jpg', isPrimary: true }]) };
  return { service: new BlocksService(prisma as never, photosService as never), blocks, photosService };
}

describe('BlocksService', () => {
  it('lists only the blocks the caller made, newest first, with approved-photo lookup', async () => {
    const { service, photosService } = buildService([
      { initiatorId: 'me', targetId: 'user-b', createdAt: new Date('2026-10-01') },
      { initiatorId: 'me', targetId: 'user-c', createdAt: new Date('2026-10-03') },
      { initiatorId: 'user-b', targetId: 'me', createdAt: new Date('2026-10-04') },
    ]);

    const { items } = await service.listBlockedByCaller('me');

    expect(items).toEqual([
      { userId: 'user-c', profileId: null, fullName: 'Deleted member', primaryPhotoUrl: null, blockedAt: '2026-10-03T00:00:00.000Z' },
      { userId: 'user-b', profileId: 'profile-b', fullName: 'Bala', primaryPhotoUrl: 'https://x/ph.jpg', blockedAt: '2026-10-01T00:00:00.000Z' },
    ]);
    // Default (approved-only) photo lookup, as for any other member.
    expect(photosService.getPhotosForProfile).toHaveBeenCalledWith('profile-b');
  });

  it("unblock removes only the caller's own block — the other member's block on them stays", async () => {
    const { service, blocks } = buildService([
      { initiatorId: 'me', targetId: 'user-b', createdAt: new Date() },
      { initiatorId: 'user-b', targetId: 'me', createdAt: new Date() },
    ]);

    await service.unblock('me', 'user-b');

    expect(blocks).toEqual([expect.objectContaining({ initiatorId: 'user-b', targetId: 'me' })]);
  });

  it('unblocking someone the caller never blocked is a 404', async () => {
    const { service } = buildService([{ initiatorId: 'user-b', targetId: 'me', createdAt: new Date() }]);
    await expect(service.unblock('me', 'user-b')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('resolves a profile id (profile page Block button) to the member to block', async () => {
    const { service } = buildService([]);
    await expect(service.userIdForProfile('profile-b')).resolves.toBe('user-b');
    await expect(service.userIdForProfile('nope')).rejects.toBeInstanceOf(NotFoundException);
  });
});

describe('blockRequestSchema', () => {
  it('takes exactly one of targetUserId / targetProfileId', () => {
    expect(blockRequestSchema.safeParse({ targetUserId: 'u' }).success).toBe(true);
    expect(blockRequestSchema.safeParse({ targetProfileId: 'p' }).success).toBe(true);
    expect(blockRequestSchema.safeParse({}).success).toBe(false);
    expect(blockRequestSchema.safeParse({ targetUserId: 'u', targetProfileId: 'p' }).success).toBe(false);
  });
});
