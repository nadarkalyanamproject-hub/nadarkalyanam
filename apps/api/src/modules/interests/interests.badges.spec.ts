import 'reflect-metadata';
import { describe, expect, it, vi } from 'vitest';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { MessagesService, sortConversations } from '../messages/messages.service.js';
import { NotificationsService } from '../notifications/notifications.service.js';
import { InterestsController } from './interests.controller.js';
import { InterestsService } from './interests.service.js';

const A = 'user-a';
const B = 'user-b';
const C = 'user-c';
const minutesAgo = (m: number) => new Date(Date.now() - m * 60_000);

// ---- Interests "new" dot --------------------------------------------------------
function interestsFixture(opts: {
  lastViewed: Date | null;
  interests: { id: string; senderId: string; status: string; createdAt: Date }[];
  senders?: Record<string, string>; // userId -> account status
  blocks?: [string, string][];
}) {
  let lastViewed = opts.lastViewed;
  const senders = opts.senders ?? { [A]: 'ACTIVE', [C]: 'ACTIVE' };
  const prisma = {
    user: {
      findUnique: vi.fn(async () => ({ lastViewedInterestsAt: lastViewed })),
      update: vi.fn(async ({ data }: { data: { lastViewedInterestsAt: Date } }) => {
        lastViewed = data.lastViewedInterestsAt;
        return {};
      }),
    },
    block: {
      findMany: vi.fn(async () => (opts.blocks ?? []).map(([initiatorId, targetId]) => ({ initiatorId, targetId }))),
    },
    interest: {
      findFirst: vi.fn(async ({ where }: { where: { targetId: string; status: string; createdAt?: { gt: Date }; sender: { status: string; id: { notIn: string[] } } } }) =>
        opts.interests.find(
          (i) =>
            where.targetId === B &&
            i.status === where.status &&
            (!where.createdAt || i.createdAt > where.createdAt.gt) &&
            senders[i.senderId] === where.sender.status &&
            !where.sender.id.notIn.includes(i.senderId),
        ) ?? null,
      ),
    },
  };
  const service = new InterestsService(prisma as never, {} as never, {} as never, { notify: vi.fn(), markTargetRead: vi.fn() } as never);
  return { service, prisma };
}

describe('InterestsService.hasUnread / markViewed (the Interests dot)', () => {
  it('a new PENDING interest arriving after the last visit lights the dot', async () => {
    const { service } = interestsFixture({
      lastViewed: minutesAgo(30),
      interests: [{ id: 'i1', senderId: A, status: 'PENDING', createdAt: minutesAgo(5) }],
    });

    expect(await service.hasUnread(B)).toEqual({ hasUnread: true });
  });

  it('visiting /interests clears it even though the interest is still pending', async () => {
    const { service } = interestsFixture({
      lastViewed: minutesAgo(30),
      interests: [{ id: 'i1', senderId: A, status: 'PENDING', createdAt: minutesAgo(5) }],
    });

    await service.markViewed(B);

    expect(await service.hasUnread(B)).toEqual({ hasUnread: false });
  });

  it('a member who never opened /interests sees the dot for any pending interest', async () => {
    const { service, prisma } = interestsFixture({
      lastViewed: null,
      interests: [{ id: 'i1', senderId: A, status: 'PENDING', createdAt: minutesAgo(600) }],
    });

    expect(await service.hasUnread(B)).toEqual({ hasUnread: true });
    expect(prisma.interest.findFirst.mock.calls[0][0].where).not.toHaveProperty('createdAt');
  });

  it('only PENDING counts: accepted/declined/withdrawn interests never light it', async () => {
    const { service } = interestsFixture({
      lastViewed: minutesAgo(30),
      interests: [
        { id: 'i1', senderId: A, status: 'ACCEPTED', createdAt: minutesAgo(5) },
        { id: 'i2', senderId: C, status: 'DECLINED', createdAt: minutesAgo(5) },
      ],
    });

    expect(await service.hasUnread(B)).toEqual({ hasUnread: false });
  });

  it('ignores interests from senders who are blocked (either way) or no longer active', async () => {
    const blocked = interestsFixture({
      lastViewed: null,
      interests: [{ id: 'i1', senderId: A, status: 'PENDING', createdAt: minutesAgo(5) }],
      blocks: [[B, A]],
    });
    const suspended = interestsFixture({
      lastViewed: null,
      interests: [{ id: 'i1', senderId: A, status: 'PENDING', createdAt: minutesAgo(5) }],
      senders: { [A]: 'SUSPENDED' },
    });

    expect(await blocked.service.hasUnread(B)).toEqual({ hasUnread: false });
    expect(await suspended.service.hasUnread(B)).toEqual({ hasUnread: false });
  });
});

