import { createHash, randomBytes, randomInt } from 'node:crypto';
import { ConflictException, Inject, Injectable, Logger, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import type { AccountStatusResponse, AuthTokens, LogoutOthersOtpResponse, VerifyOtpResponse } from '@nadar-kalyanam/schemas';
import type { Redis } from 'ioredis';
import type { Env } from '../config/env.schema.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { OTP_LIMITS, OtpRateLimiter } from './otp-rate-limiter.js';
import { revokeSession } from './session.util.js';
import { REDIS_CLIENT } from '../redis/redis.constants.js';
import { scheduledAnonymizationDate } from '../admin/member-removal.js';

const OTP_TTL_SECONDS = 300;
// How long after a refresh token is spent a repeat of it still counts as a
// lost response rather than theft (see refresh()).
export const REFRESH_REUSE_GRACE_MS = 2 * 60 * 1000;
const OTP_REDIS_PREFIX = 'otp:';

function toAccountStatus(user: { status: string; deletionRequestedAt: Date | null }): AccountStatusResponse {
  const pendingSince = user.status === 'PENDING_DELETION' ? user.deletionRequestedAt : null;
  return {
    status: user.status as AccountStatusResponse['status'],
    deletionScheduledAt: pendingSince ? scheduledAnonymizationDate(pendingSince).toISOString() : null,
  };
}

function hashValue(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

function generateRefreshToken(): string {
  return randomBytes(32).toString('hex');
}

const logoutOthersOtpKey = (userId: string) => `${OTP_REDIS_PREFIX}logout-others:${userId}`;

// "+919876543201" -> "+91 ******3201"
export function maskPhone(phoneNumber: string): string {
  const local = phoneNumber.replace(/^\+91/, '');
  return `+91 ${'*'.repeat(Math.max(0, local.length - 4))}${local.slice(-4)}`;
}

function generateOtp(): string {
  return randomInt(0, 1_000_000).toString().padStart(6, '0');
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService<Env, true>,
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
    private readonly rateLimiter: OtpRateLimiter,
  ) {}

  async requestOtp(phoneNumber: string, ip?: string): Promise<{ expiresInSeconds: number; devOtp?: string }> {
    return this.issueOtp(`${OTP_REDIS_PREFIX}${phoneNumber}`, phoneNumber, ip);
  }

  // Creates a code for phoneNumber and stores its hash under `key` (login
  // and "log out other devices" use different keys, so neither code works
  // for the other). Shares the per-number and per-IP request limits.
  private async issueOtp(key: string, phoneNumber: string, ip?: string): Promise<{ expiresInSeconds: number; devOtp?: string }> {
    await this.rateLimiter.assertCanRequest(phoneNumber, ip);
    const otp = generateOtp();
    await this.redis.set(
      key,
      hashValue(otp),
      'EX',
      OTP_TTL_SECONDS,
    );

    const isDev = this.configService.get('NODE_ENV', { infer: true }) === 'development';
    const allowOtpDebugVisibility = this.configService.get('ALLOW_OTP_DEBUG_VISIBILITY', {
      infer: true,
    });

    if (allowOtpDebugVisibility) {
      // Deliberately 'warn', not 'log'/'debug': production's pino level
      // floor is 'info', and this needs to stand out from routine request
      // logs, not blend into them — see env.schema.ts for the off-by-default
      // gate.
      this.logger.warn(
        `[OTP_DEBUG_VISIBILITY] phoneNumber=${phoneNumber} otp=${otp} (expires in ${OTP_TTL_SECONDS}s). ` +
          'ALLOW_OTP_DEBUG_VISIBILITY is enabled — unset it once real SMS delivery is wired up.',
      );
    }

    return {
      expiresInSeconds: OTP_TTL_SECONDS,
      ...(isDev || allowOtpDebugVisibility ? { devOtp: otp } : {}),
    };
  }

  async verifyOtp(
    phoneNumber: string,
    otp: string,
    intent: 'register' | 'login' = 'register',
  ): Promise<VerifyOtpResponse> {
    await this.consumeOtp(`${OTP_REDIS_PREFIX}${phoneNumber}`, phoneNumber, otp);

    const user =
      intent === 'login'
        ? await this.findUserForLogin(phoneNumber)
        : // Upsert keyed by the unique phoneNumber column: a repeat verification
          // for the same number always resolves to the same user row, never a
          // duplicate.
          await this.prisma.user.upsert({
            where: { phoneNumber },
            update: {},
            create: { phoneNumber },
            include: { profile: { select: { id: true } } },
          });

    // Admin login reuses this exact same phone/OTP flow — there is no
    // separate admin login endpoint. Only checked on the 'login' path:
    // admin accounts are pre-provisioned (via prisma/seed.ts), never
    // self-registered. If this User has a linked AdminUser, they get an
    // admin-scoped token INSTEAD of a normal member token — never both.
    // Note `sub` is the AdminUser's own id, not the User's id: that's what
    // AdminAuthGuard looks up by.
    const adminUser =
      intent === 'login' ? await this.prisma.adminUser.findUnique({ where: { userId: user.id } }) : null;

    // The session is created first so the access token can carry its id
    // (`sid`): guards check that session on every request, which is what
    // lets logout revoke the token server-side.
    // The refresh token is opaque and stored only as a hash, both on the
    // session (its current token) and as the first refresh_tokens row.
    const refreshToken = generateRefreshToken();
    const tokenHash = hashValue(refreshToken);
    const session = await this.prisma.session.create({
      data: {
        userId: user.id,
        adminUserId: adminUser?.id ?? null,
        refreshTokenHash: tokenHash,
        expiresAt: this.sessionExpiry(),
        refreshTokens: { create: { tokenHash } },
      },
    });

    const accessToken = await this.signAccessToken(session.id, user.id, adminUser?.id ?? null);

    return {
      accessToken,
      refreshToken,
      user: {
        id: user.id,
        phoneNumber: user.phoneNumber,
        hasProfile: Boolean(user.profile),
        isAdmin: Boolean(adminUser),
      },
    };
  }

  // POST /auth/refresh. Rotation: the presented refresh token is spent and a
  // new access + refresh token pair is issued for the same session, whose
  // expiry slides forward. A token that was already spent being presented
  // again means a copy leaked, so the whole session is revoked — the thief
  // and the real owner are both signed out, and the owner signs back in.
  async refresh(refreshToken: string): Promise<AuthTokens> {
    const row = await this.prisma.refreshToken.findUnique({
      where: { tokenHash: hashValue(refreshToken) },
      include: { session: true },
    });
    if (!row) throw new UnauthorizedException('Session expired. Please sign in again.');
    const { session } = row;
    if (session.revokedAt || session.expiresAt <= new Date()) {
      throw new UnauthorizedException('Session expired. Please sign in again.');
    }

    // Claiming the token is conditional on it still being unspent, so two
    // concurrent uses of one token can't both succeed.
    const claimed = row.usedAt
      ? 0
      : (await this.prisma.refreshToken.updateMany({ where: { id: row.id, usedAt: null }, data: { usedAt: new Date() } }))
          .count;
    if (claimed === 0) {
      // A token spent moments ago is almost always a lost response (weak
      // signal, a tab closed mid-refresh), not theft: issue a fresh token
      // rather than signing the member out. Reuse after the grace window
      // still ends the whole session.
      const spentAt = row.usedAt ?? new Date();
      if (Date.now() - spentAt.getTime() > REFRESH_REUSE_GRACE_MS) {
        await revokeSession(this.prisma, session.userId, session.id);
        this.logger.warn(`Refresh token reuse detected; revoked session ${session.id} (user ${session.userId})`);
        throw new UnauthorizedException('This sign-in was ended for your security. Please sign in again.');
      }
      this.logger.log(`Refresh token re-sent within the grace window; reissued for session ${session.id}`);
    }

    if (session.adminUserId) {
      const admin = await this.prisma.adminUser.findUnique({ where: { id: session.adminUserId } });
      if (!admin || !admin.isActive) {
        await revokeSession(this.prisma, session.userId, session.id);
        throw new UnauthorizedException('Admin account is inactive');
      }
    }

    const nextToken = generateRefreshToken();
    const nextHash = hashValue(nextToken);
    await this.prisma.$transaction([
      this.prisma.refreshToken.create({ data: { sessionId: session.id, tokenHash: nextHash } }),
      this.prisma.session.update({
        where: { id: session.id },
        data: { refreshTokenHash: nextHash, expiresAt: this.sessionExpiry() },
      }),
    ]);

    return {
      accessToken: await this.signAccessToken(session.id, session.userId, session.adminUserId),
      refreshToken: nextToken,
    };
  }

  // Admin sessions keep issuing admin tokens (typ:'admin', sub = AdminUser
  // id); member sessions keep issuing member tokens (sub = User id).
  private signAccessToken(sessionId: string, userId: string, adminUserId: string | null): Promise<string> {
    return adminUserId
      ? this.jwtService.signAsync({ sub: adminUserId, typ: 'admin', sid: sessionId })
      : this.jwtService.signAsync({ sub: userId, sid: sessionId });
  }

  private sessionExpiry(): Date {
    const ttlSeconds = this.configService.get('JWT_REFRESH_TOKEN_TTL_SECONDS', { infer: true });
    return new Date(Date.now() + ttlSeconds * 1000);
  }

  // Revokes the caller's own login session. Every token carrying that `sid`
  // is rejected from then on (see assertActiveSession). Idempotent: an
  // already-revoked session stays revoked.
  async logout(userId: string, sessionId: string): Promise<void> {
    await revokeSession(this.prisma, userId, sessionId);
  }

  // The member's own account state, for the apps' account screen.
  async getAccount(userId: string): Promise<AccountStatusResponse> {
    const user = await this.prisma.user.findUnique({ where: { id: userId }, select: { status: true, deletionRequestedAt: true } });
    if (!user) throw new NotFoundException('Account not found');
    return toAccountStatus(user);
  }

  // Self-service account deletion (FR-1.5; required by the App Store and
  // Play Store). The same mechanism as an admin removal: the account leaves
  // every list straight away (discovery, matching and messaging only show
  // ACTIVE members), every sign-in is ended, and the anonymization job
  // erases it once the 14-day grace period has passed. Until then the
  // member can sign in and cancel.
  async requestAccountDeletion(userId: string): Promise<AccountStatusResponse> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { status: true, deletionRequestedAt: true, adminUser: { select: { id: true } } },
    });
    if (!user) throw new NotFoundException('Account not found');
    if (user.adminUser) {
      throw new ConflictException('This account is linked to a staff login. Please contact support to remove it.');
    }
    if (user.status === 'PENDING_DELETION') return toAccountStatus(user);
    const deletionRequestedAt = new Date();
    const [updated] = await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: userId },
        data: { status: 'PENDING_DELETION', deletionRequestedAt, statusBeforeDeletion: user.status },
        select: { status: true, deletionRequestedAt: true },
      }),
      this.prisma.session.updateMany({ where: { userId, adminUserId: null, revokedAt: null }, data: { revokedAt: new Date() } }),
    ]);
    return toAccountStatus(updated);
  }

  // Undo a self-service deletion request, strictly before the scheduled date
  // (from then on the anonymization job may run).
  async cancelAccountDeletion(userId: string): Promise<AccountStatusResponse> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { status: true, deletionRequestedAt: true, statusBeforeDeletion: true },
    });
    if (!user) throw new NotFoundException('Account not found');
    if (user.status !== 'PENDING_DELETION' || !user.deletionRequestedAt) return toAccountStatus(user);
    if (scheduledAnonymizationDate(user.deletionRequestedAt).getTime() <= Date.now()) {
      throw new ConflictException('The 14 days have passed, so this deletion can no longer be cancelled.');
    }
    const updated = await this.prisma.user.update({
      where: { id: userId },
      data: { status: user.statusBeforeDeletion ?? 'ACTIVE', deletionRequestedAt: null, statusBeforeDeletion: null },
      select: { status: true, deletionRequestedAt: true },
    });
    return toAccountStatus(updated);
  }

  // Checks a code stored by issueOtp and spends it. Wrong codes count toward
  // the per-number lockout, whichever kind of code it was.
  private async consumeOtp(key: string, phoneNumber: string, otp: string): Promise<void> {
    await this.rateLimiter.assertCanVerify(phoneNumber);
    const storedHash = await this.redis.get(key);
    if (!storedHash || storedHash !== hashValue(otp)) {
      // Counts toward the wrong-code lockout (throws 429 on the last one).
      const left = await this.rateLimiter.recordFailedVerify(phoneNumber, key);
      throw new UnauthorizedException(
        `Invalid or expired OTP. ${left} attempt${left === 1 ? '' : 's'} left before a ${OTP_LIMITS.verifyLockSeconds / 60}-minute lock.`,
      );
    }
    await this.redis.del(key);
    await this.rateLimiter.clearFailedVerifies(phoneNumber);
  }

  // Member sign-ins still active, this one included. Admin (staff panel)
  // sessions are separate and never counted or ended from here.
  async countActiveSessions(userId: string): Promise<number> {
    return this.prisma.session.count({
      where: { userId, adminUserId: null, revokedAt: null, expiresAt: { gt: new Date() } },
    });
  }

  // Sends the code that "Log out of all other devices" asks for, to the
  // member's own registered number (never one the client names).
  async requestLogoutOthersOtp(userId: string, ip?: string): Promise<LogoutOthersOtpResponse> {
    const phoneNumber = await this.registeredNumber(userId);
    const sent = await this.issueOtp(logoutOthersOtpKey(userId), phoneNumber, ip);
    return { ...sent, sentTo: maskPhone(phoneNumber) };
  }

  // "Log out of all other devices": once the code checks out, ends every
  // other member sign-in of this user, keeping the one making the request.
  // Returns how many were ended.
  async logoutOtherSessions(userId: string, currentSessionId: string, otp: string): Promise<number> {
    await this.consumeOtp(logoutOthersOtpKey(userId), await this.registeredNumber(userId), otp);
    const { count } = await this.prisma.session.updateMany({
      where: { userId, adminUserId: null, revokedAt: null, id: { not: currentSessionId } },
      data: { revokedAt: new Date() },
    });
    return count;
  }

  private async registeredNumber(userId: string): Promise<string> {
    const user = await this.prisma.user.findUnique({ where: { id: userId }, select: { phoneNumber: true } });
    if (!user) throw new NotFoundException('Account not found');
    return user.phoneNumber;
  }

  private async findUserForLogin(phoneNumber: string) {
    const user = await this.prisma.user.findUnique({
      where: { phoneNumber },
      include: { profile: { select: { id: true } } },
    });
    if (!user) {
      throw new NotFoundException({
        message: 'No account found with this number. Please register instead.',
        errorCode: 'ACCOUNT_NOT_FOUND',
      });
    }
    return user;
  }
}
