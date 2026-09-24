import { ConfigService } from '@nestjs/config';
import { Redis } from 'ioredis';
import type { Env } from '../config/env.schema.js';

// BullMQ requires maxRetriesPerRequest: null on its Redis connection (it
// manages retries itself) — a separate connection from the shared
// REDIS_CLIENT in modules/redis, which does not set this.
export function createBullConnection(configService: ConfigService<Env, true>): Redis {
  return new Redis(configService.get('REDIS_URL', { infer: true }), { maxRetriesPerRequest: null });
}
