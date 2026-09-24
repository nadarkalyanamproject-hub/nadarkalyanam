import { Injectable, Logger, type OnModuleDestroy, type OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Worker } from 'bullmq';
import type { Env } from '../config/env.schema.js';
import { createBullConnection } from '../queue/bullmq-connection.js';
import { NOTIFICATIONS_QUEUE } from '../queue/queue.constants.js';
import { NotificationsService, type NotifyJob } from './notifications.service.js';

// The "Notification Worker" from Figures 5/8. Runs in-process for now (see
// the note in QueueModule about the deployment diagram's separate-container
// intent) — starting/stopping it is just this provider's Nest lifecycle.
@Injectable()
export class NotificationsProcessor implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(NotificationsProcessor.name);
  private worker?: Worker<NotifyJob>;

  constructor(
    private readonly configService: ConfigService<Env, true>,
    private readonly notificationsService: NotificationsService,
  ) {}

  onModuleInit(): void {
    this.worker = new Worker<NotifyJob>(
      NOTIFICATIONS_QUEUE,
      async (job) => {
        await this.notificationsService.createAndPush(job.data);
      },
      { connection: createBullConnection(this.configService) },
    );
    this.worker.on('failed', (job, error) => {
      this.logger.error(`Notification job ${job?.id} failed: ${error.message}`);
    });
  }

  async onModuleDestroy(): Promise<void> {
    await this.worker?.close();
  }
}
