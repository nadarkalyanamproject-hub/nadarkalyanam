import { Global, Module, type Provider } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Queue } from 'bullmq';
import type { Env } from '../config/env.schema.js';
import { createBullConnection } from './bullmq-connection.js';
import { NOTIFICATIONS_QUEUE, NOTIFICATIONS_QUEUE_TOKEN } from './queue.constants.js';

// Async/Processing tier from the component diagram (Fig 10): this module is
// only the producer side (the Queue client used to enqueue jobs). Consumers
// (BullMQ Workers) are defined in the module that owns the job's business
// logic — see NotificationsModule — and, per the deployment diagram, are
// meant to run as a separate container replica from the API in production
// (same image, different start command), not split out yet at this stage.
const notificationsQueueProvider: Provider = {
  provide: NOTIFICATIONS_QUEUE_TOKEN,
  inject: [ConfigService],
  useFactory: (configService: ConfigService<Env, true>) =>
    new Queue(NOTIFICATIONS_QUEUE, { connection: createBullConnection(configService) }),
};

@Global()
@Module({
  providers: [notificationsQueueProvider],
  exports: [notificationsQueueProvider],
})
export class QueueModule {}
