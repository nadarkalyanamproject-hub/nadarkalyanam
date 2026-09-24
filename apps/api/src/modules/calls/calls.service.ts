import { ForbiddenException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { CallSessionResponse } from '@nadar-kalyanam/schemas';
import { isBlockedEitherDirection } from '../../common/blocks.util.js';
import { assertProviderConfigured } from '../../common/not-yet-available.exception.js';
import type { Env } from '../config/env.schema.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { RTC_PROVIDER_ADAPTER, type RtcProviderAdapter } from './adapters/rtc-provider.adapter.js';

@Injectable()
export class CallsService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(RTC_PROVIDER_ADAPTER) private readonly rtc: RtcProviderAdapter,
    private readonly configService: ConfigService<Env, true>,
  ) {}

  // FR-6.1/6.4: calling requires a mutually accepted interest and no block
  // either direction. The plan-based entitlement half of FR-6.1
  // ("calling permitted by the approved calling entitlement policy") is left
  // unenforced — SRS §8.4 lists it as APPROVAL REQUIRED, still open.
  async initiate(callerId: string, targetUserId: string): Promise<CallSessionResponse> {
    assertProviderConfigured(this.configService, this.rtc, 'Voice/video calling');

    if (callerId === targetUserId) {
      throw new ForbiddenException('You cannot call yourself');
    }
    if (await isBlockedEitherDirection(this.prisma, callerId, targetUserId)) {
      throw new ForbiddenException('You cannot call this member');
    }
    const mutualInterest = await this.prisma.interest.findFirst({
      where: {
        status: 'ACCEPTED',
        OR: [
          { senderId: callerId, targetId: targetUserId },
          { senderId: targetUserId, targetId: callerId },
        ],
      },
    });
    if (!mutualInterest) {
      throw new ForbiddenException('Calling requires a mutually accepted interest');
    }

    const { roomId } = await this.rtc.createRoom();
    const { token } = await this.rtc.issueToken(roomId, callerId);
    const call = await this.prisma.call.create({
      data: { callerId, calleeId: targetUserId, roomId, status: 'RINGING' },
    });

    return { id: call.id, roomId, token, status: call.status };
  }

  async accept(calleeId: string, callId: string): Promise<CallSessionResponse> {
    const call = await this.getCallOrThrow(callId);
    if (call.calleeId !== calleeId) {
      throw new ForbiddenException('Only the callee can accept this call');
    }
    const { token } = await this.rtc.issueToken(call.roomId, calleeId);
    const updated = await this.prisma.call.update({
      where: { id: callId },
      data: { status: 'ACCEPTED', connectedAt: new Date() },
    });
    return { id: updated.id, roomId: updated.roomId, token, status: updated.status };
  }

  async end(callerUserId: string, callId: string): Promise<{ id: string; durationSeconds: number | null }> {
    const call = await this.getCallOrThrow(callId);
    if (call.callerId !== callerUserId && call.calleeId !== callerUserId) {
      throw new ForbiddenException('You are not a participant in this call');
    }
    const endedAt = new Date();
    const durationSeconds = call.connectedAt
      ? Math.round((endedAt.getTime() - call.connectedAt.getTime()) / 1000)
      : null;
    const updated = await this.prisma.call.update({
      where: { id: callId },
      data: { status: 'ENDED', endedAt, durationSeconds },
    });
    return { id: updated.id, durationSeconds: updated.durationSeconds };
  }

  private async getCallOrThrow(callId: string) {
    const call = await this.prisma.call.findUnique({ where: { id: callId } });
    if (!call) {
      throw new NotFoundException('Call not found');
    }
    return call;
  }
}
