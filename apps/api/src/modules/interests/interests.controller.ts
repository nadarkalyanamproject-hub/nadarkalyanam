import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { type SendInterestRequest, sendInterestRequestSchema } from '@nadar-kalyanam/schemas';
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
