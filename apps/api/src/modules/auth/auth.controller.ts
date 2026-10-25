import { Body, Controller, Get, HttpCode, Post, Req, UseFilters, UseGuards } from '@nestjs/common';
import { AllowUnverifiedIdentity } from '../../common/identity-gate.js';
import {
  type AccountStatusResponse,
  type LogoutOthersOtpResponse,
  type LogoutOthersRequest,
  type RefreshTokenRequest,
  type SendOtpRequest,
  type VerifyOtpRequest,
  logoutOthersRequestSchema,
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
  @AllowUnverifiedIdentity()
  async logout(@CurrentUser() user: AuthenticatedUser): Promise<void> {
    await this.authService.logout(user.userId, user.sessionId);
  }

  // The member's own account state (e.g. a deletion scheduled).
  @Get('account')
  @UseGuards(JwtAuthGuard)
  @AllowUnverifiedIdentity()
  account(@CurrentUser() user: AuthenticatedUser): Promise<AccountStatusResponse> {
    return this.authService.getAccount(user.userId);
  }

  // "Delete my account": hidden at once, erased after 14 days unless cancelled.
  @Post('account/delete')
  @HttpCode(200)
  @UseGuards(JwtAuthGuard)
  @AllowUnverifiedIdentity()
  deleteAccount(@CurrentUser() user: AuthenticatedUser): Promise<AccountStatusResponse> {
    return this.authService.requestAccountDeletion(user.userId);
  }

  @Post('account/cancel-deletion')
  @HttpCode(200)
  @UseGuards(JwtAuthGuard)
  @AllowUnverifiedIdentity()
  cancelDeletion(@CurrentUser() user: AuthenticatedUser): Promise<AccountStatusResponse> {
    return this.authService.cancelAccountDeletion(user.userId);
  }

  // How many devices this member is signed in on (this one included).
  @Get('sessions')
  @UseGuards(JwtAuthGuard)
  @AllowUnverifiedIdentity()
  async sessions(@CurrentUser() user: AuthenticatedUser): Promise<{ activeSessions: number }> {
    return { activeSessions: await this.authService.countActiveSessions(user.userId) };
  }

  // Sends a code to the member's registered number, needed to sign out
  // every other device (so a stolen signed-in device can't lock the owner out).
  @Post('logout-others/otp')
  @HttpCode(200)
  @UseGuards(JwtAuthGuard)
  @AllowUnverifiedIdentity()
  requestLogoutOthersOtp(@CurrentUser() user: AuthenticatedUser, @Req() request: { ip?: string }): Promise<LogoutOthersOtpResponse> {
    return this.authService.requestLogoutOthersOtp(user.userId, request.ip);
  }

  // Signs out every other device once the code checks out; this one stays signed in.
  @Post('logout-others')
  @HttpCode(200)
  @UseGuards(JwtAuthGuard)
  @AllowUnverifiedIdentity()
  async logoutOthers(
    @CurrentUser() user: AuthenticatedUser,
    @Body(new ZodValidationPipe(logoutOthersRequestSchema)) body: LogoutOthersRequest,
  ): Promise<{ loggedOut: number }> {
    return { loggedOut: await this.authService.logoutOtherSessions(user.userId, user.sessionId, body.otp) };
  }
}
