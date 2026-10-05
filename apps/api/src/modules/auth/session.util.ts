import { UnauthorizedException } from '@nestjs/common';
import type { PrismaService } from '../prisma/prisma.service.js';

// Access tokens carry `sid`, the Session row created at login. A token is only
// honoured while that session exists, belongs to the token's user, is not
// revoked (logout) and has not expired — so logging out rejects the token
// immediately instead of leaving it usable until its own expiry.
//
// `sub` is the member's User id; for admin tokens it is the AdminUser id, so
// callers pass the User id the session must belong to.
export async function assertActiveSession(
  prisma: PrismaService,
  sessionId: string | undefined,
  userId: string,
): Promise<void> {
  if (!sessionId) throw new UnauthorizedException('Session expired. Please sign in again.');
  const session = await prisma.session.findUnique({
    where: { id: sessionId },
    select: { userId: true, revokedAt: true, expiresAt: true },
  });
  if (!session || session.userId !== userId || session.revokedAt || session.expiresAt <= new Date()) {
    throw new UnauthorizedException('Session expired. Please sign in again.');
  }
}

// Logout, for members and admins alike: revokes this one login session, so
// every token carrying its `sid` is refused from then on — access tokens via
// assertActiveSession, and every refresh token of the session via
// AuthService.refresh, which refuses any token whose session is revoked.
// Idempotent.
export async function revokeSession(prisma: PrismaService, userId: string, sessionId: string): Promise<void> {
  await prisma.session.updateMany({
    where: { id: sessionId, userId, revokedAt: null },
    data: { revokedAt: new Date() },
  });
}
