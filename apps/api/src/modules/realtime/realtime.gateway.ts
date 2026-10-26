import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import {
  type OnGatewayConnection,
  type OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import type { Server, Socket } from 'socket.io';
import { parseCorsOrigins } from '../../common/cors-origins.js';
import { hasPlanAccess, PLAN_REQUIRED_MESSAGE } from '../../common/plan-required.guard.js';
import { assertActiveSession } from '../auth/session.util.js';
import type { Env } from '../config/env.schema.js';
import { MessagesService } from '../messages/messages.service.js';
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
// CORS reuses the same CORS_ORIGIN env var (and parsing) as the REST API's
// app.enableCors() call in main.ts — there is only one place this ever needs
// updating. It's read directly from process.env rather than injected
// ConfigService because @WebSocketGateway()'s options are evaluated at
// module-load time, before Nest's DI container exists (same constraint
// app.module.ts already works around for NODE_ENV in its pino config).
@WebSocketGateway({
  cors: { origin: parseCorsOrigins(process.env.CORS_ORIGIN ?? 'http://localhost:3005,http://localhost:3002,http://localhost:3001') },
})
export class RealtimeGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  private readonly server!: Server;

  private readonly logger = new Logger(RealtimeGateway.name);

  constructor(
    private readonly jwtService: JwtService,
    private readonly messagesService: MessagesService,
    private readonly prisma: PrismaService,
    private readonly config: ConfigService<Env, true>,
  ) {}

  async handleConnection(client: AuthenticatedSocket): Promise<void> {
    const token = client.handshake.auth?.token as string | undefined;
    if (!token) {
      client.disconnect(true);
      return;
    }
    try {
      const payload = await this.jwtService.verifyAsync<{ sub: string; typ?: string; sid?: string }>(token);
      // Same member/admin boundary as JwtAuthGuard: an admin token's sub is
      // an AdminUser id, never a member.
      if (payload.typ === 'admin') {
        client.disconnect(true);
        return;
      }
      // Same session rule as JwtAuthGuard: a logged-out token can't connect.
      await assertActiveSession(this.prisma, payload.sid, payload.sub);
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
    await this.requirePlan(senderId);
    const message = await this.messagesService.sendMessage(senderId, payload.conversationId, payload.body);

    const participant = await this.prisma.conversationParticipant.findFirst({
      where: { conversationId: payload.conversationId, userId: { not: senderId } },
    });
    if (!participant) {
      return;
    }

    // The in-app NEW_MESSAGE notification is created by
    // MessagesService.sendMessage (for REST and socket sends alike); this
    // only pushes the message live to a connected recipient.
    const recipientRoom = userRoom(participant.userId);
    const isOnline = (await this.server.in(recipientRoom).fetchSockets()).length > 0;
    if (isOnline) {
      this.server.to(recipientRoom).emit('new_message', message);
    }
  }

  @SubscribeMessage('message_read')
  async handleMessageRead(client: AuthenticatedSocket, payload: { conversationId: string }): Promise<void> {
    const userId = this.requireUserId(client);
    await this.requirePlan(userId);
    await this.messagesService.markRead(userId, payload.conversationId);
  }

  // Chat needs a plan when REQUIRE_PAID_PLAN is on, same as the REST routes.
  private async requirePlan(userId: string): Promise<void> {
    if (!(await hasPlanAccess(this.prisma, this.config, userId))) {
      throw new Error(PLAN_REQUIRED_MESSAGE);
    }
  }

  private requireUserId(client: AuthenticatedSocket): string {
    if (!client.data.userId) {
      throw new Error('Socket is not authenticated');
    }
    return client.data.userId;
  }
}
