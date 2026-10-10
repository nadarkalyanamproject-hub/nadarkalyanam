import { z } from 'zod';

export const sendInterestRequestSchema = z.object({
  targetProfileId: z.string().min(1, 'targetProfileId is required'),
});
export type SendInterestRequest = z.infer<typeof sendInterestRequestSchema>;

export const interestStatusEnum = z.enum(['PENDING', 'ACCEPTED', 'DECLINED', 'WITHDRAWN']);
export type InterestStatus = z.infer<typeof interestStatusEnum>;

// The "other party" summary embedded in each interest row — just enough to
// render a useful list (matching the fields Browse Profiles already shows)
// without a separate profile lookup per row. city/state/educationLevel/
// profession are the same public card fields as ProfileCard; null when the
// member hasn't filled them in, optional so older responses still parse.
const interestPartySchema = z.object({
  profileId: z.string(),
  fullName: z.string(),
  age: z.number(),
  primaryPhotoUrl: z.string().nullable(),
  city: z.string().nullable().optional(),
  state: z.string().nullable().optional(),
  educationLevel: z.string().nullable().optional(),
  profession: z.string().nullable().optional(),
});

export const interestResponseSchema = z.object({
  id: z.string(),
  status: interestStatusEnum,
  createdAt: z.string(),
  respondedAt: z.string().nullable(),
  sender: interestPartySchema,
  target: interestPartySchema,
});
export type InterestResponse = z.infer<typeof interestResponseSchema>;

export const listInterestsResponseSchema = z.object({
  sent: z.array(interestResponseSchema),
  received: z.array(interestResponseSchema),
});
export type ListInterestsResponse = z.infer<typeof listInterestsResponseSchema>;

// GET /interests/has-unread — true when a PENDING interest arrived for the
// caller after they last opened the Interests page (the header's dot).
export const interestsHasUnreadResponseSchema = z.object({ hasUnread: z.boolean() });
export type InterestsHasUnreadResponse = z.infer<typeof interestsHasUnreadResponseSchema>;
