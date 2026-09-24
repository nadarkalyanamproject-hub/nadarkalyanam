import { Injectable } from '@nestjs/common';
import type { SearchProfileResult, SearchProfilesQuery, SearchProfilesResponse } from '@nadar-kalyanam/schemas';
import { calculateAge } from '../../common/age.js';
import { getBlockedUserIds } from '../../common/blocks.util.js';
import type { Prisma } from '../../generated/prisma/client.js';
import { PhotosService } from '../photos/photos.service.js';
import { PrismaService } from '../prisma/prisma.service.js';

// ageMin/ageMax arrive as whole years; converted to a dateOfBirth range since
// age itself isn't a stored column. ageMax=30 means "up to and including 30",
// so the lower dateOfBirth bound is exclusive of turning (ageMax + 1).
function ageRangeToDobRange(ageMin?: number, ageMax?: number): { gte?: Date; lte?: Date } {
  const now = new Date();
  const range: { gte?: Date; lte?: Date } = {};
  if (ageMax !== undefined) {
    range.gte = new Date(Date.UTC(now.getUTCFullYear() - ageMax - 1, now.getUTCMonth(), now.getUTCDate() + 1));
  }
  if (ageMin !== undefined) {
    range.lte = new Date(Date.UTC(now.getUTCFullYear() - ageMin, now.getUTCMonth(), now.getUTCDate()));
  }
  return range;
}

@Injectable()
export class DiscoveryService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly photosService: PhotosService,
  ) {}

  // FR-3.1/FR-3.2/FR-3.4/NFR-1.3: filtered, cursor-paginated search that
  // excludes hidden, blocked (either direction), non-active-account and
  // self profiles before any ranking is applied.
  async search(callerUserId: string, query: SearchProfilesQuery): Promise<SearchProfilesResponse> {
    const blockedUserIds = await getBlockedUserIds(this.prisma, callerUserId);
    const dobRange = ageRangeToDobRange(query.ageMin, query.ageMax);

    const where: Prisma.ProfileWhereInput = {
      visibility: { not: 'HIDDEN' },
      userId: { notIn: [callerUserId, ...blockedUserIds] },
      user: { status: 'ACTIVE' },
      ...(Object.keys(dobRange).length > 0 ? { dateOfBirth: dobRange } : {}),
      ...(query.city ? { details: { path: ['location', 'city'], equals: query.city } } : {}),
      ...(query.educationLevel
        ? { details: { path: ['education', 'educationLevel'], equals: query.educationLevel } }
        : {}),
      ...(query.profession ? { details: { path: ['education', 'profession'], equals: query.profession } } : {}),
      ...(query.maritalStatus ? { details: { path: ['maritalStatus'], equals: query.maritalStatus } } : {}),
    };

    const profiles = await this.prisma.profile.findMany({
      where,
      orderBy: { id: 'asc' },
      ...(query.cursor ? { cursor: { id: query.cursor }, skip: 1 } : {}),
      take: query.limit + 1,
    });

    const hasMore = profiles.length > query.limit;
    const page = hasMore ? profiles.slice(0, query.limit) : profiles;

    const items: SearchProfileResult[] = await Promise.all(
      page.map(async (profile) => {
        const photos = await this.photosService.getPhotosForProfile(profile.id);
        const primaryPhotoUrl = photos.find((photo) => photo.isPrimary)?.url ?? photos[0]?.url ?? null;
        const details = profile.details as { location?: { city?: string } } | null;
        return {
          profileId: profile.id,
          fullName: profile.fullName,
          age: calculateAge(profile.dateOfBirth),
          city: details?.location?.city ?? null,
          primaryPhotoUrl,
          isVerified: profile.isVerified,
        };
      }),
    );

    return { items, nextCursor: hasMore ? (page[page.length - 1]?.id ?? null) : null };
  }
}
