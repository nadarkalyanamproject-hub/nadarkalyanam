import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { InitiateVerificationResponse, VerificationStatusResponse } from '@nadar-kalyanam/schemas';
import { needsIdentityVerification } from '../../common/identity-gate.js';
import { assertProviderConfigured } from '../../common/not-yet-available.exception.js';
import type { Env } from '../config/env.schema.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { IDENTITY_PROVIDER_ADAPTER, type IdentityProviderAdapter } from './adapters/identity-provider.adapter.js';

@Injectable()
export class VerificationService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(IDENTITY_PROVIDER_ADAPTER) private readonly provider: IdentityProviderAdapter,
    private readonly configService: ConfigService<Env, true>,
  ) {}

  async initiate(userId: string): Promise<InitiateVerificationResponse> {
    assertProviderConfigured(this.configService, this.provider, 'Identity verification');

    const { redirectUrl, providerReference } = await this.provider.initiate(userId);
    const request = await this.prisma.verificationRequest.create({
      data: { userId, providerReference, status: 'PENDING' },
    });
    return { id: request.id, redirectUrl };
  }

  // FR-8.6 / PROPOSED DEFAULT (SRS): the latest valid provider-confirmed
  // decision governs. A failed attempt must never downgrade a profile that a
  // later (or earlier-initiated but later-confirmed) attempt already
  // verified — so a FAILED result only clears verifiedStatus when no
  // SUCCEEDED request exists for this user at all, never unconditionally.
  //
  // On success the ID's name and date of birth are stored on the member and
  // copied onto their profile (if they have one yet); from then on they lock
  // those profile fields (ProfilesService).
  async callback(userId: string, reference: string): Promise<VerificationStatusResponse> {
    assertProviderConfigured(this.configService, this.provider, 'Identity verification');
    const request = await this.prisma.verificationRequest.findFirst({
      where: { userId, providerReference: reference },
    });
    if (!request) {
      throw new NotFoundException('Verification request not found');
    }

    const { succeeded, identity } = await this.provider.confirmStatus(reference);
    const status = succeeded ? 'SUCCEEDED' : 'FAILED';
    const decidedAt = new Date();

    await this.prisma.$transaction(async (tx) => {
      await tx.verificationRequest.update({ where: { id: request.id }, data: { status, decidedAt } });

      if (succeeded) {
        const dateOfBirth = identity ? new Date(`${identity.dateOfBirth}T00:00:00.000Z`) : undefined;
        await tx.user.update({
          where: { id: userId },
          data: {
            identityVerifiedAt: decidedAt,
            ...(identity ? { identityName: identity.name, identityDateOfBirth: dateOfBirth } : {}),
          },
        });
        await tx.profile.updateMany({
          where: { userId },
          data: { isVerified: true, ...(identity ? { fullName: identity.name, dateOfBirth } : {}) },
        });
      } else {
        const anySucceeded = await tx.verificationRequest.findFirst({
          where: { userId, status: 'SUCCEEDED' },
        });
        if (!anySucceeded) {
          await tx.profile.updateMany({ where: { userId }, data: { isVerified: false } });
        }
      }
    });

    return { ...(await this.getStatus(userId)), status, decidedAt: decidedAt.toISOString() };
  }

  async getStatus(userId: string): Promise<VerificationStatusResponse> {
    const [latest, user] = await Promise.all([
      this.prisma.verificationRequest.findFirst({
        where: { userId },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.user.findUnique({
        where: { id: userId },
        select: { createdAt: true, identityVerifiedAt: true, identityName: true, identityDateOfBirth: true },
      }),
    ]);
    const identity =
      user?.identityVerifiedAt && user.identityName && user.identityDateOfBirth
        ? { name: user.identityName, dateOfBirth: user.identityDateOfBirth.toISOString().slice(0, 10) }
        : null;
    return {
      status: latest?.status ?? 'PENDING',
      decidedAt: latest?.decidedAt?.toISOString() ?? null,
      verified: Boolean(user?.identityVerifiedAt),
      required: user ? needsIdentityVerification(this.configService, user) : false,
      identity,
    };
  }
}
