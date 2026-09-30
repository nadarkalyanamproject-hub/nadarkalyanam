import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { PhotosModule } from '../photos/photos.module.js';
import { MatchCategoriesController } from './match-categories.controller.js';
import { MatchCategoriesService } from './match-categories.service.js';

@Module({
  imports: [AuthModule, PhotosModule],
  controllers: [MatchCategoriesController],
  providers: [MatchCategoriesService],
})
export class MatchCategoriesModule {}
