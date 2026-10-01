import { UnauthorizedException, type ExecutionContext } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import { JwtAuthGuard, type AuthenticatedRequest } from './jwt-auth.guard.js';

function buildContext(request: Partial<AuthenticatedRequest>): ExecutionContext {
  return {
    switchToHttp: () => ({
      getRequest: () => request,
    }),
  } as unknown as ExecutionContext;
}

const HOUR = 60 * 60 * 1000;
type FakeSession = { userId: string; revokedAt: Date | null; expiresAt: Date };

function buildGuard(payload: unknown, sessions: Record<string, FakeSession> = {}) {
  const jwtService = {
    verifyAsync: payload instanceof Error ? vi.fn().mockRejectedValue(payload) : vi.fn().mockResolvedValue(payload),
  };
  const prisma = {
    session: { findUnique: vi.fn(async ({ where }: { where: { id: string } }) => sessions[where.id] ?? null) },
  };
  return { guard: new JwtAuthGuard(jwtService as never, prisma as never), jwtService, prisma };
}

const live = (userId = 'user-1'): FakeSession => ({ userId, revokedAt: null, expiresAt: new Date(Date.now() + HOUR) });

describe('JwtAuthGuard', () => {
  it('rejects a request with no Authorization header', async () => {
    const { guard, jwtService } = buildGuard({ sub: 'user-1', sid: 's1' });

    await expect(guard.canActivate(buildContext({ headers: {} }))).rejects.toBeInstanceOf(UnauthorizedException);
    expect(jwtService.verifyAsync).not.toHaveBeenCalled();
  });

  it('rejects a request with an invalid or expired token', async () => {
    const { guard } = buildGuard(new Error('bad token'));

    await expect(guard.canActivate(buildContext({ headers: { authorization: 'Bearer bad-token' } }))).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it('allows a valid token whose session is live, and attaches the user and session', async () => {
    const { guard } = buildGuard({ sub: 'user-1', sid: 's1' }, { s1: live() });
    const request: AuthenticatedRequest = { headers: { authorization: 'Bearer good-token' } };

    await expect(guard.canActivate(buildContext(request))).resolves.toBe(true);
    expect(request.user).toEqual({ userId: 'user-1', sessionId: 's1' });
  });

  it.each([
    ['revoked by logout', { s1: { ...live(), revokedAt: new Date() } }, { sub: 'user-1', sid: 's1' }],
    ['past its expiry', { s1: { ...live(), expiresAt: new Date(Date.now() - 1000) } }, { sub: 'user-1', sid: 's1' }],
    ['missing', {}, { sub: 'user-1', sid: 's1' }],
    ["someone else's", { s1: live('user-2') }, { sub: 'user-1', sid: 's1' }],
    ['not named in the token (issued before sessions were checked)', { s1: live() }, { sub: 'user-1' }],
  ])('rejects a correctly-signed token whose session is %s', async (_label, sessions, payload) => {
    const { guard } = buildGuard(payload, sessions);
    const request: AuthenticatedRequest = { headers: { authorization: 'Bearer token' } };

    await expect(guard.canActivate(buildContext(request))).rejects.toBeInstanceOf(UnauthorizedException);
    expect(request.user).toBeUndefined();
  });

  it('rejects a valid, correctly-signed ADMIN token (typ:"admin") on member routes', async () => {
    const { guard } = buildGuard({ sub: 'admin-1', typ: 'admin', sid: 's1' }, { s1: live('admin-user') });
    const request: AuthenticatedRequest = { headers: { authorization: 'Bearer admin-token' } };

    await expect(guard.canActivate(buildContext(request))).rejects.toBeInstanceOf(UnauthorizedException);
    expect(request.user).toBeUndefined();
  });
});
