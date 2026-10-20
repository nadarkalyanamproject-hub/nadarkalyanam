import { Controller, Get, UseGuards } from '@nestjs/common';
import type { MyMembershipResponse } from '@nadar-kalyanam/schemas';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import { JwtAuthGuard, type AuthenticatedUser } from '../auth/guards/jwt-auth.guard.js';
import { EntitlementsService } from './entitlements.service.js';
import { LaunchTrialService } from './launch-trial.service.js';

@Controller('me')
@UseGuards(JwtAuthGuard)
export class MembershipController {
  constructor(
    private readonly entitlements: EntitlementsService,
    private readonly launchTrial: LaunchTrialService,
  ) {}

  // The caller's current plan (null for a free member) and its expiry, plus
  // the launch offer when it applies to them.
  @Get('membership')
  async getMyMembership(@CurrentUser() user: AuthenticatedUser): Promise<MyMembershipResponse> {
    const [membership, launchOffer] = await Promise.all([
      this.entitlements.getMyMembership(user.userId),
      this.launchTrial.offerFor(user.userId),
    ]);
    return { ...membership, launchOffer };
  }
}
