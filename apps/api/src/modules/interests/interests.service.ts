import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { Connection, ListConnectionsResponse } from '@nadar-kalyanam/schemas';
import { calculateAge } from '../../common/age.js';
import { getBlockedUserIds, isBlockedEitherDirection } from '../../common/blocks.util.js';
import { getRelationshipStates } from '../../common/relationship.js';
import { Prisma } from '../../generated/prisma/client.js';
import { NotificationsService } from '../notifications/notifications.service.js';
import { PhotosService } from '../photos/photos.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { ProfilesService } from '../profiles/profiles.service.js';
import { toPublicProfileSummary } from '../profiles/public-profile.mapper.js';

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
    private readonly notifications: NotificationsService,
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

    // Relationship rules that look at BOTH directions (the per-direction
    // rules below only ever saw the caller's own rows, which is how an
    // already-connected pair could get a second, reverse interest):
    //  - an ACCEPTED interest either way means the pair is already connected;
    //  - a PENDING interest from them to the caller should be answered, not
    //    crossed with a second pending one the other way. (Product
    //    assumption — this could instead auto-accept theirs.)
    const relationship = (await getRelationshipStates(this.prisma, callerUserId, [targetProfile.userId])).get(
      targetProfile.userId,
    );
    if (relationship?.status === 'CONNECTED') {
      throw new ConflictException('You are already connected with this member');
    }
    if (relationship?.status === 'INTEREST_RECEIVED') {
      throw new ConflictException(
        'This member has already sent you an interest - accept it from your Interests page',
      );
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
      this.notifications.notify({
        recipientUserId: targetProfile.userId,
        actorUserId: callerUserId,
        type: 'INTEREST_RECEIVED',
        targetType: 'Interest',
        targetId: interest.id,
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
      // Acting on the interest also clears the accepter's notification
      // about it (same transaction; no row to clear is fine).
      await this.notifications.markTargetRead(
        { userId: callerUserId, type: 'INTEREST_RECEIVED', targetType: 'Interest', targetId: interestId },
        tx,
      );
      return { interest: updated, conversationId: conversation.id };
    });

    // The accepter doesn't get a CONNECTED notice — they just did it; the
    // original sender hears about it, pointed at the new conversation.
    this.notifications.notify({
      recipientUserId: interest.senderId,
      actorUserId: callerUserId,
      type: 'INTEREST_ACCEPTED',
      targetType: 'Conversation',
      targetId: result.conversationId,
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

  // The header's "new interests" dot: any PENDING interest to the caller
  // that arrived after they last opened the Interests page (or ever, if they
  // never have). Senders who are now blocked (either direction) or no longer
  // active don't count — they aren't something to act on.
  async hasUnread(callerUserId: string): Promise<{ hasUnread: boolean }> {
    const [user, blocked] = await Promise.all([
      this.prisma.user.findUnique({ where: { id: callerUserId }, select: { lastViewedInterestsAt: true } }),
      getBlockedUserIds(this.prisma, callerUserId),
    ]);
    const lastViewed = user?.lastViewedInterestsAt ?? null;
    const newer = await this.prisma.interest.findFirst({
      where: {
        targetId: callerUserId,
        status: 'PENDING',
        ...(lastViewed ? { createdAt: { gt: lastViewed } } : {}),
        sender: { status: 'ACTIVE', id: { notIn: [...blocked] } },
      },
      select: { id: true },
    });
    return { hasUnread: Boolean(newer) };
  }

  // Recorded when the member opens /interests: everything pending right now
  // counts as seen (whether or not it's been acted on).
  async markViewed(callerUserId: string): Promise<{ viewedAt: string }> {
    const viewedAt = new Date();
    await this.prisma.user.update({ where: { id: callerUserId }, data: { lastViewedInterestsAt: viewedAt } });
    return { viewedAt: viewedAt.toISOString() };
  }

  // Interests with a member blocked in either direction are left out (the
  // same blocked set every other list uses); unblocking brings them back.
  async listForUser(callerUserId: string) {
    const blocked = [...(await getBlockedUserIds(this.prisma, callerUserId))];
    const [sentRows, receivedRows] = await Promise.all([
      this.prisma.interest.findMany({
        where: { senderId: callerUserId, targetId: { notIn: blocked } },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.interest.findMany({
        where: { targetId: callerUserId, senderId: { notIn: blocked } },
        orderBy: { createdAt: 'desc' },
      }),
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

  // The caller's connections: every ACCEPTED interest in either direction,
  // most recently connected first. Same exclusions as the other member
  // lists (blocked in either direction, non-ACTIVE accounts, no profile),
  // except HIDDEN visibility — hiding yourself from discovery doesn't hide
  // you from someone you're already connected with. Mapped through the same
  // privacy-safe public summary as browse (never email / dateOfBirth).
  async listConnections(callerUserId: string, offset: number, limit: number): Promise<ListConnectionsResponse> {
    const blockedUserIds = [...(await getBlockedUserIds(this.prisma, callerUserId))];
    const eligibleOther: Prisma.UserWhereInput = {
      status: 'ACTIVE',
      id: { notIn: blockedUserIds },
      profile: { isNot: null },
    };
    const where: Prisma.InterestWhereInput = {
      status: 'ACCEPTED',
      conversation: { isNot: null },
      OR: [
        { senderId: callerUserId, target: eligibleOther },
        { targetId: callerUserId, sender: eligibleOther },
      ],
    };

    const [rows, total] = await Promise.all([
      this.prisma.interest.findMany({
        where,
        orderBy: [{ respondedAt: 'desc' }, { id: 'asc' }],
        skip: offset,
        take: limit,
        select: {
          senderId: true,
          targetId: true,
          createdAt: true,
          respondedAt: true,
          conversation: { select: { id: true } },
        },
      }),
      this.prisma.interest.count({ where }),
    ]);

    const otherUserIds = rows.map((row) => (row.senderId === callerUserId ? row.targetId : row.senderId));
    const profiles = otherUserIds.length
      ? await this.prisma.profile.findMany({ where: { userId: { in: otherUserIds } } })
      : [];
    const profilesByUserId = new Map(profiles.map((profile) => [profile.userId, profile]));

    const seen = new Set<string>();
    const items: Connection[] = [];
    for (const [index, row] of rows.entries()) {
      const otherUserId = otherUserIds[index];
      const profile = profilesByUserId.get(otherUserId);
      // A pair connected by two ACCEPTED rows (possible only for data from
      // before sendInterest refused reverse interests) is listed once.
      if (!profile || !row.conversation || seen.has(otherUserId)) continue;
      seen.add(otherUserId);
      const photos = await this.photosService.getPhotosForProfile(profile.id);
      const primaryPhotoUrl = photos.find((photo) => photo.isPrimary)?.url ?? photos[0]?.url ?? null;
      items.push({
        ...toPublicProfileSummary(profile, primaryPhotoUrl, {
          status: 'CONNECTED',
          conversationId: row.conversation.id,
        }),
        conversationId: row.conversation.id,
        connectedAt: (row.respondedAt ?? row.createdAt).toISOString(),
      });
    }

    const nextOffset = offset + rows.length < total ? offset + rows.length : null;
    return { items, total, nextOffset };
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
