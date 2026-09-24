import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { InitiateVerificationResponse, VerificationStatusResponse } from '@nadar-kalyanam/schemas';
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
  async callback(userId: string, reference: string): Promise<VerificationStatusResponse> {
    const request = await this.prisma.verificationRequest.findFirst({
      where: { userId, providerReference: reference },
    });
    if (!request) {
      throw new NotFoundException('Verification request not found');
    }

    const { succeeded } = await this.provider.confirmStatus(reference);
    const status = succeeded ? 'SUCCEEDED' : 'FAILED';
    const decidedAt = new Date();

    await this.prisma.$transaction(async (tx) => {
      await tx.verificationRequest.update({ where: { id: request.id }, data: { status, decidedAt } });

      if (succeeded) {
        await tx.profile.updateMany({ where: { userId }, data: { isVerified: true } });
      } else {
        const anySucceeded = await tx.verificationRequest.findFirst({
          where: { userId, status: 'SUCCEEDED' },
        });
        if (!anySucceeded) {
          await tx.profile.updateMany({ where: { userId }, data: { isVerified: false } });
        }
      }
    });

    return { status, decidedAt: decidedAt.toISOString() };
  }

  async getStatus(userId: string): Promise<VerificationStatusResponse> {
    const latest = await this.prisma.verificationRequest.findFirst({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });
    if (!latest) {
      return { status: 'PENDING', decidedAt: null };
    }
    return { status: latest.status, decidedAt: latest.decidedAt?.toISOString() ?? null };
  }
}
