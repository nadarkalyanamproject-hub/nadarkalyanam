import { HttpException, HttpStatus, Inject, Injectable } from '@nestjs/common';
import type { Redis } from 'ioredis';
import { REDIS_CLIENT } from '../redis/redis.constants.js';

// OTP abuse limits (member and admin login share the same OTP endpoints, so
// both get them). Fixed windows in Redis: the first hit creates the counter
// with its TTL, later hits only increment it, so a window never extends.
export const OTP_LIMITS = {
  // POST /auth/otp/request, per phone number and per client IP.
  requestsPerPhone: { max: 5, windowSeconds: 600 },
  requestsPerIp: { max: 30, windowSeconds: 600 },
  // Wrong codes for one phone number before verification is locked.
  failedVerifies: { max: 5, windowSeconds: 600 },
  verifyLockSeconds: 900,
} as const;

export const OTP_RATE_LIMITED = 'OTP_RATE_LIMITED';

// 429 carrying how long to wait; RetryAfterFilter turns retryAfterSeconds
// into the Retry-After header.
export class OtpRateLimitException extends HttpException {
  constructor(
    message: string,
    public readonly retryAfterSeconds: number,
  ) {
    super(
      { statusCode: HttpStatus.TOO_MANY_REQUESTS, message, errorCode: OTP_RATE_LIMITED, retryAfterSeconds },
      HttpStatus.TOO_MANY_REQUESTS,
    );
  }
}

// "in 1 minute" / "in 9 minutes" — rounded up so the wait is never understated.
export function waitPhrase(seconds: number): string {
  const minutes = Math.max(1, Math.ceil(seconds / 60));
  return `in ${minutes} minute${minutes === 1 ? '' : 's'}`;
}

type RateLimitRedis = Pick<Redis, 'set' | 'incr' | 'ttl' | 'del'>;

@Injectable()
export class OtpRateLimiter {
  constructor(@Inject(REDIS_CLIENT) private readonly redis: RateLimitRedis) {}

  // Counts one OTP request against the phone and IP windows; throws 429
  // once either is over its limit.
  async assertCanRequest(phoneNumber: string, ip: string | undefined): Promise<void> {
    const phone = await this.hit(`otp:rl:phone:${phoneNumber}`, OTP_LIMITS.requestsPerPhone.windowSeconds);
    if (phone.count > OTP_LIMITS.requestsPerPhone.max) {
      throw new OtpRateLimitException(
        `Too many OTP requests for this number. Please try again ${waitPhrase(phone.ttl)}.`,
        phone.ttl,
      );
    }
    if (ip) {
      const byIp = await this.hit(`otp:rl:ip:${ip}`, OTP_LIMITS.requestsPerIp.windowSeconds);
      if (byIp.count > OTP_LIMITS.requestsPerIp.max) {
        throw new OtpRateLimitException(
          `Too many OTP requests from this network. Please try again ${waitPhrase(byIp.ttl)}.`,
          byIp.ttl,
        );
      }
    }
  }

  // Before checking a code: refused outright while the number is locked.
  async assertCanVerify(phoneNumber: string): Promise<void> {
    const ttl = await this.redis.ttl(this.lockKey(phoneNumber));
    if (ttl > 0) throw this.lockedException(ttl);
  }

  // After a wrong code. Returns how many attempts are left; on the last one
  // the number is locked and the pending OTP discarded (a fresh code is
  // needed after the cooldown).
  async recordFailedVerify(phoneNumber: string, otpKey: string): Promise<number> {
    const fails = await this.hit(`otp:fail:${phoneNumber}`, OTP_LIMITS.failedVerifies.windowSeconds);
    const left = OTP_LIMITS.failedVerifies.max - fails.count;
    if (left <= 0) {
      await this.redis.set(this.lockKey(phoneNumber), '1', 'EX', OTP_LIMITS.verifyLockSeconds);
      await this.redis.del(`otp:fail:${phoneNumber}`, otpKey);
      throw this.lockedException(OTP_LIMITS.verifyLockSeconds);
    }
    return left;
  }

  async clearFailedVerifies(phoneNumber: string): Promise<void> {
    await this.redis.del(`otp:fail:${phoneNumber}`);
  }

  private lockKey(phoneNumber: string): string {
    return `otp:lock:${phoneNumber}`;
  }

  private lockedException(ttl: number): OtpRateLimitException {
    return new OtpRateLimitException(`Too many incorrect codes. Please try again ${waitPhrase(ttl)}.`, ttl);
  }

  private async hit(key: string, windowSeconds: number): Promise<{ count: number; ttl: number }> {
    // NX: only the first hit of a window sets the expiry.
    await this.redis.set(key, '0', 'EX', windowSeconds, 'NX');
    const count = await this.redis.incr(key);
    const ttl = await this.redis.ttl(key);
    return { count, ttl: ttl > 0 ? ttl : windowSeconds };
  }
}
