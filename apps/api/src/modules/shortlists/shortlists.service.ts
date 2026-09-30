import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import type { ProfileCardListResponse, ShortlistResponse, ShortlistStatusResponse } from '@nadar-kalyanam/schemas';
import { isBlockedEitherDirection } from '../../common/blocks.util.js';
import { inKeyOrder, toProfileCards, visibleProfilesWhere } from '../../common/profile-cards.js';
import { Prisma } from '../../generated/prisma/client.js';
import { PhotosService } from '../photos/photos.service.js';
import { PrismaService } from '../prisma/prisma.service.js';

// Shortlist rows are keyed by the member's USER id (memberId) and the
// shortlisted PROFILE id. Shortlisting is private bookkeeping: it sends no
// notification. Both lists apply the app-wide exclusion rules at read time,
// so a member who is later blocked, hidden or deactivated simply drops out.
const LIST_LIMIT = 50;

@Injectable()
export class ShortlistsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly photosService: PhotosService,
  ) {}

  async add(callerUserId: string, profileId: string): Promise<ShortlistResponse> {
    await this.getOwnProfileOrThrow(callerUserId);
    const target = await this.prisma.profile.findUnique({
      where: { id: profileId },
      include: { user: { select: { status: true } } },
    });
    if (!target) throw new NotFoundException('Profile not found');
    if (target.userId === callerUserId) {
      throw new BadRequestException("You can't shortlist your own profile");
    }
    // Hidden, deactivated and blocked profiles look identical to a missing
    // one — never confirm *why* a profile can't be shortlisted.
    if (
      target.visibility === 'HIDDEN' ||
      target.user.status !== 'ACTIVE' ||
      (await isBlockedEitherDirection(this.prisma, callerUserId, target.userId))
    ) {
      throw new NotFoundException('Profile not found');
    }

    try {
      const row = await this.prisma.shortlist.create({ data: { memberId: callerUserId, profileId } });
      return { id: row.id, profileId: row.profileId, createdAt: row.createdAt.toISOString() };
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictException('This profile is already in your shortlist');
      }
      throw error;
    }
  }

  async remove(callerUserId: string, profileId: string): Promise<void> {
    const { count } = await this.prisma.shortlist.deleteMany({ where: { memberId: callerUserId, profileId } });
    if (count === 0) throw new NotFoundException('This profile is not in your shortlist');
  }

  async status(callerUserId: string, profileId: string): Promise<ShortlistStatusResponse> {
    const row = await this.prisma.shortlist.findUnique({
      where: { memberId_profileId: { memberId: callerUserId, profileId } },
    });
    return { shortlisted: Boolean(row) };
  }

  // "Shortlisted by you": most recently shortlisted first.
  async listMine(callerUserId: string): Promise<ProfileCardListResponse> {
    const rows = await this.prisma.shortlist.findMany({
      where: { memberId: callerUserId },
      orderBy: { createdAt: 'desc' },
      select: { profileId: true },
    });
    const profileIds = rows.map((row) => row.profileId);
    const profiles = await this.prisma.profile.findMany({
      where: { AND: [await visibleProfilesWhere(this.prisma, callerUserId), { id: { in: profileIds } }] },
    });
    const ordered = inKeyOrder(profiles, profileIds, (profile) => profile.id).slice(0, LIST_LIMIT);
    return { items: await toProfileCards(this.prisma, this.photosService, callerUserId, ordered) };
  }

  // "Shortlisted you": members who shortlisted the caller's profile, most
  // recent first.
  async listShortlistedMe(callerUserId: string): Promise<ProfileCardListResponse> {
    const own = await this.getOwnProfileOrThrow(callerUserId);
    const rows = await this.prisma.shortlist.findMany({
      where: { profileId: own.id },
      orderBy: { createdAt: 'desc' },
      select: { memberId: true },
    });
    const memberIds = rows.map((row) => row.memberId);
    const profiles = await this.prisma.profile.findMany({
      where: { AND: [await visibleProfilesWhere(this.prisma, callerUserId), { userId: { in: memberIds } }] },
    });
    const ordered = inKeyOrder(profiles, memberIds, (profile) => profile.userId).slice(0, LIST_LIMIT);
    return { items: await toProfileCards(this.prisma, this.photosService, callerUserId, ordered) };
  }

  private async getOwnProfileOrThrow(userId: string) {
    const profile = await this.prisma.profile.findUnique({ where: { userId } });
    if (!profile) throw new BadRequestException('Complete your profile before using the shortlist');
    return profile;
  }
}
