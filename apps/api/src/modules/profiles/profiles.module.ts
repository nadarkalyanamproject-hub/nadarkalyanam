import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { NotificationsModule } from '../notifications/notifications.module.js';
import { HoroscopeModule } from '../horoscope/horoscope.module.js';
import { PartnerPreferencesModule } from '../partner-preferences/partner-preferences.module.js';
import { PhotosModule } from '../photos/photos.module.js';
import { ProfilesController } from './profiles.controller.js';
import { PhoneUnlockService } from './phone-unlock.service.js';
import { ProfilesService } from './profiles.service.js';
import { UnlockedContactsController } from './unlocked-contacts.controller.js';
import { UnlockedContactsService } from './unlocked-contacts.service.js';

@Module({
  imports: [AuthModule, NotificationsModule, PhotosModule, PartnerPreferencesModule, HoroscopeModule],
  controllers: [ProfilesController, UnlockedContactsController],
  providers: [ProfilesService, PhoneUnlockService, UnlockedContactsService],
  exports: [ProfilesService],
})
export class ProfilesModule {}
