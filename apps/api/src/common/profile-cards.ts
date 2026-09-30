import type { ProfileCard } from '@nadar-kalyanam/schemas';
import type { Prisma, Profile } from '../generated/prisma/client.js';
import type { PhotosService } from '../modules/photos/photos.service.js';
import type { PrismaService } from '../modules/prisma/prisma.service.js';
import { calculateAge } from './age.js';
import { getBlockedUserIds } from './blocks.util.js';
import { getRelationshipStates, relationshipFields } from './relationship.js';

// The same exclusion rules discovery and matching apply: never the caller,
// never anyone blocked in either direction, never a HIDDEN profile, and never
// a member whose account isn't ACTIVE (suspended / pending deletion / deleted).
export async function visibleProfilesWhere(
  prisma: PrismaService,
  callerUserId: string,
): Promise<Prisma.ProfileWhereInput> {
  const blockedUserIds = await getBlockedUserIds(prisma, callerUserId);
  return {
    visibility: { not: 'HIDDEN' },
    userId: { notIn: [callerUserId, ...blockedUserIds] },
    user: { status: 'ACTIVE' },
  };
}

// Builds category-page cards from real rows only; unfilled fields stay null.
// One batched relationship query for the whole page.
export async function toProfileCards(
  prisma: PrismaService,
  photosService: PhotosService,
  callerUserId: string,
  profiles: Profile[],
): Promise<ProfileCard[]> {
  const relationships = await getRelationshipStates(
    prisma,
    callerUserId,
    profiles.map((profile) => profile.userId),
  );
  return Promise.all(
    profiles.map(async (profile) => {
      const photos = await photosService.getPhotosForProfile(profile.id);
      const details = profile.details as {
        location?: { city?: string; state?: string };
        education?: { educationLevel?: string; profession?: string };
      } | null;
      return {
        profileId: profile.id,
        fullName: profile.fullName,
        age: calculateAge(profile.dateOfBirth),
        city: details?.location?.city || null,
        state: details?.location?.state || null,
        educationLevel: details?.education?.educationLevel || null,
        profession: details?.education?.profession || null,
        primaryPhotoUrl: photos.find((photo) => photo.isPrimary)?.url ?? photos[0]?.url ?? null,
        isVerified: profile.isVerified,
        ...relationshipFields(relationships.get(profile.userId)),
      };
    }),
  );
}

// Returns `profiles` in the order of `orderedKeys` (e.g. most recent shortlist
// or view first), dropping any key whose profile was filtered out.
export function inKeyOrder<K>(profiles: Profile[], orderedKeys: K[], keyOf: (profile: Profile) => K): Profile[] {
  const byKey = new Map(profiles.map((profile) => [keyOf(profile), profile]));
  return orderedKeys.flatMap((key) => {
    const profile = byKey.get(key);
    return profile ? [profile] : [];
  });
}
