import { Injectable } from '@nestjs/common';
import type { UnlockedContactsResponse } from '@nadar-kalyanam/schemas';
import { calculateAge } from '../../common/age.js';
import { visibleProfilesWhere } from '../../common/profile-cards.js';
import type { Prisma } from '../../generated/prisma/client.js';
import { PhotosService } from '../photos/photos.service.js';
import { PrismaService } from '../prisma/prisma.service.js';

// "My Unlocked Contacts": the members whose numbers the caller unlocked AND
// could still see right now — the same rules as POST /profiles/:id/phone-
// unlock: the owner still shares (phoneVisibility CONNECTED, so NEVER wins),
// they're still connected, neither has blocked the other, and the owner is
// ACTIVE and visible (visibleProfilesWhere). Anything else is left out, not
// shown with an error. No plan is needed: earlier unlocks outlive the plan.
//
// Never returns a phone number; the page reveals one through the guarded
// unlock endpoint (re-showing an earlier unlock is free).
@Injectable()
export class UnlockedContactsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly photos: PhotosService,
  ) {}

  async listMine(viewerId: string, offset: number, limit: number): Promise<UnlockedContactsResponse> {
    const visible = await visibleProfilesWhere(this.prisma, viewerId);
    const where: Prisma.PhoneUnlockWhereInput = {
      viewerId,
      target: {
        profile: { is: { AND: [visible, { phoneVisibility: 'CONNECTED' }] } },
        OR: [
          { sentInterests: { some: { targetId: viewerId, status: 'ACCEPTED' } } },
          { receivedInterests: { some: { senderId: viewerId, status: 'ACCEPTED' } } },
        ],
      },
    };
    const [rows, total] = await Promise.all([
      this.prisma.phoneUnlock.findMany({
        where,
        orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
        skip: offset,
        take: limit,
        include: { target: { select: { profile: true } } },
      }),
      this.prisma.phoneUnlock.count({ where }),
    ]);

    const items = await Promise.all(
      rows
        .filter((row) => row.target.profile)
        .map(async (row) => {
          const profile = row.target.profile!;
          const photos = await this.photos.getPhotosForProfile(profile.id);
          const location = (profile.details as { location?: { city?: string; state?: string } } | null)?.location;
          return {
            profileId: profile.id,
            fullName: profile.fullName,
            age: calculateAge(profile.dateOfBirth),
            city: location?.city || null,
            state: location?.state || null,
            primaryPhotoUrl: photos.find((p) => p.isPrimary)?.url ?? photos[0]?.url ?? null,
            unlockedAt: row.createdAt.toISOString(),
          };
        }),
    );
    return { items, total, nextOffset: offset + rows.length < total ? offset + rows.length : null };
  }
}
