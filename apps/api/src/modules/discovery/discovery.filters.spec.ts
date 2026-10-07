import { searchProfilesQuerySchema, type SearchProfilesQuery } from '@nadar-kalyanam/schemas';
import { describe, expect, it } from 'vitest';
import { parseHeightCm, parseIncomeLakhs } from '../../common/profile-filters.js';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe.js';
import {
  type FakeProfile,
  type FakeState,
  fakePhotosService,
  fakePrisma,
  makeProfile,
} from '../../common/testing/fake-profile-store.js';
import { MatchCategoriesService } from '../match-categories/match-categories.service.js';
import { DiscoveryService } from './discovery.service.js';

/* eslint-disable @typescript-eslint/no-explicit-any */
const DAY = 24 * 60 * 60 * 1000;

// Every field a decoy can differ on. The target matches TARGET_QUERY on all
// of them; each decoy differs from the target in exactly one field.
const BASE_DETAILS = {
  maritalStatus: 'NEVER_MARRIED',
  motherTongue: 'Tamil',
  physicalStatus: 'NORMAL',
  religion: 'Hindu',
  casteCommunity: 'Nadar',
  dosham: 'NO',
  height: `5'4" (163 cm)`,
  location: { city: 'Madurai', state: 'Tamil Nadu', country: 'India' },
  education: { educationLevel: 'B.E', profession: 'Engineer', employedIn: 'Private', annualIncomeRange: '8-12 LPA' },
  additional: { familyType: 'Middle Class' },
};

function details(overrides: Record<string, any> = {}) {
  return {
    ...BASE_DETAILS,
    ...overrides,
    location: { ...BASE_DETAILS.location, ...overrides.location },
    education: { ...BASE_DETAILS.education, ...overrides.education },
    additional: { ...BASE_DETAILS.additional, ...overrides.additional },
  };
}

// filter key -> the decoy that only that filter should remove.
const DECOYS: Record<string, Partial<FakeProfile>> = {
  height: { details: details({ height: `5'10" (178 cm)` }) },
  heightUnreadable: { details: details({ height: 'tall' }) },
  motherTongue: { details: details({ motherTongue: 'Telugu' }) },
  physicalStatus: { details: details({ physicalStatus: 'PHYSICALLY_CHALLENGED' }) },
  religion: { details: details({ religion: 'Christian' }) },
  casteCommunity: { details: details({ casteCommunity: 'Brahmin' }) },
  dosham: { details: details({ dosham: 'YES' }) },
  income: { details: details({ education: { annualIncomeRange: '20 - 25 Lakhs' } }) },
  incomeBareNumber: { details: details({ education: { annualIncomeRange: '10' } }) },
  employedIn: { details: details({ education: { employedIn: 'Government' } }) },
  familyType: { details: details({ additional: { familyType: 'Upper Middle Class' } }) },
  country: { details: details({ location: { country: 'USA' } }) },
  nearby: { details: details({ location: { city: 'Bengaluru', state: 'Karnataka' } }) },
  joined: { createdAt: new Date(Date.now() - 60 * DAY) },
  photo: {},
  shortlisted: {},
  gender: { gender: 'MALE' },
  age: { dateOfBirth: new Date(Date.UTC(1975, 0, 1)) },
  city: { details: details({ location: { city: 'Salem' } }) }, // same state: still "nearby"
  maritalStatus: { details: details({ maritalStatus: 'DIVORCED' }) },
};

// query fragment -> decoys it must remove (and nothing else).
const SINGLE_FILTERS: [string, Record<string, unknown>, string[]][] = [
  ['height range', { heightMinCm: '160', heightMaxCm: '165' }, ['height', 'heightUnreadable']],
  ['mother tongue', { motherTongue: 'tamil' }, ['motherTongue']],
  ['physical status', { physicalStatus: 'NORMAL' }, ['physicalStatus']],
  ['religion', { religion: 'HINDU' }, ['religion']],
  ['caste', { casteCommunity: 'nadar' }, ['casteCommunity']],
  ['dosham', { dosham: 'NO' }, ['dosham']],
  ['annual income range', { incomeMinLakhs: '10', incomeMaxLakhs: '15' }, ['income', 'incomeBareNumber']],
  ['employment type', { employedIn: 'private' }, ['employedIn']],
  ['family status', { familyType: 'Middle Class' }, ['familyType']],
  ['country', { country: 'India' }, ['country']],
  ['nearby', { nearby: 'true' }, ['nearby']],
  ['created within', { joinedWithinDays: '30' }, ['joined']],
  ['with photo', { withPhoto: 'true' }, ['photo']],
  ['exclude shortlisted', { excludeShortlisted: 'true' }, ['shortlisted']],
];

