import { Global, Logger, Module, type Provider } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Redis } from 'ioredis';
import type { Env } from '../config/env.schema.js';
import { REDIS_CLIENT } from './redis.constants.js';

const redisProvider: Provider = {
  provide: REDIS_CLIENT,
  inject: [ConfigService],
  useFactory: (configService: ConfigService<Env, true>) => {
    const logger = new Logger('Redis');
    const client = new Redis(configService.get('REDIS_URL', { infer: true }));
    client.on('error', (err) => {
      logger.warn(`Redis connection error: ${err.message}`);
    });
    return client;
  },
};

@Global()
@Module({
  providers: [redisProvider],
  exports: [redisProvider],
})
export class RedisModule {}
