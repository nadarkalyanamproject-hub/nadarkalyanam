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

describe('JwtAuthGuard', () => {
  it('rejects a request with no Authorization header', async () => {
    const jwtService = { verifyAsync: vi.fn() };
    const guard = new JwtAuthGuard(jwtService as never);
    const context = buildContext({ headers: {} });

    await expect(guard.canActivate(context)).rejects.toBeInstanceOf(UnauthorizedException);
    expect(jwtService.verifyAsync).not.toHaveBeenCalled();
  });

  it('rejects a request with an invalid or expired token', async () => {
    const jwtService = { verifyAsync: vi.fn().mockRejectedValue(new Error('bad token')) };
    const guard = new JwtAuthGuard(jwtService as never);
    const context = buildContext({ headers: { authorization: 'Bearer bad-token' } });

    await expect(guard.canActivate(context)).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('allows a request with a valid bearer token and attaches the user', async () => {
    const jwtService = { verifyAsync: vi.fn().mockResolvedValue({ sub: 'user-1' }) };
    const guard = new JwtAuthGuard(jwtService as never);
    const request: AuthenticatedRequest = { headers: { authorization: 'Bearer good-token' } };
    const context = buildContext(request);

    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(request.user).toEqual({ userId: 'user-1' });
  });
});
