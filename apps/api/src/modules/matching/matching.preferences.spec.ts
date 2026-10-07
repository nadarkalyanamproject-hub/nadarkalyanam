import { partnerPreferencesSchema, type SavedPartnerPreferences } from '@nadar-kalyanam/schemas';
import { describe, expect, it } from 'vitest';
import { PREFERENCE_FIT_MAX, mustHaveFilters, preferenceFit, preferenceScore } from '../../common/preference-fit.js';
import { type FakeState, fakePhotosService, fakePrisma, makeProfile } from '../../common/testing/fake-profile-store.js';
import type { Profile } from '../../generated/prisma/client.js';
import { MatchingEngine } from './matching-engine.js';
import { MatchingService } from './matching.service.js';

/* eslint-disable @typescript-eslint/no-explicit-any */

const NONE: Omit<SavedPartnerPreferences, 'updatedAt'> = {
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
};
const prefs = (overrides: Partial<typeof NONE>) => ({ ...NONE, ...overrides });
const yearsAgo = (years: number) => {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear() - years, now.getUTCMonth(), now.getUTCDate()) - 86400000);
};
const candidate = (details: Record<string, unknown>, age = 28) =>
  ({ dateOfBirth: yearsAgo(age), details }) as unknown as Pick<Profile, 'dateOfBirth' | 'details'>;
const FULL = {
  height: `5'4" (163 cm)`,
  maritalStatus: 'NEVER_MARRIED',
  motherTongue: 'Tamil',
  dosham: 'NO',
  location: { city: 'Madurai', state: 'Tamil Nadu' },
  education: { annualIncomeRange: '8-12 LPA' },
};

describe('partner preferences validation', () => {
  const valid = { ...NONE };
  it('accepts an empty ("anything") set and dedupes lists', () => {
    expect(partnerPreferencesSchema.parse(valid)).toEqual(valid);
    expect(
      partnerPreferencesSchema.parse({
        ...valid,
        states: ['Kerala', 'Kerala'],
        cities: [' Madurai ', 'Madurai'],
      }),
    ).toMatchObject({
      states: ['Kerala'],
      cities: ['Madurai'],
    });
  });

  it.each([
    [{ ageMin: 30, ageMax: 25 }, 'ageMax'],
    [{ heightMinCm: 180, heightMaxCm: 150 }, 'heightMaxCm'],
    [{ incomeMinLakhs: 20, incomeMaxLakhs: 5 }, 'incomeMaxLakhs'],
    [{ ageMin: 17 }, 'ageMin'],
    [{ ageMax: 101 }, 'ageMax'],
    [{ heightMinCm: 99 }, 'heightMinCm'],
    [{ maritalStatuses: ['SINGLE'] }, 'maritalStatuses'],
    [{ motherTongues: ['Klingon'] }, 'motherTongues'],
    [{ states: ['Atlantis'] }, 'states'],
    [{ cities: Array.from({ length: 11 }, (_, i) => `City ${i}`) }, 'cities'],
    [{ doshamPreference: 'MAYBE' }, 'doshamPreference'],
    [{ mustHaveAge: true }, 'mustHaveAge'],
    [{ mustHaveMaritalStatus: true }, 'mustHaveMaritalStatus'],
    [{ mustHaveLocation: true }, 'mustHaveLocation'],
  ])('rejects %j', (overrides, path) => {
    const result = partnerPreferencesSchema.safeParse({
      ...valid,
      ...overrides,
    });
    expect(result.success).toBe(false);
    expect(result.error!.issues.some((issue) => issue.path[0] === path)).toBe(true);
  });

  it('rejects unknown fields (no must-have on anything else, no smuggled data)', () => {
    expect(partnerPreferencesSchema.safeParse({ ...valid, mustHaveIncome: true }).success).toBe(false);
    expect(partnerPreferencesSchema.safeParse({ ...valid, educationLevels: ['B.E'] }).success).toBe(false);
  });
});

