import { Injectable, Logger, type OnModuleDestroy, type OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Queue, Worker } from 'bullmq';
import type { Env } from '../config/env.schema.js';
import { createBullConnection } from '../queue/bullmq-connection.js';
import { SUBSCRIPTION_EXPIRY_QUEUE } from '../queue/queue.constants.js';
import { SubscriptionExpiryService } from './subscription-expiry.service.js';

const SWEEP_SCHEDULER_ID = 'subscription-expiry-sweep';
const SWEEP_INTERVAL_MS = 15 * 60 * 1000;

// Same pattern as AnonymizationProcessor: a BullMQ job scheduler, so with
// several API replicas each sweep still runs once. Entitlement checks never
// depend on it having run (EntitlementsService goes by dates); it keeps the
// status column honest and sends PLAN_EXPIRED.
// ENABLE_SUBSCRIPTION_EXPIRY_JOB=false creates no queue, worker or Redis
// connection at all.
@Injectable()
export class SubscriptionExpiryProcessor implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(SubscriptionExpiryProcessor.name);
  private queue?: Queue;
  private worker?: Worker;

  constructor(
    private readonly configService: ConfigService<Env, true>,
    private readonly expiryService: SubscriptionExpiryService,
  ) {}

  async onModuleInit(): Promise<void> {
    if (!this.configService.get('ENABLE_SUBSCRIPTION_EXPIRY_JOB', { infer: true })) {
      this.logger.log('Subscription expiry job disabled (ENABLE_SUBSCRIPTION_EXPIRY_JOB=false)');
      return;
    }
    this.queue = new Queue(SUBSCRIPTION_EXPIRY_QUEUE, { connection: createBullConnection(this.configService) });
    await this.queue.upsertJobScheduler(SWEEP_SCHEDULER_ID, { every: SWEEP_INTERVAL_MS }, { name: 'sweep' });

    this.worker = new Worker(
      SUBSCRIPTION_EXPIRY_QUEUE,
      async () => {
        await this.expiryService.run();
      },
      { connection: createBullConnection(this.configService), concurrency: 1 },
    );
    this.worker.on('failed', (job, error) => {
      this.logger.error(`Subscription expiry sweep ${job?.id} failed: ${error.message}`);
    });
    this.logger.log('Subscription expiry job enabled (every 15 minutes)');
  }

  async onModuleDestroy(): Promise<void> {
    await this.worker?.close();
    await this.queue?.close();
  }
}
