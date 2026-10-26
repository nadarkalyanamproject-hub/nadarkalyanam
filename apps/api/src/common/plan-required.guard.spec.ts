import { ForbiddenException, UnauthorizedException, type ExecutionContext } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import { PlanRequiredGuard } from './plan-required.guard.js';

const NOW = Date.now();
const day = 24 * 60 * 60 * 1000;

function guardWith(requirePaidPlan: boolean, subscriptions: { startedAt: Date; expiresAt: Date }[]) {
  const findMany = vi.fn().mockResolvedValue(subscriptions.map((s, i) => ({ id: `s${i}`, plan: {}, ...s })));
  const prisma = { subscription: { findMany } };
  const config = { get: vi.fn().mockReturnValue(requirePaidPlan) };
  return { guard: new PlanRequiredGuard(prisma as never, config as never), findMany };
}

function context(userId?: string): ExecutionContext {
  return {
    switchToHttp: () => ({ getRequest: () => ({ headers: {}, user: userId ? { userId } : undefined }) }),
  } as unknown as ExecutionContext;
}

describe('PlanRequiredGuard', () => {
  it('lets everyone through while REQUIRE_PAID_PLAN is off, without a database lookup', async () => {
    const { guard, findMany } = guardWith(false, []);
    await expect(guard.canActivate(context('u1'))).resolves.toBe(true);
    expect(findMany).not.toHaveBeenCalled();
  });

  it('refuses a member with no plan with 403 PLAN_REQUIRED when on', async () => {
    const { guard } = guardWith(true, []);
    const error = await guard.canActivate(context('u1')).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ForbiddenException);
    expect((error as ForbiddenException).getResponse()).toMatchObject({ errorCode: 'PLAN_REQUIRED' });
  });

  it('lets a member with a running plan through when on', async () => {
    const { guard } = guardWith(true, [{ startedAt: new Date(NOW - day), expiresAt: new Date(NOW + 30 * day) }]);
    await expect(guard.canActivate(context('u1'))).resolves.toBe(true);
  });

  it('refuses a member whose only plan starts later', async () => {
    const { guard } = guardWith(true, [{ startedAt: new Date(NOW + day), expiresAt: new Date(NOW + 90 * day) }]);
    await expect(guard.canActivate(context('u1'))).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('rejects a request that reached it without an authenticated user', async () => {
    const { guard } = guardWith(true, []);
    await expect(guard.canActivate(context())).rejects.toBeInstanceOf(UnauthorizedException);
  });
});
