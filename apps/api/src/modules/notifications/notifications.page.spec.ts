import 'reflect-metadata';
import { listNotificationsQuerySchema } from '@nadar-kalyanam/schemas';
import { describe, expect, it, vi } from 'vitest';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { NotificationsController } from './notifications.controller.js';
import { NotificationsService } from './notifications.service.js';

const ME = 'user-me';
const OTHER = 'user-other';
const ACTOR = 'user-actor';

interface Row {
  id: string;
  userId: string;
  actorUserId: string | null;
  type: string;
  targetType: string | null;
  targetId: string | null;
  payload: object;
  read: boolean;
  createdAt: Date;
}

// In-memory notifications table honouring the where-shapes the service
// builds (AND / OR / { in } / { not } / actor relation), plus deleteMany.
function build() {
  let seq = 0;
  const rows: Row[] = [];
  const add = (userId: string, type: string, read = false, actorUserId: string | null = ACTOR) =>
    rows.push({
      id: `n-${++seq}`, userId, actorUserId, type, targetType: null, targetId: null, payload: {}, read,
      createdAt: new Date(Date.now() - (100 - seq) * 1000),
    });
  const test = (r: Row, w: Record<string, unknown>): boolean =>
    Object.entries(w).every(([key, cond]) => {
      if (key === 'AND') return (cond as Record<string, unknown>[]).every((c) => test(r, c));
      if (key === 'OR') return (cond as Record<string, unknown>[]).some((c) => test(r, c));
      if (key === 'actor') return r.actorUserId !== null; // actor is always active/unblocked here
      const value = (r as unknown as Record<string, unknown>)[key];
      if (cond && typeof cond === 'object') {
        if ('in' in cond) return (cond as { in: unknown[] }).in.includes(value);
        if ('not' in cond) return value !== (cond as { not: unknown }).not;
      }
      return value === cond;
    });
  const prisma = {
    block: { findMany: vi.fn().mockResolvedValue([]) },
    profile: { findMany: vi.fn().mockResolvedValue([]) },
    notification: {
      findMany: vi.fn(async ({ where, skip, take }: { where: Record<string, unknown>; skip: number; take: number }) =>
        rows.filter((r) => test(r, where)).sort((a, b) => +b.createdAt - +a.createdAt).slice(skip, skip + take)
          .map((r) => ({ ...r, actor: r.actorUserId ? { profile: { id: 'p-actor', fullName: 'Actor Name' } } : null })),
      ),
      count: vi.fn(async ({ where }: { where: Record<string, unknown> }) => rows.filter((r) => test(r, where)).length),
      deleteMany: vi.fn(async ({ where }: { where: Record<string, unknown> }) => {
        const doomed = rows.filter((r) => test(r, where));
        for (const r of doomed) rows.splice(rows.indexOf(r), 1);
        return { count: doomed.length };
      }),
    },
  };
  const photos = { getPhotosForProfile: vi.fn().mockResolvedValue([]) };
  const service = new NotificationsService(prisma as never, { add: vi.fn() } as never, photos as never);
  return { service, rows, add, prisma };
}

function seedMine(add: ReturnType<typeof build>['add']) {
  add(ME, 'PROFILE_VIEWED');
  add(ME, 'INTEREST_RECEIVED', true);
  add(ME, 'INTEREST_ACCEPTED');
  add(ME, 'NEW_MESSAGE'); // legacy row — hidden everywhere
  add(ME, 'ACCOUNT_REINSTATED', false, null); // admin/account notice
}

describe('Clear all (DELETE /notifications)', () => {
  it('permanently deletes every row the caller owns — and never another member\'s rows', async () => {
    const { service, rows, add } = build();
    seedMine(add);
    add(OTHER, 'PROFILE_VIEWED');
    add(OTHER, 'INTEREST_RECEIVED');

    const result = await service.clearAll(ME);

    expect(result).toEqual({ deletedCount: 5 }); // incl. the hidden legacy row
    expect(rows.filter((r) => r.userId === ME)).toHaveLength(0);
    expect(rows.filter((r) => r.userId === OTHER).map((r) => r.type)).toEqual(['PROFILE_VIEWED', 'INTEREST_RECEIVED']);
    expect((await service.list(ME, { offset: 0, limit: 20, unreadOnly: false })).items).toEqual([]);
    expect((await service.list(OTHER, { offset: 0, limit: 20, unreadOnly: false })).total).toBe(2);
  });

  it('is scoped purely by the caller\'s id', async () => {
    const { service, prisma } = build();

    await service.clearAll(ME);

    expect(prisma.notification.deleteMany).toHaveBeenCalledWith({ where: { userId: ME } });
  });
});

