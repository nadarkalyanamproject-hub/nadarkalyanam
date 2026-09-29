import 'reflect-metadata';
import { NotFoundException } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { NotificationsController } from './notifications.controller.js';
import { NotificationsService, PROFILE_VIEW_THROTTLE_MS, type NotifyJob } from './notifications.service.js';

interface Row {
  id: string;
  userId: string;
  actorUserId: string | null;
  type: string;
  targetType: string | null;
  targetId: string | null;
  payload: Record<string, unknown>;
  read: boolean;
  createdAt: Date;
}

const A = 'user-a';
const B = 'user-b';
const C = 'user-c';

// In-memory notifications table applying the where-shapes the service uses,
// so throttling/collapsing/scoping are checked against real row state.
function buildService(opts: { users?: Record<string, { status: string; fullName: string | null }>; blocks?: [string, string][] } = {}) {
  const users = opts.users ?? {
    [A]: { status: 'ACTIVE', fullName: 'Arun Kumar' },
    [B]: { status: 'ACTIVE', fullName: 'Meenakshi S' },
    [C]: { status: 'ACTIVE', fullName: 'Kavitha T' },
  };
  const rows: Row[] = [];
  let seq = 0;
  const matches = (r: Row, w: Record<string, unknown>): boolean =>
    Object.entries(w).every(([key, cond]) => {
      if (key === 'OR') return (cond as Record<string, unknown>[]).some((c) => matches(r, c));
      if (key === 'actor') {
        if (!r.actorUserId) return false;
        const c = cond as { status: string; id: { notIn: string[] } };
        return users[r.actorUserId]?.status === c.status && !c.id.notIn.includes(r.actorUserId);
      }
      if (cond && typeof cond === 'object' && 'not' in (cond as object)) {
        return (r as unknown as Record<string, unknown>)[key] !== (cond as { not: unknown }).not;
      }
      return (r as unknown as Record<string, unknown>)[key] === cond;
    });

  const prisma = {
    profile: {
      findUnique: vi.fn(async ({ where }: { where: { userId: string } }) =>
        users[where.userId]?.fullName ? { id: `profile-of-${where.userId}` } : null,
      ),
      findMany: vi.fn(async ({ where }: { where: { id: { in: string[] } } }) =>
        where.id.in.filter((id) => id !== 'profile-of-hidden').map((id) => ({ id })),
      ),
    },
    block: {
      findMany: vi.fn(async ({ where }: { where: { OR: { initiatorId?: string; targetId?: string }[] } }) => {
        const me = where.OR[0].initiatorId!;
        return (opts.blocks ?? [])
          .filter(([x, y]) => x === me || y === me)
          .map(([initiatorId, targetId]) => ({ initiatorId, targetId }));
      }),
    },
    notification: {
      create: vi.fn(async ({ data }: { data: Partial<Row> }) => {
        const row: Row = {
          id: `n-${++seq}`,
          userId: data.userId!,
          actorUserId: data.actorUserId ?? null,
          type: data.type!,
          targetType: data.targetType ?? null,
          targetId: data.targetId ?? null,
          payload: (data.payload as Record<string, unknown>) ?? {},
          read: false,
          createdAt: new Date(),
        };
        rows.push(row);
        return row;
      }),
      findFirst: vi.fn(async ({ where }: { where: Record<string, unknown> }) =>
        [...rows].sort((x, y) => y.createdAt.getTime() - x.createdAt.getTime()).find((r) => matches(r, where)) ?? null,
      ),
      update: vi.fn(async ({ where, data }: { where: { id: string }; data: Partial<Row> }) => {
        const row = rows.find((r) => r.id === where.id)!;
        Object.assign(row, data);
        return row;
      }),
      updateMany: vi.fn(async ({ where, data }: { where: Record<string, unknown>; data: Partial<Row> }) => {
        const hit = rows.filter((r) => matches(r, where));
        hit.forEach((r) => Object.assign(r, data));
        return { count: hit.length };
      }),
      count: vi.fn(async ({ where }: { where: Record<string, unknown> }) => rows.filter((r) => matches(r, where)).length),
      findMany: vi.fn(async ({ where, skip, take }: { where: Record<string, unknown>; skip: number; take: number }) =>
        rows
          .filter((r) => matches(r, where))
          .sort((x, y) => y.createdAt.getTime() - x.createdAt.getTime())
          .slice(skip, skip + take)
          .map((r) => ({
            ...r,
            actor: r.actorUserId
              ? { profile: users[r.actorUserId]?.fullName ? { id: `profile-of-${r.actorUserId}`, fullName: users[r.actorUserId].fullName } : null }
              : null,
          })),
      ),
    },
  };
  const queue = { add: vi.fn().mockResolvedValue({}) };
  const photosService = {
    getPhotosForProfile: vi.fn(async (profileId: string) => [
      { id: 'p', url: `https://signed.example/${profileId}?sig`, isPrimary: true, sortOrder: 0 },
    ]),
  };
  const service = new NotificationsService(prisma as never, queue as never, photosService as never);
  return { service, prisma, queue, rows, users };
}

