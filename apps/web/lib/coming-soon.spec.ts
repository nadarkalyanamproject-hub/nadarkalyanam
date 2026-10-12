import { describe, expect, it } from 'vitest';
import { COMING_SOON } from './coming-soon';

describe('coming-soon wording', () => {
  // Partner preferences is a real Profile section now (no longer "coming
  // soon"). Search no longer has coming-soon filter fields.
  it('covers every Profile coming-soon section and row', () => {
    for (const key of ['habits', 'hobbies', 'star', 'familyValue', 'citizenship'] as const) {
      expect(COMING_SOON[key].label).toBeTruthy();
      expect(COMING_SOON[key].reason.length).toBeGreaterThan(20);
    }
  });
});
