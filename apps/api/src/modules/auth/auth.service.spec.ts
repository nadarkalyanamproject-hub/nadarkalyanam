import { createHash } from 'node:crypto';
import { NotFoundException, UnauthorizedException } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthService } from './auth.service.js';

function buildService(overrides?: {
  redisGet?: () => Promise<string | null>;
  nodeEnv?: string;
  findUniqueResult?: unknown;
  allowOtpDebugVisibility?: boolean;
  adminUserResult?: unknown;
}) {
  const prisma = {
    user: {
      upsert: vi.fn().mockResolvedValue({ id: 'user-1', phoneNumber: '+919876543210', profile: null }),
      findUnique: vi.fn().mockResolvedValue(overrides?.findUniqueResult ?? null),
    },
    adminUser: {
      findUnique: vi.fn().mockResolvedValue(overrides?.adminUserResult ?? null),
    },
    session: {
      create: vi.fn().mockResolvedValue({ id: 'session-1' }),
    },
  };
  const jwtService = {
    signAsync: vi.fn().mockResolvedValue('signed.jwt.token'),
  };
  const configValues: Record<string, unknown> = {
    NODE_ENV: overrides?.nodeEnv ?? 'test',
    JWT_REFRESH_TOKEN_TTL_SECONDS: 2592000,
    ALLOW_OTP_DEBUG_VISIBILITY: overrides?.allowOtpDebugVisibility ?? false,
  };
  const configService = {
    get: vi.fn((key: string) => configValues[key]),
  };
  const redis = {
    set: vi.fn().mockResolvedValue('OK'),
    get: overrides?.redisGet ?? vi.fn().mockResolvedValue(null),
    del: vi.fn().mockResolvedValue(1),
  };

  const service = new AuthService(
    prisma as never,
    jwtService as never,
    configService as never,
    redis as never,
  );

  return { service, prisma, jwtService, redis };
}

