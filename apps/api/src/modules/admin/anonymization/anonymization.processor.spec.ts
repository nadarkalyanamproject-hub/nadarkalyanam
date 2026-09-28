import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AnonymizationProcessor } from './anonymization.processor.js';

const { QueueMock, WorkerMock, upsertJobScheduler, createBullConnection } = vi.hoisted(() => {
  const upsertJobScheduler = vi.fn().mockResolvedValue(undefined);
  return {
    upsertJobScheduler,
    QueueMock: vi.fn().mockImplementation(() => ({ upsertJobScheduler, close: vi.fn() })),
    WorkerMock: vi.fn().mockImplementation(() => ({ on: vi.fn(), close: vi.fn() })),
    createBullConnection: vi.fn(() => ({})),
  };
});

vi.mock('bullmq', () => ({ Queue: QueueMock, Worker: WorkerMock }));
vi.mock('../../queue/bullmq-connection.js', () => ({ createBullConnection }));

function buildProcessor(env: { ENABLE_ANONYMIZATION_JOB: boolean; ANONYMIZATION_DRY_RUN: boolean }) {
  const configService = { get: vi.fn((key: keyof typeof env) => env[key]) };
  const anonymizationService = { run: vi.fn().mockResolvedValue({}) };
  return {
    processor: new AnonymizationProcessor(configService as never, anonymizationService as never),
    anonymizationService,
  };
}

describe('AnonymizationProcessor', () => {
  beforeEach(() => {
    QueueMock.mockClear();
    WorkerMock.mockClear();
    upsertJobScheduler.mockClear();
    createBullConnection.mockClear();
  });

  it('flag off: creates no queue, scheduler, worker or Redis connection, and never runs', async () => {
    const { processor, anonymizationService } = buildProcessor({
      ENABLE_ANONYMIZATION_JOB: false,
      ANONYMIZATION_DRY_RUN: false,
    });

    await processor.onModuleInit();
    await processor.onModuleDestroy();

    expect(QueueMock).not.toHaveBeenCalled();
    expect(WorkerMock).not.toHaveBeenCalled();
    expect(upsertJobScheduler).not.toHaveBeenCalled();
    expect(createBullConnection).not.toHaveBeenCalled();
    expect(anonymizationService.run).not.toHaveBeenCalled();
  });

  it('flag on: registers an hourly scheduler and a single-concurrency worker that runs the sweep', async () => {
    const { processor, anonymizationService } = buildProcessor({
      ENABLE_ANONYMIZATION_JOB: true,
      ANONYMIZATION_DRY_RUN: false,
    });

    await processor.onModuleInit();

    expect(upsertJobScheduler).toHaveBeenCalledWith('anonymization-sweep', { every: 3_600_000 }, { name: 'sweep' });
    expect(WorkerMock).toHaveBeenCalledWith('anonymization', expect.any(Function), expect.objectContaining({ concurrency: 1 }));

    const jobHandler = WorkerMock.mock.calls[0][1] as () => Promise<void>;
    await jobHandler();
    expect(anonymizationService.run).toHaveBeenCalledWith({ dryRun: false });
  });

  it('passes dry-run mode through to the sweep', async () => {
    const { processor, anonymizationService } = buildProcessor({
      ENABLE_ANONYMIZATION_JOB: true,
      ANONYMIZATION_DRY_RUN: true,
    });

    await processor.onModuleInit();
    await (WorkerMock.mock.calls[0][1] as () => Promise<void>)();

    expect(anonymizationService.run).toHaveBeenCalledWith({ dryRun: true });
  });
});
