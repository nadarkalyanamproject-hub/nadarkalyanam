import { describe, expect, it } from 'vitest';
import type { SavedPartnerPreferences } from '@nadar-kalyanam/schemas';
import { hasSavedPreferences, planSearch } from './search-plan';
import { toSearchQuery } from './search-query';

const NONE_SET: SavedPartnerPreferences = {
  ageMin: null,
  ageMax: null,
  heightMinCm: null,
  heightMaxCm: null,
  maritalStatuses: [],
  motherTongues: [],
  states: [],
  cities: [],
  incomeMinLakhs: null,
  incomeMaxLakhs: null,
  doshamPreference: 'DOESNT_MATTER',
  mustHaveAge: false,
  mustHaveMaritalStatus: false,
  mustHaveLocation: false,
  updatedAt: '2026-10-01T00:00:00Z',
};
const PREFS: SavedPartnerPreferences = { ...NONE_SET, ageMin: 25, ageMax: 30, states: ['Tamil Nadu'], cities: ['Chennai'] };
const AGE_ONLY: SavedPartnerPreferences = { ...NONE_SET, ageMin: 25, ageMax: 30 };

// Preferences default to PREFS; pass undefined explicitly for "still loading"
// (a default parameter would swallow an explicit undefined).
const plan = (slug: string | null, usePreferences: boolean, ...preferences: [SavedPartnerPreferences | null | undefined] | []) =>
  planSearch({ slug, usePreferences, preferences: preferences.length ? preferences[0] : PREFS });
const query = (p: ReturnType<typeof planSearch>) => (p.kind === 'search' ? toSearchQuery(p.filters) : null);

describe('planSearch', () => {
  it('nothing chosen: just the category list', () => {
    expect(plan(null, false).kind).toBe('idle');
  });

  it('an unknown slug (old or mistyped link) is reported, not guessed', () => {
    expect(plan('looking-for-you', false)).toEqual({ kind: 'unknown', slug: 'looking-for-you' });
  });

  it('the preferences toggle alone searches with every saved preference', () => {
    const p = plan(null, true);
    expect(p.kind).toBe('search');
    expect(query(p)).toMatchObject({ ageMin: 25, ageMax: 30, stateIn: 'Tamil Nadu', cityIn: 'Chennai' });
  });

  it('the toggle waits for preferences to load, and asks for them when none are saved', () => {
    expect(plan(null, true, undefined).kind).toBe('waiting-for-preferences');
    expect(plan(null, true, null)).toMatchObject({ kind: 'needs-preferences', missing: 'any' });
    expect(plan(null, true, NONE_SET)).toMatchObject({ kind: 'needs-preferences', missing: 'any' });
  });

  it('coming-soon categories never load results, with or without preferences', () => {
    for (const slug of ['star-matches', 'horoscope-matches', 'mutual-matches', 'education-preference', 'professional-preference', 'nri-matches']) {
      expect(plan(slug, false).kind).toBe('coming-soon');
      expect(plan(slug, true).kind).toBe('coming-soon');
    }
  });

  it('activity lists use their own endpoint and say preferences do not apply', () => {
    expect(plan('viewed-you', false)).toMatchObject({ kind: 'endpoint', source: 'viewed-me', note: null });
    const withPrefs = plan('shortlisted-you', true);
    expect(withPrefs).toMatchObject({ kind: 'endpoint', source: 'shortlisted-you' });
    expect(withPrefs.kind === 'endpoint' && withPrefs.note).toMatch(/aren't applied/);
  });

  it('Your Matches uses the matching engine, which already ranks by preferences', () => {
    expect(plan('your-matches', false)).toMatchObject({ kind: 'endpoint', source: 'matches', note: null });
    const withPrefs = plan('your-matches', true);
    expect(withPrefs.kind === 'endpoint' && withPrefs.note).toMatch(/already based on your partner preferences/);
  });

  it('search-backed categories use their own endpoint, or Search with preferences on top', () => {
    expect(plan('newly-joined', false)).toMatchObject({ kind: 'endpoint', source: 'newly-joined' });
    expect(query(plan('newly-joined', true))).toMatchObject({ joinedWithinDays: 30, ageMin: 25, cityIn: 'Chennai' });
    expect(query(plan('nearby', true))).toMatchObject({ nearby: true, ageMax: 30 });
    expect(query(plan('with-photos', true))).toMatchObject({ withPhoto: true, stateIn: 'Tamil Nadu' });
    expect(plan('with-photos', true, null)).toMatchObject({ kind: 'needs-preferences', missing: 'any' });
    expect(plan('nearby', true, undefined).kind).toBe('waiting-for-preferences');
  });

  it('City/Location preference searches the saved states and cities only, unless the toggle adds the rest', () => {
    const own = query(plan('location-preference', false));
    expect(own).toMatchObject({ stateIn: 'Tamil Nadu', cityIn: 'Chennai' });
    expect(own?.ageMin).toBeUndefined();
    expect(query(plan('location-preference', true))).toMatchObject({ stateIn: 'Tamil Nadu', cityIn: 'Chennai', ageMin: 25 });
  });

  it('City/Location preference asks for a location when none is saved', () => {
    expect(plan('location-preference', false, AGE_ONLY)).toMatchObject({ kind: 'needs-preferences', missing: 'location' });
    expect(plan('location-preference', false, null)).toMatchObject({ kind: 'needs-preferences', missing: 'location' });
    expect(plan('location-preference', false, undefined).kind).toBe('waiting-for-preferences');
  });

  it('hasSavedPreferences ignores a saved-but-empty set', () => {
    expect(hasSavedPreferences(PREFS)).toBe(true);
    expect(hasSavedPreferences(NONE_SET)).toBe(false);
    expect(hasSavedPreferences(null)).toBe(false);
    expect(hasSavedPreferences(undefined)).toBe(false);
  });
});
