import type { PreferenceFit, PreferenceFitKey, SavedPartnerPreferences } from '@nadar-kalyanam/schemas';
import type { PartnerPreference, Prisma, Profile } from '../generated/prisma/client.js';
import { ageRangeToDobRange, calculateAge } from './age.js';
import { parseHeightCm, parseIncomeLakhs, rangesOverlap } from './profile-filters.js';

// Partner preferences applied to another member's profile. Pure functions:
// the caller loads the rows. Only the candidate's ordinary profile fields
// are read (age, height, marital status, mother tongue, location, income and
// the profile's general dosham answer) — never their horoscope, which has
// its own visibility setting.

// Matches: the "fits what you're looking for" term is at most this many
// points, scaled by the share of the member's set preferences this profile
// meets: round(PREFERENCE_FIT_MAX * matched / total). The rest of the Matches
// score is the existing compatibility score (up to 100) plus the priority
// listing bonus (MATCH_SCORE_BOOST: 0 / 3 / 6), which this term never
// touches.
export const PREFERENCE_FIT_MAX = 20;

export type MustHaveKey = 'age' | 'maritalStatus' | 'location';

export function toSavedPreferences(row: PartnerPreference): SavedPartnerPreferences {
  return {
    ageMin: row.ageMin,
    ageMax: row.ageMax,
    heightMinCm: row.heightMinCm,
    heightMaxCm: row.heightMaxCm,
    maritalStatuses: row.maritalStatuses as SavedPartnerPreferences['maritalStatuses'],
    motherTongues: row.motherTongues,
    states: row.states,
    cities: row.cities,
    incomeMinLakhs: row.incomeMinLakhs,
    incomeMaxLakhs: row.incomeMaxLakhs,
    doshamPreference: row.doshamPreference as SavedPartnerPreferences['doshamPreference'],
    mustHaveAge: row.mustHaveAge,
    mustHaveMaritalStatus: row.mustHaveMaritalStatus,
    mustHaveLocation: row.mustHaveLocation,
    updatedAt: row.updatedAt.toISOString(),
  };
}

type Prefs = Omit<SavedPartnerPreferences, 'updatedAt'>;

type CandidateDetails = {
  height?: unknown;
  maritalStatus?: unknown;
  motherTongue?: unknown;
  dosham?: unknown;
  location?: { city?: unknown; state?: unknown };
  education?: { annualIncomeRange?: unknown };
};

const sameText = (a: unknown, b: string) => typeof a === 'string' && a.trim().toLowerCase() === b.trim().toLowerCase();

// One entry per preference the member has set, in PREFERENCE_FIT_KEYS order.
// matched: true / false, or null when the profile has no readable value.
export function preferenceFit(prefs: Prefs, candidate: Pick<Profile, 'dateOfBirth' | 'details'>): PreferenceFit {
  const d = (candidate.details ?? {}) as CandidateDetails;
  const fields: { key: PreferenceFitKey; matched: boolean | null }[] = [];

  if (prefs.ageMin !== null || prefs.ageMax !== null) {
    const age = calculateAge(candidate.dateOfBirth);
    fields.push({
      key: 'age',
      matched: (prefs.ageMin === null || age >= prefs.ageMin) && (prefs.ageMax === null || age <= prefs.ageMax),
    });
  }
  if (prefs.heightMinCm !== null || prefs.heightMaxCm !== null) {
    const cm = parseHeightCm(d.height);
    fields.push({
      key: 'height',
      matched: cm === null ? null : rangesOverlap({ min: cm, max: cm }, prefs.heightMinCm ?? undefined, prefs.heightMaxCm ?? undefined),
    });
  }
  if (prefs.maritalStatuses.length > 0) {
    fields.push({
      key: 'maritalStatus',
      matched: typeof d.maritalStatus === 'string' ? prefs.maritalStatuses.includes(d.maritalStatus as never) : null,
    });
  }
  if (prefs.motherTongues.length > 0) {
    fields.push({
      key: 'motherTongue',
      matched: typeof d.motherTongue === 'string' && d.motherTongue.trim() ? prefs.motherTongues.some((t) => sameText(d.motherTongue, t)) : null,
    });
  }
  if (prefs.states.length > 0 || prefs.cities.length > 0) {
    const city = d.location?.city;
    const state = d.location?.state;
    const known = (typeof city === 'string' && city.trim()) || (typeof state === 'string' && state.trim());
    fields.push({
      key: 'location',
      matched: known ? prefs.states.some((s) => sameText(state, s)) || prefs.cities.some((c) => sameText(city, c)) : null,
    });
  }
  if (prefs.incomeMinLakhs !== null || prefs.incomeMaxLakhs !== null) {
    const income = parseIncomeLakhs(d.education?.annualIncomeRange);
    fields.push({
      key: 'income',
      matched: income === null ? null : rangesOverlap(income, prefs.incomeMinLakhs ?? undefined, prefs.incomeMaxLakhs ?? undefined),
    });
  }
  if (prefs.doshamPreference !== 'DOESNT_MATTER') {
    const dosham = d.dosham;
    fields.push({
      key: 'dosham',
      matched: dosham === 'YES' || dosham === 'NO' ? (prefs.doshamPreference === 'WITH_DOSHAM') === (dosham === 'YES') : null,
    });
  }

  return {
    matched: fields.filter((f) => f.matched === true).length,
    total: fields.length,
    unknown: fields.filter((f) => f.matched === null).length,
    fields,
  };
}

// The bounded Matches term, 0..PREFERENCE_FIT_MAX. No preferences set = 0.
export function preferenceScore(fit: Pick<PreferenceFit, 'matched' | 'total'>): number {
  if (fit.total === 0) return 0;
  return Math.round((PREFERENCE_FIT_MAX * fit.matched) / fit.total);
}

// Must-have preferences as Prisma filters (AND entries), for Matches only.
// Same matching rules as preferenceFit: a profile with no value for a
// must-have field does not pass it.
export function mustHaveFilters(prefs: Prefs, now: Date = new Date()): { keys: MustHaveKey[]; where: Prisma.ProfileWhereInput[] } {
  const keys: MustHaveKey[] = [];
  const where: Prisma.ProfileWhereInput[] = [];
  if (prefs.mustHaveAge && (prefs.ageMin !== null || prefs.ageMax !== null)) {
    keys.push('age');
    where.push({
      dateOfBirth: ageRangeToDobRange(prefs.ageMin ?? undefined, prefs.ageMax ?? undefined, now),
    });
  }
  if (prefs.mustHaveMaritalStatus && prefs.maritalStatuses.length > 0) {
    keys.push('maritalStatus');
    where.push({
      OR: prefs.maritalStatuses.map((status) => ({
        details: { path: ['maritalStatus'], equals: status },
      })),
    });
  }
  if (prefs.mustHaveLocation && (prefs.states.length > 0 || prefs.cities.length > 0)) {
    keys.push('location');
    where.push({
      OR: [
        ...prefs.states.map((state) => ({
          details: {
            path: ['location', 'state'],
            equals: state,
            mode: 'insensitive' as const,
          },
        })),
        ...prefs.cities.map((city) => ({
          details: {
            path: ['location', 'city'],
            equals: city,
            mode: 'insensitive' as const,
          },
        })),
      ],
    });
  }
  return { keys, where };
}