describe('preferenceFit ("N of M preferences match")', () => {
  it('counts only the preferences that are set', () => {
    expect(preferenceFit(NONE, candidate(FULL))).toEqual({
      matched: 0,
      total: 0,
      unknown: 0,
      fields: [],
    });
    const fit = preferenceFit(
      prefs({
        ageMin: 25,
        ageMax: 30,
        states: ['Kerala'],
        doshamPreference: 'WITHOUT_DOSHAM',
      }),
      candidate(FULL),
    );
    expect(fit.fields).toEqual([
      { key: 'age', matched: true },
      { key: 'location', matched: false },
      { key: 'dosham', matched: true },
    ]);
    expect(fit).toMatchObject({ matched: 2, total: 3, unknown: 0 });
  });

  it('checks every field type against the profile', () => {
    const all = prefs({
      ageMin: 25,
      ageMax: 30,
      heightMinCm: 160,
      heightMaxCm: 170,
      maritalStatuses: ['NEVER_MARRIED'],
      motherTongues: ['tamil'],
      cities: ['madurai'],
      incomeMinLakhs: 10,
      doshamPreference: 'WITHOUT_DOSHAM',
    });
    expect(preferenceFit(all, candidate(FULL))).toMatchObject({
      matched: 7,
      total: 7,
    });
    const off = preferenceFit(
      all,
      candidate(
        {
          ...FULL,
          height: '6ft',
          maritalStatus: 'DIVORCED',
          motherTongue: 'Hindi',
          dosham: 'YES',
        },
        40,
      ),
    );
    expect(off.fields.filter((f) => f.matched === false).map((f) => f.key)).toEqual(['age', 'height', 'maritalStatus', 'motherTongue', 'dosham']);
  });

  it('reports unreadable or missing values as unknown, never as a match', () => {
    const fit = preferenceFit(
      prefs({
        heightMinCm: 150,
        incomeMinLakhs: 5,
        doshamPreference: 'WITH_DOSHAM',
        motherTongues: ['Tamil'],
      }),
      candidate({
        height: 'tall',
        dosham: 'DONT_KNOW',
        education: { annualIncomeRange: '10' },
      }),
    );
    expect(fit).toMatchObject({ matched: 0, total: 4, unknown: 4 });
  });
});

describe('preference score term (Matches)', () => {
  it('is bounded to 0..PREFERENCE_FIT_MAX and scales with the share matched', () => {
    expect(PREFERENCE_FIT_MAX).toBe(20);
    expect(preferenceScore({ matched: 0, total: 0 })).toBe(0);
    expect(preferenceScore({ matched: 0, total: 5 })).toBe(0);
    expect(preferenceScore({ matched: 5, total: 5 })).toBe(20);
    expect(preferenceScore({ matched: 1, total: 3 })).toBe(7);
  });

  const viewer = {
    dateOfBirth: new Date('1996-01-01'),
    details: { religion: 'Hindu' },
    completionScore: 100,
    isVerified: false,
  } as unknown as Profile;
  const cand = (searchBoost: number, details: Record<string, unknown> = FULL) =>
    ({
      visibility: 'PUBLIC',
      dateOfBirth: new Date('1996-01-01'),
      details: { religion: 'Hindu', ...details },
      completionScore: 100,
      isVerified: false,
      searchBoost,
    }) as unknown as Profile;

  it('adds at most 20 points on top of the unchanged compatibility + tier score', () => {
    const p = prefs({
      maritalStatuses: ['NEVER_MARRIED'],
      motherTongues: ['Tamil'],
    });
    for (const tier of [0, 1, 2]) {
      const without = MatchingEngine.computeScore(viewer, cand(tier));
      expect(MatchingEngine.computeScore(viewer, cand(tier), p) - without).toBe(20);
      expect(MatchingEngine.computeScore(viewer, cand(tier), null)).toBe(without);
    }
  });

  it('keeps the priority-listing order among candidates that fit preferences equally', () => {
    const p = prefs({ motherTongues: ['Tamil'] });
    const ranked = MatchingEngine.rankCandidates(viewer, [cand(0), cand(2), cand(1)], p);
    expect(ranked.map((r) => r.profile.searchBoost)).toEqual([2, 1, 0]);
  });

  it('a profile that fits the preferences can outrank a boosted one that does not (soft only)', () => {
    const p = prefs({
      motherTongues: ['Tamil'],
      doshamPreference: 'WITHOUT_DOSHAM',
    });
    const ranked = MatchingEngine.rankCandidates(viewer, [cand(2, { ...FULL, motherTongue: 'Hindi', dosham: 'YES' }), cand(0)], p);
    expect(ranked.map((r) => r.profile.searchBoost)).toEqual([0, 2]);
    // ...and never removes it: soft preferences only re-order.
    expect(ranked).toHaveLength(2);
  });
});

