import { z } from 'zod';
import { maritalStatusEnum } from './profile.js';
import { INDIA_STATES_AND_UTS, MOTHER_TONGUES } from './reference-data.js';

// What a member is looking for. Owner-only: never part of any response about
// another member. Every preference is soft (it ranks Matches and feeds the
// "N of M preferences match" line) unless its must-have flag is on — only
// age, marital status and location offer one, and those act as hard filters
// on Matches.
//
// Only fields the profile form actually collects with a fixed list or a
// readable value are offered: education level, occupation and city of work
// are free text without a reference list, and diet / smoking / drinking
// aren't collected at all, so they can't be preferences yet.

// How the member feels about the other person's dosham (the profile's
// existing Dosham answer: Yes / No / Don't know).
export const doshamPreferenceEnum = z.enum(['DOESNT_MATTER', 'WITHOUT_DOSHAM', 'WITH_DOSHAM']);
export type DoshamPreference = z.infer<typeof doshamPreferenceEnum>;

const unique = <T>(items: T[]) => [...new Set(items)];
const nullableInt = (min: number, max: number) => z.number().int().min(min).max(max).nullable();

export const partnerPreferencesSchema = z
  .object({
    ageMin: nullableInt(18, 100),
    ageMax: nullableInt(18, 100),
    heightMinCm: nullableInt(100, 250),
    heightMaxCm: nullableInt(100, 250),
    maritalStatuses: z.array(maritalStatusEnum).max(4).transform(unique),
    motherTongues: z.array(z.enum(MOTHER_TONGUES)).max(MOTHER_TONGUES.length).transform(unique),
    // Empty states and cities = anywhere.
    states: z.array(z.enum(INDIA_STATES_AND_UTS)).max(INDIA_STATES_AND_UTS.length).transform(unique),
    // City is free text on profiles; matched on the whole name, ignoring case
    // (the same rule as Search's city filter).
    cities: z
      .array(z.string().trim().min(1, 'City name is required').max(60))
      .max(10, 'Up to 10 cities')
      .transform((cities) => unique(cities.map((c) => c.replace(/\s+/g, ' ')))),
    incomeMinLakhs: z.number().min(0).max(10000).nullable(),
    incomeMaxLakhs: z.number().min(0).max(10000).nullable(),
    doshamPreference: doshamPreferenceEnum,
    mustHaveAge: z.boolean(),
    mustHaveMaritalStatus: z.boolean(),
    mustHaveLocation: z.boolean(),
  })
  .strict()
  .superRefine((p, ctx) => {
    const order = (min: number | null, max: number | null, path: string, label: string) => {
      if (min !== null && max !== null && min > max) {
        ctx.addIssue({
          code: 'custom',
          path: [path],
          message: `${label}: the minimum is more than the maximum`,
        });
      }
    };
    order(p.ageMin, p.ageMax, 'ageMax', 'Age');
    order(p.heightMinCm, p.heightMaxCm, 'heightMaxCm', 'Height');
    order(p.incomeMinLakhs, p.incomeMaxLakhs, 'incomeMaxLakhs', 'Income');
    if (p.mustHaveAge && p.ageMin === null && p.ageMax === null) {
      ctx.addIssue({
        code: 'custom',
        path: ['mustHaveAge'],
        message: 'Set an age range to make it a must-have',
      });
    }
    if (p.mustHaveMaritalStatus && p.maritalStatuses.length === 0) {
      ctx.addIssue({
        code: 'custom',
        path: ['mustHaveMaritalStatus'],
        message: 'Choose a marital status to make it a must-have',
      });
    }
    if (p.mustHaveLocation && p.states.length === 0 && p.cities.length === 0) {
      ctx.addIssue({
        code: 'custom',
        path: ['mustHaveLocation'],
        message: 'Choose a state or city to make location a must-have',
      });
    }
  });
export type PartnerPreferencesRequest = z.input<typeof partnerPreferencesSchema>;
export type PartnerPreferences = z.infer<typeof partnerPreferencesSchema>;

export const partnerPreferencesResponseSchema = z.object({
  // null until the member saves preferences (or after they reset them).
  preferences: z
    .object({
      ageMin: z.number().nullable(),
      ageMax: z.number().nullable(),
      heightMinCm: z.number().nullable(),
      heightMaxCm: z.number().nullable(),
      maritalStatuses: z.array(maritalStatusEnum),
      motherTongues: z.array(z.string()),
      states: z.array(z.string()),
      cities: z.array(z.string()),
      incomeMinLakhs: z.number().nullable(),
      incomeMaxLakhs: z.number().nullable(),
      doshamPreference: doshamPreferenceEnum,
      mustHaveAge: z.boolean(),
      mustHaveMaritalStatus: z.boolean(),
      mustHaveLocation: z.boolean(),
      updatedAt: z.string(),
    })
    .nullable(),
});
export type PartnerPreferencesResponse = z.infer<typeof partnerPreferencesResponseSchema>;
export type SavedPartnerPreferences = NonNullable<PartnerPreferencesResponse['preferences']>;

// The preference keys counted for "N of M preferences match" and the
// Matches fit score. Each one the member has set counts once.
export const PREFERENCE_FIT_KEYS = ['age', 'height', 'maritalStatus', 'motherTongue', 'location', 'income', 'dosham'] as const;
export type PreferenceFitKey = (typeof PREFERENCE_FIT_KEYS)[number];

// "N of M of your preferences match" — computed for the viewing member only,
// from their own preferences and this profile's visible fields. `unknown`
// counts preferences the profile has no readable value for (e.g. dosham
// "Don't know", an unreadable height); they're not counted as matches.
export const preferenceFitSchema = z.object({
  matched: z.number(),
  total: z.number(),
  unknown: z.number(),
  fields: z.array(
    z.object({
      key: z.enum(PREFERENCE_FIT_KEYS),
      matched: z.boolean().nullable(),
    }),
  ),
});
export type PreferenceFit = z.infer<typeof preferenceFitSchema>;
