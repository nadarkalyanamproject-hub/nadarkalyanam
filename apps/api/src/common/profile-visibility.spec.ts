import { describe, expect, it } from 'vitest';
import { isVisibleToOtherMembers, photoStatus } from './photo-visibility.js';
import { canSeeGender, NO_PROFILES, profileVisibilityWhere, visibleProfilesWhere } from './profile-cards.js';
import { WITH_PHOTO_WHERE } from './profile-filters.js';
import { type FakeState, fakePrisma, makeProfile, matchesProfileWhere } from './testing/fake-profile-store.js';

// The shared rule every member-facing list uses (Search, Matches, Browse,
// Shortlist, the profile page) — evaluated against an in-memory store, so
// these prove who would actually be returned.
function world(): FakeState {
  return {
    profiles: [
      makeProfile({ userId: 'viewer' }),
      makeProfile({ userId: 'public', visibility: 'PUBLIC' }),
      makeProfile({ userId: 'members', visibility: 'MEMBERS_ONLY' }),
      makeProfile({ userId: 'hidden', visibility: 'HIDDEN' }),
      makeProfile({ userId: 'suspended', visibility: 'PUBLIC' }),
      makeProfile({ userId: 'blocked-by-viewer', visibility: 'PUBLIC' }),
      makeProfile({ userId: 'blocked-viewer', visibility: 'PUBLIC' }),
    ],
    userStatus: {
      viewer: 'ACTIVE',
      public: 'ACTIVE',
      members: 'ACTIVE',
      hidden: 'ACTIVE',
      suspended: 'SUSPENDED',
      'blocked-by-viewer': 'ACTIVE',
      'blocked-viewer': 'ACTIVE',
    },
    photos: [],
    blocks: [
      { initiatorId: 'viewer', targetId: 'blocked-by-viewer' },
      { initiatorId: 'blocked-viewer', targetId: 'viewer' },
    ],
    shortlists: [],
    notifications: [],
  };
}

async function visibleTo(state: FakeState, viewer: string): Promise<string[]> {
  const where = await visibleProfilesWhere(fakePrisma(state) as never, viewer);
  return state.profiles.filter((p) => matchesProfileWhere(state, p, where)).map((p) => p.userId);
}

describe('profile visibility (visibleProfilesWhere)', () => {
  it('an active member sees PUBLIC and MEMBERS_ONLY profiles of active accounts — never HIDDEN, never themselves', async () => {
    expect(await visibleTo(world(), 'viewer')).toEqual(['public', 'members']);
  });

  it('a block in either direction hides the pair from each other', async () => {
    const state = world();
    expect(await visibleTo(state, 'viewer')).not.toContain('blocked-by-viewer');
    expect(await visibleTo(state, 'viewer')).not.toContain('blocked-viewer');
    expect(await visibleTo(state, 'blocked-by-viewer')).not.toContain('viewer');
  });

  it('unblocking (removing the block row) brings the profile back', async () => {
    const state = world();
    state.blocks = state.blocks.filter((b) => b.targetId !== 'blocked-by-viewer');
    expect(await visibleTo(state, 'viewer')).toContain('blocked-by-viewer');
  });

  it('MEMBERS_ONLY: a viewer whose account is not ACTIVE sees no one', async () => {
    const state = world();
    state.userStatus.viewer = 'SUSPENDED';
    expect(await visibleTo(state, 'viewer')).toEqual([]);
  });

  it('MEMBERS_ONLY: a signed-in account with no profile of its own sees no one', async () => {
    const state = world();
    state.profiles = state.profiles.filter((p) => p.userId !== 'viewer');
    expect(await visibleTo(state, 'viewer')).toEqual([]);
  });

  it('a HIDDEN viewer can still browse (hiding yourself does not hide others from you)', async () => {
    const state = world();
    state.profiles.find((p) => p.userId === 'viewer')!.visibility = 'HIDDEN';
    expect(await visibleTo(state, 'viewer')).toEqual(['public', 'members']);
  });

  it('profileVisibilityWhere returns the match-nothing filter for an ineligible viewer', () => {
    expect(profileVisibilityWhere({ userId: 'x', isActiveMember: false }, [])).toBe(NO_PROFILES);
  });
});

describe('photo visibility', () => {
  it('only approved photos are shown to other members', () => {
    expect(photoStatus({ isModerated: false, isApproved: false })).toBe('PENDING');
    expect(photoStatus({ isModerated: true, isApproved: true })).toBe('APPROVED');
    expect(photoStatus({ isModerated: true, isApproved: false })).toBe('REJECTED');
    expect(isVisibleToOtherMembers({ isModerated: false, isApproved: false })).toBe(false);
    expect(isVisibleToOtherMembers({ isModerated: true, isApproved: false })).toBe(false);
    expect(isVisibleToOtherMembers({ isModerated: true, isApproved: true })).toBe(true);
  });

  it('"With photos" counts only approved photos, so a profile whose only photo is pending is not included', () => {
    const state = world();
    const pendingOnly = state.profiles.find((p) => p.userId === 'public')!;
    const approved = state.profiles.find((p) => p.userId === 'members')!;
    state.photos = [
      { profileId: pendingOnly.id, approved: false },
      { profileId: approved.id },
    ];
    expect(WITH_PHOTO_WHERE).toEqual({ photos: { some: { isModerated: true, isApproved: true } } });
    expect(matchesProfileWhere(state, pendingOnly, WITH_PHOTO_WHERE)).toBe(false);
    expect(matchesProfileWhere(state, approved, WITH_PHOTO_WHERE)).toBe(true);
  });
});

describe('opposite-gender rule', () => {
  const state: FakeState = {
    profiles: [
      makeProfile({ userId: 'man', gender: 'MALE' }),
      makeProfile({ userId: 'woman', gender: 'FEMALE' }),
      makeProfile({ userId: 'other', gender: 'OTHER' }),
    ],
    userStatus: { man: 'ACTIVE', woman: 'ACTIVE', other: 'ACTIVE' },
    photos: [],
    blocks: [],
    shortlists: [],
    notifications: [],
  };
  const seenBy = (userId: string, gender: string) =>
    state.profiles
      .filter((p) => matchesProfileWhere(state, p, profileVisibilityWhere({ userId, isActiveMember: true, gender }, [])))
      .map((p) => p.userId);

  it('shows a man only women', () => {
    expect(seenBy('viewer-m', 'MALE')).toEqual(['woman']);
  });

  it('shows a woman only men', () => {
    expect(seenBy('viewer-f', 'FEMALE')).toEqual(['man']);
  });

  it('does not narrow a viewer whose gender is OTHER', () => {
    expect(seenBy('viewer-o', 'OTHER')).toEqual(['man', 'woman', 'other']);
  });

  it('applies the same rule to a single profile', () => {
    expect(canSeeGender('MALE', 'FEMALE')).toBe(true);
    expect(canSeeGender('MALE', 'MALE')).toBe(false);
    expect(canSeeGender('FEMALE', 'FEMALE')).toBe(false);
    expect(canSeeGender('OTHER', 'MALE')).toBe(true);
  });
});
