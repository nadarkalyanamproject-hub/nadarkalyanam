import 'reflect-metadata';
import { describe, expect, it } from 'vitest';
import {
  type FakeState,
  fakePhotosService,
  fakePrisma,
  makeProfile,
} from '../../common/testing/fake-profile-store.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { MatchCategoriesController } from './match-categories.controller.js';
import { MatchCategoriesService } from './match-categories.service.js';

const DAY = 24 * 60 * 60 * 1000;
const NOW = new Date(Date.UTC(2026, 8, 30));
const pid = (userId: string) => `profile-${userId}`;

// Each list gets one excluded member of every kind next to the real ones, so
// a test fails if any exclusion rule is missing.
function setup(extra: Partial<FakeState> = {}, locations: Record<string, { city: string; state: string }> = {}) {
  const ids = ['me', 'a', 'b', 'c', 'blocker', 'blocked', 'suspended', 'hidden'];
  const state: FakeState = {
    profiles: ids.map((userId, index) =>
      makeProfile({
        userId,
        visibility: userId === 'hidden' ? 'HIDDEN' : 'PUBLIC',
        createdAt: new Date(NOW.getTime() - (index + 1) * DAY),
        details: {
          location: locations[userId] ?? { city: 'Chennai', state: 'Tamil Nadu' },
          education: { educationLevel: 'Bachelors', profession: 'Engineer' },
        },
      }),
    ),
    userStatus: Object.fromEntries(ids.map((id) => [id, id === 'suspended' ? 'SUSPENDED' : 'ACTIVE'])),
    photos: [],
    blocks: [
      { initiatorId: 'blocker', targetId: 'me' },
      { initiatorId: 'me', targetId: 'blocked' },
    ],
    shortlists: [],
    notifications: [],
    ...extra,
  };
  return { state, service: new MatchCategoriesService(fakePrisma(state) as never, fakePhotosService as never) };
}
const EXCLUDED = ['me', 'blocker', 'blocked', 'suspended', 'hidden'].map(pid);
const ids = (items: { profileId: string }[]) => items.map((item) => item.profileId);

describe('MatchCategoriesService', () => {
  it('newly joined: only the last 30 days, newest first, exclusions applied', async () => {
    const { state, service } = setup();
    state.profiles.find((p) => p.userId === 'c')!.createdAt = new Date(NOW.getTime() - 45 * DAY);

    const { items } = await service.newlyJoined('me', NOW);

    expect(ids(items)).toEqual([pid('a'), pid('b')]);
  });

  it('nearby: same city first, then same state; nobody elsewhere; exclusions applied', async () => {
    const { service } = setup({}, {
      me: { city: 'Madurai', state: 'Tamil Nadu' },
      a: { city: 'Chennai', state: 'Tamil Nadu' }, // same state
      b: { city: 'madurai', state: 'Tamil Nadu' }, // same city (different case)
      c: { city: 'Bengaluru', state: 'Karnataka' }, // elsewhere
      blocked: { city: 'Madurai', state: 'Tamil Nadu' },
      suspended: { city: 'Madurai', state: 'Tamil Nadu' },
      hidden: { city: 'Madurai', state: 'Tamil Nadu' },
      blocker: { city: 'Madurai', state: 'Tamil Nadu' },
    });

    const result = await service.nearby('me');

    expect(ids(result.items)).toEqual([pid('b'), pid('a')]);
    expect(result).toMatchObject({ city: 'Madurai', state: 'Tamil Nadu' });
  });

  it('nearby: returns nothing (and says so) when my own profile has no location', async () => {
    const { state, service } = setup();
    state.profiles.find((p) => p.userId === 'me')!.details = {};

    expect(await service.nearby('me')).toEqual({ items: [], city: null, state: null });
  });

  it('with photos: only members who have at least one photo, exclusions applied', async () => {
    const { service } = setup({
      photos: ['a', 'c', 'blocker', 'blocked', 'suspended', 'hidden'].map((userId) => ({ profileId: pid(userId) })),
    });

    const { items } = await service.withPhotos('me');

    expect(ids(items)).toEqual([pid('a'), pid('c')]);
  });

  it('viewed you: each viewer once, most recent view first, exclusions applied', async () => {
    const view = (actor: string, recipient: string, daysAgo: number) => ({
      userId: recipient,
      actorUserId: actor,
      type: 'PROFILE_VIEWED',
      createdAt: new Date(NOW.getTime() - daysAgo * DAY),
    });
    const { service } = setup({
      notifications: [
        view('a', 'me', 5),
        view('b', 'me', 1),
        view('a', 'me', 3), // a again: listed once, at the most recent position
        view('c', 'b', 0), // not about me
        ...['blocker', 'blocked', 'suspended', 'hidden'].map((u) => view(u, 'me', 0)),
        { userId: 'me', actorUserId: 'c', type: 'INTEREST_RECEIVED', createdAt: NOW }, // not a view
      ],
    });

    const { items } = await service.viewedMe('me');

    expect(ids(items)).toEqual([pid('b'), pid('a')]);
    expect(EXCLUDED.some((id) => ids(items).includes(id))).toBe(false);
  });

  it('viewed by you: each member I viewed once, most recent first, exclusions applied', async () => {
    const view = (recipient: string, daysAgo: number, actor = 'me') => ({
      userId: recipient,
      actorUserId: actor,
      type: 'PROFILE_VIEWED',
      createdAt: new Date(NOW.getTime() - daysAgo * DAY),
    });
    const { service } = setup({
      notifications: [
        view('c', 4),
        view('a', 2),
        view('c', 1),
        view('b', 0, 'a'), // someone else's view
        ...['blocker', 'blocked', 'suspended', 'hidden'].map((u) => view(u, 0)),
      ],
    });

    const { items } = await service.viewedByMe('me');

    expect(ids(items)).toEqual([pid('c'), pid('a')]);
  });
});

describe('MatchCategoriesController', () => {
  it('is mounted at /match-categories behind the member JwtAuthGuard', () => {
    expect(Reflect.getMetadata('path', MatchCategoriesController)).toBe('match-categories');
    expect(Reflect.getMetadata('__guards__', MatchCategoriesController)).toEqual([JwtAuthGuard]);
    for (const [handler, path] of [
      ['newlyJoined', 'newly-joined'],
      ['nearby', 'nearby'],
      ['withPhotos', 'with-photos'],
      ['viewedMe', 'viewed-me'],
      ['viewedByMe', 'viewed-by-me'],
    ] as const) {
      expect(Reflect.getMetadata('path', MatchCategoriesController.prototype[handler])).toBe(path);
    }
  });
});