// ---- Accept marks the INTEREST_RECEIVED notification read ----------------------------
describe('accept -> marks the accepter\'s INTEREST_RECEIVED notification read', () => {
  function acceptFixture(updated: number) {
    const txNotificationUpdateMany = vi.fn().mockResolvedValue({ count: updated });
    const tx = {
      interest: { update: vi.fn().mockResolvedValue({ id: 'i1', status: 'ACCEPTED' }) },
      conversation: { create: vi.fn().mockResolvedValue({ id: 'conv-1' }) },
      conversationParticipant: { createMany: vi.fn().mockResolvedValue({ count: 2 }) },
      notification: { updateMany: txNotificationUpdateMany },
    };
    const outsideUpdateMany = vi.fn();
    const prisma = {
      interest: { findUnique: vi.fn().mockResolvedValue({ id: 'i1', senderId: A, targetId: B, status: 'PENDING' }) },
      notification: { updateMany: outsideUpdateMany },
      $transaction: vi.fn(async (fn: (t: typeof tx) => unknown) => fn(tx)),
    };
    // The real NotificationsService logic, with a queue that just records.
    const notifications = new NotificationsService(prisma as never, { add: vi.fn().mockResolvedValue({}) } as never, {} as never);
    const service = new InterestsService(prisma as never, {} as never, {} as never, notifications);
    return { service, txNotificationUpdateMany, outsideUpdateMany };
  }

  it('updates exactly that notification (recipient + interest id), inside the accept transaction', async () => {
    const { service, txNotificationUpdateMany, outsideUpdateMany } = acceptFixture(1);

    await service.accept(B, 'i1');

    expect(txNotificationUpdateMany).toHaveBeenCalledWith({
      where: { userId: B, type: 'INTEREST_RECEIVED', targetType: 'Interest', targetId: 'i1', read: false },
      data: { read: true },
    });
    expect(outsideUpdateMany).not.toHaveBeenCalled();
  });

  it('accept still succeeds when there is no matching notification (already read / older data)', async () => {
    const { service } = acceptFixture(0);

    await expect(service.accept(B, 'i1')).resolves.toMatchObject({ status: 'ACCEPTED', conversationId: 'conv-1' });
  });
});

// ---- Conversation ordering ---------------------------------------------------------
describe('conversation ordering', () => {
  const conv = (id: string, hasUnread: boolean, minsAgo: number) => ({
    id,
    hasUnread,
    lastActivityAt: minutesAgo(minsAgo).toISOString(),
  });

  it('unread first, then most-recent activity first within each group', () => {
    const sorted = sortConversations([
      conv('read-new', false, 1),
      conv('unread-old', true, 90),
      conv('read-old', false, 60),
      conv('unread-new', true, 10),
    ]);

    expect(sorted.map((c) => c.id)).toEqual(['unread-new', 'unread-old', 'read-new', 'read-old']);
  });

  it('listConversations returns per-conversation unread counts and that order; a blocked pair is never unread', async () => {
    const participants = (id: string, other: string) => [
      { conversationId: id, userId: B },
      { conversationId: id, userId: other },
    ];
    const lastMsg = (m: number) => [{ body: 'x', senderId: A, createdAt: minutesAgo(m) }];
    const prisma = {
      conversation: {
        findMany: vi.fn().mockResolvedValue([
          { id: 'c-read-recent', createdAt: minutesAgo(500), participants: participants('c-read-recent', A), messages: lastMsg(2) },
          { id: 'c-unread-older', createdAt: minutesAgo(500), participants: participants('c-unread-older', C), messages: lastMsg(40) },
          { id: 'c-blocked', createdAt: minutesAgo(500), participants: participants('c-blocked', 'user-x'), messages: lastMsg(1) },
        ]),
      },
      profile: { findMany: vi.fn().mockResolvedValue([]) },
      block: { findMany: vi.fn().mockResolvedValue([{ initiatorId: B, targetId: 'user-x' }]) },
      message: {
        groupBy: vi.fn().mockResolvedValue([
          { conversationId: 'c-unread-older', _count: { _all: 2 } },
          { conversationId: 'c-blocked', _count: { _all: 5 } },
        ]),
      },
    };
    const service = new MessagesService(prisma as never, { getPhotosForProfile: vi.fn() } as never);

    const { items } = await service.listConversations(B);

    expect(items.map((c) => [c.id, c.unreadCount, c.hasUnread])).toEqual([
      ['c-unread-older', 2, true],
      ['c-blocked', 0, false], // most recent activity among the read ones
      ['c-read-recent', 0, false],
    ]);
    expect(prisma.message.groupBy.mock.calls[0][0].where).toEqual({
      conversationId: { in: ['c-read-recent', 'c-unread-older', 'c-blocked'] },
      senderId: { not: B },
      status: { not: 'READ' },
    });
  });
});

describe('new interests routes', () => {
  it('GET /interests/has-unread and POST /interests/viewed are behind JwtAuthGuard (401 without a token)', () => {
    expect(Reflect.getMetadata('__guards__', InterestsController)).toEqual([JwtAuthGuard]);
    expect(Reflect.getMetadata('path', InterestsController.prototype.hasUnread)).toBe('has-unread');
    expect(Reflect.getMetadata('path', InterestsController.prototype.markViewed)).toBe('viewed');
  });
});
