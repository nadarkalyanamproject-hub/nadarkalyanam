import { describe, expect, it } from 'vitest';
import { searchProfilesQuerySchema } from '@nadar-kalyanam/schemas';
import type { Profile } from '../generated/prisma/client.js';
import { DiscoveryService } from '../modules/discovery/discovery.service.js';
import { MatchCategoriesService } from '../modules/match-categories/match-categories.service.js';
import { MatchingEngine } from '../modules/matching/matching-engine.js';
import { ProfilesService } from '../modules/profiles/profiles.service.js';
import { MATCH_SCORE_BOOST, encodeSearchCursor, parseSearchCursor, searchBoostForPlanCode } from './search-boost.js';
import { type FakeState, fakePhotosService, fakePrisma, makeProfile } from './testing/fake-profile-store.js';

// 9 members: 3 standard, 3 priority, 3 spotlight, ids deliberately not in
// tier order, plus the viewer.
function world(): FakeState {
  const tiers: Record<string, number> = { a: 0, b: 2, c: 1, d: 0, e: 2, f: 1, g: 0, h: 1, i: 2 };
  const profiles = [makeProfile({ userId: 'viewer' }), ...Object.entries(tiers).map(([id, searchBoost]) => makeProfile({ userId: id, searchBoost }))];
  return {
    profiles,
    userStatus: Object.fromEntries(profiles.map((p) => [p.userId, 'ACTIVE'])),
    photos: [],
    blocks: [],
    shortlists: [],
    notifications: [],
  };
}

const ids = (items: { profileId?: string; id?: string }[]) => items.map((i) => (i.profileId ?? i.id)!.replace('profile-', ''));

async function searchAll(state: FakeState, limit: number, mutateBetweenPages?: (page: number) => void) {
  const service = new DiscoveryService(fakePrisma(state) as never, fakePhotosService as never);
  const seen: string[] = [];
  let cursor: string | undefined;
  for (let page = 0; page < 20; page += 1) {
    const result = await service.search('viewer', searchProfilesQuerySchema.parse({ limit, ...(cursor ? { cursor } : {}) }));
    seen.push(...ids(result.items));
    if (!result.nextCursor) break;
    cursor = result.nextCursor;
    mutateBetweenPages?.(page);
  }
  return seen;
}

describe('plan tiers', () => {
  it('maps plans to tiers: Gold standard, Gold Plus priority, Premium and VIP spotlight', () => {
    expect([null, 'GOLD', 'GOLD_PLUS', 'GOLD_PREMIUM', 'VIP_ASSISTED'].map(searchBoostForPlanCode)).toEqual([0, 0, 1, 2, 2]);
  });

  it('search cursors carry the tier and the id; an old id-only cursor still parses', () => {
    expect(encodeSearchCursor({ searchBoost: 2, id: 'abc' })).toBe('2:abc');
    expect(parseSearchCursor('2:abc')).toEqual({ boost: 2, id: 'abc' });
    expect(parseSearchCursor('abc')).toEqual({ id: 'abc' });
  });
});

describe('Search (default sort)', () => {
  it('lists spotlight, then priority, then standard; the existing id order within a tier', async () => {
    expect(await searchAll(world(), 50)).toEqual(['b', 'e', 'i', 'c', 'f', 'h', 'a', 'd', 'g']);
  });

  it.each([1, 2, 4])('paging %i at a time returns every profile exactly once, in the same order', async (limit) => {
    const seen = await searchAll(world(), limit);
    expect(seen).toEqual(['b', 'e', 'i', 'c', 'f', 'h', 'a', 'd', 'g']);
    expect(new Set(seen).size).toBe(seen.length);
  });

  it('a tier changing between pages never repeats a profile or skips one that stayed put', async () => {
    const state = world();
    const seen = await searchAll(state, 2, (page) => {
      // After page 1 (b, e), "a" (not yet listed) is promoted to spotlight.
      if (page === 0) state.profiles.find((p) => p.userId === 'a')!.searchBoost = 2;
    });
    expect(new Set(seen).size).toBe(seen.length);
    for (const unchanged of ['b', 'e', 'i', 'c', 'f', 'h', 'd', 'g']) expect(seen).toContain(unchanged);
  });

  it('the "newest" sort is date-based and not boosted', async () => {
    const service = new DiscoveryService(fakePrisma(world()) as never, fakePhotosService as never);
    const result = await service.search('viewer', searchProfilesQuerySchema.parse({ sort: 'newest', limit: 50 }));
    // makeProfile creates later members with later createdAt: newest first.
    expect(ids(result.items)).toEqual(['i', 'h', 'g', 'f', 'e', 'd', 'c', 'b', 'a']);
  });
});

describe('Browse', () => {
  it('orders by tier first, then newest, across offset pages without gaps', async () => {
    const service = new ProfilesService(fakePrisma(world()) as never);
    const first = await service.listOtherProfiles('viewer', 0, 4);
    const second = await service.listOtherProfiles('viewer', 4, 10);
    const order = [...ids(first.profiles), ...ids(second.profiles)];
    expect(order).toEqual(['i', 'e', 'b', 'h', 'f', 'c', 'g', 'd', 'a']);
  });
});

describe('Newly Joined (date-based)', () => {
  it('is not boosted: newest first regardless of tier', async () => {
    const state = world();
    const service = new MatchCategoriesService(fakePrisma(state) as never, fakePhotosService as never);
    // Fixture members join on 1 Jan 2026 (seconds apart).
    const result = await service.newlyJoined('viewer', new Date(Date.UTC(2026, 0, 10)));
    expect(ids(result.items)).toEqual(['i', 'h', 'g', 'f', 'e', 'd', 'c', 'b', 'a']);
  });
});

describe('Matches score term', () => {
  const viewer = { dateOfBirth: new Date('1995-01-01'), details: { religion: 'Hindu' }, completionScore: 100, isVerified: false } as unknown as Profile;
  const candidate = (searchBoost: number, religion = 'Hindu') =>
    ({ visibility: 'PUBLIC', dateOfBirth: new Date('1995-01-01'), details: { religion }, completionScore: 100, isVerified: false, searchBoost }) as unknown as Profile;

  it('adds a small bonus: spotlight > priority > standard when otherwise equal', () => {
    const [standard, priority, spotlight] = [0, 1, 2].map((tier) => MatchingEngine.computeScore(viewer, candidate(tier)));
    expect(priority! - standard!).toBe(MATCH_SCORE_BOOST[1]);
    expect(spotlight! - standard!).toBe(MATCH_SCORE_BOOST[2]);
    expect(MATCH_SCORE_BOOST[1]).toBeLessThan(MATCH_SCORE_BOOST[2]!);
  });

  it('stays small: a better compatibility match still outranks a boosted weaker one', () => {
    const ranked = MatchingEngine.rankCandidates(viewer, [candidate(2, 'Christian'), candidate(0, 'Hindu')]);
    expect((ranked[0]!.profile as unknown as { searchBoost: number }).searchBoost).toBe(0);
  });
});
