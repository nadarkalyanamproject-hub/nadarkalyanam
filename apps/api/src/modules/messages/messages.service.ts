import { ForbiddenException, Injectable } from '@nestjs/common';
import type { ConversationDetail, ConversationSummary, MessageResponse } from '@nadar-kalyanam/schemas';
import { getBlockedUserIds, isBlockedEitherDirection } from '../../common/blocks.util.js';
import type { Message } from '../../generated/prisma/client.js';
import { PhotosService } from '../photos/photos.service.js';
import { PrismaService } from '../prisma/prisma.service.js';

function toMessageResponse(message: Message): MessageResponse {
  return {
    id: message.id,
    conversationId: message.conversationId,
    senderId: message.senderId,
    body: message.body,
    status: message.status,
    createdAt: message.createdAt.toISOString(),
  };
}

// Unread conversations first; within each group, most recent activity first.
export function sortConversations<T extends { hasUnread: boolean; lastActivityAt: string }>(items: T[]): T[] {
  return [...items].sort(
    (a, b) => Number(b.hasUnread) - Number(a.hasUnread) || b.lastActivityAt.localeCompare(a.lastActivityAt),
  );
}

@Injectable()
export class MessagesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly photosService: PhotosService,
  ) {}

  async listConversations(callerUserId: string): Promise<{ items: ConversationSummary[] }> {
    const conversations = await this.prisma.conversation.findMany({
      where: { participants: { some: { userId: callerUserId } } },
      include: {
        participants: true,
        messages: { orderBy: { createdAt: 'desc' }, take: 1 },
      },
      orderBy: { createdAt: 'desc' },
    });

    const otherUserIds = conversations
      .map((conversation) => conversation.participants.find((p) => p.userId !== callerUserId)?.userId)
      .filter((id): id is string => Boolean(id));
    const profiles =
      otherUserIds.length > 0
        ? await this.prisma.profile.findMany({ where: { userId: { in: otherUserIds } } })
        : [];
    const profileByUserId = new Map(profiles.map((profile) => [profile.userId, profile]));

    // Unread per conversation: messages from the other participant not yet
    // READ (the same status the thread's read-on-open sets). One grouped
    // query for all conversations. A blocked pair can't open the thread, so
    // it never shows as unread — matching GET /messages/unread-count.
    const blocked = await getBlockedUserIds(this.prisma, callerUserId);
    const unreadGroups = conversations.length
      ? await this.prisma.message.groupBy({
          by: ['conversationId'],
          where: {
            conversationId: { in: conversations.map((c) => c.id) },
            senderId: { not: callerUserId },
            status: { not: 'READ' },
          },
          _count: { _all: true },
        })
      : [];
    const unreadByConversation = new Map(unreadGroups.map((g) => [g.conversationId, g._count._all]));

    const items = await Promise.all(
      conversations.map(async (conversation) => {
        const otherParticipant = conversation.participants.find((p) => p.userId !== callerUserId);
        const otherProfile = otherParticipant ? profileByUserId.get(otherParticipant.userId) : undefined;
        const photos = otherProfile ? await this.photosService.getPhotosForProfile(otherProfile.id) : [];
        const primaryPhotoUrl = photos.find((photo) => photo.isPrimary)?.url ?? photos[0]?.url ?? null;
        const lastMessage = conversation.messages[0];
        const isBlocked = otherParticipant ? blocked.has(otherParticipant.userId) : false;
        const unreadCount = isBlocked ? 0 : (unreadByConversation.get(conversation.id) ?? 0);

        return {
          id: conversation.id,
          otherParticipant: {
            userId: otherParticipant?.userId ?? '',
            profileId: otherProfile?.id ?? null,
            fullName: otherProfile?.fullName ?? 'Unknown',
            primaryPhotoUrl,
          },
          lastMessage: lastMessage
            ? {
                body: lastMessage.body,
                senderId: lastMessage.senderId,
                createdAt: lastMessage.createdAt.toISOString(),
              }
            : null,
          createdAt: conversation.createdAt.toISOString(),
          unreadCount,
          hasUnread: unreadCount > 0,
          lastActivityAt: (lastMessage?.createdAt ?? conversation.createdAt).toISOString(),
        };
      }),
    );

    return { items: sortConversations(items) };
  }

  async listMessages(
    callerUserId: string,
    conversationId: string,
    offset: number,
    limit: number,
  ): Promise<{ items: MessageResponse[]; nextOffset: number | null }> {
    // Reading messages is authorized exactly the same as sending them — see
    // the identical check (and its comment) in sendMessage below.
    await this.assertCanAccessConversation(callerUserId, conversationId);
    // Opening (or polling) a thread is what "reading" means in this UI, so
    // the other side's messages become READ here — before the fetch below,
    // so the returned statuses and the unread badge agree immediately.
    await this.markOthersMessagesRead(callerUserId, conversationId);

    const [messages, total] = await Promise.all([
      this.prisma.message.findMany({
        where: { conversationId },
        orderBy: { createdAt: 'asc' },
        skip: offset,
        take: limit,
      }),
      this.prisma.message.count({ where: { conversationId } }),
    ]);

    const nextOffset = offset + messages.length < total ? offset + messages.length : null;
    return { items: messages.map(toMessageResponse), nextOffset };
  }

  async sendMessage(callerUserId: string, conversationId: string, body: string): Promise<MessageResponse> {
    // FLOW STEP: "Message Authorization Checked on Every Operation". Every
    // send (and every read, above) re-verifies the caller is still an actual
    // participant of this conversation AND that neither party has blocked
    // the other since — a block created after a conversation already exists
    // must still cut off messaging, not just new interests.
    await this.assertCanAccessConversation(callerUserId, conversationId);

    // No notification: new messages are surfaced by the Messages unread
    // badge (unreadCount below), not the Notifications feed.
    const message = await this.prisma.message.create({
      data: { conversationId, senderId: callerUserId, body },
    });
    return toMessageResponse(message);
  }

  // Figure 8's "emit message_read" step: only the recipient can mark a
  // message read, and only messages not already sent by them.
  async markRead(callerUserId: string, conversationId: string): Promise<{ updatedCount: number }> {
    await this.assertCanAccessConversation(callerUserId, conversationId);
    return { updatedCount: await this.markOthersMessagesRead(callerUserId, conversationId) };
  }

  private async markOthersMessagesRead(callerUserId: string, conversationId: string): Promise<number> {
    const result = await this.prisma.message.updateMany({
      where: { conversationId, senderId: { not: callerUserId }, status: { not: 'READ' } },
      data: { status: 'READ' },
    });
    return result.count;
  }

  // The thread header: who the caller is talking to. Same access rule as
  // reading/sending (participant, not blocked either way — a blocked pair
  // gets 403 here too). A member who is no longer active, or has no
  // profile, gets a neutral fallback name and no photo.
  async getConversation(callerUserId: string, conversationId: string): Promise<ConversationDetail> {
    const otherUserId = await this.assertCanAccessConversation(callerUserId, conversationId);
    const other = otherUserId
      ? await this.prisma.user.findUnique({
          where: { id: otherUserId },
          select: { id: true, status: true, profile: { select: { id: true, fullName: true } } },
        })
      : null;

    if (!other || other.status !== 'ACTIVE' || !other.profile) {
      const deleted = !other || other.status === 'DELETED' || !other.profile;
      return {
        id: conversationId,
        otherParticipant: {
          userId: otherUserId ?? '',
          profileId: null,
          fullName: deleted ? 'Deleted user' : 'Member unavailable',
          primaryPhotoUrl: null,
          available: false,
        },
      };
    }

    const photos = await this.photosService.getPhotosForProfile(other.profile.id);
    return {
      id: conversationId,
      otherParticipant: {
        userId: other.id,
        profileId: other.profile.id,
        fullName: other.profile.fullName,
        primaryPhotoUrl: photos.find((photo) => photo.isPrimary)?.url ?? photos[0]?.url ?? null,
        available: true,
      },
    };
  }

  // Messages sent TO the caller, in any of their conversations, that they
  // haven't opened yet. A conversation with a blocked participant (either
  // direction) is excluded — the caller can't open it anyway.
  async unreadCount(callerUserId: string): Promise<{ unreadCount: number }> {
    const blocked = [...(await getBlockedUserIds(this.prisma, callerUserId))];
    const unreadCount = await this.prisma.message.count({
      where: {
        status: { not: 'READ' },
        AND: [{ senderId: { not: callerUserId } }, { senderId: { notIn: blocked } }],
        conversation: { participants: { some: { userId: callerUserId } } },
      },
    });
    return { unreadCount };
  }

  // Returns the other participant's user id (if any) so callers don't
  // re-query it; the checks themselves are unchanged.
  private async assertCanAccessConversation(callerUserId: string, conversationId: string): Promise<string | null> {
    const participants = await this.prisma.conversationParticipant.findMany({
      where: { conversationId },
    });
    const isParticipant = participants.some((p) => p.userId === callerUserId);
    if (!isParticipant) {
      // Covers both "you were never a participant" and "this conversation
      // id doesn't exist" identically — no reason to distinguish for the
      // caller either way.
      throw new ForbiddenException('You are not a participant in this conversation');
    }

    const otherParticipant = participants.find((p) => p.userId !== callerUserId);
    if (
      otherParticipant &&
      (await isBlockedEitherDirection(this.prisma, callerUserId, otherParticipant.userId))
    ) {
      throw new ForbiddenException('You cannot access this conversation');
    }
    return otherParticipant?.userId ?? null;
  }
}
