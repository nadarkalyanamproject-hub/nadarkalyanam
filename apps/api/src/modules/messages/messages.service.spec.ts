import { ForbiddenException } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MessagesService } from './messages.service.js';

const CONVERSATION_ID = 'conversation-1';
const CALLER_USER_ID = 'user-caller';
const OTHER_USER_ID = 'user-other';
const OUTSIDER_USER_ID = 'user-outsider';

function buildService(overrides?: {
  participants?: unknown[];
  block?: unknown;
  messages?: unknown[];
}) {
  const prisma = {
    conversationParticipant: {
      findMany: vi.fn().mockResolvedValue(
        overrides?.participants ?? [
          { id: 'p1', conversationId: CONVERSATION_ID, userId: CALLER_USER_ID },
          { id: 'p2', conversationId: CONVERSATION_ID, userId: OTHER_USER_ID },
        ],
      ),
    },
    block: {
      findFirst: vi.fn().mockResolvedValue(overrides?.block ?? null),
    },
    message: {
      findMany: vi.fn().mockResolvedValue(overrides?.messages ?? []),
      count: vi.fn().mockResolvedValue(overrides?.messages?.length ?? 0),
      create: vi.fn().mockImplementation(({ data }: { data: Record<string, unknown> }) =>
        Promise.resolve({
          id: 'message-1',
          conversationId: data.conversationId,
          senderId: data.senderId,
          body: data.body,
          status: 'SENT',
          createdAt: new Date('2026-01-01T00:00:00.000Z'),
        }),
      ),
    },
    conversation: {
      findMany: vi.fn().mockResolvedValue([]),
    },
    profile: {
      findMany: vi.fn().mockResolvedValue([]),
    },
  };
  const photosService = { getPhotosForProfile: vi.fn().mockResolvedValue([]) };

  const service = new MessagesService(prisma as never, photosService as never);
  return { service, prisma, photosService };
}

describe('MessagesService.sendMessage', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('persists a message from an actual participant', async () => {
    const { service, prisma } = buildService();

    const result = await service.sendMessage(CALLER_USER_ID, CONVERSATION_ID, 'Hello there');

    expect(prisma.message.create).toHaveBeenCalledWith({
      data: { conversationId: CONVERSATION_ID, senderId: CALLER_USER_ID, body: 'Hello there' },
    });
    expect(result).toMatchObject({ conversationId: CONVERSATION_ID, senderId: CALLER_USER_ID, body: 'Hello there' });
  });

  it('rejects a caller who is not a participant of the conversation', async () => {
    const { service, prisma } = buildService();

    await expect(
      service.sendMessage(OUTSIDER_USER_ID, CONVERSATION_ID, 'Hi'),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(prisma.message.create).not.toHaveBeenCalled();
  });

  it('rejects sending when a nonexistent conversation id is given (no participants at all)', async () => {
    const { service, prisma } = buildService({ participants: [] });

    await expect(
      service.sendMessage(CALLER_USER_ID, 'no-such-conversation', 'Hi'),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(prisma.message.create).not.toHaveBeenCalled();
  });

  it('rejects sending between a blocked pair even though both are still listed as participants', async () => {
    const { service, prisma } = buildService({ block: { id: 'block-1' } });

    await expect(
      service.sendMessage(CALLER_USER_ID, CONVERSATION_ID, 'Hi'),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(prisma.block.findFirst).toHaveBeenCalled();
    expect(prisma.message.create).not.toHaveBeenCalled();
  });
});

describe('MessagesService.listMessages', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('returns messages for an actual participant, in ascending order', async () => {
    const messages = [
      { id: 'm1', conversationId: CONVERSATION_ID, senderId: OTHER_USER_ID, body: 'Hi', status: 'SENT', createdAt: new Date('2026-01-01T00:00:00.000Z') },
      { id: 'm2', conversationId: CONVERSATION_ID, senderId: CALLER_USER_ID, body: 'Hello back', status: 'SENT', createdAt: new Date('2026-01-01T00:01:00.000Z') },
    ];
    const { service, prisma } = buildService({ messages });

    const result = await service.listMessages(CALLER_USER_ID, CONVERSATION_ID, 0, 100);

    expect(prisma.message.findMany).toHaveBeenCalledWith({
      where: { conversationId: CONVERSATION_ID },
      orderBy: { createdAt: 'asc' },
      skip: 0,
      take: 100,
    });
    expect(result.items).toHaveLength(2);
    expect(result.items[0].body).toBe('Hi');
  });

  it('rejects reading messages for a caller who is not a participant — same protection as sending', async () => {
    const { service, prisma } = buildService();

    await expect(
      service.listMessages(OUTSIDER_USER_ID, CONVERSATION_ID, 0, 100),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(prisma.message.findMany).not.toHaveBeenCalled();
  });

  it('rejects reading messages between a blocked pair even though both are still listed as participants', async () => {
    const { service, prisma } = buildService({ block: { id: 'block-1' } });

    await expect(
      service.listMessages(CALLER_USER_ID, CONVERSATION_ID, 0, 100),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(prisma.message.findMany).not.toHaveBeenCalled();
  });
});

describe('MessagesService.listConversations', () => {
  it('resolves the other participant\'s profile and the last message preview', async () => {
    const { service, prisma } = buildService();
    prisma.conversation.findMany.mockResolvedValueOnce([
      {
        id: CONVERSATION_ID,
        interestId: 'interest-1',
        createdAt: new Date('2026-01-01T00:00:00.000Z'),
        participants: [
          { userId: CALLER_USER_ID },
          { userId: OTHER_USER_ID },
        ],
        messages: [
          { body: 'Hey!', senderId: OTHER_USER_ID, createdAt: new Date('2026-01-01T00:05:00.000Z') },
        ],
      },
    ]);
    prisma.profile.findMany.mockResolvedValueOnce([
      { id: 'profile-other', userId: OTHER_USER_ID, fullName: 'Other Person' },
    ]);

    const result = await service.listConversations(CALLER_USER_ID);

    expect(result.items).toHaveLength(1);
    expect(result.items[0].otherParticipant).toMatchObject({
      userId: OTHER_USER_ID,
      profileId: 'profile-other',
      fullName: 'Other Person',
    });
    expect(result.items[0].lastMessage).toMatchObject({ body: 'Hey!', senderId: OTHER_USER_ID });
  });

  it('returns an empty list when the caller has no conversations', async () => {
    const { service } = buildService();

    const result = await service.listConversations(CALLER_USER_ID);

    expect(result.items).toEqual([]);
  });
});
