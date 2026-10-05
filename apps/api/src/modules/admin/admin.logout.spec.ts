import 'reflect-metadata';
import { createHash } from 'node:crypto';
import { UnauthorizedException, type ExecutionContext } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { describe, expect, it } from 'vitest';
import { noopOtpRateLimiter } from '../../common/testing/noop-otp-rate-limiter.js';
import { AuthService } from '../auth/auth.service.js';
import { AdminController } from './admin.controller.js';
import { AdminAuthGuard, type AuthenticatedAdmin } from './guards/admin-auth.guard.js';

/* eslint-disable @typescript-eslint/no-explicit-any */
// Real JWT signing/verification and a stateful session table: an admin signs
// in through the real OTP login, logs out through POST /admin/logout, and the
// very same token is then refused by the admin guard.
function setup() {
  const sessions: { id: string; userId: string; revokedAt: Date | null; expiresAt: Date }[] = [];
  const otp = '123456';
  const prisma = {
    user: { findUnique: async () => ({ id: 'admin-user-1', phoneNumber: '+919876543200', profile: null }) },
    adminUser: {
      findUnique: async ({ where }: any) =>
        where.userId === 'admin-user-1' || where.id === 'admin-1'
          ? { id: 'admin-1', userId: 'admin-user-1', roleId: 'role-1', isActive: true, role: { name: 'SUPER_ADMIN', permissions: [] } }
          : null,
    },
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
  const auth = new AuthService(prisma as never, jwtService, config as never, redis as never, noopOtpRateLimiter as never);
  const guard = new AdminAuthGuard(jwtService, prisma as never);
  const controller = new AdminController({} as never, {} as never, {} as never, {} as never, {} as never, prisma as never);
  const authorize = async (token: string): Promise<AuthenticatedAdmin> => {
    const request: { headers: { authorization: string }; adminUser?: AuthenticatedAdmin } = { headers: { authorization: `Bearer ${token}` } };
    const context = { switchToHttp: () => ({ getRequest: () => request }) } as unknown as ExecutionContext;
    await guard.canActivate(context);
    return request.adminUser!;
  };
  return { sessions, login: () => auth.verifyOtp('+919876543200', otp, 'login'), authorize, controller };
}

describe('admin logout', () => {
  it('rejects the old admin token with 401 right after logout', async () => {
    const { login, authorize, controller, sessions } = setup();
    const { accessToken, user } = await login();
    expect(user.isAdmin).toBe(true);

    const admin = await authorize(accessToken);
    expect(admin).toMatchObject({ adminId: 'admin-1', userId: 'admin-user-1', sessionId: 'session-1' });

    await controller.logout(admin);

    expect(sessions[0].revokedAt).toBeInstanceOf(Date);
    await expect(authorize(accessToken)).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('only ends that session — the same admin signed in elsewhere keeps working', async () => {
    const { login, authorize, controller } = setup();
    const laptop = await login();
    const phone = await login();

    await controller.logout(await authorize(phone.accessToken));

    await expect(authorize(phone.accessToken)).rejects.toBeInstanceOf(UnauthorizedException);
    await expect(authorize(laptop.accessToken)).resolves.toMatchObject({ adminId: 'admin-1', sessionId: 'session-1' });
  });

  it('is routed as POST /admin/logout behind the admin guard, with no permission required', () => {
    const handler = AdminController.prototype.logout;
    expect(Reflect.getMetadata('path', handler)).toBe('logout');
    expect(Reflect.getMetadata('method', handler)).toBe(1); // RequestMethod.POST
    expect(Reflect.getMetadata('__guards__', AdminController)).toContain(AdminAuthGuard);
  });
});