describe('Matches with partner preferences (service)', () => {
  function world(): FakeState {
    const p = (userId: string, extra: Record<string, unknown>) =>
      ({
        ...makeProfile({ userId, ...extra }),
        completionScore: 80,
        searchBoost: (extra.searchBoost as number) ?? 0,
      }) as any;
    return {
      profiles: [
        p('viewer', { details: { ...FULL } }),
        p('fits', { details: { ...FULL } }),
        p('divorced', { details: { ...FULL, maritalStatus: 'DIVORCED' } }),
        p('kerala', {
          details: { ...FULL, location: { city: 'Kochi', state: 'Kerala' } },
        }),
        p('hidden', { visibility: 'HIDDEN', details: { ...FULL } }),
        p('blocked', { details: { ...FULL } }),
        p('spotlight', {
          searchBoost: 2,
          details: { ...FULL, motherTongue: 'Hindi' },
        }),
      ],
      userStatus: {
        viewer: 'ACTIVE',
        fits: 'ACTIVE',
        divorced: 'ACTIVE',
        kerala: 'ACTIVE',
        hidden: 'ACTIVE',
        blocked: 'ACTIVE',
        spotlight: 'ACTIVE',
      },
      photos: [],
      blocks: [{ initiatorId: 'viewer', targetId: 'blocked' }],
      shortlists: [],
      notifications: [],
    };
  }
  const service = (state: FakeState, saved: typeof NONE | null) =>
    new MatchingService(fakePrisma(state) as never, fakePhotosService as never, { findForUser: async () => saved } as never);
  const ids = (r: { items: { profileId: string }[] }) => r.items.map((i) => i.profileId.replace('profile-', '')).sort();

  it('without preferences: unchanged candidates, no must-haves', async () => {
    const r = await service(world(), null).listMatches('viewer', 50);
    expect(ids(r)).toEqual(['divorced', 'fits', 'kerala', 'spotlight']);
    expect(r.preferences).toEqual({
      hasPreferences: false,
      mustHave: [],
      hiddenByMustHave: 0,
    });
  });

  it('soft preferences only rank; hidden and blocked members never appear', async () => {
    const r = await service(world(), prefs({ maritalStatuses: ['NEVER_MARRIED'], states: ['Tamil Nadu'] })).listMatches('viewer', 50);
    expect(ids(r)).toEqual(['divorced', 'fits', 'kerala', 'spotlight']);
    expect(r.items[0]!.profileId).not.toBe('profile-divorced');
    expect(r.preferences).toMatchObject({
      hasPreferences: true,
      mustHave: [],
      hiddenByMustHave: 0,
    });
  });

  it('must-haves filter, and say how many members they hold back', async () => {
    const r = await service(
      world(),
      prefs({
        maritalStatuses: ['NEVER_MARRIED'],
        mustHaveMaritalStatus: true,
        states: ['Tamil Nadu'],
        mustHaveLocation: true,
      }),
    ).listMatches('viewer', 50);
    expect(ids(r)).toEqual(['fits', 'spotlight']);
    expect(r.preferences).toEqual({
      hasPreferences: true,
      mustHave: ['maritalStatus', 'location'],
      hiddenByMustHave: 2,
    });
    expect(ids(r)).not.toContain('hidden');
    expect(ids(r)).not.toContain('blocked');
  });

  it('when must-haves remove everyone, the list is empty and the response says so (never silent)', async () => {
    const r = await service(world(), prefs({ ageMin: 60, ageMax: 70, mustHaveAge: true })).listMatches('viewer', 50);
    expect(r.items).toEqual([]);
    expect(r.preferences).toEqual({
      hasPreferences: true,
      mustHave: ['age'],
      hiddenByMustHave: 4,
    });
  });

  it('mustHaveFilters only applies flags whose values are set', () => {
    expect(mustHaveFilters(prefs({ mustHaveAge: false, ageMin: 25 })).keys).toEqual([]);
    expect(mustHaveFilters(prefs({ mustHaveLocation: true, cities: ['Madurai'] })).keys).toEqual(['location']);
  });
});
