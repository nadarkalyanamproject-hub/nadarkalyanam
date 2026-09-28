import { z } from 'zod';
import { additionalDetailsSchema, doshamEnum, genderEnum, maritalStatusEnum, physicalStatusEnum } from './profile.js';
import { photoResponseSchema } from './photo.js';
import { relationshipFieldsSchema } from './relationship.js';

// Distinct from profileResponseSchema/profileDetailsSchema (packages/schemas/src/profile.ts)
// on purpose: that shape includes email, which is only ever safe to return for
// a user's OWN profile (GET /profiles/me). These schemas back GET /profiles
// (browse) and GET /profiles/:id (view another user's profile), and must
// never gain an email field — dateOfBirth is also withheld in favor of a
// computed age, so another user isn't given more than they need either.

export const publicProfileSummarySchema = z.object({
  id: z.string(),
  fullName: z.string(),
  age: z.number(),
  gender: genderEnum,
  location: z.object({
    city: z.string(),
    state: z.string(),
  }),
  religion: z.string(),
  profession: z.string(),
  maritalStatus: maritalStatusEnum,
  primaryPhotoUrl: z.string().nullable(),
  // Kept for backward compatibility; derived from relationshipStatus (true
  // for INTEREST_SENT and CONNECTED). New code should read
  // relationshipStatus, which also covers interests in the other direction.
  hasSentInterest: z.boolean(),
}).extend(relationshipFieldsSchema.shape);
export type PublicProfileSummary = z.infer<typeof publicProfileSummarySchema>;

export const publicProfileDetailSchema = publicProfileSummarySchema.extend({
  motherTongue: z.string(),
  height: z.string(),
  physicalStatus: physicalStatusEnum,
  casteCommunity: z.string(),
  dosham: doshamEnum.optional(),
  education: z.object({
    educationLevel: z.string(),
    educationDetail: z.string(),
    profession: z.string(),
    employedIn: z.string(),
    annualIncomeRange: z.string(),
    annualIncomeCurrency: z.string(),
  }),
  additional: additionalDetailsSchema,
  photos: z.array(photoResponseSchema),
});
export type PublicProfileDetail = z.infer<typeof publicProfileDetailSchema>;

export const profileListResponseSchema = z.object({
  items: z.array(publicProfileSummarySchema),
  nextOffset: z.number().nullable(),
});
export type ProfileListResponse = z.infer<typeof profileListResponseSchema>;

// GET /interests/connections — members the caller is CONNECTED with (an
// ACCEPTED interest in either direction). Same privacy-safe summary shape as
// browse (no email, no dateOfBirth), plus when the connection was made.
export const connectionSchema = publicProfileSummarySchema.extend({
  conversationId: z.string(),
  connectedAt: z.string(),
});
export type Connection = z.infer<typeof connectionSchema>;

export const listConnectionsResponseSchema = z.object({
  items: z.array(connectionSchema),
  total: z.number(),
  nextOffset: z.number().nullable(),
});
export type ListConnectionsResponse = z.infer<typeof listConnectionsResponseSchema>;
