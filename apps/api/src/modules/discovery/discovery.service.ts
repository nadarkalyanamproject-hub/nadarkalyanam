import { Injectable } from '@nestjs/common';
import type { SearchProfileResult, SearchProfilesQuery, SearchProfilesResponse } from '@nadar-kalyanam/schemas';
import { calculateAge } from '../../common/age.js';
import {
  WITH_PHOTO_WHERE,
  getCallerLocation,
  joinedWithinWhere,
  nearbyWhere,
  parseHeightCm,
  parseIncomeLakhs,
  rangesOverlap,
} from '../../common/profile-filters.js';
import { visibleProfilesWhere } from '../../common/profile-cards.js';
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

// City, education, profession, mother tongue, religion, caste, employment
// type and country are free text at onboarding, so they're matched against
// the WHOLE stored value, ignoring case and surrounding spaces ("madurai"
// finds "Madurai") — never a partial/substring match. Marital status,
// physical status, dosham and family status are enums: exact match.
function detailFilters(query: SearchProfilesQuery): Prisma.ProfileWhereInput[] {
  const filters: Prisma.ProfileWhereInput[] = [];
  const text = (path: string[], value: string | undefined) => {
    const trimmed = value?.trim();
    if (trimmed) filters.push({ details: { path, equals: trimmed, mode: 'insensitive' } });
  };
  const exact = (path: string[], value: string | undefined) => {
    if (value) filters.push({ details: { path, equals: value } });
  };
  text(['location', 'city'], query.city);
  text(['education', 'educationLevel'], query.educationLevel);
  text(['education', 'profession'], query.profession);
  exact(['maritalStatus'], query.maritalStatus);
  text(['motherTongue'], query.motherTongue);
  exact(['physicalStatus'], query.physicalStatus);
  text(['religion'], query.religion);
  text(['casteCommunity'], query.casteCommunity);
  exact(['dosham'], query.dosham);
  text(['education', 'employedIn'], query.employedIn);
  exact(['additional', 'familyType'], query.familyType);
  text(['location', 'country'], query.country);
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
    const visible = await visibleProfilesWhere(this.prisma, callerUserId);
    const dobRange = ageRangeToDobRange(query.ageMin, query.ageMax);
    const details = detailFilters(query);

    if (query.nearby) {
      const sameLocation = nearbyWhere(await getCallerLocation(this.prisma, callerUserId));
      // A caller with no stored location has nobody nearby, as on Matches.
      if (!sameLocation) return { items: [], nextCursor: null, total: 0 };
      details.push(sameLocation);
    }
    if (query.joinedWithinDays) details.push(joinedWithinWhere(query.joinedWithinDays));
    if (query.withPhoto) details.push(WITH_PHOTO_WHERE);
    if (query.verified) details.push({ isVerified: true });
    if (query.excludeShortlisted) {
      const shortlisted = await this.prisma.shortlist.findMany({
        where: { memberId: callerUserId },
        select: { profileId: true },
      });
      details.push({ id: { notIn: shortlisted.map((row) => row.profileId) } });
    }
    const parsedIds = await this.idsMatchingParsedRanges(query);
    if (parsedIds) details.push({ id: { in: parsedIds } });

    const where: Prisma.ProfileWhereInput = {
      ...(Object.keys(dobRange).length > 0 ? { dateOfBirth: dobRange } : {}),
      ...(query.gender ? { gender: query.gender } : {}),
      // Every `details` filter targets the same JSON column, so each must be
      // its own AND entry — as sibling `details:` keys they overwrote each
      // other and only the last filter applied. The same goes for the
      // several `id` filters (shortlist exclusion, height/income ranges).
      // The shared visibility rule (visibleProfilesWhere) is one more AND
      // entry, so it can't be overwritten by a filter either.
      AND: [visible, ...details],
    };
    const total = await this.prisma.profile.count({ where });

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

    return { items, nextCursor: hasMore ? (page[page.length - 1]?.id ?? null) : null, total };
  }

  // Height and income are stored as text, so a range can't be a JSON-path
  // comparison: every profile's value is parsed here and the matching ids
  // become an id filter. Null when neither range is requested. This scans
  // all profiles — fine at the current size; a numeric column is the fix
  // once that stops being true.
  private async idsMatchingParsedRanges(query: SearchProfilesQuery): Promise<string[] | null> {
    const height = query.heightMinCm !== undefined || query.heightMaxCm !== undefined;
    const income = query.incomeMinLakhs !== undefined || query.incomeMaxLakhs !== undefined;
    if (!height && !income) return null;

    const rows = await this.prisma.profile.findMany({ select: { id: true, details: true } });
    return rows
      .filter((row) => {
        const details = row.details as { height?: unknown; education?: { annualIncomeRange?: unknown } } | null;
        if (height) {
          const cm = parseHeightCm(details?.height);
          if (cm === null || !rangesOverlap({ min: cm, max: cm }, query.heightMinCm, query.heightMaxCm)) return false;
        }
        if (income) {
          const lakhs = parseIncomeLakhs(details?.education?.annualIncomeRange);
          if (lakhs === null || !rangesOverlap(lakhs, query.incomeMinLakhs, query.incomeMaxLakhs)) return false;
        }
        return true;
      })
      .map((row) => row.id);
  }
}
