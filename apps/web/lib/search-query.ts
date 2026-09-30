import type { searchProfiles } from './api-client';

// Search page filter state: every field is a string, '' meaning "any".
export interface SearchFilters {
  gender: string;
  ageMin: string;
  ageMax: string;
  city: string;
  educationLevel: string;
  profession: string;
  maritalStatus: string;
}

export const EMPTY_SEARCH_FILTERS: SearchFilters = {
  gender: '',
  ageMin: '',
  ageMax: '',
  city: '',
  educationLevel: '',
  profession: '',
  maritalStatus: '',
};

const FILTER_KEYS = Object.keys(EMPTY_SEARCH_FILTERS) as (keyof SearchFilters)[];

// Reads the same keys the page links use (e.g. the home page's quick search:
// /search?gender=FEMALE&ageMin=25&ageMax=32&city=Chennai).
export function filtersFromUrl(searchParams: Pick<URLSearchParams, 'get'>): SearchFilters {
  const filters = { ...EMPTY_SEARCH_FILTERS };
  for (const key of FILTER_KEYS) filters[key] = searchParams.get(key) ?? '';
  return filters;
}

export function hasAnyFilter(filters: SearchFilters): boolean {
  return FILTER_KEYS.some((key) => filters[key].trim() !== '');
}

// Maps form state to GET /search/profiles params: blanks are dropped, free
// text is trimmed, and gender only passes through as one of its enum values.
export function toSearchQuery(filters: SearchFilters): Parameters<typeof searchProfiles>[1] {
  const text = (value: string) => value.trim() || undefined;
  const age = (value: string) => (value.trim() ? Number(value) : undefined);
  return {
    gender: filters.gender === 'MALE' || filters.gender === 'FEMALE' ? filters.gender : undefined,
    ageMin: age(filters.ageMin),
    ageMax: age(filters.ageMax),
    city: text(filters.city),
    educationLevel: text(filters.educationLevel),
    profession: text(filters.profession),
    maritalStatus: text(filters.maritalStatus),
  };
}
