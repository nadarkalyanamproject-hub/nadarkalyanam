import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { PhotosModule } from '../photos/photos.module.js';
import { MessagesController, MessagesUnreadController } from './messages.controller.js';
import { MessagesService } from './messages.service.js';

@Module({
  imports: [AuthModule, PhotosModule],
  controllers: [MessagesController, MessagesUnreadController],
  providers: [MessagesService],
  exports: [MessagesService],
})
export class MessagesModule {}