const job = (overrides: Partial<NotifyJob>): NotifyJob => ({
  recipientUserId: B,
  actorUserId: A,
  type: 'INTEREST_RECEIVED',
  targetType: 'Interest',
  targetId: 'interest-1',
  ...overrides,
});

describe('NotificationsService.notify (the call business flows make)', () => {
  it('enqueues the job without awaiting it, and never throws', () => {
    const { service, queue } = buildService();

    const result = service.notify(job({}));

    expect(result).toBeUndefined();
    expect(queue.add).toHaveBeenCalledWith('notify', job({}));
  });

  it('swallows an async enqueue failure (Redis down) instead of failing the caller', async () => {
    const { service, queue } = buildService();
    queue.add.mockRejectedValueOnce(new Error('redis down'));

    expect(() => service.notify(job({}))).not.toThrow();
    await new Promise((resolve) => setTimeout(resolve, 0));
  });

  it('swallows a synchronous enqueue failure too', () => {
    const { service, queue } = buildService();
    queue.add.mockImplementationOnce(() => {
      throw new Error('boom');
    });

    expect(() => service.notify(job({}))).not.toThrow();
  });

  it('never notifies someone about their own action', () => {
    const { service, queue } = buildService();

    service.notify(job({ recipientUserId: A, actorUserId: A }));

    expect(queue.add).not.toHaveBeenCalled();
  });
});

describe('NotificationsService.persist', () => {
  it('writes exactly one row with recipient, actor, type and target', async () => {
    const { service, rows } = buildService();

    await service.persist(job({}));

    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ userId: B, actorUserId: A, type: 'INTEREST_RECEIVED', targetType: 'Interest', targetId: 'interest-1', read: false });
  });

  it('PROFILE_VIEWED: a second view inside 24h adds nothing; target is the VIEWER\'s profile', async () => {
    const { service, rows } = buildService();

    await service.persist(job({ type: 'PROFILE_VIEWED', targetType: 'Profile', targetId: undefined }));
    await service.persist(job({ type: 'PROFILE_VIEWED', targetType: 'Profile', targetId: undefined }));

    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ targetType: 'Profile', targetId: `profile-of-${A}` });
  });

  it('PROFILE_VIEWED: after 24h the SAME row is re-surfaced (bumped + unread), not duplicated', async () => {
    const { service, rows } = buildService();
    await service.persist(job({ type: 'PROFILE_VIEWED', targetType: 'Profile' }));
    rows[0].read = true;
    rows[0].createdAt = new Date(Date.now() - PROFILE_VIEW_THROTTLE_MS - 1000);

    await service.persist(job({ type: 'PROFILE_VIEWED', targetType: 'Profile' }));

    expect(rows).toHaveLength(1);
    expect(rows[0].read).toBe(false);
    expect(Date.now() - rows[0].createdAt.getTime()).toBeLessThan(5000);
  });

  it('PROFILE_VIEWED is per viewer: two different viewers -> two rows', async () => {
    const { service, rows } = buildService();

    await service.persist(job({ type: 'PROFILE_VIEWED', actorUserId: A, recipientUserId: B }));
    await service.persist(job({ type: 'PROFILE_VIEWED', actorUserId: C, recipientUserId: B }));

    expect(rows).toHaveLength(2);
  });

  it('PROFILE_VIEWED is skipped when the viewer has no profile to link to', async () => {
    const { service, rows } = buildService({
      users: { [A]: { status: 'ACTIVE', fullName: null }, [B]: { status: 'ACTIVE', fullName: 'B' } },
    });

    await service.persist(job({ type: 'PROFILE_VIEWED' }));

    expect(rows).toHaveLength(0);
  });
});

