import 'reflect-metadata';
import { createHash } from 'node:crypto';
import { UnauthorizedException, type ExecutionContext } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { describe, expect, it } from 'vitest';
import { AuthController } from './auth.controller.js';
import { AuthService } from './auth.service.js';
import { JwtAuthGuard, type AuthenticatedRequest } from './guards/jwt-auth.guard.js';

/* eslint-disable @typescript-eslint/no-explicit-any */
// Real JWT signing/verification and a stateful session table, so the test
// proves the actual token from a login stops working after logout.
function setup() {
  const sessions: { id: string; userId: string; revokedAt: Date | null; expiresAt: Date }[] = [];
  const otp = '123456';
  const prisma = {
    user: { findUnique: async () => ({ id: 'user-1', phoneNumber: '+919876543210', profile: { id: 'p1' } }) },
    adminUser: { findUnique: async () => null },
    session: {
      create: async ({ data }: any) => {
        const row = { id: `session-${sessions.length + 1}`, revokedAt: null, ...data };
        sessions.push(row);
        return row;
      },
      findUnique: async ({ where }: any) => sessions.find((s) => s.id === where.id) ?? null,
      updateMany: async ({ where, data }: any) => {
        const hits = sessions.filter((s) => s.id === where.id && s.userId === where.userId && s.revokedAt === null);
        hits.forEach((s) => Object.assign(s, data));
        return { count: hits.length };
      },
    },
  };
  const jwtService = new JwtService({ secret: 'test-secret', signOptions: { expiresIn: 900 } });
  const config = { get: (key: string) => ({ NODE_ENV: 'test', JWT_REFRESH_TOKEN_TTL_SECONDS: 3600, ALLOW_OTP_DEBUG_VISIBILITY: false })[key] };
  const redis = { get: async () => createHash('sha256').update(otp).digest('hex'), del: async () => 1, set: async () => 'OK' };
  const service = new AuthService(prisma as never, jwtService, config as never, redis as never);
  const guard = new JwtAuthGuard(jwtService, prisma as never);
  const controller = new AuthController(service);
  const login = () => service.verifyOtp('+919876543210', otp, 'login');
  const authorize = async (token: string) => {
    const request: AuthenticatedRequest = { headers: { authorization: `Bearer ${token}` } };
    const context = { switchToHttp: () => ({ getRequest: () => request }) } as unknown as ExecutionContext;
    await guard.canActivate(context);
    return request.user!;
  };
  return { sessions, login, authorize, controller };
}

describe('logout', () => {
  it('rejects the old access token on the very next request', async () => {
    const { login, authorize, controller, sessions } = setup();
    const { accessToken } = await login();

    const user = await authorize(accessToken);
    expect(user).toEqual({ userId: 'user-1', sessionId: 'session-1' });

    await controller.logout(user);

    expect(sessions[0].revokedAt).toBeInstanceOf(Date);
    await expect(authorize(accessToken)).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('only ends that session — the same member signed in elsewhere stays signed in', async () => {
    const { login, authorize, controller } = setup();
    const phone = await login();
    const laptop = await login();

    await controller.logout(await authorize(phone.accessToken));

    await expect(authorize(phone.accessToken)).rejects.toBeInstanceOf(UnauthorizedException);
    await expect(authorize(laptop.accessToken)).resolves.toEqual({ userId: 'user-1', sessionId: 'session-2' });
  });

  it('is routed as POST /auth/logout behind the member guard', () => {
    const handler = AuthController.prototype.logout;
    expect(Reflect.getMetadata('path', handler)).toBe('logout');
    expect(Reflect.getMetadata('method', handler)).toBe(1); // RequestMethod.POST
    expect(Reflect.getMetadata('__guards__', handler)).toEqual([JwtAuthGuard]);
  });
});
