import type { SearchProfilesParams } from './api-client';

// Search page filter state: every field is a string, '' meaning "any"
// ('true' for a ticked checkbox). Only REAL, searchable profile fields live
// here — the page's "Coming soon" fields (star, lifestyle habits, profile
// created by, …) have no state at all, so they can never reach a query.
export interface SearchFilters {
  gender: string;
  ageMin: string;
  ageMax: string;
  heightMinCm: string;
  heightMaxCm: string;
  maritalStatus: string;
  motherTongue: string;
  physicalStatus: string;
  religion: string;
  casteCommunity: string;
  dosham: string;
  educationLevel: string;
  profession: string;
  employedIn: string;
  incomeMinLakhs: string;
  incomeMaxLakhs: string;
  country: string;
  city: string;
  nearby: string;
  familyType: string;
  joinedWithinDays: string;
  withPhoto: string;
  excludeShortlisted: string;
}

export const EMPTY_SEARCH_FILTERS: SearchFilters = {
  gender: '',
  ageMin: '',
  ageMax: '',
  heightMinCm: '',
  heightMaxCm: '',
  maritalStatus: '',
  motherTongue: '',
  physicalStatus: '',
  religion: '',
  casteCommunity: '',
  dosham: '',
  educationLevel: '',
  profession: '',
  employedIn: '',
  incomeMinLakhs: '',
  incomeMaxLakhs: '',
  // Onboarding only offers India, so search is fixed to it as well.
  country: 'India',
  city: '',
  nearby: '',
  familyType: '',
  joinedWithinDays: '',
  withPhoto: '',
  excludeShortlisted: '',
};

const FILTER_KEYS = Object.keys(EMPTY_SEARCH_FILTERS) as (keyof SearchFilters)[];

// Reads the same keys the page links use (e.g. the home page's quick search:
// /search?gender=FEMALE&ageMin=25&ageMax=32&city=Chennai).
export function filtersFromUrl(searchParams: Pick<URLSearchParams, 'get'>): SearchFilters {
  const filters = { ...EMPTY_SEARCH_FILTERS };
  for (const key of FILTER_KEYS) {
    if (key === 'country') continue;
    filters[key] = searchParams.get(key) ?? '';
  }
  return filters;
}

// Country is fixed, so it never counts as the member having chosen a filter.
export function hasAnyFilter(filters: SearchFilters): boolean {
  return FILTER_KEYS.some((key) => key !== 'country' && filters[key].trim() !== '');
}

const ENUMS = {
  gender: ['MALE', 'FEMALE'],
  physicalStatus: ['NORMAL', 'PHYSICALLY_CHALLENGED'],
  dosham: ['NO', 'YES', 'DONT_KNOW'],
  familyType: ['Middle Class', 'Upper Middle Class', 'Rich / Affluent (Elite)'],
  joinedWithinDays: ['1', '3', '7', '30'],
} as const;

// Maps form state to GET /search/profiles params: blanks are dropped, free
// text is trimmed, enums only pass through as one of their values, and
// checkboxes are sent only when ticked.
export function toSearchQuery(filters: SearchFilters): SearchProfilesParams {
  const text = (value: string) => value.trim() || undefined;
  const num = (value: string) => (value.trim() && Number.isFinite(Number(value)) ? Number(value) : undefined);
  const oneOf = <T extends string>(value: string, allowed: readonly T[]) =>
    (allowed as readonly string[]).includes(value) ? (value as T) : undefined;
  const flag = (value: string) => (value === 'true' ? true : undefined);
  const joined = oneOf(filters.joinedWithinDays, ENUMS.joinedWithinDays);
  return {
    gender: oneOf(filters.gender, ENUMS.gender),
    ageMin: num(filters.ageMin),
    ageMax: num(filters.ageMax),
    heightMinCm: num(filters.heightMinCm),
    heightMaxCm: num(filters.heightMaxCm),
    maritalStatus: text(filters.maritalStatus),
    motherTongue: text(filters.motherTongue),
    physicalStatus: oneOf(filters.physicalStatus, ENUMS.physicalStatus),
    religion: text(filters.religion),
    casteCommunity: text(filters.casteCommunity),
    dosham: oneOf(filters.dosham, ENUMS.dosham),
    educationLevel: text(filters.educationLevel),
    profession: text(filters.profession),
    employedIn: text(filters.employedIn),
    incomeMinLakhs: num(filters.incomeMinLakhs),
    incomeMaxLakhs: num(filters.incomeMaxLakhs),
    country: filters.country === 'India' ? 'India' : undefined,
    city: text(filters.city),
    nearby: flag(filters.nearby),
    familyType: oneOf(filters.familyType, ENUMS.familyType),
    joinedWithinDays: joined ? Number(joined) : undefined,
    withPhoto: flag(filters.withPhoto),
    excludeShortlisted: flag(filters.excludeShortlisted),
  };
}
