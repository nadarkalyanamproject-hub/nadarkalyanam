import { describe, expect, it } from 'vitest';
import { COMING_SOON } from './coming-soon';
import { COMING_SOON_FILTERS } from '../components/search/partner-search-bar';

describe('coming-soon wording', () => {
  it('Search shows exactly the shared text, so a gap is never explained two ways', () => {
    for (const [key, value] of Object.entries(COMING_SOON_FILTERS)) {
      expect(value).toBe(COMING_SOON[key as keyof typeof COMING_SOON]);
    }
    expect(Object.keys(COMING_SOON_FILTERS)).toHaveLength(7);
  });

  // Partner preferences is a real Profile section now (no longer "coming
  // soon"); star stays for the Search filter.
  it('covers every Profile coming-soon section and row', () => {
    for (const key of ['habits', 'hobbies', 'star', 'familyValue', 'citizenship'] as const) {
      expect(COMING_SOON[key].label).toBeTruthy();
      expect(COMING_SOON[key].reason.length).toBeGreaterThan(20);
    }
  });
});
