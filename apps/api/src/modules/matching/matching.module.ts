import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { PhotosModule } from '../photos/photos.module.js';
import { MatchingController } from './matching.controller.js';
import { MatchingService } from './matching.service.js';

@Module({
  imports: [AuthModule, PhotosModule],
  controllers: [MatchingController],
  providers: [MatchingService],
})
export class MatchingModule {}