describe('NotificationsService.list / unreadCount', () => {
  it('returns items newest first with a message built from the actor\'s CURRENT name, plus total + unreadCount', async () => {
    const { service, users, rows } = buildService();
    await service.persist(job({ type: 'INTEREST_RECEIVED' }));
    rows[0].createdAt = new Date(Date.now() - 60_000);
    await service.persist(job({ type: 'INTEREST_ACCEPTED', targetType: 'Conversation', targetId: 'conv-1' }));
    users[A].fullName = 'Arun Renamed';

    const result = await service.list(B, { offset: 0, limit: 20, unreadOnly: false });

    expect(result.total).toBe(2);
    expect(result.unreadCount).toBe(2);
    expect(result.items[0]).toMatchObject({
      type: 'INTEREST_ACCEPTED',
      message: "Arun Renamed accepted your interest — you're now connected",
      actor: { name: 'Arun Renamed', photoUrl: `https://signed.example/profile-of-${A}?sig` },
      targetType: 'Conversation',
      targetId: 'conv-1',
      isRead: false,
    });
  });

  it('system/admin notices show "Nadar Kalyanam" as the actor', async () => {
    const { service } = buildService();
    await service.persist({ recipientUserId: B, type: 'ACCOUNT_SUSPENDED', targetType: 'Account' });

    const [item] = (await service.list(B, { offset: 0, limit: 20, unreadOnly: false })).items;

    expect(item.actor).toEqual({ name: 'Nadar Kalyanam', photoUrl: null });
    expect(item.message).toMatch(/suspended/);
  });

  it('never includes email, phone or dateOfBirth', async () => {
    const { service } = buildService();
    await service.persist(job({}));

    const json = JSON.stringify(await service.list(B, { offset: 0, limit: 20, unreadOnly: false }));

    expect(json).not.toMatch(/email|phone|dateOfBirth|@example/i);
  });

  it('hides notifications whose actor is now blocked (either direction), suspended or deleted — and counts agree', async () => {
    const { service, users } = buildService({
      users: {
        [A]: { status: 'ACTIVE', fullName: 'A' },
        [B]: { status: 'ACTIVE', fullName: 'B' },
        [C]: { status: 'ACTIVE', fullName: 'C' },
        d: { status: 'SUSPENDED', fullName: 'D' },
        e: { status: 'DELETED', fullName: 'E' },
      },
      blocks: [[C, B]],
    });
    for (const actor of [A, C, 'd', 'e']) await service.persist(job({ actorUserId: actor, targetId: `i-${actor}` }));
    await service.persist({ recipientUserId: B, type: 'ACCOUNT_REINSTATED' });
    void users;

    const result = await service.list(B, { offset: 0, limit: 20, unreadOnly: false });

    expect(result.items.map((i) => i.actor.name).sort()).toEqual(['A', 'Nadar Kalyanam']);
    expect(result.total).toBe(2);
    expect((await service.unreadCount(B)).unreadCount).toBe(2);
  });

  it('unreadOnly filters, and unreadCount reflects reads', async () => {
    const { service, rows } = buildService();
    await service.persist(job({ targetId: 'i-1' }));
    await service.persist(job({ type: 'INTEREST_ACCEPTED', targetType: 'Conversation', targetId: 'c-1' }));
    rows[0].read = true;

    const unread = await service.list(B, { offset: 0, limit: 20, unreadOnly: true });

    expect(unread.items).toHaveLength(1);
    expect(unread.unreadCount).toBe(1);
    expect((await service.unreadCount(B)).unreadCount).toBe(1);
  });

  it('marks a PROFILE_VIEWED target unavailable when that profile is now hidden', async () => {
    const { service, rows } = buildService();
    await service.persist(job({ type: 'PROFILE_VIEWED', targetType: 'Profile' }));
    rows[0].targetId = 'profile-of-hidden';

    const [item] = (await service.list(B, { offset: 0, limit: 20, unreadOnly: false })).items;

    expect(item.targetAvailable).toBe(false);
  });
});

