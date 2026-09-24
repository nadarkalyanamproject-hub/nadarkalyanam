import { Controller, Get, Param, Patch, Query, UseGuards } from '@nestjs/common';
import { parseOffsetLimit } from '../../common/pagination.js';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import type { AuthenticatedUser } from '../auth/guards/jwt-auth.guard.js';
import { NotificationsService } from './notifications.service.js';

@Controller('notifications')
@UseGuards(JwtAuthGuard)
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get()
  list(@CurrentUser() user: AuthenticatedUser, @Query('offset') offsetParam?: string, @Query('limit') limitParam?: string) {
    const { offset, limit } = parseOffsetLimit(offsetParam, limitParam);
    return this.notificationsService.list(user.userId, offset, limit);
  }

  @Patch(':id/read')
  markRead(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.notificationsService.markRead(user.userId, id);
  }
}
