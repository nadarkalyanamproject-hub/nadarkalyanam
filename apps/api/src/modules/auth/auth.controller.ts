import { Body, Controller, HttpCode, Post, Req, UseFilters, UseGuards } from '@nestjs/common';
import {
  type RefreshTokenRequest,
  type SendOtpRequest,
  type VerifyOtpRequest,
  refreshTokenRequestSchema,
  sendOtpRequestSchema,
  verifyOtpRequestSchema,
} from '@nadar-kalyanam/schemas';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe.js';
import { AuthService } from './auth.service.js';
import { CurrentUser } from './decorators/current-user.decorator.js';
import { JwtAuthGuard, type AuthenticatedUser } from './guards/jwt-auth.guard.js';
import { RetryAfterFilter } from './retry-after.filter.js';

@Controller('auth')
@UseFilters(RetryAfterFilter)
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  // `ip` is the client address as Express resolves it (see TRUST_PROXY_HOPS
  // in main.ts); it feeds the per-IP OTP request limit.
  @Post('otp/request')
  requestOtp(
    @Body(new ZodValidationPipe(sendOtpRequestSchema)) body: SendOtpRequest,
    @Req() request: { ip?: string },
  ) {
    return this.authService.requestOtp(body.phoneNumber, request.ip);
  }

  @Post('otp/verify')
  verifyOtp(@Body(new ZodValidationPipe(verifyOtpRequestSchema)) body: VerifyOtpRequest) {
    return this.authService.verifyOtp(body.phoneNumber, body.otp, body.intent ?? 'register');
  }

  // Swaps a refresh token for a new access + refresh token pair (members
  // and admins alike). No access token needed: this is how an expired one
  // is replaced.
  @Post('refresh')
  @HttpCode(200)
  refresh(@Body(new ZodValidationPipe(refreshTokenRequestSchema)) body: RefreshTokenRequest) {
    return this.authService.refresh(body.refreshToken);
  }

  // Ends this login session server-side: the access token used here (and
  // any other carrying the same session) stops working immediately.
  @Post('logout')
  @HttpCode(204)
  @UseGuards(JwtAuthGuard)
  async logout(@CurrentUser() user: AuthenticatedUser): Promise<void> {
    await this.authService.logout(user.userId, user.sessionId);
  }
}
