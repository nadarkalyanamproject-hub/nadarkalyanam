import 'reflect-metadata';
import { createHash } from 'node:crypto';
import { UnauthorizedException, type ExecutionContext } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { describe, expect, it } from 'vitest';
import { noopOtpRateLimiter } from '../../common/testing/noop-otp-rate-limiter.js';
import { AdminAuthGuard } from '../admin/guards/admin-auth.guard.js';
import { AuthService } from './auth.service.js';
import { JwtAuthGuard, type AuthenticatedRequest } from './guards/jwt-auth.guard.js';
import { revokeSession } from './session.util.js';

/* eslint-disable @typescript-eslint/no-explicit-any */
// Real JWTs and stateful sessions + refresh_tokens tables, so these tests
// prove what a client actually holding the tokens can and can't do.
interface SessionRow {
  id: string;
  userId: string;
  adminUserId: string | null;
  refreshTokenHash: string;
  revokedAt: Date | null;
  expiresAt: Date;
}
interface TokenRow {
  id: string;
  sessionId: string;
  tokenHash: string;
  usedAt: Date | null;
}

function setup(options: { admin?: boolean } = {}) {
  const sessions: SessionRow[] = [];
  const tokens: TokenRow[] = [];
  const adminUser = { id: 'admin-1', userId: 'user-1', isActive: true, roleId: 'r1', role: { name: 'SUPER_ADMIN', permissions: [] } };
  const otp = '123456';
  const prisma: any = {
    user: { findUnique: async () => ({ id: 'user-1', phoneNumber: '+919876543210', profile: { id: 'p1' } }) },
    adminUser: {
      findUnique: async ({ where }: any) =>
        options.admin && (where.userId === adminUser.userId || where.id === adminUser.id) ? adminUser : null,
    },
    session: {
      create: async ({ data }: any) => {
        const { refreshTokens, ...fields } = data;
        const row: SessionRow = { id: `session-${sessions.length + 1}`, revokedAt: null, ...fields };
        sessions.push(row);
        for (const token of [refreshTokens?.create].flat().filter(Boolean)) {
          tokens.push({ id: `rt-${tokens.length + 1}`, sessionId: row.id, usedAt: null, tokenHash: token.tokenHash });
        }
        return row;
      },
      findUnique: async ({ where }: any) => sessions.find((s) => s.id === where.id) ?? null,
      update: async ({ where, data }: any) => Object.assign(sessions.find((s) => s.id === where.id)!, data),
      updateMany: async ({ where, data }: any) => {
        const hits = sessions.filter((s) => s.id === where.id && s.userId === where.userId && s.revokedAt === null);
        hits.forEach((s) => Object.assign(s, data));
        return { count: hits.length };
      },
    },
    refreshToken: {
      findUnique: async ({ where }: any) => {
        const row = tokens.find((t) => t.tokenHash === where.tokenHash);
        return row ? { ...row, session: sessions.find((s) => s.id === row.sessionId)! } : null;
      },
      updateMany: async ({ where, data }: any) => {
        const hits = tokens.filter((t) => t.id === where.id && t.usedAt === null);
        hits.forEach((t) => Object.assign(t, data));
        return { count: hits.length };
      },
      create: async ({ data }: any) => {
        const row = { id: `rt-${tokens.length + 1}`, usedAt: null, ...data };
        tokens.push(row);
        return row;
      },
    },
    $transaction: async (operations: Promise<unknown>[]) => Promise.all(operations),
  };
  const jwtService = new JwtService({ secret: 'test-secret', signOptions: { expiresIn: 900 } });
  const config = { get: (key: string) => ({ NODE_ENV: 'test', JWT_REFRESH_TOKEN_TTL_SECONDS: 3600, ALLOW_OTP_DEBUG_VISIBILITY: false })[key] };
  const redis = { get: async () => createHash('sha256').update(otp).digest('hex'), del: async () => 1, set: async () => 'OK' };
  const service = new AuthService(prisma, jwtService, config as never, redis as never, noopOtpRateLimiter as never);
  const memberGuard = new JwtAuthGuard(jwtService, prisma);
  const adminGuard = new AdminAuthGuard(jwtService, prisma);
  const call = async (guard: { canActivate: (c: ExecutionContext) => Promise<boolean> }, token: string) => {
    const request: AuthenticatedRequest = { headers: { authorization: `Bearer ${token}` } };
    const context = { switchToHttp: () => ({ getRequest: () => request }) } as unknown as ExecutionContext;
    return guard.canActivate(context);
  };
  return {
    prisma,
    sessions,
    tokens,
    service,
    login: () => service.verifyOtp('+919876543210', otp, 'login'),
    member: (token: string) => call(memberGuard, token),
    admin: (token: string) => call(adminGuard, token),
    jwt: jwtService,
  };
}

