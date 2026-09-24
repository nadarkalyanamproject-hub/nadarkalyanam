import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { type BlockRequest, blockRequestSchema, type ReportRequest, reportRequestSchema } from '@nadar-kalyanam/schemas';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe.js';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import type { AuthenticatedUser } from '../auth/guards/jwt-auth.guard.js';
import { ModerationService } from './moderation.service.js';

@Controller()
@UseGuards(JwtAuthGuard)
export class ModerationController {
  constructor(private readonly moderationService: ModerationService) {}

  @Post('blocks')
  block(
    @CurrentUser() user: AuthenticatedUser,
    @Body(new ZodValidationPipe(blockRequestSchema)) body: BlockRequest,
  ) {
    return this.moderationService.block(user.userId, body.targetUserId);
  }

  @Post('reports')
  report(
    @CurrentUser() user: AuthenticatedUser,
    @Body(new ZodValidationPipe(reportRequestSchema)) body: ReportRequest,
  ) {
    return this.moderationService.report(user.userId, body.targetType, body.targetId, body.reason);
  }
}