function setup() {
  const me = makeProfile({ userId: 'me', details: details() });
  const target = makeProfile({ userId: 'target', details: details(), createdAt: new Date(Date.now() - DAY) });
  const decoys = Object.entries(DECOYS).map(([key, overrides]) =>
    makeProfile({ userId: key, details: details(), createdAt: new Date(Date.now() - DAY), ...overrides }),
  );
  const profiles = [me, target, ...decoys];
  const state: FakeState = {
    profiles,
    userStatus: Object.fromEntries(profiles.map((p) => [p.userId, 'ACTIVE'])),
    photos: profiles.filter((p) => p.userId !== 'photo').map((p) => ({ profileId: p.id })),
    blocks: [],
    shortlists: [{ id: 'sl-1', memberId: 'me', profileId: 'profile-shortlisted', createdAt: new Date() }],
    notifications: [],
  };
  const prisma = fakePrisma(state) as any;
  return {
    state,
    discovery: new DiscoveryService(prisma, fakePhotosService as never),
    matches: new MatchCategoriesService(prisma, fakePhotosService as never),
  };
}

const ALL_DECOYS = Object.keys(DECOYS);
const pid = (userId: string) => `profile-${userId}`;
const run = (service: DiscoveryService, raw: Record<string, unknown>) =>
  service.search('me', searchProfilesQuerySchema.parse({ limit: '50', ...raw }) as SearchProfilesQuery);
const ids = (items: { profileId: string }[]) => items.map((item) => item.profileId).sort();

describe('search filters — each narrows results independently', () => {
  it.each(SINGLE_FILTERS)('%s removes only the members that fail it', async (_name, query, removed) => {
    const { discovery } = setup();
    const { items, total } = await run(discovery, query);
    const expected = ['target', ...ALL_DECOYS.filter((key) => !removed.includes(key))].map(pid).sort();
    expect(ids(items)).toEqual(expected);
    expect(total).toBe(expected.length);
  });

  it('all new filters together with the existing ones leave only the member matching every one', async () => {
    const { discovery } = setup();
    const query = Object.assign(
      { gender: 'FEMALE', ageMin: '25', ageMax: '35', city: 'Madurai', maritalStatus: 'NEVER_MARRIED' },
      ...SINGLE_FILTERS.map(([, fragment]) => fragment),
    );
    const { items, total } = await run(discovery, query);
    expect(ids(items)).toEqual([pid('target')]);
    expect(total).toBe(1);
  });

  it('two new filters combine as AND, not OR, alongside an existing one', async () => {
    const { discovery } = setup();
    const { items } = await run(discovery, { motherTongue: 'Tamil', dosham: 'NO', city: 'Madurai' });
    const removed = ['motherTongue', 'dosham', 'city', 'nearby'];
    expect(ids(items)).toEqual(['target', ...ALL_DECOYS.filter((key) => !removed.includes(key))].map(pid).sort());
  });

  it('total counts every match, not just the returned page', async () => {
    const { discovery } = setup();
    const { items, total, nextCursor } = await run(discovery, { limit: '2' });
    expect(items).toHaveLength(2);
    expect(total).toBe(1 + ALL_DECOYS.length);
    expect(nextCursor).not.toBeNull();
  });
});

describe('verified filter', () => {
  it('keeps only identity-verified members and combines with other filters', async () => {
    const { state, discovery } = setup();
    state.profiles.find((p) => p.userId === 'target')!.isVerified = true;
    state.profiles.find((p) => p.userId === 'religion')!.isVerified = true;

    expect(ids((await run(discovery, { verified: 'true' })).items)).toEqual([pid('religion'), pid('target')].sort());
    expect(ids((await run(discovery, { verified: 'true', religion: 'Hindu' })).items)).toEqual([pid('target')]);
    expect((await run(discovery, { verified: 'false' })).total).toBe(1 + ALL_DECOYS.length);
  });
});

describe('nearby is the Matches "Nearby" rule', () => {
  it('returns the same members as GET /match-categories/nearby', async () => {
    const { discovery, matches } = setup();
    const search = await run(discovery, { nearby: 'true' });
    const nearby = await matches.nearby('me');
    expect(ids(search.items)).toEqual(ids(nearby.items));
  });

  it('a caller with no stored location has nobody nearby', async () => {
    const { state, discovery } = setup();
    state.profiles[0].details = { ...details(), location: { city: '', state: '' } };
    expect(await run(discovery, { nearby: 'true' })).toEqual({ items: [], nextCursor: null, total: 0 });
  });
});

