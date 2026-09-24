import { NotFoundException } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NotYetAvailableException } from '../../common/not-yet-available.exception.js';
import { PaymentsService } from './payments.service.js';

function buildService(overrides?: { nodeEnv?: string; gatewayIsStub?: boolean }) {
  const prisma = {
    membershipPlan: {
      findUnique: vi.fn().mockResolvedValue({
        id: 'plan-1',
        isActive: true,
        priceInPaise: 149900,
        durationDays: 90,
      }),
    },
    order: {
      create: vi.fn().mockResolvedValue({
        id: 'order-1',
        planId: 'plan-1',
        amountInPaise: 149900,
        status: 'CREATED',
        createdAt: new Date(),
      }),
    },
  };
  const gateway = {
    isStub: overrides?.gatewayIsStub ?? true,
    createProviderOrder: vi.fn(),
    verifyWebhookSignature: vi.fn(),
  };
  const configService = {
    get: vi.fn((key: string) => (key === 'NODE_ENV' ? (overrides?.nodeEnv ?? 'test') : undefined)),
  };

  const service = new PaymentsService(prisma as never, gateway as never, configService as never);
  return { service, prisma, gateway };
}

describe('PaymentsService', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('createOrder returns NotYetAvailableException in production while the gateway is the stub, without creating an order row', async () => {
    const { service, prisma } = buildService({ nodeEnv: 'production', gatewayIsStub: true });

    await expect(service.createOrder('user-1', 'plan-1')).rejects.toBeInstanceOf(NotYetAvailableException);
    expect(prisma.order.create).not.toHaveBeenCalled();
  });

  it('createOrder still works with the stub outside production (no regression to local dev)', async () => {
    const { service, prisma } = buildService({ nodeEnv: 'development', gatewayIsStub: true });

    const result = await service.createOrder('user-1', 'plan-1');

    expect(result.id).toBe('order-1');
    expect(prisma.order.create).toHaveBeenCalledTimes(1);
  });

  it('createOrder proceeds in production once a real (non-stub) gateway is configured', async () => {
    const { service, prisma } = buildService({ nodeEnv: 'production', gatewayIsStub: false });

    const result = await service.createOrder('user-1', 'plan-1');

    expect(result.id).toBe('order-1');
    expect(prisma.order.create).toHaveBeenCalledTimes(1);
  });

  it('createOrder rejects an unknown or inactive plan before touching the gateway check outcome', async () => {
    const { service, prisma } = buildService({ nodeEnv: 'development' });
    prisma.membershipPlan.findUnique.mockResolvedValue(null);

    await expect(service.createOrder('user-1', 'missing-plan')).rejects.toBeInstanceOf(NotFoundException);
  });
});
