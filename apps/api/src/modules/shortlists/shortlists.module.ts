import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { PhotosModule } from '../photos/photos.module.js';
import { ShortlistsController } from './shortlists.controller.js';
import { ShortlistsService } from './shortlists.service.js';

@Module({
  imports: [AuthModule, PhotosModule],
  controllers: [ShortlistsController],
  providers: [ShortlistsService],
})
export class ShortlistsModule {}
