import { partnerPreferencesSchema, updateHoroscopeSchema, type SavedPartnerPreferences } from '@nadar-kalyanam/schemas';
import { describe, expect, it } from 'vitest';
import {
  horoscopeFormFrom,
  horoscopeRows,
  horoscopeViewRows,
  mustHaveNotice,
  parseCityList,
  formatHeightCm,
  preferenceFitLine,
  preferenceSummary,
  preferencesFormFrom,
  searchFiltersFromPreferences,
  toHoroscopeRequest,
  theirPreferenceRows,
  toPreferencesRequest,
} from './partner-preferences';
import { EMPTY_SEARCH_FILTERS, toSearchQuery } from './search-query';

const SAVED: SavedPartnerPreferences = {
  ageMin: 25,
  ageMax: 31,
  heightMinCm: null,
  heightMaxCm: 175,
  maritalStatuses: ['NEVER_MARRIED', 'DIVORCED'],
  motherTongues: ['Tamil'],
  states: ['Tamil Nadu'],
  cities: ['Bengaluru'],
  incomeMinLakhs: 10,
  incomeMaxLakhs: null,
  doshamPreference: 'WITHOUT_DOSHAM',
  mustHaveAge: true,
  mustHaveMaritalStatus: false,
  mustHaveLocation: true,
  updatedAt: '2026-10-07T00:00:00.000Z',
};

describe('preferences form', () => {
  it('round-trips saved preferences through the form into a valid request', () => {
    const request = toPreferencesRequest(preferencesFormFrom(SAVED));
    const parsed = partnerPreferencesSchema.parse(request);
    expect({ ...parsed, updatedAt: SAVED.updatedAt }).toEqual(SAVED);
  });

  it('an empty form is a valid "no preference" request', () => {
    expect(partnerPreferencesSchema.safeParse(toPreferencesRequest(preferencesFormFrom(null))).success).toBe(true);
  });

  it('parses a typed city list', () => {
    expect(parseCityList(' Madurai,  chennai ,, Madurai')).toEqual(['Madurai', 'chennai']);
  });

  it('summarises only what is set, marking must-haves', () => {
    expect(preferenceSummary(SAVED)).toEqual([
      { label: 'Age', value: '25 yrs – 31 yrs', mustHave: true },
      { label: 'Height', value: 'Up to 175 cm', mustHave: false },
      {
        label: 'Marital status',
        value: 'Never married, Divorced',
        mustHave: false,
      },
      { label: 'Mother tongue', value: 'Tamil', mustHave: false },
      { label: 'Location', value: 'Tamil Nadu, Bengaluru', mustHave: true },
      { label: 'Annual income', value: '₹10 L or more', mustHave: false },
      { label: 'Dosham', value: 'No dosham', mustHave: false },
    ]);
  });
});

describe('fit line and must-have notice', () => {
  it('says N of M, and how many could not be checked', () => {
    expect(preferenceFitLine({ matched: 3, total: 5, unknown: 0, fields: [] })).toBe('3 of 5 of your preferences match');
    expect(preferenceFitLine({ matched: 1, total: 3, unknown: 2, fields: [] })).toBe(
      '1 of 3 of your preferences match (2 not stated on this profile)',
    );
  });

  it('explains an empty Matches list caused by must-haves, and says nothing otherwise', () => {
    expect(
      mustHaveNotice(
        {
          hasPreferences: true,
          mustHave: ['age', 'location'],
          hiddenByMustHave: 4,
        },
        0,
      ),
    ).toBe('No members meet your must-have preferences (age, location). 4 members would show if you relaxed them.');
    expect(mustHaveNotice({ hasPreferences: true, mustHave: ['age'], hiddenByMustHave: 1 }, 3)).toBe(
      'Your must-have preferences (age) are hiding 1 member.',
    );
    expect(mustHaveNotice({ hasPreferences: true, mustHave: [], hiddenByMustHave: 0 }, 0)).toBeNull();
    expect(mustHaveNotice({ hasPreferences: false, mustHave: [], hiddenByMustHave: 0 }, 0)).toBeNull();
  });
});

