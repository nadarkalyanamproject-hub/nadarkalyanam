import { Body, Controller, Delete, Get, HttpCode, Param, Post, UseGuards } from '@nestjs/common';
import { type BlockRequest, blockRequestSchema, type ReportRequest, reportRequestSchema } from '@nadar-kalyanam/schemas';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe.js';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import type { AuthenticatedUser } from '../auth/guards/jwt-auth.guard.js';
import { BlocksService } from './blocks.service.js';
import { ModerationService } from './moderation.service.js';

@Controller()
@UseGuards(JwtAuthGuard)
export class ModerationController {
  constructor(
    private readonly moderationService: ModerationService,
    private readonly blocksService: BlocksService,
  ) {}

  @Post('blocks')
  async block(
    @CurrentUser() user: AuthenticatedUser,
    @Body(new ZodValidationPipe(blockRequestSchema)) body: BlockRequest,
  ) {
    const targetUserId = body.targetUserId ?? (await this.blocksService.userIdForProfile(body.targetProfileId!));
    return this.moderationService.block(user.userId, targetUserId);
  }

  // "Blocked members" in Profile settings.
  @Get('blocks')
  listBlocks(@CurrentUser() user: AuthenticatedUser) {
    return this.blocksService.listBlockedByCaller(user.userId);
  }

  @Delete('blocks/:targetUserId')
  @HttpCode(204)
  async unblock(@CurrentUser() user: AuthenticatedUser, @Param('targetUserId') targetUserId: string): Promise<void> {
    await this.blocksService.unblock(user.userId, targetUserId);
  }

  @Post('reports')
  report(
    @CurrentUser() user: AuthenticatedUser,
    @Body(new ZodValidationPipe(reportRequestSchema)) body: ReportRequest,
  ) {
    return this.moderationService.report(user.userId, body.targetType, body.targetId, body.reason);
  }
}
