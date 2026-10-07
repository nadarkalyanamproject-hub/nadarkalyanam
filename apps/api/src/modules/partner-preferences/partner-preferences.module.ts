import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { PartnerPreferencesController } from './partner-preferences.controller.js';
import { PartnerPreferencesService } from './partner-preferences.service.js';

@Module({
  imports: [AuthModule],
  controllers: [PartnerPreferencesController],
  providers: [PartnerPreferencesService],
  exports: [PartnerPreferencesService],
})
export class PartnerPreferencesModule {}
