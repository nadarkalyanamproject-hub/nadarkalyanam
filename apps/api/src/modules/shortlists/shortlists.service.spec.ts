import 'reflect-metadata';
import {
  BadRequestException,
  ConflictException,
  NotFoundException,
  RequestMethod,
  UnauthorizedException,
  type ExecutionContext,
} from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import {
  type FakeState,
  fakePhotosService,
  fakePrisma,
  makeProfile,
} from '../../common/testing/fake-profile-store.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { ShortlistsController } from './shortlists.controller.js';
import { ShortlistsService } from './shortlists.service.js';

// me = the caller; a/b/c are ordinary members; blocker blocked me, blocked
// was blocked by me, suspended is inactive, hidden hid their profile.
function setup() {
  const ids = ['me', 'a', 'b', 'c', 'blocker', 'blocked', 'suspended', 'hidden'];
  const state: FakeState = {
    profiles: ids.map((userId) =>
      makeProfile({ userId, visibility: userId === 'hidden' ? 'HIDDEN' : 'PUBLIC' }),
    ),
    userStatus: Object.fromEntries(ids.map((id) => [id, id === 'suspended' ? 'SUSPENDED' : 'ACTIVE'])),
    photos: [],
    blocks: [
      { initiatorId: 'blocker', targetId: 'me' },
      { initiatorId: 'me', targetId: 'blocked' },
    ],
    shortlists: [],
    notifications: [],
  };
  const service = new ShortlistsService(fakePrisma(state) as never, fakePhotosService as never);
  return { state, service };
}
const pid = (userId: string) => `profile-${userId}`;

describe('ShortlistsService', () => {
  it('shortlists a profile and reports it in the status check', async () => {
    const { service, state } = setup();

    const row = await service.add('me', pid('a'));

    expect(row.profileId).toBe(pid('a'));
    expect(state.shortlists).toHaveLength(1);
    expect(await service.status('me', pid('a'))).toEqual({ shortlisted: true });
    expect(await service.status('me', pid('b'))).toEqual({ shortlisted: false });
  });

  it('rejects shortlisting your own profile', async () => {
    const { service } = setup();
    await expect(service.add('me', pid('me'))).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects an already-shortlisted profile with a conflict', async () => {
    const { service } = setup();
    await service.add('me', pid('a'));
    await expect(service.add('me', pid('a'))).rejects.toBeInstanceOf(ConflictException);
  });

  it('rejects blocked (either direction), inactive, hidden and unknown profiles as not found', async () => {
    const { service, state } = setup();
    for (const userId of ['blocker', 'blocked', 'suspended', 'hidden']) {
      await expect(service.add('me', pid(userId))).rejects.toBeInstanceOf(NotFoundException);
    }
    await expect(service.add('me', 'no-such-profile')).rejects.toBeInstanceOf(NotFoundException);
    expect(state.shortlists).toHaveLength(0);
  });

  it('requires the caller to have a profile', async () => {
    const { service, state } = setup();
    state.profiles = state.profiles.filter((p) => p.userId !== 'me');
    await expect(service.add('me', pid('a'))).rejects.toBeInstanceOf(BadRequestException);
  });

  it('unshortlists, and 404s when the profile was not shortlisted', async () => {
    const { service, state } = setup();
    await service.add('me', pid('a'));

    await service.remove('me', pid('a'));

    expect(state.shortlists).toHaveLength(0);
    expect(await service.status('me', pid('a'))).toEqual({ shortlisted: false });
    await expect(service.remove('me', pid('a'))).rejects.toBeInstanceOf(NotFoundException);
  });

  it('lists who I shortlisted, most recent first', async () => {
    const { service } = setup();
    await service.add('me', pid('a'));
    await service.add('me', pid('b'));

    const { items } = await service.listMine('me');

    expect(items.map((item) => item.profileId)).toEqual([pid('b'), pid('a')]);
    expect(items[0]).toMatchObject({ city: 'Chennai', state: 'Tamil Nadu', relationshipStatus: 'NONE' });
  });

  it('lists who shortlisted me, and not people I shortlisted', async () => {
    const { service } = setup();
    // a and c shortlist me; I shortlist b.
    await service.add('a', pid('me'));
    await service.add('c', pid('me'));
    await service.add('me', pid('b'));

    const { items } = await service.listShortlistedMe('me');

    expect(items.map((item) => item.profileId)).toEqual([pid('c'), pid('a')]);
  });

  it('drops members who are later blocked, deactivated or hidden from both lists', async () => {
    const { state, service } = setup();
    await service.add('me', pid('a'));
    await service.add('me', pid('b'));
    await service.add('me', pid('c'));
    await service.add('a', pid('me'));
    await service.add('b', pid('me'));
    await service.add('c', pid('me'));

    state.blocks.push({ initiatorId: 'a', targetId: 'me' });
    state.userStatus.b = 'PENDING_DELETION';
    state.profiles.find((p) => p.userId === 'c')!.visibility = 'HIDDEN';

    expect((await service.listMine('me')).items).toEqual([]);
    expect((await service.listShortlistedMe('me')).items).toEqual([]);
  });
});

describe('ShortlistsController', () => {
  const routes: { handler: keyof ShortlistsController; method: RequestMethod; path: string }[] = [
    { handler: 'add', method: RequestMethod.POST, path: '/' },
    { handler: 'listMine', method: RequestMethod.GET, path: '/' },
    { handler: 'listShortlistedMe', method: RequestMethod.GET, path: 'shortlisted-me' },
    { handler: 'status', method: RequestMethod.GET, path: 'by-profile/:profileId' },
    { handler: 'remove', method: RequestMethod.DELETE, path: 'by-profile/:profileId' },
  ];

  it('is mounted at /shortlists behind the member JwtAuthGuard', () => {
    expect(Reflect.getMetadata('path', ShortlistsController)).toBe('shortlists');
    expect(Reflect.getMetadata('__guards__', ShortlistsController)).toEqual([JwtAuthGuard]);
    for (const { handler, method, path } of routes) {
      const fn = ShortlistsController.prototype[handler];
      expect(Reflect.getMetadata('method', fn)).toBe(method);
      expect(Reflect.getMetadata('path', fn)).toBe(path);
    }
  });

  it('rejects unauthenticated requests with 401', async () => {
    const guard = new JwtAuthGuard({ verifyAsync: vi.fn().mockRejectedValue(new Error('bad')) } as never, {} as never);
    const context = (authorization?: string) =>
      ({ switchToHttp: () => ({ getRequest: () => ({ headers: { authorization } }) }) }) as unknown as ExecutionContext;

    await expect(guard.canActivate(context())).rejects.toBeInstanceOf(UnauthorizedException);
    await expect(guard.canActivate(context('Bearer invalid'))).rejects.toBeInstanceOf(UnauthorizedException);
  });
});
