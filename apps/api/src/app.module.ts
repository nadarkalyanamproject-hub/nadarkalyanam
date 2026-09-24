import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { LoggerModule } from 'nestjs-pino';
import { validateEnv } from './modules/config/env.schema.js';
import { AdminModule } from './modules/admin/admin.module.js';
import { AuthModule } from './modules/auth/auth.module.js';
import { CallsModule } from './modules/calls/calls.module.js';
import { DiscoveryModule } from './modules/discovery/discovery.module.js';
import { HealthModule } from './modules/health/health.module.js';
import { InterestsModule } from './modules/interests/interests.module.js';
import { MatchingModule } from './modules/matching/matching.module.js';
import { MessagesModule } from './modules/messages/messages.module.js';
import { ModerationModule } from './modules/moderation/moderation.module.js';
import { NotificationsModule } from './modules/notifications/notifications.module.js';
import { PaymentsModule } from './modules/payments/payments.module.js';
import { PhotosModule } from './modules/photos/photos.module.js';
import { PrismaModule } from './modules/prisma/prisma.module.js';
import { ProfilesModule } from './modules/profiles/profiles.module.js';
import { QueueModule } from './modules/queue/queue.module.js';
import { RealtimeModule } from './modules/realtime/realtime.module.js';
import { RedisModule } from './modules/redis/redis.module.js';
import { StorageModule } from './modules/storage/storage.module.js';
import { VerificationModule } from './modules/verification/verification.module.js';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validate: validateEnv,
    }),
    LoggerModule.forRoot({
      pinoHttp: {
        transport:
          process.env.NODE_ENV === 'development'
            ? { target: 'pino-pretty', options: { singleLine: true } }
            : undefined,
        level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
      },
    }),
    PrismaModule,
    RedisModule,
    QueueModule,
    StorageModule,
    HealthModule,
    AuthModule,
    ProfilesModule,
    PhotosModule,
    InterestsModule,
    MessagesModule,
    RealtimeModule,
    DiscoveryModule,
    MatchingModule,
    ModerationModule,
    NotificationsModule,
    PaymentsModule,
    VerificationModule,
    CallsModule,
    AdminModule,
  ],
})
export class AppModule {}
