import { NotImplementedException } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NotYetAvailableException } from '../../common/not-yet-available.exception.js';
import { CallsService } from './calls.service.js';

function buildService(overrides?: { nodeEnv?: string; rtcIsStub?: boolean; rtcThrows?: boolean }) {
  const prisma = {
    interest: {
      findFirst: vi.fn().mockResolvedValue({ id: 'interest-1', status: 'ACCEPTED' }),
    },
    block: { findFirst: vi.fn().mockResolvedValue(null) },
    call: {
      create: vi.fn().mockResolvedValue({ id: 'call-1', roomId: 'room-1', status: 'RINGING' }),
    },
  };
  const rtc = {
    isStub: overrides?.rtcIsStub ?? true,
    createRoom: overrides?.rtcThrows
      ? vi.fn().mockRejectedValue(new NotImplementedException('No RTC/SFU provider is configured yet'))
      : vi.fn().mockResolvedValue({ roomId: 'room-1' }),
    issueToken: vi.fn().mockResolvedValue({ token: 'token-1' }),
  };
  const configService = {
    get: vi.fn((key: string) => (key === 'NODE_ENV' ? (overrides?.nodeEnv ?? 'test') : undefined)),
  };

  const service = new CallsService(prisma as never, rtc as never, configService as never);
  return { service, prisma, rtc };
}

describe('CallsService', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('initiate returns NotYetAvailableException in production while the RTC adapter is the stub, without creating a call row', async () => {
    const { service, prisma } = buildService({ nodeEnv: 'production', rtcIsStub: true });

    await expect(service.initiate('user-1', 'user-2')).rejects.toBeInstanceOf(NotYetAvailableException);
    expect(prisma.call.create).not.toHaveBeenCalled();
  });

  it('initiate still works with the stub outside production (no regression to local dev)', async () => {
    const { service, prisma } = buildService({ nodeEnv: 'development', rtcIsStub: true });

    const result = await service.initiate('user-1', 'user-2');

    expect(result.id).toBe('call-1');
    expect(prisma.call.create).toHaveBeenCalledTimes(1);
  });

  it('initiate proceeds in production once a real (non-stub) RTC adapter is configured', async () => {
    const { service, prisma } = buildService({ nodeEnv: 'production', rtcIsStub: false });

    const result = await service.initiate('user-1', 'user-2');

    expect(result.id).toBe('call-1');
    expect(prisma.call.create).toHaveBeenCalledTimes(1);
  });
});
