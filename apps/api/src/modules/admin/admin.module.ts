import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { MembershipModule } from '../membership/membership.module.js';
import { ModerationModule } from '../moderation/moderation.module.js';
import { NotificationsModule } from '../notifications/notifications.module.js';
import { PhotosModule } from '../photos/photos.module.js';
import { ProfilesModule } from '../profiles/profiles.module.js';
import { VipModule } from '../vip/vip.module.js';
import { AdminBillingController } from './billing/admin-billing.controller.js';
import { AdminBillingService } from './billing/admin-billing.service.js';
import { AdminController } from './admin.controller.js';
import { AdminUsersService } from './admin-users.service.js';
import { AdminService } from './admin.service.js';
import { AnonymizationProcessor } from './anonymization/anonymization.processor.js';
import { AnonymizationService } from './anonymization/anonymization.service.js';
import { AuditLogService } from './audit-log.service.js';
import { AdminAuthGuard } from './guards/admin-auth.guard.js';
import { PermissionsGuard } from './guards/permissions.guard.js';

@Module({
  imports: [AuthModule, ModerationModule, NotificationsModule, PhotosModule, ProfilesModule, MembershipModule, VipModule],
  controllers: [AdminController, AdminBillingController],
  providers: [
    AdminService,
    AdminBillingService,
    AdminUsersService,
    AuditLogService,
    AnonymizationService,
    AnonymizationProcessor,
    AdminAuthGuard,
    PermissionsGuard,
  ],
  exports: [AuditLogService],
})
export class AdminModule {}
