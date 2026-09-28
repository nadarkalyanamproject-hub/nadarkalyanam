import { Injectable, Logger, type OnModuleDestroy, type OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Queue, Worker } from 'bullmq';
import type { Env } from '../../config/env.schema.js';
import { createBullConnection } from '../../queue/bullmq-connection.js';
import { ANONYMIZATION_QUEUE } from '../../queue/queue.constants.js';
import { AnonymizationService } from './anonymization.service.js';

const SWEEP_SCHEDULER_ID = 'anonymization-sweep';
const SWEEP_INTERVAL_MS = 60 * 60 * 1000;

// Schedules AnonymizationService.run on the same in-process BullMQ setup as
// NotificationsProcessor. A BullMQ job scheduler (rather than setInterval)
// means that with several API replicas each sweep still runs exactly once.
//
// When ENABLE_ANONYMIZATION_JOB is false this does nothing at all — no
// queue, no scheduler, no worker, no Redis connection. A scheduler left in
// Redis by an earlier enabled deploy is harmless: with no worker, its
// pending job is never processed.
@Injectable()
export class AnonymizationProcessor implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(AnonymizationProcessor.name);
  private queue?: Queue;
  private worker?: Worker;

  constructor(
    private readonly configService: ConfigService<Env, true>,
    private readonly anonymizationService: AnonymizationService,
  ) {}

  async onModuleInit(): Promise<void> {
    if (!this.configService.get('ENABLE_ANONYMIZATION_JOB', { infer: true })) {
      this.logger.log('Anonymization job disabled (ENABLE_ANONYMIZATION_JOB=false)');
      return;
    }
    const dryRun = this.configService.get('ANONYMIZATION_DRY_RUN', { infer: true });

    this.queue = new Queue(ANONYMIZATION_QUEUE, { connection: createBullConnection(this.configService) });
    await this.queue.upsertJobScheduler(SWEEP_SCHEDULER_ID, { every: SWEEP_INTERVAL_MS }, { name: 'sweep' });

    this.worker = new Worker(
      ANONYMIZATION_QUEUE,
      async () => {
        await this.anonymizationService.run({ dryRun });
      },
      { connection: createBullConnection(this.configService), concurrency: 1 },
    );
    this.worker.on('failed', (job, error) => {
      this.logger.error(`Anonymization sweep ${job?.id} failed: ${error.message}`);
    });
    this.logger.warn(`Anonymization job ENABLED (${dryRun ? 'DRY RUN — no changes' : 'LIVE'}), hourly sweep`);
  }

  async onModuleDestroy(): Promise<void> {
    await this.worker?.close();
    await this.queue?.close();
  }
}
