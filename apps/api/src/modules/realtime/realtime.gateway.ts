import { Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import {
  type OnGatewayConnection,
  type OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import type { Server, Socket } from 'socket.io';
import { MessagesService } from '../messages/messages.service.js';
import { NotificationsService } from '../notifications/notifications.service.js';
import { PrismaService } from '../prisma/prisma.service.js';

interface AuthenticatedSocket extends Socket {
  data: { userId?: string };
}

function userRoom(userId: string): string {
  return `user:${userId}`;
}

// Figure 8 (Real-Time Chat sequence): a distinct connection-handling process
// from the REST API (per the component diagram), but it calls into
// MessagesService rather than duplicating its authorization/persistence
// logic.
//
// CORS reuses the same CORS_ORIGIN env var (and default) as the REST API's
// app.enableCors() call in main.ts — there is only one place this ever needs
// updating. It's read directly from process.env rather than injected
// ConfigService because @WebSocketGateway()'s options are evaluated at
// module-load time, before Nest's DI container exists (same constraint
// app.module.ts already works around for NODE_ENV in its pino config).
@WebSocketGateway({ cors: { origin: process.env.CORS_ORIGIN ?? 'http://localhost:3002' } })
export class RealtimeGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  private readonly server!: Server;

  private readonly logger = new Logger(RealtimeGateway.name);

  constructor(
    private readonly jwtService: JwtService,
    private readonly messagesService: MessagesService,
    private readonly notificationsService: NotificationsService,
    private readonly prisma: PrismaService,
  ) {}

  async handleConnection(client: AuthenticatedSocket): Promise<void> {
    const token = client.handshake.auth?.token as string | undefined;
    if (!token) {
      client.disconnect(true);
      return;
    }
    try {
      const payload = await this.jwtService.verifyAsync<{ sub: string }>(token);
      client.data.userId = payload.sub;
      await client.join(userRoom(payload.sub));
    } catch {
      client.disconnect(true);
    }
  }

  handleDisconnect(): void {
    // No per-connection state to clean up beyond socket.io's own room
    // membership, which it clears automatically on disconnect.
  }

  @SubscribeMessage('send_message')
  async handleSendMessage(
    client: AuthenticatedSocket,
    payload: { conversationId: string; body: string },
  ): Promise<void> {
    const senderId = this.requireUserId(client);
    const message = await this.messagesService.sendMessage(senderId, payload.conversationId, payload.body);

    const participant = await this.prisma.conversationParticipant.findFirst({
      where: { conversationId: payload.conversationId, userId: { not: senderId } },
    });
    if (!participant) {
      return;
    }

    const recipientRoom = userRoom(participant.userId);
    const isOnline = (await this.server.in(recipientRoom).fetchSockets()).length > 0;
    if (isOnline) {
      this.server.to(recipientRoom).emit('new_message', message);
    } else {
      await this.notificationsService.enqueue(participant.userId, 'message.new', {
        conversationId: payload.conversationId,
        messageId: message.id,
      });
    }
  }

  @SubscribeMessage('message_read')
  async handleMessageRead(client: AuthenticatedSocket, payload: { conversationId: string }): Promise<void> {
    const userId = this.requireUserId(client);
    await this.messagesService.markRead(userId, payload.conversationId);
  }

  private requireUserId(client: AuthenticatedSocket): string {
    if (!client.data.userId) {
      throw new Error('Socket is not authenticated');
    }
    return client.data.userId;
  }
}
