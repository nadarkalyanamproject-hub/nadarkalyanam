import { Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';
import type {
  ListNotificationsResponse,
  NotificationResponse,
  NotificationTargetType,
  NotificationType,
} from '@nadar-kalyanam/schemas';
import type { Queue } from 'bullmq';
import { getBlockedUserIds } from '../../common/blocks.util.js';
import type { Prisma } from '../../generated/prisma/client.js';
import { PhotosService } from '../photos/photos.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { NOTIFICATIONS_QUEUE_TOKEN } from '../queue/queue.constants.js';
import { notificationMessage, SYSTEM_ACTOR_NAME } from './notification-message.js';

export interface NotifyInput {
  recipientUserId: string;
  // null/undefined for system and admin notices.
  actorUserId?: string | null;
  type: NotificationType;
  targetType?: NotificationTargetType;
  targetId?: string;
  // Non-identifying extras only (e.g. a scheduled date). Never email,
  // phone or dateOfBirth — names are resolved at read time instead.
  data?: Record<string, unknown>;
}

export type NotifyJob = NotifyInput;

// One PROFILE_VIEWED per viewer -> profile pair per window: a repeat view
// inside it is dropped; a view after it re-surfaces the SAME row (bumped to
// now and unread again) rather than adding another.
export const PROFILE_VIEW_THROTTLE_MS = 24 * 60 * 60 * 1000;

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    private readonly prisma: PrismaService,
    @Inject(NOTIFICATIONS_QUEUE_TOKEN) private readonly queue: Queue<NotifyJob>,
    private readonly photosService: PhotosService,
  ) {}

  // FR-10.5: the one entry point business flows call. Fire-and-forget onto
  // the queue: it never throws and never awaits Redis, so a notification
  // problem can't fail — or slow down — the action that triggered it.
  notify(input: NotifyInput): void {
    if (input.actorUserId && input.actorUserId === input.recipientUserId) {
      return;
    }
    try {
      void this.queue.add('notify', input).catch((error: unknown) => {
        this.logger.error(`Could not enqueue ${input.type} for user=${input.recipientUserId}: ${String(error)}`);
      });
    } catch (error) {
      this.logger.error(`Could not enqueue ${input.type} for user=${input.recipientUserId}: ${String(error)}`);
    }
  }

  // Consumer side (NotificationsProcessor, off the request path, one job at
  // a time). In-app only: persisting the row is the delivery — no push, SMS
  // or email is sent.
  async persist(job: NotifyJob): Promise<void> {
    const now = new Date();
    const base = {
      userId: job.recipientUserId,
      actorUserId: job.actorUserId ?? null,
      type: job.type,
      targetType: job.targetType ?? null,
      targetId: job.targetId ?? null,
      payload: (job.data ?? {}) as Prisma.InputJsonValue,
    };

    if (job.type === 'PROFILE_VIEWED') {
      // The target is the viewer's own profile (for "view their profile").
      const viewerProfile = job.actorUserId
        ? await this.prisma.profile.findUnique({ where: { userId: job.actorUserId }, select: { id: true } })
        : null;
      if (!viewerProfile) return;
      const existing = await this.prisma.notification.findFirst({
        where: { userId: job.recipientUserId, type: 'PROFILE_VIEWED', actorUserId: job.actorUserId },
        orderBy: { createdAt: 'desc' },
      });
      if (existing && now.getTime() - existing.createdAt.getTime() < PROFILE_VIEW_THROTTLE_MS) {
        return;
      }
      if (existing) {
        await this.prisma.notification.update({
          where: { id: existing.id },
          data: { createdAt: now, read: false, targetType: 'Profile', targetId: viewerProfile.id },
        });
        return;
      }
      await this.prisma.notification.create({
        data: { ...base, targetType: 'Profile', targetId: viewerProfile.id },
      });
      return;
    }

    await this.prisma.notification.create({ data: base });
  }

  // Notifications whose actor is now blocked (either direction), suspended,
  // pending deletion or deleted are hidden — the same people are hidden
  // everywhere else in the app. System notices (no actor) always show.
  private async visibleWhere(userId: string, unreadOnly: boolean): Promise<Prisma.NotificationWhereInput> {
    const blocked = [...(await getBlockedUserIds(this.prisma, userId))];
    return {
      userId,
      // New messages have their own unread badge; NEW_MESSAGE rows (only
      // older data — nothing creates them now) never show here.
      type: { not: 'NEW_MESSAGE' },
      ...(unreadOnly ? { read: false } : {}),
      OR: [{ actorUserId: null }, { actor: { status: 'ACTIVE', id: { notIn: blocked } } }],
    };
  }

  async list(
    userId: string,
    options: { offset: number; limit: number; unreadOnly: boolean },
  ): Promise<ListNotificationsResponse> {
    const where = await this.visibleWhere(userId, options.unreadOnly);
    const unreadWhere = options.unreadOnly ? where : await this.visibleWhere(userId, true);
    const [rows, total, unreadCount] = await Promise.all([
      this.prisma.notification.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: options.offset,
        take: options.limit,
        include: { actor: { select: { profile: { select: { id: true, fullName: true } } } } },
      }),
      this.prisma.notification.count({ where }),
      this.prisma.notification.count({ where: unreadWhere }),
    ]);

    // Actor photos: one signed-URL lookup per distinct actor on the page.
    const actorProfileIds = [...new Set(rows.map((row) => row.actor?.profile?.id).filter((id): id is string => !!id))];
    const photoByProfileId = new Map<string, string | null>();
    await Promise.all(
      actorProfileIds.map(async (profileId) => {
        const photos = await this.photosService.getPhotosForProfile(profileId);
        photoByProfileId.set(profileId, photos.find((p) => p.isPrimary)?.url ?? photos[0]?.url ?? null);
      }),
    );

    // Profile targets can become unopenable (hidden since); one batched check.
    const profileTargetIds = rows.filter((r) => r.targetType === 'Profile' && r.targetId).map((r) => r.targetId!);
    const openableProfiles = new Set(
      profileTargetIds.length
        ? (
            await this.prisma.profile.findMany({
              where: { id: { in: profileTargetIds }, visibility: { not: 'HIDDEN' } },
              select: { id: true },
            })
          ).map((p) => p.id)
        : [],
    );

    const items: NotificationResponse[] = rows.map((row) => {
      const actorProfile = row.actor?.profile ?? null;
      const actorName = row.actorUserId ? (actorProfile?.fullName ?? 'A member') : SYSTEM_ACTOR_NAME;
      return {
        id: row.id,
        type: row.type,
        message: notificationMessage(row.type, actorName, (row.payload ?? {}) as Record<string, unknown>),
        actor: { name: actorName, photoUrl: actorProfile ? (photoByProfileId.get(actorProfile.id) ?? null) : null },
        targetType: row.targetType,
        targetId: row.targetId,
        targetAvailable: row.targetType === 'Profile' ? openableProfiles.has(row.targetId ?? '') : true,
        isRead: row.read,
        createdAt: row.createdAt.toISOString(),
      };
    });

    const nextOffset = options.offset + rows.length < total ? options.offset + rows.length : null;
    return { items, total, unreadCount, nextOffset };
  }

  async unreadCount(userId: string): Promise<{ unreadCount: number }> {
    return { unreadCount: await this.prisma.notification.count({ where: await this.visibleWhere(userId, true) }) };
  }

  // Scoped to the caller: someone else's id is indistinguishable from a
  // nonexistent one (404), and nothing is written.
  async markRead(userId: string, notificationId: string): Promise<{ id: string; isRead: true }> {
    const { count } = await this.prisma.notification.updateMany({
      where: { id: notificationId, userId, type: { not: 'NEW_MESSAGE' } },
      data: { read: true },
    });
    if (count === 0) {
      throw new NotFoundException('Notification not found');
    }
    return { id: notificationId, isRead: true };
  }

  async markAllRead(userId: string): Promise<{ updatedCount: number }> {
    const { count } = await this.prisma.notification.updateMany({
      where: { userId, read: false, type: { not: 'NEW_MESSAGE' } },
      data: { read: true },
    });
    return { updatedCount: count };
  }
}
