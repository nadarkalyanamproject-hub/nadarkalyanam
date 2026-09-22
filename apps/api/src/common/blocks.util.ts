import type { PrismaService } from '../modules/prisma/prisma.service.js';

// Block rows are directional (initiatorId -> targetId), but a block must
// exclude visibility/interaction both ways regardless of who created it.

export async function isBlockedEitherDirection(
  prisma: PrismaService,
  userIdA: string,
  userIdB: string,
): Promise<boolean> {
  const block = await prisma.block.findFirst({
    where: {
      OR: [
        { initiatorId: userIdA, targetId: userIdB },
        { initiatorId: userIdB, targetId: userIdA },
      ],
    },
  });
  return Boolean(block);
}

export async function getBlockedUserIds(prisma: PrismaService, userId: string): Promise<Set<string>> {
  const blocks = await prisma.block.findMany({
    where: { OR: [{ initiatorId: userId }, { targetId: userId }] },
    select: { initiatorId: true, targetId: true },
  });
  const blockedUserIds = new Set<string>();
  for (const block of blocks) {
    blockedUserIds.add(block.initiatorId === userId ? block.targetId : block.initiatorId);
  }
  return blockedUserIds;
}
