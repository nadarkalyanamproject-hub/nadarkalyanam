import { Body, Controller, Param, Post, UseGuards } from '@nestjs/common';
import { type InitiateCallRequest, initiateCallRequestSchema } from '@nadar-kalyanam/schemas';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe.js';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import type { AuthenticatedUser } from '../auth/guards/jwt-auth.guard.js';
import { CallsService } from './calls.service.js';

@Controller('calls')
@UseGuards(JwtAuthGuard)
export class CallsController {
  constructor(private readonly callsService: CallsService) {}

  @Post()
  initiate(
    @CurrentUser() user: AuthenticatedUser,
    @Body(new ZodValidationPipe(initiateCallRequestSchema)) body: InitiateCallRequest,
  ) {
    return this.callsService.initiate(user.userId, body.targetUserId);
  }

  @Post(':id/accept')
  accept(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.callsService.accept(user.userId, id);
  }

  @Post(':id/end')
  end(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.callsService.end(user.userId, id);
  }
}