describe('"coming soon" filters never reach the query', () => {
  const COMING_SOON = {
    star: 'Ashwini',
    horoscope: 'true',
    institution: 'Anna University',
    hobbies: 'Music',
    eatingHabits: 'VEGETARIAN',
    smokingHabits: 'NO',
    drinkingHabits: 'NO',
    familyValue: 'TRADITIONAL',
    citizenship: 'India',
    profileCreatedBy: 'PARENT',
    subcaste: 'Something',
    excludeIgnored: 'true',
  };

  it('are stripped by validation instead of being applied or rejected', () => {
    const pipe = new ZodValidationPipe(searchProfilesQuerySchema);
    const parsed = pipe.transform({ city: 'Madurai', ...COMING_SOON }) as Record<string, unknown>;
    expect(parsed.city).toBe('Madurai');
    for (const key of Object.keys(COMING_SOON)) expect(parsed).not.toHaveProperty(key);
  });

  it('leave results exactly as if they were never sent', async () => {
    const { discovery } = setup();
    const withThem = await run(discovery, COMING_SOON);
    const without = await run(discovery, {});
    expect(ids(withThem.items)).toEqual(ids(without.items));
  });

  it("'false' flags are off, not truthy strings", async () => {
    const { discovery } = setup();
    const { total } = await run(discovery, { nearby: 'false', withPhoto: 'false', excludeShortlisted: 'false' });
    expect(total).toBe(1 + ALL_DECOYS.length);
  });
});

describe('text values parsed for range filters', () => {
  it.each([
    [`5'4" (163 cm)`, 163],
    ['170 cm', 170],
    ['5ft 8in', 173],
    ['5 ft 10 in', 178],
    [`5'7"`, 170],
    ['tall', null],
    ['', null],
    [undefined, null],
  ])('height %j -> %j', (raw, cm) => expect(parseHeightCm(raw)).toBe(cm));

  it.each([
    ['8-12 LPA', { min: 8, max: 12 }],
    ['14 - 18 Lakhs', { min: 14, max: 18 }],
    ['10LPA', { min: 10, max: 10 }],
    ['25 lakh', { min: 25, max: 25 }],
    ['10', null],
    ['19', null],
    ['', null],
    [undefined, null],
  ])('income %j -> %j', (raw, range) => expect(parseIncomeLakhs(raw)).toEqual(range));
});

describe('comma-list filters ("Use my preferences")', () => {
  it('parses comma lists (trimmed, deduped) and keeps them optional', () => {
    const parsed = searchProfilesQuerySchema.parse({ stateIn: ' Tamil Nadu ,Kerala,,Kerala', maritalStatusIn: 'NEVER_MARRIED' });
    expect(parsed.stateIn).toEqual(['Tamil Nadu', 'Kerala']);
    expect(parsed.maritalStatusIn).toEqual(['NEVER_MARRIED']);
    expect(searchProfilesQuerySchema.parse({}).cityIn).toBeUndefined();
  });

  it('a profile matches when it has ANY of the listed values; other filters still AND', async () => {
    const { discovery } = setup();
    const all = ids((await run(discovery, {})).items);
    const { items } = await run(discovery, { maritalStatusIn: 'DIVORCED,NEVER_MARRIED', cityIn: 'madurai,Kochi' });
    // Both marital statuses pass; only the Salem and Bengaluru decoys fail the city list.
    expect(ids(items)).toEqual(all.filter((id) => id !== pid('city') && id !== pid('nearby')));
    expect(ids((await run(discovery, { maritalStatusIn: 'WIDOWED' })).items)).toEqual([]);
  });

  it('no list filter = exactly the old results', async () => {
    const { discovery } = setup();
    expect(ids((await run(discovery, { city: 'Madurai' })).items)).toEqual(ids((await run(discovery, { cityIn: 'Madurai' })).items));
  });

  it('stateIn matches the whole state name, ignoring case', async () => {
    const { discovery } = setup();
    const tn = ids((await run(discovery, { stateIn: 'tamil nadu' })).items);
    expect(tn).toContain(pid('target'));
    expect(ids((await run(discovery, { stateIn: 'Tamil' })).items)).toEqual([]);
  });
});
