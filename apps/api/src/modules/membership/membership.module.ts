import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { NotificationsModule } from '../notifications/notifications.module.js';
import { EntitlementsService } from './entitlements.service.js';
import { MembershipController } from './membership.controller.js';
import { SubscriptionExpiryProcessor } from './subscription-expiry.processor.js';
import { SubscriptionExpiryService } from './subscription-expiry.service.js';

// What plan a member has (EntitlementsService, the single place paid
// features will check), GET /me/membership, and the expiry sweep.
@Module({
  imports: [AuthModule, NotificationsModule],
  controllers: [MembershipController],
  providers: [EntitlementsService, SubscriptionExpiryService, SubscriptionExpiryProcessor],
  exports: [EntitlementsService],
})
export class MembershipModule {}
