import type { ProfileCard } from '@nadar-kalyanam/schemas';
import type { Prisma, Profile, ProfileVisibility } from '../generated/prisma/client.js';
import type { PhotosService } from '../modules/photos/photos.service.js';
import type { PrismaService } from '../modules/prisma/prisma.service.js';
import { calculateAge } from './age.js';
import { getBlockedUserIds } from './blocks.util.js';
import { getRelationshipStates, relationshipFields } from './relationship.js';

// Profile visibility settings that let signed-in members find a profile.
// PUBLIC and MEMBERS_ONLY are both members-only in practice: there is no
// guest (signed-out) view of any profile, so "Everyone" can't reach further
// than members. HIDDEN is never listed.
export const MEMBER_VISIBLE_SETTINGS: ProfileVisibility[] = ['PUBLIC', 'MEMBERS_ONLY'];

// Matches nothing — for a viewer who isn't allowed to see anyone.
export const NO_PROFILES: Prisma.ProfileWhereInput = { id: { in: [] } };

// The single visibility rule for every member-facing profile list (Search,
// Matches and its categories, Browse, Shortlist) and the profile page:
//  - the viewer must be a member in good standing: ACTIVE account with a
//    profile of their own (a suspended, removed or half-registered account
//    sees no one);
//  - never the viewer themselves, never anyone blocked in either direction;
//  - never a HIDDEN profile, never an account that isn't ACTIVE.
export function profileVisibilityWhere(
  viewer: { userId: string; isActiveMember: boolean },
  blockedUserIds: Iterable<string>,
): Prisma.ProfileWhereInput {
  if (!viewer.isActiveMember) return NO_PROFILES;
  return {
    visibility: { in: MEMBER_VISIBLE_SETTINGS },
    userId: { notIn: [viewer.userId, ...blockedUserIds] },
    user: { status: 'ACTIVE' },
  };
}

export async function visibleProfilesWhere(
  prisma: PrismaService,
  callerUserId: string,
): Promise<Prisma.ProfileWhereInput> {
  const [viewer, blockedUserIds] = await Promise.all([
    prisma.user.findUnique({
      where: { id: callerUserId },
      select: { status: true, profile: { select: { id: true } } },
    }),
    getBlockedUserIds(prisma, callerUserId),
  ]);
  const isActiveMember = viewer?.status === 'ACTIVE' && Boolean(viewer.profile);
  return profileVisibilityWhere({ userId: callerUserId, isActiveMember }, blockedUserIds);
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
