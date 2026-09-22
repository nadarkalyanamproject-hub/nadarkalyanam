import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { type SendMessageRequest, sendMessageRequestSchema } from '@nadar-kalyanam/schemas';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe.js';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import type { AuthenticatedUser } from '../auth/guards/jwt-auth.guard.js';
import { MessagesService } from './messages.service.js';

@Controller('conversations')
@UseGuards(JwtAuthGuard)
export class MessagesController {
  constructor(private readonly messagesService: MessagesService) {}

  @Get()
  listConversations(@CurrentUser() user: AuthenticatedUser) {
    return this.messagesService.listConversations(user.userId);
  }

  @Get(':id/messages')
  listMessages(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Query('offset') offsetParam?: string,
    @Query('limit') limitParam?: string,
  ) {
    const offset = Math.max(0, Number.parseInt(offsetParam ?? '0', 10) || 0);
    const limit = Math.min(200, Math.max(1, Number.parseInt(limitParam ?? '100', 10) || 100));
    return this.messagesService.listMessages(user.userId, id, offset, limit);
  }

  @Post(':id/messages')
  sendMessage(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(sendMessageRequestSchema)) body: SendMessageRequest,
  ) {
    return this.messagesService.sendMessage(user.userId, id, body.body);
  }
}
