import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { PartnerPreferencesModule } from '../partner-preferences/partner-preferences.module.js';
import { PhotosModule } from '../photos/photos.module.js';
import { MatchingController } from './matching.controller.js';
import { MatchingService } from './matching.service.js';

@Module({
  imports: [AuthModule, PhotosModule, PartnerPreferencesModule],
  controllers: [MatchingController],
  providers: [MatchingService],
})
export class MatchingModule {}
