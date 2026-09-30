import { describe, expect, it } from 'vitest';
import { EMPTY_SEARCH_FILTERS, filtersFromUrl, hasAnyFilter, toSearchQuery } from './search-query';

describe('search query mapping (used by app/search/page.tsx)', () => {
  it("reads the home page's quick-search link, including gender", () => {
    const filters = filtersFromUrl(new URLSearchParams('gender=FEMALE&ageMin=25&ageMax=32&city=Chennai'));
    expect(filters).toEqual({ ...EMPTY_SEARCH_FILTERS, gender: 'FEMALE', ageMin: '25', ageMax: '32', city: 'Chennai' });
    expect(hasAnyFilter(filters)).toBe(true);
    expect(toSearchQuery(filters)).toEqual({
      gender: 'FEMALE',
      ageMin: 25,
      ageMax: 32,
      city: 'Chennai',
      educationLevel: undefined,
      profession: undefined,
      maritalStatus: undefined,
    });
  });

  it('passes both genders through and drops anything that is not a gender enum value', () => {
    expect(toSearchQuery({ ...EMPTY_SEARCH_FILTERS, gender: 'MALE' }).gender).toBe('MALE');
    expect(toSearchQuery({ ...EMPTY_SEARCH_FILTERS, gender: 'bride' }).gender).toBeUndefined();
    expect(toSearchQuery(EMPTY_SEARCH_FILTERS).gender).toBeUndefined();
  });

  it('sends free text trimmed but otherwise as typed, and the marital status enum value unchanged', () => {
    const query = toSearchQuery({
      ...EMPTY_SEARCH_FILTERS,
      city: '  madurai ',
      educationLevel: 'Bachelors',
      profession: ' Software Engineer',
      maritalStatus: 'NEVER_MARRIED',
    });
    expect(query).toMatchObject({
      city: 'madurai',
      educationLevel: 'Bachelors',
      profession: 'Software Engineer',
      maritalStatus: 'NEVER_MARRIED',
    });
  });

  it('treats blank or whitespace-only fields as no filter', () => {
    const blank = { ...EMPTY_SEARCH_FILTERS, city: '   ', profession: '' };
    expect(hasAnyFilter(blank)).toBe(false);
    expect(Object.values(toSearchQuery(blank)).every((value) => value === undefined)).toBe(true);
    expect(hasAnyFilter(filtersFromUrl(new URLSearchParams('')))).toBe(false);
  });
});
