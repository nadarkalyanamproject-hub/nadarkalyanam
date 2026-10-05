import { Injectable, NotFoundException } from '@nestjs/common';
import type { BlockedMembersResponse } from '@nadar-kalyanam/schemas';
import { PhotosService } from '../photos/photos.service.js';
import { PrismaService } from '../prisma/prisma.service.js';

// The member-facing side of blocks beyond creating one (ModerationService.
// block): resolving a profile to its member, listing whom the caller has
// blocked, and undoing a block. What a block hides is decided elsewhere, by
// the existing rules (visibleProfilesWhere, the interests/messages checks).
@Injectable()
export class BlocksService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly photosService: PhotosService,
  ) {}

  async userIdForProfile(profileId: string): Promise<string> {
    const profile = await this.prisma.profile.findUnique({ where: { id: profileId }, select: { userId: true } });
    if (!profile) throw new NotFoundException('Profile not found');
    return profile.userId;
  }

  // Only blocks the caller made. Photos are the approved ones, as anywhere
  // another member's photo is shown.
  async listBlockedByCaller(callerUserId: string): Promise<BlockedMembersResponse> {
    const blocks = await this.prisma.block.findMany({
      where: { initiatorId: callerUserId },
      orderBy: { createdAt: 'desc' },
      include: { target: { select: { id: true, status: true, profile: true } } },
    });
    const items = await Promise.all(
      blocks.map(async (block) => {
        const profile = block.target.profile;
        const available = block.target.status !== 'DELETED' && profile;
        const photos = available ? await this.photosService.getPhotosForProfile(profile.id) : [];
        return {
          userId: block.targetId,
          profileId: available ? profile.id : null,
          fullName: available ? profile.fullName : 'Deleted member',
          primaryPhotoUrl: photos.find((photo) => photo.isPrimary)?.url ?? photos[0]?.url ?? null,
          blockedAt: block.createdAt.toISOString(),
        };
      }),
    );
    return { items };
  }

  // Removes the caller's own block. If the other member has also blocked
  // the caller, that block stays and the pair stays hidden from each other.
  async unblock(callerUserId: string, targetUserId: string): Promise<void> {
    const { count } = await this.prisma.block.deleteMany({ where: { initiatorId: callerUserId, targetId: targetUserId } });
    if (count === 0) throw new NotFoundException('You have not blocked this member');
  }
}
