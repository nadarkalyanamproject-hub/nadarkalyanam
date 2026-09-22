import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { calculateAge } from '../../common/age.js';
import { isBlockedEitherDirection } from '../../common/blocks.util.js';
import { Prisma } from '../../generated/prisma/client.js';
import { PhotosService } from '../photos/photos.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { ProfilesService } from '../profiles/profiles.service.js';

function isUniqueConstraintViolation(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002';
}

interface InterestParty {
  profileId: string;
  fullName: string;
  age: number;
  primaryPhotoUrl: string | null;
}

@Injectable()
export class InterestsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly profilesService: ProfilesService,
    private readonly photosService: PhotosService,
  ) {}

  async sendInterest(callerUserId: string, targetProfileId: string) {
    const callerProfile = await this.profilesService.getOwnProfileOrThrow(callerUserId);

    const targetProfile = await this.prisma.profile.findUnique({ where: { id: targetProfileId } });
    if (!targetProfile || targetProfile.visibility === 'HIDDEN') {
      throw new NotFoundException('Profile not found');
    }

    if (callerProfile.id === targetProfileId) {
      throw new BadRequestException('You cannot send an interest to yourself');
    }

    if (await isBlockedEitherDirection(this.prisma, callerUserId, targetProfile.userId)) {
      throw new NotFoundException('Profile not found');
    }

    // A prior WITHDRAWN interest between this pair does NOT block a new one —
    // only a still-PENDING/ACCEPTED or a DECLINED interest does (DECLINED is
    // permanent: once declined, never sendable again). The DB enforces this
    // as a partial unique index on (senderId, targetId) WHERE status IN
    // ('PENDING','ACCEPTED','DECLINED') — see the migration and the comment
    // on the Interest model. There can be at most one such row at a time for
    // a given pair, so findFirst is enough; checked here first for a clean,
    // specific error instead of a raw unique-constraint violation.
    const blocking = await this.prisma.interest.findFirst({
      where: {
        senderId: callerUserId,
        targetId: targetProfile.userId,
        status: { in: ['PENDING', 'ACCEPTED', 'DECLINED'] },
      },
    });
    if (blocking?.status === 'DECLINED') {
      throw new ConflictException('This person has already declined your interest');
    }
    if (blocking) {
      throw new ConflictException('You have already sent an interest to this profile');
    }

    try {
      const interest = await this.prisma.interest.create({
        data: { senderId: callerUserId, targetId: targetProfile.userId },
      });
      return { id: interest.id, status: interest.status };
    } catch (error) {
      // Concurrency backstop: two near-simultaneous sends can both pass the
      // findFirst check above before either commits. The partial unique
      // index (not represented in Prisma's schema DSL, so this isn't a
      // schema-aware P2002 — it's a raw Postgres unique_violation Prisma
      // still surfaces as P2002 regardless) catches the second one here.
      if (isUniqueConstraintViolation(error)) {
        throw new ConflictException('You have already sent an interest to this profile');
      }
      throw error;
    }
  }

  // Single transaction: the flow's core requirement. If any step fails, the
  // interest status update, the Conversation, and both
  // ConversationParticipant rows all roll back together — never a
  // half-created conversation with no participants, or an accepted interest
  // with no conversation behind it.
  async accept(callerUserId: string, interestId: string) {
    const interest = await this.getInterestOrThrow(interestId);
    if (interest.targetId !== callerUserId) {
      throw new ForbiddenException('Only the recipient can accept this interest');
    }
    if (interest.status !== 'PENDING') {
      throw new ConflictException('This interest is no longer pending');
    }

    const result = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.interest.update({
        where: { id: interestId },
        data: { status: 'ACCEPTED', respondedAt: new Date() },
      });
      const conversation = await tx.conversation.create({
        data: { interestId: updated.id },
      });
      await tx.conversationParticipant.createMany({
        data: [
          { conversationId: conversation.id, userId: interest.senderId },
          { conversationId: conversation.id, userId: interest.targetId },
        ],
      });
      return { interest: updated, conversationId: conversation.id };
    });

    return {
      id: result.interest.id,
      status: result.interest.status,
      conversationId: result.conversationId,
    };
  }

  async decline(callerUserId: string, interestId: string) {
    const interest = await this.getInterestOrThrow(interestId);
    if (interest.targetId !== callerUserId) {
      throw new ForbiddenException('Only the recipient can decline this interest');
    }
    if (interest.status !== 'PENDING') {
      throw new ConflictException('This interest is no longer pending');
    }

    const updated = await this.prisma.interest.update({
      where: { id: interestId },
      data: { status: 'DECLINED', respondedAt: new Date() },
    });
    return { id: updated.id, status: updated.status };
  }

  // "Withdraw" updates status rather than deleting the row — InterestStatus
  // has a dedicated WITHDRAWN value, and the (senderId, targetId) unique
  // constraint means the row must stay around as the permanent record of
  // this pair regardless (see the comment in sendInterest).
  async withdraw(callerUserId: string, interestId: string) {
    const interest = await this.getInterestOrThrow(interestId);
    if (interest.senderId !== callerUserId) {
      throw new ForbiddenException('Only the sender can withdraw this interest');
    }
    if (interest.status !== 'PENDING') {
      throw new ConflictException('Only a pending interest can be withdrawn');
    }

    const updated = await this.prisma.interest.update({
      where: { id: interestId },
      data: { status: 'WITHDRAWN', respondedAt: new Date() },
    });
    return { id: updated.id, status: updated.status };
  }

  async listForUser(callerUserId: string) {
    const [sentRows, receivedRows] = await Promise.all([
      this.prisma.interest.findMany({ where: { senderId: callerUserId }, orderBy: { createdAt: 'desc' } }),
      this.prisma.interest.findMany({ where: { targetId: callerUserId }, orderBy: { createdAt: 'desc' } }),
    ]);

    const otherUserIds = [
      ...new Set([...sentRows.map((row) => row.targetId), ...receivedRows.map((row) => row.senderId)]),
    ];
    const parties = await this.resolveParties(otherUserIds);
    const selfParty = await this.resolveParties([callerUserId]);
    const self = selfParty.get(callerUserId);

    const toResponse = (row: (typeof sentRows)[number], other: InterestParty | undefined) => ({
      id: row.id,
      status: row.status,
      createdAt: row.createdAt.toISOString(),
      respondedAt: row.respondedAt?.toISOString() ?? null,
      sender: row.senderId === callerUserId ? (self ?? unknownParty()) : (other ?? unknownParty()),
      target: row.targetId === callerUserId ? (self ?? unknownParty()) : (other ?? unknownParty()),
    });

    return {
      sent: sentRows.map((row) => toResponse(row, parties.get(row.targetId))),
      received: receivedRows.map((row) => toResponse(row, parties.get(row.senderId))),
    };
  }

  private async getInterestOrThrow(interestId: string) {
    const interest = await this.prisma.interest.findUnique({ where: { id: interestId } });
    if (!interest) {
      throw new NotFoundException('Interest not found');
    }
    return interest;
  }

  private async resolveParties(userIds: string[]): Promise<Map<string, InterestParty>> {
    const profiles = await this.prisma.profile.findMany({ where: { userId: { in: userIds } } });
    const result = new Map<string, InterestParty>();
    for (const profile of profiles) {
      const photos = await this.photosService.getPhotosForProfile(profile.id);
      const primaryPhotoUrl = photos.find((photo) => photo.isPrimary)?.url ?? photos[0]?.url ?? null;
      result.set(profile.userId, {
        profileId: profile.id,
        fullName: profile.fullName,
        age: calculateAge(profile.dateOfBirth),
        primaryPhotoUrl,
      });
    }
    return result;
  }
}

function unknownParty(): InterestParty {
  return { profileId: '', fullName: 'Unknown', age: 0, primaryPhotoUrl: null };
}
