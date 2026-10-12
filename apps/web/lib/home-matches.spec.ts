import { describe, expect, it } from 'vitest';
import { splitHomeMatches } from './home-matches';

type Status = 'NONE' | 'INTEREST_SENT' | 'INTEREST_RECEIVED' | 'CONNECTED';
const match = (profileId: string, relationshipStatus: Status = 'NONE') => ({ profileId, relationshipStatus });
const ids = (items: { profileId: string }[]) => items.map((item) => item.profileId);
const options = { userId: 'u1', recommendedCount: 4, dailyCount: 5, now: new Date('2026-10-09T03:00:00Z') };

describe('splitHomeMatches', () => {
  it('drops connected members first, then fills the recommended row from the rest of the ranking', () => {
    const ranked = [match('c1', 'CONNECTED'), match('p1'), match('c2', 'CONNECTED'), match('p2'), match('p3', 'INTEREST_SENT'), match('p4'), match('p5'), match('p6')];
    const { recommended, dailyPicks } = splitHomeMatches(ranked, options);
    expect(ids(recommended)).toEqual(['p1', 'p2', 'p3', 'p4']);
    expect(ids(dailyPicks).sort()).toEqual(['p5', 'p6']);
  });

  it('never puts a connected member in either row', () => {
    const ranked = Array.from({ length: 30 }, (_, i) => match(`p${i}`, i % 3 === 0 ? 'CONNECTED' : 'NONE'));
    const { recommended, dailyPicks } = splitHomeMatches(ranked, options);
    expect(recommended).toHaveLength(4);
    expect(dailyPicks).toHaveLength(5);
    expect([...recommended, ...dailyPicks].some((m) => m.relationshipStatus === 'CONNECTED')).toBe(false);
    expect(ids(dailyPicks).some((id) => ids(recommended).includes(id))).toBe(false);
  });

  it('returns empty rows when everyone is connected', () => {
    const { recommended, dailyPicks } = splitHomeMatches([match('c1', 'CONNECTED'), match('c2', 'CONNECTED')], options);
    expect(recommended).toEqual([]);
    expect(dailyPicks).toEqual([]);
  });

  it('keeps the ranking order when no one is connected', () => {
    const ranked = Array.from({ length: 6 }, (_, i) => match(`p${i}`));
    const { recommended, dailyPicks } = splitHomeMatches(ranked, options);
    expect(ids(recommended)).toEqual(['p0', 'p1', 'p2', 'p3']);
    expect(ids(dailyPicks).sort()).toEqual(['p4', 'p5']);
  });

  it('handles fewer matches than the row and an empty list', () => {
    expect(ids(splitHomeMatches([match('p1')], options).recommended)).toEqual(['p1']);
    expect(splitHomeMatches([], options)).toEqual({ recommended: [], dailyPicks: [] });
  });

  it("someone connecting mid-day doesn't reshuffle the rest of today's daily picks", () => {
    const ranked = Array.from({ length: 40 }, (_, i) => match(`p${i}`));
    const morning = splitHomeMatches(ranked, options).dailyPicks;
    const later = ranked.map((m) => (m.profileId === morning[0].profileId ? match(m.profileId, 'CONNECTED') : m));
    const afternoon = splitHomeMatches(later, { ...options, now: new Date('2026-10-09T12:00:00Z') }).dailyPicks;
    expect(afternoon).toHaveLength(5);
    expect(ids(afternoon)).toEqual(expect.arrayContaining(ids(morning).slice(1)));
  });
});
