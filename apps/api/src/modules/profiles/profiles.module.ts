import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { NotificationsModule } from '../notifications/notifications.module.js';
import { PhotosModule } from '../photos/photos.module.js';
import { ProfilesController } from './profiles.controller.js';
import { PhoneUnlockService } from './phone-unlock.service.js';
import { ProfilesService } from './profiles.service.js';

@Module({
  imports: [AuthModule, NotificationsModule, PhotosModule],
  controllers: [ProfilesController],
  providers: [ProfilesService, PhoneUnlockService],
  exports: [ProfilesService],
})
export class ProfilesModule {}
