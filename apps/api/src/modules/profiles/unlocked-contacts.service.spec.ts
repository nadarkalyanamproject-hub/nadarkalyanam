import { describe, expect, it } from 'vitest';
import { type FakeProfile, type FakeState, fakePhotosService, fakePrisma, makeProfile, matchesProfileWhere } from '../../common/testing/fake-profile-store.js';
import { UnlockedContactsService } from './unlocked-contacts.service.js';

/* eslint-disable @typescript-eslint/no-explicit-any */
// The list runs the same rule as the unlock endpoint; this evaluates the
// where clause it builds against an in-memory world.
type P = FakeProfile & { phoneVisibility: 'CONNECTED' | 'NEVER' };

function world() {
  const profiles: P[] = [];
  const state: FakeState = { profiles, userStatus: {}, photos: [], blocks: [], shortlists: [], notifications: [] };
  const interests: { senderId: string; targetId: string; status: string }[] = [];
  const unlocks: { id: string; viewerId: string; targetUserId: string; createdAt: Date }[] = [];
  const add = (userId: string, phoneVisibility: 'CONNECTED' | 'NEVER' = 'CONNECTED') => {
    profiles.push({ ...makeProfile({ userId, details: { location: { city: 'Madurai', state: 'Tamil Nadu' }, phone: '+919800000000' } }), phoneVisibility });
    state.userStatus[userId] = 'ACTIVE';
  };
  const unlocked = (target: string, daysAgo: number) =>
    unlocks.push({ id: `u-${target}`, viewerId: 'me', targetUserId: target, createdAt: new Date(Date.UTC(2026, 9, 6) - daysAgo * 86400000) });
  const connect = (a: string, b: string) => interests.push({ senderId: a, targetId: b, status: 'ACCEPTED' });

  const passes = (row: (typeof unlocks)[number], where: any) => {
    if (row.viewerId !== where.viewerId) return false;
    const target = profiles.find((p) => p.userId === row.targetUserId);
    if (!target) return false;
    const [visible, sharing] = where.target.profile.is.AND;
    if (!matchesProfileWhere(state, target, visible) || target.phoneVisibility !== sharing.phoneVisibility) return false;
    return interests.some(
      (i) => i.status === 'ACCEPTED' && ((i.senderId === row.targetUserId && i.targetId === where.viewerId) || (i.targetId === row.targetUserId && i.senderId === where.viewerId)),
    );
  };
  const prisma: any = {
    ...fakePrisma(state),
    phoneUnlock: {
      findMany: async ({ where, skip, take }: any) =>
        unlocks
          .filter((u) => passes(u, where))
          .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
          .slice(skip, skip + take)
          .map((u) => ({ ...u, target: { profile: profiles.find((p) => p.userId === u.targetUserId) } })),
      count: async ({ where }: any) => unlocks.filter((u) => passes(u, where)).length,
    },
  };
  add('me');
  return { service: new UnlockedContactsService(prisma, fakePhotosService as never), state, profiles, interests, unlocks, add, unlocked, connect };
}

describe('My Unlocked Contacts', () => {
  it('lists contacts that still pass every rule, newest first — even with no plan (unlocks outlive the plan)', async () => {
    const w = world();
    for (const [id, days] of [['a', 3], ['b', 1]] as const) {
      w.add(id);
      w.connect(id, 'me');
      w.unlocked(id, days);
    }
    const result = await w.service.listMine('me', 0, 10);
    expect(result.total).toBe(2);
    expect(result.items.map((i) => i.profileId)).toEqual(['profile-b', 'profile-a']);
    expect(result.items[0]).toEqual({
      profileId: 'profile-b',
      fullName: 'Member b',
      age: expect.any(Number),
      city: 'Madurai',
      state: 'Tamil Nadu',
      primaryPhotoUrl: null,
      unlockedAt: '2026-10-05T00:00:00.000Z',
    });
  });

  it('hides a contact whose owner turned sharing off (NEVER), who blocked or was blocked, who is suspended or hidden, or who is no longer connected', async () => {
    const w = world();
    for (const id of ['ok', 'never', 'blockedThem', 'blockedMe', 'suspended', 'hidden', 'unconnected']) {
      w.add(id, id === 'never' ? 'NEVER' : 'CONNECTED');
      if (id !== 'unconnected') w.connect('me', id);
      w.unlocked(id, 1);
    }
    w.state.blocks.push({ initiatorId: 'me', targetId: 'blockedThem' }, { initiatorId: 'blockedMe', targetId: 'me' });
    w.state.userStatus.suspended = 'SUSPENDED';
    w.profiles.find((p) => p.userId === 'hidden')!.visibility = 'HIDDEN';

    const result = await w.service.listMine('me', 0, 50);
    expect(result.items.map((i) => i.profileId)).toEqual(['profile-ok']);
    expect(result.total).toBe(1);
  });

  it('paginates with offset and a next offset', async () => {
    const w = world();
    for (let n = 0; n < 5; n += 1) {
      w.add(`m${n}`);
      w.connect('me', `m${n}`);
      w.unlocked(`m${n}`, n);
    }
    const first = await w.service.listMine('me', 0, 2);
    const second = await w.service.listMine('me', 2, 2);
    const last = await w.service.listMine('me', 4, 2);
    expect([first.nextOffset, second.nextOffset, last.nextOffset]).toEqual([2, 4, null]);
    const ids = [...first.items, ...second.items, ...last.items].map((i) => i.profileId);
    expect(ids).toEqual(['profile-m0', 'profile-m1', 'profile-m2', 'profile-m3', 'profile-m4']);
  });

  it('never contains a phone number, even one stored in the profile details', async () => {
    const w = world();
    w.add('a');
    w.connect('a', 'me');
    w.unlocked('a', 1);
    const json = JSON.stringify(await w.service.listMine('me', 0, 10));
    expect(json).not.toMatch(/\+91\d{10}/);
    expect(json).not.toMatch(/"(phone|phoneNumber|mobile)"/i);
  });

  it('an empty list when there are none', async () => {
    await expect(world().service.listMine('me', 0, 10)).resolves.toEqual({ items: [], total: 0, nextOffset: null });
  });
});
