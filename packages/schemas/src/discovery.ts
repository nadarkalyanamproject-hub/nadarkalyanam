import { z } from 'zod';

// APPROVAL REQUIRED (SRS §4.3): the final v1 filter list, sort options and
// AND/OR combination behavior are still open. This is the filter set implied
// by FR-3.1's example list (age range, location, education, profession,
// marital status) — extend once the product decision is recorded.
export const searchProfilesQuerySchema = z.object({
  ageMin: z.coerce.number().int().min(18).optional(),
  ageMax: z.coerce.number().int().max(100).optional(),
  city: z.string().optional(),
  gender: z.enum(['MALE', 'FEMALE']).optional(),
  educationLevel: z.string().optional(),
  profession: z.string().optional(),
  maritalStatus: z.string().optional(),
  // 'newest' trades cursor-pagination stability for createdAt-desc order —
  // fine for a small, unpaginated "recently joined" home-page strip; the
  // default 'id' order is what search/pagination actually use.
  sort: z.enum(['id', 'newest']).default('id'),
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});
export type SearchProfilesQuery = z.infer<typeof searchProfilesQuerySchema>;

export const searchProfileResultSchema = z.object({
  profileId: z.string(),
  fullName: z.string(),
  age: z.number(),
  city: z.string().nullable(),
  primaryPhotoUrl: z.string().nullable(),
  isVerified: z.boolean(),
});
export type SearchProfileResult = z.infer<typeof searchProfileResultSchema>;

export const searchProfilesResponseSchema = z.object({
  items: z.array(searchProfileResultSchema),
  nextCursor: z.string().nullable(),
});
export type SearchProfilesResponse = z.infer<typeof searchProfilesResponseSchema>;