describe('Category filter', () => {
  const typesFor = async (types?: string[], unreadOnly = false) => {
    const { service, add } = build();
    seedMine(add);
    add(OTHER, 'PROFILE_VIEWED');
    const result = await service.list(ME, { offset: 0, limit: 20, unreadOnly, types });
    return { types: result.items.map((i) => i.type).sort(), unreadCount: result.unreadCount, total: result.total };
  };

  it('Profile -> PROFILE_VIEWED only', async () => {
    expect((await typesFor(['PROFILE_VIEWED'])).types).toEqual(['PROFILE_VIEWED']);
  });

  it('Interests -> INTEREST_RECEIVED + INTEREST_ACCEPTED', async () => {
    expect((await typesFor(['INTEREST_RECEIVED', 'INTEREST_ACCEPTED'])).types).toEqual(['INTEREST_ACCEPTED', 'INTEREST_RECEIVED']);
  });

  it('there is no Messages category, and legacy NEW_MESSAGE rows never show under All', async () => {
    expect((await typesFor()).types).not.toContain('NEW_MESSAGE');
  });

  it('All -> everything visible, including admin/account notices, never NEW_MESSAGE', async () => {
    expect((await typesFor()).types).toEqual(['ACCOUNT_REINSTATED', 'INTEREST_ACCEPTED', 'INTEREST_RECEIVED', 'PROFILE_VIEWED']);
  });

  it('Unread -> only unread rows', async () => {
    expect((await typesFor(undefined, true)).types).toEqual(['ACCOUNT_REINSTATED', 'INTEREST_ACCEPTED', 'PROFILE_VIEWED']);
  });

  it('unreadCount is the caller\'s overall unread total on every tab (the page header)', async () => {
    expect((await typesFor(['PROFILE_VIEWED'])).unreadCount).toBe(3);
    expect((await typesFor(['INTEREST_RECEIVED', 'INTEREST_ACCEPTED'])).unreadCount).toBe(3);
  });
});

describe('controller', () => {
  it('maps ?category= to the right filter', async () => {
    const svc = { list: vi.fn().mockResolvedValue({}) };
    const controller = new NotificationsController(svc as never);
    const me = { userId: ME, sessionId: 'session-test' };

    await controller.list(me, { category: 'profile' });
    await controller.list(me, { category: 'interests' });
    await controller.list(me, { category: 'unread' });
    await controller.list(me, {});

    const calls = svc.list.mock.calls.map((c) => c[1]);
    expect(calls[0]).toMatchObject({ unreadOnly: false, types: ['PROFILE_VIEWED'] });
    expect(calls[1]).toMatchObject({ unreadOnly: false, types: ['INTEREST_RECEIVED', 'INTEREST_ACCEPTED'] });
    expect(calls[2]).toMatchObject({ unreadOnly: true, types: undefined });
    expect(calls[3]).toMatchObject({ unreadOnly: false, types: undefined });
    expect(svc.list.mock.calls.every((c) => c[0] === ME)).toBe(true);
  });

  it('?category=messages (or any unknown category) is rejected by query validation -> 400', () => {
    expect(listNotificationsQuerySchema.safeParse({ category: 'messages' }).success).toBe(false);
    expect(listNotificationsQuerySchema.safeParse({ category: 'bogus' }).success).toBe(false);
    for (const ok of ['all', 'unread', 'profile', 'interests']) {
      expect(listNotificationsQuerySchema.safeParse({ category: ok }).success).toBe(true);
    }
  });

  it('DELETE /notifications is behind JwtAuthGuard (401 without a token) and passes only the caller\'s id', async () => {
    expect(Reflect.getMetadata('__guards__', NotificationsController)).toEqual([JwtAuthGuard]);
    expect(Reflect.getMetadata('method', NotificationsController.prototype.clearAll)).toBe(3); // RequestMethod.DELETE
    const svc = { clearAll: vi.fn().mockResolvedValue({ deletedCount: 0 }) };
    await new NotificationsController(svc as never).clearAll({ userId: ME, sessionId: 'session-test' });
    expect(svc.clearAll).toHaveBeenCalledWith(ME);
  });
});
