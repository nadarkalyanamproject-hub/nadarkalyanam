import { Injectable, NotFoundException } from '@nestjs/common';
import type { ListMatchesResponse } from '@nadar-kalyanam/schemas';
import { getBlockedUserIds } from '../../common/blocks.util.js';
import { calculateAge } from '../../common/age.js';
import { PhotosService } from '../photos/photos.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { MatchingEngine, SCORING_CONFIG_VERSION } from './matching-engine.js';

@Injectable()
export class MatchingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly photosService: PhotosService,
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

    const blockedUserIds = await getBlockedUserIds(this.prisma, callerUserId);
    const candidates = await this.prisma.profile.findMany({
      where: {
        visibility: { not: 'HIDDEN' },
        userId: { notIn: [callerUserId, ...blockedUserIds] },
        user: { status: 'ACTIVE' },
      },
      take: 200,
    });

    const ranked = MatchingEngine.rankCandidates(viewerProfile, candidates).slice(0, limit);

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
        };
      }),
    );

    return { items, scoringVersion: SCORING_CONFIG_VERSION };
  }
}
