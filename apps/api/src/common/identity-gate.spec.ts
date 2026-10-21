import { ForbiddenException, type ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { describe, expect, it, vi } from 'vitest';
import { JwtAuthGuard } from '../modules/auth/guards/jwt-auth.guard.js';
import { VerificationService } from '../modules/verification/verification.service.js';
import { AllowUnverifiedIdentity, needsIdentityVerification } from './identity-gate.js';
import { istMidnight } from './launch.js';

/* eslint-disable @typescript-eslint/no-explicit-any */
const FROM = istMidnight('2027-01-20');
const config = (from: string | null = '2027-01-20', nodeEnv = 'test') =>
  ({ get: (key: string) => ({ IDENTITY_VERIFICATION_REQUIRED_FROM: from, NODE_ENV: nodeEnv })[key] }) as any;

describe('needsIdentityVerification', () => {
  it('applies to accounts created on/after the start day that have not verified', () => {
    expect(needsIdentityVerification(config(), { createdAt: FROM, identityVerifiedAt: null })).toBe(true);
  });

  it('grandfathers older accounts, and lets verified ones through', () => {
    expect(needsIdentityVerification(config(), { createdAt: new Date(FROM.getTime() - 1), identityVerifiedAt: null })).toBe(false);
    expect(needsIdentityVerification(config(), { createdAt: FROM, identityVerifiedAt: new Date() })).toBe(false);
  });

  it('is off when IDENTITY_VERIFICATION_REQUIRED_FROM is unset', () => {
    expect(needsIdentityVerification(config(null), { createdAt: FROM, identityVerifiedAt: null })).toBe(false);
  });
});

class OpenController {
  @AllowUnverifiedIdentity()
  open() {}
  closed() {}
}

function guardFor(user: { createdAt: Date; identityVerifiedAt: Date | null }) {
  const jwtService = { verifyAsync: vi.fn().mockResolvedValue({ sub: 'u1', sid: 's1' }) };
  const prisma = {
    session: { findUnique: vi.fn().mockResolvedValue({ userId: 'u1', revokedAt: null, expiresAt: new Date(Date.now() + 60_000) }) },
    user: { findUnique: vi.fn().mockResolvedValue(user) },
  };
  return new JwtAuthGuard(jwtService as never, prisma as never, config(), new Reflector());
}

const context = (handler: keyof OpenController) =>
  ({
    switchToHttp: () => ({ getRequest: () => ({ headers: { authorization: 'Bearer t' } }) }),
    getHandler: () => OpenController.prototype[handler],
    getClass: () => OpenController,
  }) as unknown as ExecutionContext;

describe('JwtAuthGuard DigiLocker gate', () => {
  it('refuses an unverified new account with 403 IDENTITY_REQUIRED', async () => {
    const guard = guardFor({ createdAt: FROM, identityVerifiedAt: null });
    const error = await guard.canActivate(context('closed')).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ForbiddenException);
    expect((error as ForbiddenException).getResponse()).toMatchObject({ errorCode: 'IDENTITY_REQUIRED' });
  });

  it('lets it reach routes marked @AllowUnverifiedIdentity (verification, logout)', async () => {
    const guard = guardFor({ createdAt: FROM, identityVerifiedAt: null });
    await expect(guard.canActivate(context('open'))).resolves.toBe(true);
  });

  it('lets verified and grandfathered accounts through', async () => {
    await expect(guardFor({ createdAt: FROM, identityVerifiedAt: new Date() }).canActivate(context('closed'))).resolves.toBe(true);
    await expect(
      guardFor({ createdAt: new Date(FROM.getTime() - 1), identityVerifiedAt: null }).canActivate(context('closed')),
    ).resolves.toBe(true);
  });
});

describe('VerificationService.callback', () => {
  function world(succeeded: boolean) {
    const tx = {
      verificationRequest: { update: vi.fn(), findFirst: vi.fn().mockResolvedValue(null) },
      user: { update: vi.fn() },
      profile: { updateMany: vi.fn() },
    };
    const prisma = {
      verificationRequest: { findFirst: vi.fn().mockResolvedValue({ id: 'r1' }) },
      user: { findUnique: vi.fn().mockResolvedValue({ createdAt: FROM, identityVerifiedAt: new Date(), identityName: 'Meena Rajan', identityDateOfBirth: new Date('1998-04-10T00:00:00Z') }) },
      $transaction: (fn: (t: typeof tx) => Promise<unknown>) => fn(tx),
    };
    const provider = {
      isStub: false,
      confirmStatus: vi.fn().mockResolvedValue(succeeded ? { succeeded, identity: { name: 'Meena Rajan', dateOfBirth: '1998-04-10' } } : { succeeded }),
    };
    return { service: new VerificationService(prisma as never, provider as never, config(null, 'production')), tx };
  }

  it('on success stores only name and date of birth, and copies them onto the profile', async () => {
    const { service, tx } = world(true);
    const result = await service.callback('u1', 'ref-1');
    const dob = new Date('1998-04-10T00:00:00.000Z');
    expect(tx.user.update).toHaveBeenCalledWith({
      where: { id: 'u1' },
      data: { identityVerifiedAt: expect.any(Date), identityName: 'Meena Rajan', identityDateOfBirth: dob },
    });
    expect(tx.profile.updateMany).toHaveBeenCalledWith({ where: { userId: 'u1' }, data: { isVerified: true, fullName: 'Meena Rajan', dateOfBirth: dob } });
    expect(result).toMatchObject({ status: 'SUCCEEDED', verified: true, identity: { name: 'Meena Rajan', dateOfBirth: '1998-04-10' } });
  });

  it('on failure leaves the member unverified', async () => {
    const { service, tx } = world(false);
    await service.callback('u1', 'ref-1');
    expect(tx.user.update).not.toHaveBeenCalled();
  });

  it('refuses the stand-in provider in production', async () => {
    const prisma = { verificationRequest: { findFirst: vi.fn() } };
    const service = new VerificationService(prisma as never, { isStub: true, confirmStatus: vi.fn() } as never, config(null, 'production'));
    await expect(service.callback('u1', 'stub-1')).rejects.toThrow(/not yet available/);
    expect(prisma.verificationRequest.findFirst).not.toHaveBeenCalled();
  });
});
