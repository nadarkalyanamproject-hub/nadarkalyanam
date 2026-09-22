import { z } from 'zod';
import { additionalDetailsSchema, doshamEnum, genderEnum, maritalStatusEnum, physicalStatusEnum } from './profile.js';
import { photoResponseSchema } from './photo.js';

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
  // True when the authenticated caller has already sent a still-pending or
  // accepted interest to this profile — lets the frontend show "Interest
  // Sent" on initial load, not just after an in-session click.
  hasSentInterest: z.boolean(),
});
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
