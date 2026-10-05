import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { PhotosModule } from '../photos/photos.module.js';
import { BlocksService } from './blocks.service.js';
import { ModerationController } from './moderation.controller.js';
import { ModerationService } from './moderation.service.js';

@Module({
  imports: [AuthModule, PhotosModule],
  controllers: [ModerationController],
  providers: [ModerationService, BlocksService],
  exports: [ModerationService],
})
export class ModerationModule {}
