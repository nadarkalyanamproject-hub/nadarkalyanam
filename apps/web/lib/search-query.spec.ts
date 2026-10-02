import { describe, expect, it } from 'vitest';
import { EMPTY_SEARCH_FILTERS, filtersFromUrl, hasAnyFilter, toSearchQuery } from './search-query';

const defined = (query: object) => Object.fromEntries(Object.entries(query).filter(([, value]) => value !== undefined));

describe('search query mapping (used by app/search/page.tsx)', () => {
  it("reads the home page's quick-search link, including gender", () => {
    const filters = filtersFromUrl(new URLSearchParams('gender=FEMALE&ageMin=25&ageMax=32&city=Chennai'));
    expect(filters).toEqual({ ...EMPTY_SEARCH_FILTERS, gender: 'FEMALE', ageMin: '25', ageMax: '32', city: 'Chennai' });
    expect(hasAnyFilter(filters)).toBe(true);
    expect(defined(toSearchQuery(filters))).toEqual({
      gender: 'FEMALE',
      ageMin: 25,
      ageMax: 32,
      city: 'Chennai',
      country: 'India',
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
    // Only the fixed country is ever sent without the member choosing it.
    expect(defined(toSearchQuery(blank))).toEqual({ country: 'India' });
    expect(hasAnyFilter(filtersFromUrl(new URLSearchParams('')))).toBe(false);
  });

  it('maps every new real filter to its API param', () => {
    const query = toSearchQuery({
      ...EMPTY_SEARCH_FILTERS,
      heightMinCm: '160',
      heightMaxCm: '175',
      motherTongue: ' Tamil ',
      physicalStatus: 'NORMAL',
      religion: 'Hindu',
      casteCommunity: 'Nadar',
      dosham: 'NO',
      employedIn: 'Private',
      incomeMinLakhs: '5',
      incomeMaxLakhs: '15',
      nearby: 'true',
      familyType: 'Middle Class',
      joinedWithinDays: '7',
      withPhoto: 'true',
      excludeShortlisted: 'true',
      verified: 'true',
    });
    expect(defined(query)).toEqual({
      heightMinCm: 160,
      heightMaxCm: 175,
      motherTongue: 'Tamil',
      physicalStatus: 'NORMAL',
      religion: 'Hindu',
      casteCommunity: 'Nadar',
      dosham: 'NO',
      employedIn: 'Private',
      incomeMinLakhs: 5,
      incomeMaxLakhs: 15,
      country: 'India',
      nearby: true,
      familyType: 'Middle Class',
      joinedWithinDays: 7,
      withPhoto: true,
      excludeShortlisted: true,
      verified: true,
    });
  });

  it('drops values outside each enum and unticked checkboxes', () => {
    const query = toSearchQuery({
      ...EMPTY_SEARCH_FILTERS,
      dosham: 'MAYBE',
      familyType: 'Nuclear',
      joinedWithinDays: '2',
      nearby: 'false',
      country: 'USA',
    });
    expect(defined(query)).toEqual({});
  });

  it('can never send a "coming soon" filter, even from a crafted URL', () => {
    const url = new URLSearchParams(
      'city=Madurai&star=Ashwini&profileCreatedBy=PARENT&eatingHabits=VEG&citizenship=NRI&institution=IIT&hobbies=Music&familyValue=TRADITIONAL&subcaste=X&excludeIgnored=true',
    );
    const filters = filtersFromUrl(url);
    expect(Object.keys(filters).sort()).toEqual(Object.keys(EMPTY_SEARCH_FILTERS).sort());
    expect(defined(toSearchQuery(filters))).toEqual({ city: 'Madurai', country: 'India' });
  });
});
