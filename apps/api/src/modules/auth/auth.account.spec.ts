import 'reflect-metadata';
import { ConflictException } from '@nestjs/common';
import { describe, expect, it } from 'vitest';
import { noopOtpRateLimiter } from '../../common/testing/noop-otp-rate-limiter.js';
import { DELETION_GRACE_PERIOD_DAYS } from '../admin/member-removal.js';
import { AuthService } from './auth.service.js';

/* eslint-disable @typescript-eslint/no-explicit-any */
const DAY = 86_400_000;

function setup(user: Record<string, any>) {
  const sessions = [
    { id: 's1', userId: 'user-1', adminUserId: null, revokedAt: null as Date | null },
    { id: 's2', userId: 'user-1', adminUserId: null, revokedAt: null as Date | null },
  ];
  const prisma: any = {
    user: {
      findUnique: async () => user,
      update: async ({ data }: any) => Object.assign(user, data),
    },
    session: {
      updateMany: async ({ where, data }: any) => {
        const hits = sessions.filter((s) => s.userId === where.userId && s.adminUserId === null && s.revokedAt === null);
        hits.forEach((s) => Object.assign(s, data));
        return { count: hits.length };
      },
    },
    $transaction: async (ops: Promise<unknown>[]) => Promise.all(ops),
  };
  const service = new AuthService(prisma, {} as never, { get: () => undefined } as never, {} as never, noopOtpRateLimiter as never);
  return { service, user, sessions };
}

describe('self-service account deletion', () => {
  it('schedules deletion 14 days out, hides the account and signs out every device', async () => {
    const { service, user, sessions } = setup({ status: 'ACTIVE', deletionRequestedAt: null, adminUser: null });

    const result = await service.requestAccountDeletion('user-1');

    expect(user.status).toBe('PENDING_DELETION');
    expect(user.statusBeforeDeletion).toBe('ACTIVE');
    const scheduled = new Date(result.deletionScheduledAt!).getTime();
    expect(Math.round((scheduled - Date.now()) / DAY)).toBe(DELETION_GRACE_PERIOD_DAYS);
    expect(sessions.every((s) => s.revokedAt instanceof Date)).toBe(true);
  });

  it('refuses an account linked to a staff login', async () => {
    const { service } = setup({ status: 'ACTIVE', deletionRequestedAt: null, adminUser: { id: 'a1' } });
    await expect(service.requestAccountDeletion('user-1')).rejects.toBeInstanceOf(ConflictException);
  });

  it('cancelling within the 14 days restores the earlier status', async () => {
    const { service, user } = setup({
      status: 'PENDING_DELETION',
      deletionRequestedAt: new Date(Date.now() - 3 * DAY),
      statusBeforeDeletion: 'ACTIVE',
    });

    await expect(service.cancelAccountDeletion('user-1')).resolves.toEqual({ status: 'ACTIVE', deletionScheduledAt: null });
    expect(user.deletionRequestedAt).toBeNull();
  });

  it('cannot be cancelled once the 14 days have passed', async () => {
    const { service } = setup({
      status: 'PENDING_DELETION',
      deletionRequestedAt: new Date(Date.now() - (DELETION_GRACE_PERIOD_DAYS + 1) * DAY),
      statusBeforeDeletion: 'ACTIVE',
    });
    await expect(service.cancelAccountDeletion('user-1')).rejects.toBeInstanceOf(ConflictException);
  });
});
