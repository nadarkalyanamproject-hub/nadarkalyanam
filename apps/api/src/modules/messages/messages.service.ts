import { ForbiddenException, Injectable } from '@nestjs/common';
import type { ConversationSummary, MessageResponse } from '@nadar-kalyanam/schemas';
import { isBlockedEitherDirection } from '../../common/blocks.util.js';
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

    const items = await Promise.all(
      conversations.map(async (conversation) => {
        const otherParticipant = conversation.participants.find((p) => p.userId !== callerUserId);
        const otherProfile = otherParticipant ? profileByUserId.get(otherParticipant.userId) : undefined;
        const photos = otherProfile ? await this.photosService.getPhotosForProfile(otherProfile.id) : [];
        const primaryPhotoUrl = photos.find((photo) => photo.isPrimary)?.url ?? photos[0]?.url ?? null;
        const lastMessage = conversation.messages[0];

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
        };
      }),
    );

    return { items };
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

    const message = await this.prisma.message.create({
      data: { conversationId, senderId: callerUserId, body },
    });
    return toMessageResponse(message);
  }

  // Figure 8's "emit message_read" step: only the recipient can mark a
  // message read, and only messages not already sent by them.
  async markRead(callerUserId: string, conversationId: string): Promise<{ updatedCount: number }> {
    await this.assertCanAccessConversation(callerUserId, conversationId);

    const result = await this.prisma.message.updateMany({
      where: { conversationId, senderId: { not: callerUserId }, status: { not: 'READ' } },
      data: { status: 'READ' },
    });
    return { updatedCount: result.count };
  }

  private async assertCanAccessConversation(callerUserId: string, conversationId: string): Promise<void> {
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
  }
}