describe('legacy NEW_MESSAGE rows (messages now use their own unread badge)', () => {
  // Seeded directly, as rows from before the change would be.
  async function withLegacyRow() {
    const ctx = buildService();
    await ctx.service.persist(job({ targetId: 'i-1' })); // n-1 INTEREST_RECEIVED (visible)
    await ctx.prisma.notification.create({
      data: { userId: B, actorUserId: A, type: 'NEW_MESSAGE', targetType: 'Conversation', targetId: 'c-1', payload: { count: 3 } },
    }); // n-2 legacy, unread
    return ctx;
  }

  it('never appears in GET /notifications and does not count toward unreadCount', async () => {
    const { service } = await withLegacyRow();

    const result = await service.list(B, { offset: 0, limit: 20, unreadOnly: false });

    expect(result.items.map((i) => i.type)).toEqual(['INTEREST_RECEIVED']);
    expect(result.total).toBe(1);
    expect(result.unreadCount).toBe(1);
    expect((await service.unreadCount(B)).unreadCount).toBe(1);
    expect((await service.list(B, { offset: 0, limit: 20, unreadOnly: true })).items).toHaveLength(1);
  });

  it('cannot be marked read individually (404) and read-all leaves it untouched', async () => {
    const { service, rows } = await withLegacyRow();

    await expect(service.markRead(B, 'n-2')).rejects.toBeInstanceOf(NotFoundException);
    await expect(service.markAllRead(B)).resolves.toEqual({ updatedCount: 1 });
    expect(rows.find((r) => r.id === 'n-2')?.read).toBe(false);
  });
});

describe('NotificationsService read / read-all — caller-scoped', () => {
  let ctx: ReturnType<typeof buildService>;
  beforeEach(async () => {
    ctx = buildService();
    await ctx.service.persist(job({ recipientUserId: B, targetId: 'for-b' })); // n-1 (B's)
    await ctx.service.persist(job({ recipientUserId: A, actorUserId: B, targetId: 'for-a' })); // n-2 (A's)
  });

  it('marks the caller\'s own notification read', async () => {
    await expect(ctx.service.markRead(B, 'n-1')).resolves.toEqual({ id: 'n-1', isRead: true });
    expect(ctx.rows[0].read).toBe(true);
  });

  it("cannot mark ANOTHER user's notification read: 404 and the row is untouched", async () => {
    await expect(ctx.service.markRead(B, 'n-2')).rejects.toBeInstanceOf(NotFoundException);
    expect(ctx.rows[1].read).toBe(false);
  });

  it('cannot list another user\'s notifications: listing only ever returns the caller\'s rows', async () => {
    const forB = await ctx.service.list(B, { offset: 0, limit: 20, unreadOnly: false });

    expect(forB.items.map((i) => i.id)).toEqual(['n-1']);
  });

  it('read-all only touches the caller\'s rows', async () => {
    await expect(ctx.service.markAllRead(B)).resolves.toEqual({ updatedCount: 1 });
    expect(ctx.rows[0].read).toBe(true);
    expect(ctx.rows[1].read).toBe(false);
  });
});

describe('NotificationsController', () => {
  it('guards every route with JwtAuthGuard (401 without a member token; admin tokens are rejected by that guard)', () => {
    expect(Reflect.getMetadata('__guards__', NotificationsController)).toEqual([JwtAuthGuard]);
  });

  it('routes: GET / , GET unread-count, POST read-all, PATCH :id/read — always passing the caller\'s own id', async () => {
    const svc = {
      list: vi.fn().mockResolvedValue({}),
      unreadCount: vi.fn().mockResolvedValue({ unreadCount: 0 }),
      markAllRead: vi.fn().mockResolvedValue({ updatedCount: 0 }),
      markRead: vi.fn().mockResolvedValue({}),
    };
    const controller = new NotificationsController(svc as never);
    const me = { userId: B };

    await controller.list(me, { unreadOnly: 'true', offset: '20', limit: '500' });
    await controller.unreadCount(me);
    await controller.markAllRead(me);
    await controller.markRead(me, 'n-9');

    expect(svc.list).toHaveBeenCalledWith(B, { offset: 20, limit: 50, unreadOnly: true });
    expect(svc.unreadCount).toHaveBeenCalledWith(B);
    expect(svc.markAllRead).toHaveBeenCalledWith(B);
    expect(svc.markRead).toHaveBeenCalledWith(B, 'n-9');
    expect(Reflect.getMetadata('path', NotificationsController.prototype.unreadCount)).toBe('unread-count');
    expect(Reflect.getMetadata('path', NotificationsController.prototype.markAllRead)).toBe('read-all');
  });
});
