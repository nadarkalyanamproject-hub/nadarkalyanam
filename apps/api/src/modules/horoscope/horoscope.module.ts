import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { PhotosModule } from '../photos/photos.module.js';
import { HoroscopeController } from './horoscope.controller.js';
import { HoroscopeService } from './horoscope.service.js';

@Module({
  imports: [AuthModule, PhotosModule],
  controllers: [HoroscopeController],
  providers: [HoroscopeService],
  exports: [HoroscopeService],
})
export class HoroscopeModule {}
