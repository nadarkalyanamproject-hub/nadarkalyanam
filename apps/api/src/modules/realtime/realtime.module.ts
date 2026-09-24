import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { MessagesModule } from '../messages/messages.module.js';
import { NotificationsModule } from '../notifications/notifications.module.js';
import { RealtimeGateway } from './realtime.gateway.js';

@Module({
  imports: [AuthModule, MessagesModule, NotificationsModule],
  providers: [RealtimeGateway],
})
export class RealtimeModule {}