describe('refresh token rotation', () => {
  it('login stores only a hash of the refresh token, tied to the session', async () => {
    const { login, sessions, tokens } = setup();
    const { refreshToken } = await login();

    const hash = createHash('sha256').update(refreshToken).digest('hex');
    expect(tokens).toEqual([{ id: 'rt-1', sessionId: 'session-1', tokenHash: hash, usedAt: null }]);
    expect(sessions[0]!.refreshTokenHash).toBe(hash);
    expect(JSON.stringify({ sessions, tokens })).not.toContain(refreshToken);
  });

  it('a refresh returns a new working access token and a different refresh token for the same session', async () => {
    const { login, service, member, jwt } = setup();
    const first = await login();

    const next = await service.refresh(first.refreshToken);

    expect(next.refreshToken).not.toBe(first.refreshToken);
    await expect(member(next.accessToken)).resolves.toBe(true);
    expect((jwt.decode(next.accessToken) as { sid: string }).sid).toBe('session-1');
  });

  it('the old refresh token is rejected after rotation, and reusing it revokes the whole session', async () => {
    const { login, service, member, sessions } = setup();
    const first = await login();
    const second = await service.refresh(first.refreshToken);

    await expect(service.refresh(first.refreshToken)).rejects.toBeInstanceOf(UnauthorizedException);

    expect(sessions[0]!.revokedAt).toBeInstanceOf(Date);
    // Everything from that session is now dead: the newest tokens included.
    await expect(member(second.accessToken)).rejects.toBeInstanceOf(UnauthorizedException);
    await expect(service.refresh(second.refreshToken)).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('a chain of rotations keeps working while each token is used once', async () => {
    const { login, service, member } = setup();
    let pair: { accessToken: string; refreshToken: string } = await login();
    for (let i = 0; i < 3; i += 1) pair = await service.refresh(pair.refreshToken);
    await expect(member(pair.accessToken)).resolves.toBe(true);
  });

  it('logout revokes the session, so its refresh token no longer works', async () => {
    const { login, service } = setup();
    const { refreshToken } = await login();

    await service.logout('user-1', 'session-1');

    await expect(service.refresh(refreshToken)).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('an unknown or expired-session refresh token is rejected', async () => {
    const { login, service, sessions } = setup();
    await expect(service.refresh('not-a-real-token')).rejects.toBeInstanceOf(UnauthorizedException);

    const { refreshToken } = await login();
    sessions[0]!.expiresAt = new Date(Date.now() - 1000);
    await expect(service.refresh(refreshToken)).rejects.toBeInstanceOf(UnauthorizedException);
  });
});

describe('admin sessions', () => {
  it('refreshing an admin session issues an admin token (typ:admin) that the admin guard accepts', async () => {
    const { login, service, admin, member, jwt } = setup({ admin: true });
    const first = await login();

    const next = await service.refresh(first.refreshToken);

    expect(jwt.decode(next.accessToken)).toMatchObject({ sub: 'admin-1', typ: 'admin', sid: 'session-1' });
    await expect(admin(next.accessToken)).resolves.toBe(true);
    await expect(member(next.accessToken)).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('admin logout (the same session revocation) ends refresh too', async () => {
    const { login, service, prisma } = setup({ admin: true });
    const { refreshToken } = await login();

    // What POST /admin/logout calls.
    await revokeSession(prisma, 'user-1', 'session-1');

    await expect(service.refresh(refreshToken)).rejects.toBeInstanceOf(UnauthorizedException);
  });
});
