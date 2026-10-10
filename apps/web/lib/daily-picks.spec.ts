import { describe, expect, it } from 'vitest';
import { istDateKey, pickDailyRecommendations } from './daily-picks';

const pool = Array.from({ length: 20 }, (_, i) => ({ profileId: `p${i}`, relationshipStatus: 'NONE' }));
const ids = (items: { profileId: string }[]) => items.map((item) => item.profileId);

describe('istDateKey', () => {
  it('uses the India date, which runs 5.5 hours ahead of UTC', () => {
    expect(istDateKey(new Date('2026-10-09T18:29:00Z'))).toBe('2026-10-09');
    expect(istDateKey(new Date('2026-10-09T18:31:00Z'))).toBe('2026-10-10');
  });
});

describe('pickDailyRecommendations', () => {
  const morning = new Date('2026-10-09T03:00:00Z');
  const evening = new Date('2026-10-09T15:00:00Z');
  const nextDay = new Date('2026-10-10T03:00:00Z');

  it('returns the same picks all day for one member', () => {
    const a = pickDailyRecommendations(pool, { userId: 'u1', count: 4, now: morning });
    const b = pickDailyRecommendations(pool, { userId: 'u1', count: 4, now: evening });
    expect(ids(a)).toEqual(ids(b));
    expect(a).toHaveLength(4);
  });

  it('changes the picks on the next day and between members', () => {
    const today = ids(pickDailyRecommendations(pool, { userId: 'u1', count: 4, now: morning }));
    expect(ids(pickDailyRecommendations(pool, { userId: 'u1', count: 4, now: nextDay }))).not.toEqual(today);
    expect(ids(pickDailyRecommendations(pool, { userId: 'u2', count: 4, now: morning }))).not.toEqual(today);
  });

  it('skips excluded profiles and anyone already interacted with', () => {
    const mixed = [
      { profileId: 'sent', relationshipStatus: 'INTEREST_SENT' },
      { profileId: 'connected', relationshipStatus: 'CONNECTED' },
      { profileId: 'shown', relationshipStatus: 'NONE' },
      { profileId: 'fresh', relationshipStatus: 'NONE' },
    ];
    const picks = pickDailyRecommendations(mixed, { userId: 'u1', count: 4, exclude: new Set(['shown']), now: morning });
    expect(ids(picks)).toEqual(['fresh']);
  });
});
