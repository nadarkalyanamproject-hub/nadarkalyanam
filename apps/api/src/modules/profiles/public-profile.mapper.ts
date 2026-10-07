import type { HoroscopeView, PhotoResponse, PreferenceFit, ProfileResponse, PublicProfileDetail, PublicProfileSummary } from '@nadar-kalyanam/schemas';
import { calculateAge } from '../../common/age.js';
import { legacyHasSentInterest, relationshipFields, type RelationshipState } from '../../common/relationship.js';
import type { Profile } from '../../generated/prisma/client.js';

// Deliberately separate from the owner-facing toProfileResponse in
// profiles.controller.ts: this is what any OTHER user's request for this
// profile can see, so it must never be able to grow an `email` (or full
// `dateOfBirth`) field just because someone later merges it with the
// owner-facing mapper. Every field here is picked explicitly —
// never spread the raw `details` blob into a response for someone else.
export function toPublicProfileSummary(
  profile: Profile,
  primaryPhotoUrl: string | null,
  relationship: RelationshipState | undefined,
): PublicProfileSummary {
  const details = profile.details as unknown as ProfileResponse['details'];
  return {
    id: profile.id,
    fullName: profile.fullName,
    age: calculateAge(profile.dateOfBirth),
    gender: profile.gender as PublicProfileSummary['gender'],
    location: { city: details.location.city, state: details.location.state },
    religion: details.religion,
    profession: details.education.profession,
    maritalStatus: details.maritalStatus,
    primaryPhotoUrl,
    hasSentInterest: legacyHasSentInterest(relationship),
    ...relationshipFields(relationship),
  };
}

// The viewer-specific extras on the single profile view. The default shares
// nothing, so a caller that doesn't compute them can never leak a horoscope.
export interface ProfileViewExtras {
  preferenceFit: PreferenceFit | null;
  horoscope: HoroscopeView;
}
const NO_EXTRAS: ProfileViewExtras = { preferenceFit: null, horoscope: { shared: false } };

export function toPublicProfileDetail(
  profile: Profile,
  photos: PhotoResponse[],
  relationship: RelationshipState | undefined,
  extras: ProfileViewExtras = NO_EXTRAS,
): PublicProfileDetail {
  const details = profile.details as unknown as ProfileResponse['details'];
  const primaryPhotoUrl = photos.find((photo) => photo.isPrimary)?.url ?? photos[0]?.url ?? null;
  return {
    ...toPublicProfileSummary(profile, primaryPhotoUrl, relationship),
    motherTongue: details.motherTongue,
    height: details.height,
    physicalStatus: details.physicalStatus,
    casteCommunity: details.casteCommunity,
    dosham: details.dosham,
    education: details.education,
    additional: details.additional,
    photos,
    preferenceFit: extras.preferenceFit,
    horoscope: extras.horoscope,
  };
}
