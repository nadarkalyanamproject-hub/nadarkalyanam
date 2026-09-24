import { UnauthorizedException, type ExecutionContext } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AdminAuthGuard } from './admin-auth.guard.js';

function buildContext(headers: { authorization?: string }) {
  const request: { headers: { authorization?: string }; adminUser?: unknown } = { headers };
  const context = {
    switchToHttp: () => ({ getRequest: () => request }),
  } as unknown as ExecutionContext;
  return { context, request };
}

describe('AdminAuthGuard', () => {
  let jwtService: { verifyAsync: ReturnType<typeof vi.fn> };
  let prisma: { adminUser: { findUnique: ReturnType<typeof vi.fn> } };
  let guard: AdminAuthGuard;

  beforeEach(() => {
    jwtService = { verifyAsync: vi.fn() };
    prisma = { adminUser: { findUnique: vi.fn() } };
    guard = new AdminAuthGuard(jwtService as never, prisma as never);
  });

  it('rejects a request with no Authorization header at all', async () => {
    const { context } = buildContext({});

    await expect(guard.canActivate(context)).rejects.toBeInstanceOf(UnauthorizedException);
    expect(jwtService.verifyAsync).not.toHaveBeenCalled();
  });

  it('rejects an invalid or expired token', async () => {
    jwtService.verifyAsync.mockRejectedValue(new Error('bad token'));
    const { context } = buildContext({ authorization: 'Bearer garbage' });

    await expect(guard.canActivate(context)).rejects.toBeInstanceOf(UnauthorizedException);
  });

  // The critical case this guard exists for: a real, validly-signed MEMBER
  // access token (exactly what auth.service.ts issues on every login) must
  // never be replayable against an admin route. Its payload has no `typ`
  // claim at all — see auth.service.ts's `signAsync({ sub: user.id })`.
  it('rejects a valid, correctly-signed MEMBER access token (no typ:"admin" claim)', async () => {
    jwtService.verifyAsync.mockResolvedValue({ sub: 'member-user-1' });
    const { context } = buildContext({ authorization: 'Bearer valid-member-token' });

    await expect(guard.canActivate(context)).rejects.toBeInstanceOf(UnauthorizedException);
    expect(prisma.adminUser.findUnique).not.toHaveBeenCalled();
  });

  it('rejects a typ:"admin" token whose admin account no longer exists', async () => {
    jwtService.verifyAsync.mockResolvedValue({ sub: 'admin-1', typ: 'admin' });
    prisma.adminUser.findUnique.mockResolvedValue(null);
    const { context } = buildContext({ authorization: 'Bearer admin-token' });

    await expect(guard.canActivate(context)).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('rejects a typ:"admin" token for a deactivated admin account', async () => {
    jwtService.verifyAsync.mockResolvedValue({ sub: 'admin-1', typ: 'admin' });
    prisma.adminUser.findUnique.mockResolvedValue({
      id: 'admin-1',
      isActive: false,
      roleId: 'role-1',
      role: { name: 'Moderator', permissions: [] },
    });
    const { context } = buildContext({ authorization: 'Bearer admin-token' });

    await expect(guard.canActivate(context)).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('allows a valid typ:"admin" token for an active admin and attaches their resolved permissions', async () => {
    jwtService.verifyAsync.mockResolvedValue({ sub: 'admin-1', typ: 'admin' });
    prisma.adminUser.findUnique.mockResolvedValue({
      id: 'admin-1',
      roleId: 'role-1',
      isActive: true,
      role: {
        name: 'Moderator',
        permissions: [{ permission: { code: 'reports.review' } }],
      },
    });
    const { context, request } = buildContext({ authorization: 'Bearer admin-token' });

    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(request.adminUser).toEqual({
      adminId: 'admin-1',
      roleId: 'role-1',
      roleName: 'Moderator',
      permissions: ['reports.review'],
    });
  });
});
