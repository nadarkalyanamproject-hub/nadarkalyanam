import { randomUUID } from 'node:crypto';
import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import type {
  GeneratedHoroscope,
  HoroscopeChart,
  HoroscopeView,
  MyHoroscope,
  MyHoroscopeResponse,
  RelationshipStatus,
  UpdateHoroscopeRequest,
} from '@nadar-kalyanam/schemas';
import { photoStatus } from '../../common/photo-visibility.js';
import type { ProfileHoroscope } from '../../generated/prisma/client.js';
import { PhotosService } from '../photos/photos.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { StorageService } from '../storage/storage.service.js';
import { generateHoroscope } from './jathagam.js';

const CHART_EXTENSIONS: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
};

const DETAIL_FIELDS = [
  'birthTime',
  'birthCity',
  'birthState',
  'birthCountry',
  'rasi',
  'nakshatra',
  'nakshatraPada',
  'lagnam',
  'sevvaiDosham',
  'raguKethuDosham',
] as const;

// Has the member entered anything (details or a chart)? Used for the
// optional completion item — the visibility setting doesn't matter, so
// keeping it hidden isn't penalised.
export function hasHoroscopeContent(row: ProfileHoroscope | null): boolean {
  if (!row) return false;
  return Boolean(row.chartObjectKey) || DETAIL_FIELDS.some((key) => row[key] !== null && row[key] !== '');
}

// The chart worked out from the birth details, or null without them.
export function generatedFor(row: ProfileHoroscope, dateOfBirth: Date | null | undefined): GeneratedHoroscope | null {
  return dateOfBirth ? generateHoroscope({ dateOfBirth, ...row }) : null;
}

// What matching uses: the details the member entered, else the ones worked
// out from their birth details.
export function effectiveStars(row: ProfileHoroscope, dateOfBirth: Date | null | undefined) {
  const generated = generatedFor(row, dateOfBirth);
  return {
    rasi: (row.rasi ?? generated?.rasi ?? null) as GeneratedHoroscope['rasi'] | null,
    nakshatra: (row.nakshatra ?? generated?.nakshatra ?? null) as GeneratedHoroscope['nakshatra'] | null,
  };
}

// Can this viewer see the horoscope at all? The caller has already applied
// the profile visibility rule (visibleProfilesWhere) for the pair.
export function canViewHoroscope(visibility: ProfileHoroscope['visibility'], relationship: RelationshipStatus | undefined): boolean {
  if (visibility === 'EVERYONE') return true;
  if (visibility === 'CONNECTED') return relationship === 'CONNECTED';
  return false;
}

