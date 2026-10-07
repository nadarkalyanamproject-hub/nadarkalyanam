import { z } from 'zod';
import { doshamEnum, familyStatusEnum, physicalStatusEnum } from './profile.js';
import { relationshipFieldsSchema } from './relationship.js';

// Query-string booleans: only the literal 'true'/'false' (z.coerce.boolean
// would read the string 'false' as true).
const queryFlag = z
  .enum(['true', 'false'])
  .transform((value) => value === 'true')
  .optional();

// "a,b,c" -> ['a','b','c'] (trimmed, blanks dropped, at most 40 values).
const commaList = z
  .string()
  .transform((value) => [...new Set(value.split(',').map((v) => v.trim()).filter(Boolean))])
  .pipe(z.array(z.string().max(80)).max(40))
  .optional();

export const JOINED_WITHIN_DAYS = [1, 3, 7, 30] as const;

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
  // Further profile fields members actually fill in at onboarding. Free text
  // (motherTongue, religion, casteCommunity, employedIn) is matched on the
  // whole value ignoring case, like city; enums are exact. Caste is one free
  // text field — there is no subcaste.
  motherTongue: z.string().optional(),
  physicalStatus: physicalStatusEnum.optional(),
  religion: z.string().optional(),
  casteCommunity: z.string().optional(),
  dosham: doshamEnum.optional(),
  employedIn: z.string().optional(),
  familyType: familyStatusEnum.optional(),
  // Height and income are stored as text; profiles whose value can't be read
  // as a height / a lakh amount never match these ranges.
  heightMinCm: z.coerce.number().int().min(100).max(250).optional(),
  heightMaxCm: z.coerce.number().int().min(100).max(250).optional(),
  incomeMinLakhs: z.coerce.number().min(0).max(10000).optional(),
  incomeMaxLakhs: z.coerce.number().min(0).max(10000).optional(),
  // Several values at once, comma-separated (e.g. the "Use my preferences"
  // toggle): a profile matches if it has any one of them. Same matching
  // rules as the single-value filters above; state is whole-value,
  // case-insensitive like city.
  maritalStatusIn: commaList,
  motherTongueIn: commaList,
  stateIn: commaList,
  cityIn: commaList,
  // Onboarding only offers India, so this is the only country to search.
  country: z.literal('India').optional(),
  // Same rules as the Matches categories: Nearby (caller's city/state),
  // Newly Joined (createdAt window) and With Photos.
  nearby: queryFlag,
  joinedWithinDays: z.coerce
    .number()
    .int()
    .refine((days) => (JOINED_WITHIN_DAYS as readonly number[]).includes(days), 'Use 1, 3, 7 or 30')
    .optional(),
  withPhoto: queryFlag,
  excludeShortlisted: queryFlag,
  // Only members whose identity verification completed (isVerified).
  verified: queryFlag,
  // Any other key (e.g. a "coming soon" filter such as star or eating
  // habits) is stripped by z.object, never applied and never an error.
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
}).extend(relationshipFieldsSchema.shape);
export type SearchProfileResult = z.infer<typeof searchProfileResultSchema>;

export const searchProfilesResponseSchema = z.object({
  items: z.array(searchProfileResultSchema),
  nextCursor: z.string().nullable(),
  // Every profile matching the filters, across all pages.
  total: z.number(),
});
export type SearchProfilesResponse = z.infer<typeof searchProfilesResponseSchema>;
