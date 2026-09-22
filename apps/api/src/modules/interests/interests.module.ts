import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { PhotosModule } from '../photos/photos.module.js';
import { ProfilesModule } from '../profiles/profiles.module.js';
import { InterestsController } from './interests.controller.js';
import { InterestsService } from './interests.service.js';

@Module({
  imports: [AuthModule, PhotosModule, ProfilesModule],
  controllers: [InterestsController],
  providers: [InterestsService],
})
export class InterestsModule {}
