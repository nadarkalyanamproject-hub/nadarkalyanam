import { createHmac } from 'node:crypto';
import { NotFoundException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import { PaymentsService } from './payments.service.js';

/* eslint-disable @typescript-eslint/no-explicit-any */
function build({ nodeEnv = 'development', isStub = true } = {}) {
  const prisma = { order: { findFirst: vi.fn().mockResolvedValue({ id: 'o1', userId: 'u1', amountInPaise: 149900 }) } };
  const config = { get: (key: string) => ({ NODE_ENV: nodeEnv, PAYMENT_WEBHOOK_SECRET: 'secret' })[key] } as any;
  const service = new PaymentsService(prisma as any, { isStub } as any, config, {} as any);
  const handleWebhook = vi.spyOn(service, 'handleWebhook').mockResolvedValue({ outcome: 'processed' });
  return { service, prisma, handleWebhook };
}

describe('PaymentsService.completeTestPayment (development only)', () => {
  it('confirms the member’s own order through the signed webhook path', async () => {
    const { service, handleWebhook } = build();
    await expect(service.completeTestPayment('u1', 'o1')).resolves.toEqual({ outcome: 'processed' });
    const [body, signature] = handleWebhook.mock.calls[0] as [Buffer, string];
    expect(JSON.parse(body.toString())).toMatchObject({ orderId: 'o1', status: 'PAID', amountInPaise: 149900, currency: 'INR' });
    expect(signature).toBe(createHmac('sha256', 'secret').update(body).digest('hex'));
  });

  it('does not exist in production or with a real gateway', async () => {
    for (const opts of [{ nodeEnv: 'production' }, { isStub: false }]) {
      const { service, handleWebhook } = build(opts);
      await expect(service.completeTestPayment('u1', 'o1')).rejects.toBeInstanceOf(NotFoundException);
      expect(handleWebhook).not.toHaveBeenCalled();
    }
  });

  it('only for the member’s own order', async () => {
    const { service, prisma } = build();
    prisma.order.findFirst.mockResolvedValueOnce(null);
    await expect(service.completeTestPayment('u2', 'o1')).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.order.findFirst).toHaveBeenCalledWith({ where: { id: 'o1', userId: 'u2' } });
  });
});
