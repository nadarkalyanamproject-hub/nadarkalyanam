import { Injectable, NotFoundException } from '@nestjs/common';
import type { ListMatchesResponse } from '@nadar-kalyanam/schemas';
import { visibleProfilesWhere } from '../../common/profile-cards.js';
import { getRelationshipStates, relationshipFields } from '../../common/relationship.js';
import { calculateAge } from '../../common/age.js';
import { mustHaveFilters } from '../../common/preference-fit.js';
import type { Prisma } from '../../generated/prisma/client.js';
import { PartnerPreferencesService } from '../partner-preferences/partner-preferences.service.js';
import { PhotosService } from '../photos/photos.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { MatchingEngine, SCORING_CONFIG_VERSION } from './matching-engine.js';

@Injectable()
export class MatchingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly photosService: PhotosService,
    private readonly partnerPreferences: PartnerPreferencesService,
  ) {}

  // FR-3.3/3.4: ranked recommendations, cursor-paginated in principle — a
  // full candidate scan is acceptable at v0 scale; see NFR-2.3 (10x launch
  // peak load testing) for when this needs a pre-filtered candidate set
  // instead of scoring the whole eligible pool per request.
  async listMatches(callerUserId: string, limit: number): Promise<ListMatchesResponse> {
    const viewerProfile = await this.prisma.profile.findUnique({ where: { userId: callerUserId } });
    if (!viewerProfile) {
      throw new NotFoundException('Create your profile before viewing matches');
    }

    // Must-have preferences (age, marital status, location) are filters on
    // top of the shared visibility rule — they can only remove candidates,
    // never add hidden or blocked ones. Applied in the query, before the
    // candidate cap, so they never shrink an arbitrary 200-row sample.
    const preferences = await this.partnerPreferences.findForUser(callerUserId);
    const visible = await visibleProfilesWhere(this.prisma, callerUserId);
    const mustHave = preferences ? mustHaveFilters(preferences) : { keys: [], where: [] };
    const where: Prisma.ProfileWhereInput = mustHave.where.length > 0 ? { AND: [visible, ...mustHave.where] } : visible;

    const candidates = await this.prisma.profile.findMany({ where, take: 200 });
    // How many members the must-haves are holding back, so an empty (or
    // short) list can say so instead of looking like nobody exists.
    const hiddenByMustHave =
      mustHave.where.length > 0
        ? Math.max(0, (await this.prisma.profile.count({ where: visible })) - (await this.prisma.profile.count({ where })))
        : 0;

    const ranked = MatchingEngine.rankCandidates(viewerProfile, candidates, preferences).slice(0, limit);
    // Connected members are kept in the ranking (labeled, not excluded).
    const relationships = await getRelationshipStates(
      this.prisma,
      callerUserId,
      ranked.map(({ profile }) => profile.userId),
    );

    const items = await Promise.all(
      ranked.map(async ({ profile, score }) => {
        const photos = await this.photosService.getPhotosForProfile(profile.id);
        const primaryPhotoUrl = photos.find((photo) => photo.isPrimary)?.url ?? photos[0]?.url ?? null;
        const details = profile.details as {
          location?: { city?: string };
          education?: { profession?: string };
          religion?: string;
        } | null;
        return {
          profileId: profile.id,
          fullName: profile.fullName,
          age: calculateAge(profile.dateOfBirth),
          city: details?.location?.city ?? null,
          primaryPhotoUrl,
          isVerified: profile.isVerified,
          profession: details?.education?.profession || null,
          religion: details?.religion || null,
          score,
          ...relationshipFields(relationships.get(profile.userId)),
        };
      }),
    );

    return {
      items,
      scoringVersion: SCORING_CONFIG_VERSION,
      preferences: { hasPreferences: preferences !== null, mustHave: mustHave.keys, hiddenByMustHave },
    };
  }
}
