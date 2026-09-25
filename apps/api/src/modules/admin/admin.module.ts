import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { ModerationModule } from '../moderation/moderation.module.js';
import { PhotosModule } from '../photos/photos.module.js';
import { ProfilesModule } from '../profiles/profiles.module.js';
import { AdminController } from './admin.controller.js';
import { AdminService } from './admin.service.js';
import { AuditLogService } from './audit-log.service.js';
import { AdminAuthGuard } from './guards/admin-auth.guard.js';
import { PermissionsGuard } from './guards/permissions.guard.js';

@Module({
  imports: [AuthModule, ModerationModule, PhotosModule, ProfilesModule],
  controllers: [AdminController],
  providers: [AdminService, AuditLogService, AdminAuthGuard, PermissionsGuard],
  exports: [AuditLogService],
})
export class AdminModule {}
