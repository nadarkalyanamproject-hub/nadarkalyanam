import { Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import {
  type ListNotificationsQuery,
  listNotificationsQuerySchema,
  NOTIFICATION_CATEGORY_TYPES,
} from '@nadar-kalyanam/schemas';
import { parseOffsetLimit } from '../../common/pagination.js';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe.js';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import type { AuthenticatedUser } from '../auth/guards/jwt-auth.guard.js';
import { NotificationsService } from './notifications.service.js';

// Every route is scoped to the caller's own notifications (user.userId is
// the only recipient ever queried or updated).
@Controller('notifications')
@UseGuards(JwtAuthGuard)
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get()
  list(
    @CurrentUser() user: AuthenticatedUser,
    @Query(new ZodValidationPipe(listNotificationsQuerySchema)) query: ListNotificationsQuery,
  ) {
    const { offset, limit } = parseOffsetLimit(query.offset, query.limit ?? '20', 50);
    const category = query.category ?? 'all';
    return this.notificationsService.list(user.userId, {
      offset,
      limit,
      unreadOnly: query.unreadOnly === 'true' || category === 'unread',
      types: category === 'all' || category === 'unread' ? undefined : NOTIFICATION_CATEGORY_TYPES[category],
    });
  }

  // Cheap count for the header badge (polled).
  @Get('unread-count')
  unreadCount(@CurrentUser() user: AuthenticatedUser) {
    return this.notificationsService.unreadCount(user.userId);
  }

  // Clear all — permanent, caller's rows only.
  @Delete()
  clearAll(@CurrentUser() user: AuthenticatedUser) {
    return this.notificationsService.clearAll(user.userId);
  }

  @Post('read-all')
  markAllRead(@CurrentUser() user: AuthenticatedUser) {
    return this.notificationsService.markAllRead(user.userId);
  }

  @Patch(':id/read')
  markRead(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.notificationsService.markRead(user.userId, id);
  }
}
