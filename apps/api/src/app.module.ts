import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { LoggerModule } from 'nestjs-pino';
import { validateEnv } from './modules/config/env.schema.js';
import { AuthModule } from './modules/auth/auth.module.js';
import { HealthModule } from './modules/health/health.module.js';
import { PrismaModule } from './modules/prisma/prisma.module.js';
import { ProfilesModule } from './modules/profiles/profiles.module.js';
import { RedisModule } from './modules/redis/redis.module.js';

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
    HealthModule,
    AuthModule,
    ProfilesModule,
  ],
})
export class AppModule {}
