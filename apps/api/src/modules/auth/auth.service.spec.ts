import { createHash } from 'node:crypto';
import { UnauthorizedException } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthService } from './auth.service.js';

function buildService(overrides?: {
  redisGet?: () => Promise<string | null>;
  nodeEnv?: string;
}) {
  const prisma = {
    user: {
      upsert: vi.fn().mockResolvedValue({ id: 'user-1', phoneNumber: '+919876543210', profile: null }),
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
});
