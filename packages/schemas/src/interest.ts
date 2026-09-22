import { z } from 'zod';

export const sendInterestRequestSchema = z.object({
  targetProfileId: z.string().min(1, 'targetProfileId is required'),
});
export type SendInterestRequest = z.infer<typeof sendInterestRequestSchema>;

export const interestStatusEnum = z.enum(['PENDING', 'ACCEPTED', 'DECLINED', 'WITHDRAWN']);
export type InterestStatus = z.infer<typeof interestStatusEnum>;

// The "other party" summary embedded in each interest row — just enough to
// render a useful list (matching the fields Browse Profiles already shows)
// without a separate profile lookup per row.
const interestPartySchema = z.object({
  profileId: z.string(),
  fullName: z.string(),
  age: z.number(),
  primaryPhotoUrl: z.string().nullable(),
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
