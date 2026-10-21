import { ForbiddenException, SetMetadata } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import type { Env } from '../modules/config/env.schema.js';
import { istMidnight } from './launch.js';

// The DigiLocker gate (IDENTITY_VERIFICATION_REQUIRED_FROM): an account
// created on/after that day must pass identity verification before using any
// member route except the ones marked @AllowUnverifiedIdentity(). Accounts
// created earlier are grandfathered in.

export const ALLOW_UNVERIFIED_IDENTITY = 'allowUnverifiedIdentity';

// For routes an account needs before it has verified: the verification flow
// itself and logout.
export const AllowUnverifiedIdentity = () => SetMetadata(ALLOW_UNVERIFIED_IDENTITY, true);

export const IDENTITY_REQUIRED_MESSAGE = 'Please verify your identity with DigiLocker to continue.';

export function identityRequiredException(): ForbiddenException {
  return new ForbiddenException({ statusCode: 403, errorCode: 'IDENTITY_REQUIRED', message: IDENTITY_REQUIRED_MESSAGE });
}

export function identityRequiredFrom(config: ConfigService<Env, true>): Date | null {
  const day = config.get('IDENTITY_VERIFICATION_REQUIRED_FROM', { infer: true });
  return day ? istMidnight(day) : null;
}

// True when this account still has to verify.
export function needsIdentityVerification(
  config: ConfigService<Env, true>,
  user: { createdAt: Date; identityVerifiedAt: Date | null },
): boolean {
  const from = identityRequiredFrom(config);
  return from !== null && user.createdAt >= from && user.identityVerifiedAt === null;
}
