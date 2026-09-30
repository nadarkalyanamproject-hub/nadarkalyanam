import { describe, expect, it } from 'vitest';
import { MATCH_CATEGORIES, findMatchCategory, matchCategoryHref } from './match-categories';

describe('Matches categories', () => {
  it('defines all 17 categories with unique slugs', () => {
    expect(MATCH_CATEGORIES).toHaveLength(17);
    expect(new Set(MATCH_CATEGORIES.map((c) => c.slug)).size).toBe(17);
  });

  it('has 8 real categories, each backed by a distinct data source', () => {
    const real = MATCH_CATEGORIES.filter((c) => c.kind === 'real');
    expect(real.map((c) => c.title)).toEqual([
      'Your Matches',
      'Shortlisted by you',
      'Viewed you',
      'Shortlisted you',
      'Viewed by you',
      'Newly Joined',
      'Nearby matches',
      'Matches with photos',
    ]);
    expect(new Set(real.map((c) => (c.kind === 'real' ? c.source : ''))).size).toBe(8);
  });

  it('has 9 coming-soon categories, each with its own specific message', () => {
    const soon = MATCH_CATEGORIES.filter((c) => c.kind === 'coming-soon');
    expect(soon).toHaveLength(9);
    const messages = soon.map((c) => (c.kind === 'coming-soon' ? c.message : ''));
    expect(new Set(messages).size).toBe(9);
    expect(messages.every((m) => m.length > 40)).toBe(true);
  });

  it('links every category to its own page, never to Search or Interests', () => {
    for (const category of MATCH_CATEGORIES) {
      expect(matchCategoryHref(category.slug)).toBe(`/matches/${category.slug}`);
    }
    expect(findMatchCategory('nope')).toBeUndefined();
    expect(() => matchCategoryHref('nope')).toThrow();
  });
});
