import 'reflect-metadata';
import { ForbiddenException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { MessagesController, MessagesUnreadController } from './messages.controller.js';
import { MessagesService } from './messages.service.js';

const A = 'user-a';
const B = 'user-b';
const C = 'user-c';

interface Msg {
  id: string;
  conversationId: string;
  senderId: string;
  status: 'SENT' | 'DELIVERED' | 'READ';
}

// In-memory messages/participants/blocks applying the where-shapes the
// service uses, so "open marks read -> count drops" is checked end to end.
function build(opts: { blocks?: [string, string][]; users?: Record<string, { status: string; profile: { id: string; fullName: string } | null }> } = {}) {
  const participants = [
    { conversationId: 'conv-ab', userId: A },
    { conversationId: 'conv-ab', userId: B },
    { conversationId: 'conv-cb', userId: C },
    { conversationId: 'conv-cb', userId: B },
  ];
  const messages: Msg[] = [
    { id: 'm1', conversationId: 'conv-ab', senderId: A, status: 'SENT' },
    { id: 'm2', conversationId: 'conv-ab', senderId: A, status: 'SENT' },
    { id: 'm3', conversationId: 'conv-ab', senderId: A, status: 'SENT' },
    { id: 'm4', conversationId: 'conv-ab', senderId: B, status: 'SENT' }, // B's own — never "unread for B"
    { id: 'm5', conversationId: 'conv-cb', senderId: C, status: 'SENT' },
  ];
  const blocks = opts.blocks ?? [];
  const users = opts.users ?? {
    [A]: { status: 'ACTIVE', profile: { id: 'profile-a', fullName: 'Arun A' } },
    [B]: { status: 'ACTIVE', profile: { id: 'profile-b', fullName: 'Bina B' } },
    [C]: { status: 'ACTIVE', profile: { id: 'profile-c', fullName: 'Chitra C' } },
  };
  const senderOk = (m: Msg, c: Record<string, unknown> | undefined) => {
    if (!c) return true;
    if ('not' in c && m.senderId === c.not) return false;
    if ('notIn' in c && (c.notIn as string[]).includes(m.senderId)) return false;
    return true;
  };
  const matches = (m: Msg, w: Record<string, unknown>) => {
    if (w.conversationId && m.conversationId !== w.conversationId) return false;
    if (w.status && m.status === (w.status as { not: string }).not) return false;
    if (w.senderId && !senderOk(m, w.senderId as Record<string, unknown>)) return false;
    for (const clause of (w.AND as Record<string, unknown>[] | undefined) ?? []) {
      if (!senderOk(m, clause.senderId as Record<string, unknown>)) return false;
    }
    const inConv = w.conversation as { participants: { some: { userId: string } } } | undefined;
    if (inConv && !participants.some((p) => p.conversationId === m.conversationId && p.userId === inConv.participants.some.userId)) {
      return false;
    }
    return true;
  };
  const prisma = {
    conversationParticipant: {
      findMany: vi.fn(async ({ where }: { where: { conversationId: string } }) =>
        participants.filter((p) => p.conversationId === where.conversationId),
      ),
    },
    block: {
      findFirst: vi.fn(async ({ where }: { where: { OR: { initiatorId: string; targetId: string }[] } }) =>
        blocks.some(([x, y]) => where.OR.some((o) => o.initiatorId === x && o.targetId === y)) ? { id: 'blk' } : null,
      ),
      findMany: vi.fn(async ({ where }: { where: { OR: { initiatorId?: string }[] } }) => {
        const me = where.OR[0].initiatorId!;
        return blocks.filter(([x, y]) => x === me || y === me).map(([initiatorId, targetId]) => ({ initiatorId, targetId }));
      }),
    },
    message: {
      updateMany: vi.fn(async ({ where, data }: { where: Record<string, unknown>; data: { status: Msg['status'] } }) => {
        const hit = messages.filter((m) => matches(m, where));
        hit.forEach((m) => (m.status = data.status));
        return { count: hit.length };
      }),
      count: vi.fn(async ({ where }: { where: Record<string, unknown> }) => messages.filter((m) => matches(m, where)).length),
      findMany: vi.fn(async ({ where }: { where: { conversationId: string } }) =>
        messages.filter((m) => m.conversationId === where.conversationId).map((m) => ({ ...m, body: 'x', createdAt: new Date() })),
      ),
    },
    user: {
      findUnique: vi.fn(async ({ where }: { where: { id: string } }) =>
        users[where.id] ? { id: where.id, ...users[where.id] } : null,
      ),
    },
  };
  const photos = { getPhotosForProfile: vi.fn(async (id: string) => [{ id: 'p', url: `https://signed.example/${id}?sig`, isPrimary: true, sortOrder: 0 }]) };
  return { service: new MessagesService(prisma as never, photos as never), messages };
}

describe('MessagesService.unreadCount + read-on-open', () => {
  it('counts messages sent TO the caller across their conversations (never their own)', async () => {
    const { service } = build();

    expect(await service.unreadCount(B)).toEqual({ unreadCount: 4 }); // m1-m3 from A + m5 from C
    expect(await service.unreadCount(A)).toEqual({ unreadCount: 1 }); // m4 from B
  });

  it('opening a conversation marks the other side\'s messages READ, and the count reflects it immediately', async () => {
    const { service, messages } = build();

    const opened = await service.listMessages(B, 'conv-ab', 0, 100);

    expect(opened.items.filter((m) => m.senderId === A).every((m) => m.status === 'READ')).toBe(true);
    expect(messages.find((m) => m.id === 'm4')?.status).toBe('SENT'); // B's own message untouched
    expect(await service.unreadCount(B)).toEqual({ unreadCount: 1 }); // only C's m5 left
    expect(await service.unreadCount(A)).toEqual({ unreadCount: 1 }); // A hasn't opened it
  });

  it('excludes conversations with a blocked participant (either direction) from the count', async () => {
    const byB = build({ blocks: [[B, C]] });
    const byC = build({ blocks: [[C, B]] });

    expect(await byB.service.unreadCount(B)).toEqual({ unreadCount: 3 });
    expect(await byC.service.unreadCount(B)).toEqual({ unreadCount: 3 });
  });

  it('a blocked conversation can\'t be opened, so nothing is marked read', async () => {
    const { service, messages } = build({ blocks: [[B, A]] });

    await expect(service.listMessages(B, 'conv-ab', 0, 100)).rejects.toBeInstanceOf(ForbiddenException);
    expect(messages.filter((m) => m.status === 'READ')).toHaveLength(0);
  });
});

describe('MessagesService.getConversation (thread header)', () => {
  it('returns the other participant\'s name and signed photo', async () => {
    const { service } = build();

    expect(await service.getConversation(B, 'conv-ab')).toEqual({
      id: 'conv-ab',
      otherParticipant: {
        userId: A,
        profileId: 'profile-a',
        fullName: 'Arun A',
        primaryPhotoUrl: 'https://signed.example/profile-a?sig',
        available: true,
      },
    });
  });

  it.each([
    ['DELETED', { id: 'profile-a', fullName: 'Deleted member' }, 'Deleted user'],
    ['SUSPENDED', { id: 'profile-a', fullName: 'Arun A' }, 'Member unavailable'],
    ['PENDING_DELETION', { id: 'profile-a', fullName: 'Arun A' }, 'Member unavailable'],
    ['ACTIVE', null, 'Deleted user'],
  ])('falls back when the other member is %s (profile: %o)', async (status, profile, name) => {
    const { service } = build({
      users: { [A]: { status, profile }, [B]: { status: 'ACTIVE', profile: { id: 'profile-b', fullName: 'Bina B' } } },
    });

    const { otherParticipant } = await service.getConversation(B, 'conv-ab');

    expect(otherParticipant).toMatchObject({ fullName: name, primaryPhotoUrl: null, available: false, profileId: null });
  });

  it('a blocked pair gets 403, same as reading or sending', async () => {
    const { service } = build({ blocks: [[A, B]] });

    await expect(service.getConversation(B, 'conv-ab')).rejects.toBeInstanceOf(ForbiddenException);
  });
});

describe('routes', () => {
  it('GET /messages/unread-count and GET /conversations/:id are behind JwtAuthGuard (401 without a token)', () => {
    expect(Reflect.getMetadata('__guards__', MessagesUnreadController)).toEqual([JwtAuthGuard]);
    expect(Reflect.getMetadata('__guards__', MessagesController)).toEqual([JwtAuthGuard]);
    expect(Reflect.getMetadata('path', MessagesUnreadController)).toBe('messages');
    expect(Reflect.getMetadata('path', MessagesUnreadController.prototype.unreadCount)).toBe('unread-count');
    expect(Reflect.getMetadata('path', MessagesController.prototype.getConversation)).toBe(':id');
  });
});
