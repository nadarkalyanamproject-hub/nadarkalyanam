import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NotYetAvailableException } from '../../common/not-yet-available.exception.js';
import { VerificationService } from './verification.service.js';

function buildService(overrides?: { nodeEnv?: string; providerIsStub?: boolean }) {
  const prisma = {
    verificationRequest: {
      create: vi.fn().mockResolvedValue({ id: 'request-1' }),
    },
  };
  const provider = {
    isStub: overrides?.providerIsStub ?? true,
    initiate: vi.fn().mockResolvedValue({ redirectUrl: 'https://provider.example/kyc', providerReference: 'ref-1' }),
    confirmStatus: vi.fn(),
  };
  const configService = {
    get: vi.fn((key: string) => (key === 'NODE_ENV' ? (overrides?.nodeEnv ?? 'test') : undefined)),
  };

  const service = new VerificationService(prisma as never, provider as never, configService as never);
  return { service, prisma, provider };
}

describe('VerificationService', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('initiate returns NotYetAvailableException in production while the identity provider is the stub, without creating a request row', async () => {
    const { service, prisma } = buildService({ nodeEnv: 'production', providerIsStub: true });

    await expect(service.initiate('user-1')).rejects.toBeInstanceOf(NotYetAvailableException);
    expect(prisma.verificationRequest.create).not.toHaveBeenCalled();
  });

  it('initiate still works with the stub outside production (no regression to local dev)', async () => {
    const { service, prisma } = buildService({ nodeEnv: 'development', providerIsStub: true });

    const result = await service.initiate('user-1');

    expect(result.id).toBe('request-1');
    expect(prisma.verificationRequest.create).toHaveBeenCalledTimes(1);
  });

  it('initiate proceeds in production once a real (non-stub) identity provider is configured', async () => {
    const { service, prisma } = buildService({ nodeEnv: 'production', providerIsStub: false });

    const result = await service.initiate('user-1');

    expect(result.id).toBe('request-1');
    expect(prisma.verificationRequest.create).toHaveBeenCalledTimes(1);
  });
});