describe('Search "Use my preferences"', () => {
  it('fills the filters from preferences, lists as "any of"', () => {
    const typedByMember = { ...EMPTY_SEARCH_FILTERS, city: 'Salem' };
    const query = toSearchQuery({
      ...typedByMember,
      ...searchFiltersFromPreferences(SAVED),
    });
    expect(query).toMatchObject({
      ageMin: 25,
      ageMax: 31,
      heightMaxCm: 175,
      incomeMinLakhs: 10,
      dosham: 'NO',
      maritalStatusIn: 'NEVER_MARRIED,DIVORCED',
      motherTongueIn: 'Tamil',
      stateIn: 'Tamil Nadu',
      cityIn: 'Bengaluru',
    });
    // The single city box is cleared so it can't contradict the list.
    expect(query.city).toBeUndefined();
  });

  it('with the toggle off, the query is exactly as before (no list params)', () => {
    const query = toSearchQuery({ ...EMPTY_SEARCH_FILTERS, ageMin: '25' });
    expect(query.maritalStatusIn).toBeUndefined();
    expect(query.stateIn).toBeUndefined();
    expect(query.cityIn).toBeUndefined();
    expect(query.motherTongueIn).toBeUndefined();
  });
});

describe('horoscope form and display', () => {
  it('a new horoscope starts hidden, with birth details not shared', () => {
    const form = horoscopeFormFrom(null);
    expect(form.visibility).toBe('HIDDEN');
    expect(form.shareBirthDetails).toBe(false);
    expect(updateHoroscopeSchema.safeParse(toHoroscopeRequest(form)).success).toBe(true);
  });

  it('builds a valid request and shows labelled rows', () => {
    const form = {
      ...horoscopeFormFrom(null),
      rasi: 'SIMMAM',
      nakshatra: 'MAGAM',
      nakshatraPada: '2',
      sevvaiDosham: 'NO',
      birthTime: '06:15',
    };
    expect(updateHoroscopeSchema.parse(toHoroscopeRequest(form))).toMatchObject({ rasi: 'SIMMAM', nakshatraPada: 2, birthTime: '06:15' });
    expect(
      horoscopeRows({
        rasi: 'SIMMAM',
        nakshatra: 'MAGAM',
        nakshatraPada: 2,
        lagnam: null,
        sevvaiDosham: 'NO',
        raguKethuDosham: null,
        birthTime: null,
        birthPlace: null,
      }),
    ).toEqual([
      { label: 'Rasi', value: 'Simmam (Leo)' },
      { label: 'Nakshatra', value: 'Magam, pada 2' },
      { label: 'Sevvai (Chevvai) dosham', value: 'No' },
    ]);
  });

  it('a "not shared" view has no rows at all', () => {
    expect(horoscopeViewRows({ shared: false })).toEqual([]);
  });
});

describe('their partner preferences', () => {
  it('formats heights in feet and inches', () => {
    expect(formatHeightCm(168)).toBe(`5'6"`);
    expect(formatHeightCm(152)).toBe(`5'0"`);
  });

  it('builds one row per preference the API checked, with the viewer match', () => {
    const rows = theirPreferenceRows(SAVED, {
      matched: 2,
      total: 4,
      unknown: 1,
      fields: [
        { key: 'age', matched: true },
        { key: 'height', matched: false },
        { key: 'location', matched: true },
        { key: 'income', matched: null },
      ],
    });
    expect(rows).toEqual([
      { key: 'age', label: 'Age', value: '25 yrs – 31 yrs', mustHave: true, matched: true },
      { key: 'height', label: 'Height', value: `Up to 5'9"`, mustHave: false, matched: false },
      { key: 'location', label: 'Location', value: 'Bengaluru, Tamil Nadu', mustHave: true, matched: true },
      { key: 'income', label: 'Annual income', value: '₹10 L or more', mustHave: false, matched: null },
    ]);
  });
});
