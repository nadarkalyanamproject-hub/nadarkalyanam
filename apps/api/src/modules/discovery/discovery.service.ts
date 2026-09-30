import { Injectable } from '@nestjs/common';
import type { SearchProfileResult, SearchProfilesQuery, SearchProfilesResponse } from '@nadar-kalyanam/schemas';
import { calculateAge } from '../../common/age.js';
import { getBlockedUserIds } from '../../common/blocks.util.js';
import { getRelationshipStates, relationshipFields } from '../../common/relationship.js';
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

// City, education and profession are free text at onboarding, so they're
// matched against the WHOLE stored value, ignoring case and surrounding
// spaces ("madurai" finds "Madurai") — never a partial/substring match.
// maritalStatus is an enum and stays an exact match.
function detailFilters(query: SearchProfilesQuery): Prisma.ProfileWhereInput[] {
  const filters: Prisma.ProfileWhereInput[] = [];
  const text = (path: string[], value: string | undefined) => {
    const trimmed = value?.trim();
    if (trimmed) filters.push({ details: { path, equals: trimmed, mode: 'insensitive' } });
  };
  text(['location', 'city'], query.city);
  text(['education', 'educationLevel'], query.educationLevel);
  text(['education', 'profession'], query.profession);
  if (query.maritalStatus) filters.push({ details: { path: ['maritalStatus'], equals: query.maritalStatus } });
  return filters;
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
    const details = detailFilters(query);

    const where: Prisma.ProfileWhereInput = {
      visibility: { not: 'HIDDEN' },
      userId: { notIn: [callerUserId, ...blockedUserIds] },
      user: { status: 'ACTIVE' },
      ...(Object.keys(dobRange).length > 0 ? { dateOfBirth: dobRange } : {}),
      ...(query.gender ? { gender: query.gender } : {}),
      // Every `details` filter targets the same JSON column, so each must be
      // its own AND entry — as sibling `details:` keys they overwrote each
      // other and only the last filter applied.
      ...(details.length > 0 ? { AND: details } : {}),
    };

    // 'newest' has no cursor-pagination guarantee (createdAt ties aren't
    // disambiguated) — acceptable for its one caller, an unpaginated
    // "recently joined" preview strip; a real paginated newest-sort would
    // need a compound (createdAt, id) cursor instead.
    const profiles = await this.prisma.profile.findMany({
      where,
      orderBy: query.sort === 'newest' ? { createdAt: 'desc' } : { id: 'asc' },
      ...(query.cursor && query.sort === 'id' ? { cursor: { id: query.cursor }, skip: 1 } : {}),
      take: query.limit + 1,
    });

    const hasMore = profiles.length > query.limit;
    const page = hasMore ? profiles.slice(0, query.limit) : profiles;
    // Connected members stay in results (labeled, not excluded) so ranking
    // and cursor pagination are unaffected. One batched query per page.
    const relationships = await getRelationshipStates(
      this.prisma,
      callerUserId,
      page.map((profile) => profile.userId),
    );

    const items: SearchProfileResult[] = await Promise.all(
      page.map(async (profile) => {
        const photos = await this.photosService.getPhotosForProfile(profile.id);
        const primaryPhotoUrl = photos.find((photo) => photo.isPrimary)?.url ?? photos[0]?.url ?? null;
        const profileDetails = profile.details as { location?: { city?: string } } | null;
        return {
          profileId: profile.id,
          fullName: profile.fullName,
          age: calculateAge(profile.dateOfBirth),
          city: profileDetails?.location?.city ?? null,
          primaryPhotoUrl,
          isVerified: profile.isVerified,
          ...relationshipFields(relationships.get(profile.userId)),
        };
      }),
    );

    return { items, nextCursor: hasMore ? (page[page.length - 1]?.id ?? null) : null };
  }
}
