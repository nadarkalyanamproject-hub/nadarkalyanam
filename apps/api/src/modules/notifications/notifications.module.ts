import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { QueueModule } from '../queue/queue.module.js';
import {
  EMAIL_CHANNEL_ADAPTER,
  PUSH_CHANNEL_ADAPTER,
  SMS_CHANNEL_ADAPTER,
} from './adapters/notification-channel.adapter.js';
import { LogChannelAdapter } from './adapters/log-channel.adapter.js';
import { NotificationsController } from './notifications.controller.js';
import { NotificationsProcessor } from './notifications.processor.js';
import { NotificationsService } from './notifications.service.js';

@Module({
  imports: [AuthModule, QueueModule],
  controllers: [NotificationsController],
  providers: [
    NotificationsService,
    NotificationsProcessor,
    { provide: PUSH_CHANNEL_ADAPTER, useFactory: () => new LogChannelAdapter('push') },
    { provide: SMS_CHANNEL_ADAPTER, useFactory: () => new LogChannelAdapter('sms') },
    { provide: EMAIL_CHANNEL_ADAPTER, useFactory: () => new LogChannelAdapter('email') },
  ],
  exports: [NotificationsService],
})
export class NotificationsModule {}
