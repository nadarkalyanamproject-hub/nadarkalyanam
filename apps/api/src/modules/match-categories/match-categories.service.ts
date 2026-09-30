import { Injectable } from '@nestjs/common';
import type { NearbyMatchesResponse, ProfileCardListResponse } from '@nadar-kalyanam/schemas';
import { inKeyOrder, toProfileCards, visibleProfilesWhere } from '../../common/profile-cards.js';
import { PhotosService } from '../photos/photos.service.js';
import { PrismaService } from '../prisma/prisma.service.js';

// Real-data Matches categories. "Your Matches" is GET /matches and the two
// shortlist categories live in ShortlistsService; everything else is here.
// Every list applies the app-wide exclusion rules (visibleProfilesWhere) and
// returns at most LIST_LIMIT cards — there is no pagination yet.
export const LIST_LIMIT = 50;
export const NEWLY_JOINED_DAYS = 30;
// Profile views are read from PROFILE_VIEWED notifications, which hold one
// row per viewer -> viewed pair; this caps how many rows are scanned.
const VIEW_SCAN_LIMIT = 500;

@Injectable()
export class MatchCategoriesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly photosService: PhotosService,
  ) {}

  // Profiles created in the last 30 days, newest first.
  async newlyJoined(callerUserId: string, now = new Date()): Promise<ProfileCardListResponse> {
    const since = new Date(now.getTime() - NEWLY_JOINED_DAYS * 24 * 60 * 60 * 1000);
    const profiles = await this.prisma.profile.findMany({
      where: { AND: [await visibleProfilesWhere(this.prisma, callerUserId), { createdAt: { gte: since } }] },
      orderBy: { createdAt: 'desc' },
      take: LIST_LIMIT,
    });
    return this.cards(callerUserId, profiles);
  }

  // No geolocation exists: "nearby" means the same city or the same state as
  // the caller's own stored location (whole value, case-insensitive), with
  // same-city members first.
  async nearby(callerUserId: string): Promise<NearbyMatchesResponse> {
    const own = await this.prisma.profile.findUnique({ where: { userId: callerUserId } });
    const location = (own?.details as { location?: { city?: string; state?: string } } | null)?.location;
    const city = location?.city?.trim() || null;
    const state = location?.state?.trim() || null;
    if (!city && !state) return { items: [], city, state };

    const sameLocation = [
      ...(city ? [{ details: { path: ['location', 'city'], equals: city, mode: 'insensitive' as const } }] : []),
      ...(state ? [{ details: { path: ['location', 'state'], equals: state, mode: 'insensitive' as const } }] : []),
    ];
    const profiles = await this.prisma.profile.findMany({
      where: { AND: [await visibleProfilesWhere(this.prisma, callerUserId), { OR: sameLocation }] },
      orderBy: { createdAt: 'desc' },
      take: LIST_LIMIT * 2,
    });
    const inMyCity = (details: unknown) =>
      Boolean(city) &&
      ((details as { location?: { city?: string } } | null)?.location?.city ?? '').trim().toLowerCase() ===
        city!.toLowerCase();
    const sorted = [...profiles.filter((p) => inMyCity(p.details)), ...profiles.filter((p) => !inMyCity(p.details))];
    const { items } = await this.cards(callerUserId, sorted.slice(0, LIST_LIMIT));
    return { items, city, state };
  }

  // Members with at least one photo, newest first.
  async withPhotos(callerUserId: string): Promise<ProfileCardListResponse> {
    const profiles = await this.prisma.profile.findMany({
      where: { AND: [await visibleProfilesWhere(this.prisma, callerUserId), { photos: { some: {} } }] },
      orderBy: { createdAt: 'desc' },
      take: LIST_LIMIT,
    });
    return this.cards(callerUserId, profiles);
  }

  // "Viewed you": each member who viewed the caller's profile, once, most
  // recent view first.
  async viewedMe(callerUserId: string): Promise<ProfileCardListResponse> {
    const rows = await this.prisma.notification.findMany({
      where: { userId: callerUserId, type: 'PROFILE_VIEWED', actorUserId: { not: null } },
      orderBy: { createdAt: 'desc' },
      take: VIEW_SCAN_LIMIT,
      select: { actorUserId: true },
    });
    return this.cardsForUsers(callerUserId, distinct(rows.map((row) => row.actorUserId!)));
  }

  // "Viewed by you": each member whose profile the caller viewed, once, most
  // recent view first.
  async viewedByMe(callerUserId: string): Promise<ProfileCardListResponse> {
    const rows = await this.prisma.notification.findMany({
      where: { actorUserId: callerUserId, type: 'PROFILE_VIEWED' },
      orderBy: { createdAt: 'desc' },
      take: VIEW_SCAN_LIMIT,
      select: { userId: true },
    });
    return this.cardsForUsers(callerUserId, distinct(rows.map((row) => row.userId)));
  }

  private async cardsForUsers(callerUserId: string, orderedUserIds: string[]): Promise<ProfileCardListResponse> {
    const profiles = await this.prisma.profile.findMany({
      where: { AND: [await visibleProfilesWhere(this.prisma, callerUserId), { userId: { in: orderedUserIds } }] },
    });
    const ordered = inKeyOrder(profiles, orderedUserIds, (profile) => profile.userId).slice(0, LIST_LIMIT);
    return this.cards(callerUserId, ordered);
  }

  private async cards(callerUserId: string, profiles: Parameters<typeof toProfileCards>[3]) {
    return { items: await toProfileCards(this.prisma, this.photosService, callerUserId, profiles) };
  }
}

function distinct(ids: string[]): string[] {
  return [...new Set(ids)];
}
