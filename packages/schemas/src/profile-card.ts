import { z } from 'zod';
import { relationshipFieldsSchema } from './relationship.js';

// One member as shown on a Matches category page card. Only real stored
// values: anything a profile hasn't filled in is null, never a placeholder.
export const profileCardSchema = z
  .object({
    profileId: z.string(),
    fullName: z.string(),
    age: z.number(),
    city: z.string().nullable(),
    state: z.string().nullable(),
    educationLevel: z.string().nullable(),
    profession: z.string().nullable(),
    primaryPhotoUrl: z.string().nullable(),
    isVerified: z.boolean(),
  })
  .extend(relationshipFieldsSchema.shape);
export type ProfileCard = z.infer<typeof profileCardSchema>;

export const profileCardListResponseSchema = z.object({
  items: z.array(profileCardSchema),
});
export type ProfileCardListResponse = z.infer<typeof profileCardListResponseSchema>;

// Nearby is approximated from the caller's own stored city/state (there is
// no geolocation); both are echoed back so the page can say what it used.
export const nearbyMatchesResponseSchema = profileCardListResponseSchema.extend({
  city: z.string().nullable(),
  state: z.string().nullable(),
});
export type NearbyMatchesResponse = z.infer<typeof nearbyMatchesResponseSchema>;

// --- Shortlist ---------------------------------------------------------------

export const shortlistRequestSchema = z.object({
  profileId: z.string().trim().min(1, 'profileId is required'),
});
export type ShortlistRequest = z.infer<typeof shortlistRequestSchema>;

export const shortlistResponseSchema = z.object({
  id: z.string(),
  profileId: z.string(),
  createdAt: z.string(),
});
export type ShortlistResponse = z.infer<typeof shortlistResponseSchema>;

export const shortlistStatusResponseSchema = z.object({
  shortlisted: z.boolean(),
});
export type ShortlistStatusResponse = z.infer<typeof shortlistStatusResponseSchema>;