describe('AuthService', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('requestOtp stores a hashed OTP in redis with a TTL and returns devOtp in development', async () => {
    const { service, redis } = buildService({ nodeEnv: 'development' });

    const result = await service.requestOtp('+919876543210');

    expect(redis.set).toHaveBeenCalledWith(
      'otp:+919876543210',
      expect.any(String),
      'EX',
      expect.any(Number),
    );
    expect(redis.set.mock.calls[0][1]).not.toBe(result.devOtp);
    expect(result.devOtp).toMatch(/^\d{6}$/);
  });

  it('requestOtp omits devOtp outside development', async () => {
    const { service } = buildService({ nodeEnv: 'production' });

    const result = await service.requestOtp('+919876543210');

    expect(result.devOtp).toBeUndefined();
  });

  it('requestOtp reveals devOtp in production when ALLOW_OTP_DEBUG_VISIBILITY is set', async () => {
    const { service } = buildService({ nodeEnv: 'production', allowOtpDebugVisibility: true });

    const result = await service.requestOtp('+919876543210');

    expect(result.devOtp).toMatch(/^\d{6}$/);
  });

  it('verifyOtp rejects an invalid or expired OTP without touching the database', async () => {
    const { service, prisma } = buildService({ redisGet: async () => null });

    await expect(service.verifyOtp('+919876543210', '000000')).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
    expect(prisma.user.upsert).not.toHaveBeenCalled();
  });

  it('verifyOtp upserts the user keyed by phone number, never creating a duplicate on repeat verification', async () => {
    const otp = '123456';
    const hashedOtp = createHash('sha256').update(otp).digest('hex');
    const { service, prisma } = buildService({ redisGet: async () => hashedOtp });

    const first = await service.verifyOtp('+919876543210', otp);
    const second = await service.verifyOtp('+919876543210', otp);

    expect(prisma.user.upsert).toHaveBeenCalledTimes(2);
    for (const call of prisma.user.upsert.mock.calls) {
      expect(call[0]).toMatchObject({
        where: { phoneNumber: '+919876543210' },
        create: { phoneNumber: '+919876543210' },
      });
    }
    expect(first.user.id).toBe(second.user.id);
    expect(first.accessToken).toBeTruthy();
    expect(first.refreshToken).toBeTruthy();
  });

  it('verifyOtp with intent "login" succeeds for a known phone number exactly like the register flow', async () => {
    const otp = '123456';
    const hashedOtp = createHash('sha256').update(otp).digest('hex');
    const existingUser = { id: 'user-1', phoneNumber: '+919876543210', profile: { id: 'profile-1' } };
    const { service, prisma } = buildService({
      redisGet: async () => hashedOtp,
      findUniqueResult: existingUser,
    });

    const result = await service.verifyOtp('+919876543210', otp, 'login');

    expect(prisma.user.findUnique).toHaveBeenCalledWith({
      where: { phoneNumber: '+919876543210' },
      include: { profile: { select: { id: true } } },
    });
    expect(prisma.user.upsert).not.toHaveBeenCalled();
    expect(result.user.id).toBe('user-1');
    expect(result.user.hasProfile).toBe(true);
    expect(result.accessToken).toBeTruthy();
    expect(result.refreshToken).toBeTruthy();
  });

  it('verifyOtp with intent "login" rejects an unregistered phone number and never creates a User row', async () => {
    const otp = '123456';
    const hashedOtp = createHash('sha256').update(otp).digest('hex');
    const { service, prisma } = buildService({
      redisGet: async () => hashedOtp,
      findUniqueResult: null,
    });

    await expect(service.verifyOtp('+910000000000', otp, 'login')).rejects.toMatchObject({
      status: 404,
      response: expect.objectContaining({ errorCode: 'ACCOUNT_NOT_FOUND' }),
    });
    await expect(service.verifyOtp('+910000000000', otp, 'login')).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(prisma.user.upsert).not.toHaveBeenCalled();
    expect(prisma.session.create).not.toHaveBeenCalled();
  });

  it('verifyOtp with intent omitted (or "register") still upserts a new user, unchanged from today', async () => {
    const otp = '123456';
    const hashedOtp = createHash('sha256').update(otp).digest('hex');
    const { service, prisma } = buildService({ redisGet: async () => hashedOtp });

    await service.verifyOtp('+919876543210', otp);
    await service.verifyOtp('+919876543210', otp, 'register');

    expect(prisma.user.upsert).toHaveBeenCalledTimes(2);
    expect(prisma.user.findUnique).not.toHaveBeenCalled();
  });

  describe('admin-aware login', () => {
    const otp = '123456';
    const hashedOtp = createHash('sha256').update(otp).digest('hex');
    const memberUser = { id: 'user-1', phoneNumber: '+919876543210', profile: null };
    const adminRow = { id: 'admin-1', userId: 'user-1', roleId: 'role-1', isActive: true };

    it('logging in as a user WITH an AdminUser record issues an admin-scoped (typ: "admin") token, not a member token', async () => {
      const { service, prisma, jwtService } = buildService({
        redisGet: async () => hashedOtp,
        findUniqueResult: memberUser,
        adminUserResult: adminRow,
      });

      await service.verifyOtp('+919876543210', otp, 'login');

      expect(prisma.adminUser.findUnique).toHaveBeenCalledWith({ where: { userId: 'user-1' } });
      // sub is the AdminUser's own id (what AdminAuthGuard looks up by), not the User's id.
      expect(jwtService.signAsync).toHaveBeenCalledWith({ sub: 'admin-1', typ: 'admin' });
      expect(jwtService.signAsync).not.toHaveBeenCalledWith({ sub: 'user-1' });
    });

    it('logging in as a normal user (no AdminUser record) still issues the existing member token, unchanged', async () => {
      const { service, prisma, jwtService } = buildService({
        redisGet: async () => hashedOtp,
        findUniqueResult: memberUser,
        adminUserResult: null,
      });

      await service.verifyOtp('+919876543210', otp, 'login');

      // The check runs (it must, to know there's no admin link) but falls through.
      expect(prisma.adminUser.findUnique).toHaveBeenCalledWith({ where: { userId: 'user-1' } });
      expect(jwtService.signAsync).toHaveBeenCalledWith({ sub: 'user-1' });
      expect(jwtService.signAsync).not.toHaveBeenCalledWith(expect.objectContaining({ typ: 'admin' }));
    });

    it('the admin-link check never runs on intent "register" — admins are pre-provisioned, never self-registered', async () => {
      const { service, prisma, jwtService } = buildService({ redisGet: async () => hashedOtp });

      await service.verifyOtp('+919876543210', otp, 'register');

      expect(prisma.adminUser.findUnique).not.toHaveBeenCalled();
      expect(jwtService.signAsync).toHaveBeenCalledWith({ sub: 'user-1' });
    });
  });
});
