import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { PaymentsModule } from '../payments/payments.module.js';
import { ProfilesModule } from '../profiles/profiles.module.js';
import { HoroscopeMatchController } from './horoscope-match.controller.js';
import { HoroscopeMatchService } from './horoscope-match.service.js';

@Module({
  imports: [AuthModule, PaymentsModule, ProfilesModule],
  controllers: [HoroscopeMatchController],
  providers: [HoroscopeMatchService],
})
export class HoroscopeMatchModule {}
