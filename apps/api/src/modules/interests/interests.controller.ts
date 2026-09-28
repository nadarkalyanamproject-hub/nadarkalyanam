import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { type SendInterestRequest, sendInterestRequestSchema } from '@nadar-kalyanam/schemas';
import { parseOffsetLimit } from '../../common/pagination.js';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe.js';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import type { AuthenticatedUser } from '../auth/guards/jwt-auth.guard.js';
import { InterestsService } from './interests.service.js';

@Controller('interests')
@UseGuards(JwtAuthGuard)
export class InterestsController {
  constructor(private readonly interestsService: InterestsService) {}

  @Post()
  send(
    @CurrentUser() user: AuthenticatedUser,
    @Body(new ZodValidationPipe(sendInterestRequestSchema)) body: SendInterestRequest,
  ) {
    return this.interestsService.sendInterest(user.userId, body.targetProfileId);
  }

  @Get()
  list(@CurrentUser() user: AuthenticatedUser) {
    return this.interestsService.listForUser(user.userId);
  }

  // Connected members (ACCEPTED interest in either direction). Registered
  // as its own path segment, so it never collides with the :id routes.
  @Get('connections')
  connections(
    @CurrentUser() user: AuthenticatedUser,
    @Query('offset') offsetParam?: string,
    @Query('limit') limitParam?: string,
  ) {
    const { offset, limit } = parseOffsetLimit(offsetParam, limitParam ?? '20', 50);
    return this.interestsService.listConnections(user.userId, offset, limit);
  }

  @Patch(':id/accept')
  accept(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.interestsService.accept(user.userId, id);
  }

  @Patch(':id/decline')
  decline(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.interestsService.decline(user.userId, id);
  }

  @Delete(':id')
  withdraw(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.interestsService.withdraw(user.userId, id);
  }
}
