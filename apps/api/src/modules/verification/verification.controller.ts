import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import {
  type VerificationCallbackRequest,
  verificationCallbackRequestSchema,
} from '@nadar-kalyanam/schemas';
import { AllowUnverifiedIdentity } from '../../common/identity-gate.js';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe.js';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import type { AuthenticatedUser } from '../auth/guards/jwt-auth.guard.js';
import { VerificationService } from './verification.service.js';

// The DigiLocker flow itself is open to accounts that haven't verified yet.
@Controller('verification')
@UseGuards(JwtAuthGuard)
@AllowUnverifiedIdentity()
export class VerificationController {
  constructor(private readonly verificationService: VerificationService) {}

  @Post('initiate')
  initiate(@CurrentUser() user: AuthenticatedUser) {
    return this.verificationService.initiate(user.userId);
  }

  @Post('callback')
  callback(
    @CurrentUser() user: AuthenticatedUser,
    @Body(new ZodValidationPipe(verificationCallbackRequestSchema)) body: VerificationCallbackRequest,
  ) {
    return this.verificationService.callback(user.userId, body.reference);
  }

  @Get('status')
  status(@CurrentUser() user: AuthenticatedUser) {
    return this.verificationService.getStatus(user.userId);
  }
}
