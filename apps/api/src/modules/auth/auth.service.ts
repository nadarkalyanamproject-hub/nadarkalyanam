import { createHash, randomBytes, randomInt } from 'node:crypto';
import { Inject, Injectable, Logger, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import type { VerifyOtpResponse } from '@nadar-kalyanam/schemas';
import type { Redis } from 'ioredis';
import type { Env } from '../config/env.schema.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { REDIS_CLIENT } from '../redis/redis.constants.js';

const OTP_TTL_SECONDS = 300;
const OTP_REDIS_PREFIX = 'otp:';

function hashValue(value: string): string {
  return createHash('sha256').update(value).digest('hex');
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
  ) {}

  async requestOtp(phoneNumber: string): Promise<{ expiresInSeconds: number; devOtp?: string }> {
    const otp = generateOtp();
    await this.redis.set(
      `${OTP_REDIS_PREFIX}${phoneNumber}`,
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
    const key = `${OTP_REDIS_PREFIX}${phoneNumber}`;
    const storedHash = await this.redis.get(key);
    if (!storedHash || storedHash !== hashValue(otp)) {
      throw new UnauthorizedException('Invalid or expired OTP');
    }
    await this.redis.del(key);

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

    const accessToken = adminUser
      ? await this.jwtService.signAsync({ sub: adminUser.id, typ: 'admin' })
      : await this.jwtService.signAsync({ sub: user.id });

    const refreshToken = randomBytes(32).toString('hex');
    const refreshTtlSeconds = this.configService.get('JWT_REFRESH_TOKEN_TTL_SECONDS', {
      infer: true,
    });
    await this.prisma.session.create({
      data: {
        userId: user.id,
        refreshTokenHash: hashValue(refreshToken),
        expiresAt: new Date(Date.now() + refreshTtlSeconds * 1000),
      },
    });

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
