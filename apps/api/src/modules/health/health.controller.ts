import { Controller, Get, Inject } from '@nestjs/common';
import {
  HealthCheck,
  HealthCheckService,
  type HealthIndicatorResult,
} from '@nestjs/terminus';
import type { Redis } from 'ioredis';
import { PrismaService } from '../prisma/prisma.service.js';
import { REDIS_CLIENT } from '../redis/redis.constants.js';

@Controller('health')
export class HealthController {
  constructor(
    private readonly health: HealthCheckService,
    private readonly prisma: PrismaService,
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
  ) {}

  @Get()
  @HealthCheck()
  check() {
    return this.health.check([
      (): Promise<HealthIndicatorResult> => this.checkDatabase(),
      (): Promise<HealthIndicatorResult> => this.checkRedis(),
    ]);
  }

  private async checkDatabase(): Promise<HealthIndicatorResult> {
    await this.prisma.$queryRaw`SELECT 1`;
    return { database: { status: 'up' } };
  }

  private async checkRedis(): Promise<HealthIndicatorResult> {
    const pong = await this.redis.ping();
    return { redis: { status: pong === 'PONG' ? 'up' : 'down' } };
  }
}
