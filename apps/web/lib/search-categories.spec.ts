import { describe, expect, it } from 'vitest';
import { CATEGORY_GROUPS, SEARCH_CATEGORIES, findSearchCategory, searchCategoryHref, searchHref } from './search-categories';

describe('Search categories', () => {
  it('lists the 15 categories, each with a unique slug', () => {
    expect(SEARCH_CATEGORIES.map((c) => c.title)).toEqual([
      'Shortlisted by you',
      'Viewed you',
      'Shortlisted you',
      'Viewed by you',
      'Newly Joined',
      'Nearby matches',
      'Matches with photos',
      'NRI matches',
      'Your Matches',
      'City/Location preference',
      'Education preference',
      'Professional preference',
      'Mutual matches',
      'Star matches',
      'Horoscope matches',
    ]);
    expect(new Set(SEARCH_CATEGORIES.map((c) => c.slug)).size).toBe(15);
  });

  it('groups every category under Activity, Profile or Preferences', () => {
    expect(CATEGORY_GROUPS.map((g) => g.title)).toEqual(['Activity', 'Profile', 'Preferences']);
    for (const group of CATEGORY_GROUPS) {
      expect(SEARCH_CATEGORIES.some((c) => c.group === group.key)).toBe(true);
    }
  });

  it('backs each real category with its own data source', () => {
    const real = SEARCH_CATEGORIES.filter((c) => c.kind === 'real');
    expect(real).toHaveLength(9);
    expect(new Set(real.map((c) => (c.kind === 'real' ? c.source : ''))).size).toBe(9);
  });

  it('gives each coming-soon category its own specific reason', () => {
    const soon = SEARCH_CATEGORIES.filter((c) => c.kind === 'coming-soon');
    expect(soon.map((c) => c.slug).sort()).toEqual([
      'education-preference',
      'horoscope-matches',
      'mutual-matches',
      'nri-matches',
      'professional-preference',
      'star-matches',
    ]);
    const messages = soon.map((c) => (c.kind === 'coming-soon' ? c.message : ''));
    expect(new Set(messages).size).toBe(soon.length);
    expect(messages.every((m) => m.length > 40)).toBe(true);
  });

  it('keeps the slugs the old /matches/<slug> pages used, so redirected links still land', () => {
    for (const slug of ['your-matches', 'shortlisted-by-you', 'viewed-you', 'shortlisted-you', 'viewed-by-you', 'newly-joined', 'nearby', 'with-photos', 'location-preference', 'nri-matches']) {
      expect(findSearchCategory(slug)).toBeDefined();
    }
  });

  it('builds shareable Search URLs', () => {
    expect(searchCategoryHref('viewed-you')).toBe('/search?category=viewed-you');
    expect(() => searchCategoryHref('nope')).toThrow();
    expect(findSearchCategory('nope')).toBeUndefined();
    expect(findSearchCategory(null)).toBeUndefined();
    expect(searchHref({ category: null, usePreferences: false })).toBe('/search');
    expect(searchHref({ category: 'nearby', usePreferences: true })).toBe('/search?category=nearby&prefs=1');
    expect(searchHref({ category: null, usePreferences: true })).toBe('/search?prefs=1');
  });
});
