import { z } from 'zod';

export const matchResultSchema = z.object({
  profileId: z.string(),
  fullName: z.string(),
  age: z.number(),
  city: z.string().nullable(),
  primaryPhotoUrl: z.string().nullable(),
  score: z.number(),
});
export type MatchResult = z.infer<typeof matchResultSchema>;

export const listMatchesResponseSchema = z.object({
  items: z.array(matchResultSchema),
  scoringVersion: z.string(),
});
export type ListMatchesResponse = z.infer<typeof listMatchesResponseSchema>;
