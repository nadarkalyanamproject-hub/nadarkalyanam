import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import type { ListNotificationsResponse, NotificationResponse } from '@nadar-kalyanam/schemas';
import type { Queue } from 'bullmq';
import { NOTIFICATIONS_QUEUE_TOKEN } from '../queue/queue.constants.js';
import type { Prisma } from '../../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import {
  EMAIL_CHANNEL_ADAPTER,
  type NotificationChannelAdapter,
  PUSH_CHANNEL_ADAPTER,
  SMS_CHANNEL_ADAPTER,
} from './adapters/notification-channel.adapter.js';

export interface NotifyJob {
  userId: string;
  type: string;
  payload: Record<string, unknown>;
}

function toResponse(notification: {
  id: string;
  type: string;
  payload: unknown;
  read: boolean;
  createdAt: Date;
}): NotificationResponse {
  return {
    id: notification.id,
    type: notification.type,
    payload: notification.payload as Record<string, unknown>,
    read: notification.read,
    createdAt: notification.createdAt.toISOString(),
  };
}

// FR-10.5: enqueue() is the only thing callers (Interests, Messages, Calls,
// Payments, Verification) should call directly — everything else runs off
// the queue, decoupled from the triggering API request. See
// NotificationsProcessor for the consumer side (Fig 5/8's "Notification
// Worker").
@Injectable()
export class NotificationsService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(NOTIFICATIONS_QUEUE_TOKEN) private readonly queue: Queue<NotifyJob>,
    @Inject(PUSH_CHANNEL_ADAPTER) private readonly push: NotificationChannelAdapter,
    @Inject(SMS_CHANNEL_ADAPTER) private readonly sms: NotificationChannelAdapter,
    @Inject(EMAIL_CHANNEL_ADAPTER) private readonly email: NotificationChannelAdapter,
  ) {}

  async enqueue(userId: string, type: string, payload: Record<string, unknown> = {}): Promise<void> {
    await this.queue.add('notify', { userId, type, payload });
  }

  // Consumer-side logic (runs in NotificationsProcessor, off the request
  // path): persists the Notification row (FR-10.6 traceability) then fans
  // out to whichever channels resolveChannels() selects for this type.
  async createAndPush(job: NotifyJob): Promise<void> {
    await this.prisma.notification.create({
      data: { userId: job.userId, type: job.type, payload: job.payload as Prisma.InputJsonValue },
    });

    const channels = this.resolveChannels();
    await Promise.all(channels.map((channel) => channel.send(job.userId, job.type, job.payload)));
  }

  // FR-10.1/10.2/10.3: which channel(s) a notification type uses. A real
  // implementation should also honor per-user, per-channel preferences
  // (FR-10.4, Should-priority, not yet modeled) — everything currently goes
  // to push only, pending that.
  private resolveChannels(): NotificationChannelAdapter[] {
    return [this.push];
  }

  async list(userId: string, offset: number, limit: number): Promise<ListNotificationsResponse> {
    const [items, total] = await Promise.all([
      this.prisma.notification.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        skip: offset,
        take: limit,
      }),
      this.prisma.notification.count({ where: { userId } }),
    ]);
    const nextOffset = offset + items.length < total ? offset + items.length : null;
    return { items: items.map(toResponse), nextOffset };
  }

  async markRead(userId: string, notificationId: string): Promise<NotificationResponse> {
    const notification = await this.prisma.notification.findUnique({ where: { id: notificationId } });
    if (!notification || notification.userId !== userId) {
      throw new NotFoundException('Notification not found');
    }
    const updated = await this.prisma.notification.update({
      where: { id: notificationId },
      data: { read: true },
    });
    return toResponse(updated);
  }
}
