import { Controller, Get, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import { JwtAuthGuard, type AuthenticatedUser } from '../auth/guards/jwt-auth.guard.js';
import { EntitlementsService } from './entitlements.service.js';

@Controller('me')
@UseGuards(JwtAuthGuard)
export class MembershipController {
  constructor(private readonly entitlements: EntitlementsService) {}

  // The caller's current plan (null for a free member) and its expiry.
  @Get('membership')
  getMyMembership(@CurrentUser() user: AuthenticatedUser) {
    return this.entitlements.getMyMembership(user.userId);
  }
}