@Injectable()
export class HoroscopeService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    private readonly photos: PhotosService,
  ) {}

  private async ownProfile(userId: string): Promise<{ id: string; dateOfBirth?: Date }> {
    const profile = await this.prisma.profile.findUnique({
      where: { userId },
      select: { id: true, dateOfBirth: true },
    });
    if (!profile) throw new NotFoundException('Create your profile first');
    return profile;
  }

  private async ownProfileId(userId: string): Promise<string> {
    return (await this.ownProfile(userId)).id;
  }

  private async chartFor(row: ProfileHoroscope): Promise<HoroscopeChart | null> {
    if (!row.chartObjectKey) return null;
    return {
      url: await this.storage.getObjectUrl(row.chartObjectKey),
      status: photoStatus({
        isModerated: row.chartIsModerated,
        isApproved: row.chartIsApproved,
      }),
      rejectionReason: row.chartRejectionReason,
    };
  }

  // The full record, for its owner (and admins with members.view). With the
  // date of birth it includes the chart worked out from the birth details.
  async toFull(row: ProfileHoroscope, dateOfBirth: Date | null = null): Promise<MyHoroscope> {
    return {
      birthTime: row.birthTime,
      birthCity: row.birthCity,
      birthState: row.birthState,
      birthCountry: row.birthCountry,
      rasi: row.rasi as MyHoroscope['rasi'],
      nakshatra: row.nakshatra as MyHoroscope['nakshatra'],
      nakshatraPada: row.nakshatraPada,
      lagnam: row.lagnam as MyHoroscope['lagnam'],
      sevvaiDosham: row.sevvaiDosham as MyHoroscope['sevvaiDosham'],
      raguKethuDosham: row.raguKethuDosham as MyHoroscope['raguKethuDosham'],
      visibility: row.visibility,
      shareBirthDetails: row.shareBirthDetails,
      chart: await this.chartFor(row),
      generated: generatedFor(row, dateOfBirth),
      updatedAt: row.updatedAt.toISOString(),
    };
  }

  async getMine(userId: string): Promise<MyHoroscopeResponse> {
    const [row, profile] = await Promise.all([
      this.prisma.profileHoroscope.findFirst({ where: { profile: { userId } } }),
      this.prisma.profile.findUnique({ where: { userId }, select: { id: true, dateOfBirth: true } }),
    ]);
    return { horoscope: row ? await this.toFull(row, profile?.dateOfBirth) : null };
  }

  async findByProfileId(profileId: string): Promise<ProfileHoroscope | null> {
    return this.prisma.profileHoroscope.findUnique({ where: { profileId } });
  }

  async save(userId: string, input: UpdateHoroscopeRequest): Promise<MyHoroscopeResponse> {
    const profile = await this.ownProfile(userId);
    const row = await this.prisma.profileHoroscope.upsert({
      where: { profileId: profile.id },
      create: { profileId: profile.id, ...input },
      update: input,
    });
    return { horoscope: await this.toFull(row, profile.dateOfBirth) };
  }

  // What `viewerRelationship` lets another member see of this profile's
  // horoscope. Never called for lists. Birth time/place need the owner's
  // extra shareBirthDetails consent; the chart only once approved.
  async viewFor(profileId: string, viewerRelationship: RelationshipStatus | undefined, dateOfBirth?: Date): Promise<HoroscopeView> {
    const row = await this.findByProfileId(profileId);
    if (!row || !canViewHoroscope(row.visibility, viewerRelationship)) return { shared: false };
    // The worked-out chart, without the birth place unless that's shared too.
    const worked = generatedFor(row, dateOfBirth);
    const generated = worked && !row.shareBirthDetails ? { ...worked, place: null } : worked;
    const place = row.birthCity || row.birthState || row.birthCountry;
    const chartApproved = Boolean(row.chartObjectKey) && row.chartIsModerated && row.chartIsApproved;
    // Entered details first; the worked-out ones fill any left blank.
    return {
      shared: true,
      rasi: (row.rasi ?? generated?.rasi ?? null) as Extract<HoroscopeView, { shared: true }>['rasi'],
      nakshatra: (row.nakshatra ?? generated?.nakshatra ?? null) as Extract<HoroscopeView, { shared: true }>['nakshatra'],
      nakshatraPada: row.nakshatra ? row.nakshatraPada : (generated?.nakshatraPada ?? null),
      lagnam: (row.lagnam ?? generated?.lagnam ?? null) as Extract<HoroscopeView, { shared: true }>['lagnam'],
      sevvaiDosham: row.sevvaiDosham as Extract<HoroscopeView, { shared: true }>['sevvaiDosham'],
      raguKethuDosham: row.raguKethuDosham as Extract<HoroscopeView, { shared: true }>['raguKethuDosham'],
      birthTime: row.shareBirthDetails ? row.birthTime : null,
      birthPlace:
        row.shareBirthDetails && place
          ? {
              city: row.birthCity,
              state: row.birthState,
              country: row.birthCountry,
            }
          : null,
      chartImageUrl: chartApproved ? await this.storage.getObjectUrl(row.chartObjectKey!) : null,
      generated,
    };
  }

  // --- Chart image: same flow and moderation hold as profile photos -------

  async createChartUploadUrl(userId: string, contentType: string): Promise<{ uploadUrl: string; objectKey: string }> {
    const profileId = await this.ownProfileId(userId);
    const objectKey = `horoscopes/${profileId}/${randomUUID()}.${CHART_EXTENSIONS[contentType]}`;
    return {
      uploadUrl: await this.storage.createUploadUrl(objectKey, contentType),
      objectKey,
    };
  }

  // Replaces any earlier chart. Held for moderation like a photo (the same
  // PHOTO_MODERATION setting decides pending vs dev auto-approve).
  async confirmChart(userId: string, objectKey: string): Promise<MyHoroscopeResponse> {
    const profileId = await this.ownProfileId(userId);
    if (!objectKey.startsWith(`horoscopes/${profileId}/`)) {
      throw new BadRequestException('objectKey does not belong to this profile');
    }
    await this.storage.validateUploadedImage(objectKey);
    const autoApprove = this.photos.moderationMode() === 'auto_approve';
    const previous = await this.findByProfileId(profileId);
    const chart = {
      chartObjectKey: objectKey,
      chartIsModerated: autoApprove,
      chartIsApproved: autoApprove,
      chartRejectionReason: null,
      chartUploadedAt: new Date(),
    };
    const row = await this.prisma.profileHoroscope.upsert({
      where: { profileId },
      create: { profileId, ...chart },
      update: chart,
    });
    if (previous?.chartObjectKey && previous.chartObjectKey !== objectKey) await this.storage.deleteObject(previous.chartObjectKey);
    return { horoscope: await this.toFull(row) };
  }

  async deleteChart(userId: string): Promise<MyHoroscopeResponse> {
    const profileId = await this.ownProfileId(userId);
    const row = await this.findByProfileId(profileId);
    if (!row?.chartObjectKey) throw new NotFoundException('No chart image to remove');
    const updated = await this.prisma.profileHoroscope.update({
      where: { profileId },
      data: {
        chartObjectKey: null,
        chartIsModerated: false,
        chartIsApproved: false,
        chartRejectionReason: null,
        chartUploadedAt: null,
      },
    });
    await this.storage.deleteObject(row.chartObjectKey);
    return { horoscope: await this.toFull(updated) };
  }

  // Admin decision on a member's chart. Re-deciding is allowed.
  async moderateChart(
    userId: string,
    decision: { approve: true } | { approve: false; reason: string },
  ): Promise<{ profileId: string; chart: HoroscopeChart }> {
    const profileId = await this.ownProfileId(userId);
    const row = await this.findByProfileId(profileId);
    if (!row?.chartObjectKey) throw new NotFoundException('This member has no chart image');
    const updated = await this.prisma.profileHoroscope.update({
      where: { profileId },
      data: {
        chartIsModerated: true,
        chartIsApproved: decision.approve,
        chartRejectionReason: decision.approve ? null : decision.reason,
      },
    });
    return { profileId, chart: (await this.chartFor(updated))! };
  }
}
