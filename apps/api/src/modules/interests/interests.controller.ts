import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { type SendInterestRequest, sendInterestRequestSchema } from '@nadar-kalyanam/schemas';
import { parseOffsetLimit } from '../../common/pagination.js';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe.js';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import type { AuthenticatedUser } from '../auth/guards/jwt-auth.guard.js';
import { InterestsService } from './interests.service.js';
import { PlanRequiredGuard } from '../../common/plan-required.guard.js';

@Controller('interests')
@UseGuards(JwtAuthGuard)
export class InterestsController {
  constructor(private readonly interestsService: InterestsService) {}

  @Post()
  @UseGuards(PlanRequiredGuard)
  send(
    @CurrentUser() user: AuthenticatedUser,
    @Body(new ZodValidationPipe(sendInterestRequestSchema)) body: SendInterestRequest,
  ) {
    return this.interestsService.sendInterest(user.userId, body.targetProfileId);
  }

  @Get()
  @UseGuards(PlanRequiredGuard)
  list(@CurrentUser() user: AuthenticatedUser) {
    return this.interestsService.listForUser(user.userId);
  }

  // Connected members (ACCEPTED interest in either direction). Registered
  // as its own path segment, so it never collides with the :id routes.
  @Get('connections')
  @UseGuards(PlanRequiredGuard)
  connections(
    @CurrentUser() user: AuthenticatedUser,
    @Query('offset') offsetParam?: string,
    @Query('limit') limitParam?: string,
  ) {
    const { offset, limit } = parseOffsetLimit(offsetParam, limitParam ?? '20', 50);
    return this.interestsService.listConnections(user.userId, offset, limit);
  }

  // Header dot: a pending interest arrived since the last Interests visit.
  @Get('has-unread')
  hasUnread(@CurrentUser() user: AuthenticatedUser) {
    return this.interestsService.hasUnread(user.userId);
  }

  // Called by the Interests page on open; clears the dot.
  @Post('viewed')
  @UseGuards(PlanRequiredGuard)
  markViewed(@CurrentUser() user: AuthenticatedUser) {
    return this.interestsService.markViewed(user.userId);
  }

  @Patch(':id/accept')
  @UseGuards(PlanRequiredGuard)
  accept(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.interestsService.accept(user.userId, id);
  }

  @Patch(':id/decline')
  @UseGuards(PlanRequiredGuard)
  decline(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.interestsService.decline(user.userId, id);
  }

  @Delete(':id')
  @UseGuards(PlanRequiredGuard)
  withdraw(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.interestsService.withdraw(user.userId, id);
  }
}
