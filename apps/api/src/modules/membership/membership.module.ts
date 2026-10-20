import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { NotificationsModule } from '../notifications/notifications.module.js';
import { EntitlementsService } from './entitlements.service.js';
import { LaunchTrialService } from './launch-trial.service.js';
import { MembershipController } from './membership.controller.js';
import { SubscriptionExpiryProcessor } from './subscription-expiry.processor.js';
import { SubscriptionExpiryService } from './subscription-expiry.service.js';
import { SubscriptionService } from './subscription.service.js';

// What plan a member has (EntitlementsService, the single place paid
// features will check), GET /me/membership, the expiry sweep and the
// launch offer (LaunchTrialService).
@Module({
  imports: [AuthModule, NotificationsModule],
  controllers: [MembershipController],
  providers: [EntitlementsService, SubscriptionService, LaunchTrialService, SubscriptionExpiryService, SubscriptionExpiryProcessor],
  exports: [EntitlementsService, SubscriptionService, LaunchTrialService],
})
export class MembershipModule {}
