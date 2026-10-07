import { z } from 'zod';
import { relationshipFieldsSchema } from './relationship.js';

export const matchResultSchema = z.object({
  profileId: z.string(),
  fullName: z.string(),
  age: z.number(),
  city: z.string().nullable(),
  primaryPhotoUrl: z.string().nullable(),
  isVerified: z.boolean(),
  profession: z.string().nullable(),
  religion: z.string().nullable(),
  score: z.number(),
}).extend(relationshipFieldsSchema.shape);
export type MatchResult = z.infer<typeof matchResultSchema>;

export const listMatchesResponseSchema = z.object({
  items: z.array(matchResultSchema),
  scoringVersion: z.string(),
  // The caller's own preference state, so an empty list can say why.
  preferences: z.object({
    hasPreferences: z.boolean(),
    // Must-have preferences applied as filters: 'age', 'maritalStatus', 'location'.
    mustHave: z.array(z.enum(['age', 'maritalStatus', 'location'])),
    // Members who would otherwise be candidates but fail a must-have.
    hiddenByMustHave: z.number(),
  }),
});
export type ListMatchesResponse = z.infer<typeof listMatchesResponseSchema>;
