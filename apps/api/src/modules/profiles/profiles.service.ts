import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PRIOR_MARRIAGE_STATUSES, type CreateProfileRequest } from '@nadar-kalyanam/schemas';
import { getBlockedUserIds, isBlockedEitherDirection } from '../../common/blocks.util.js';
import { getRelationshipStates, type RelationshipState } from '../../common/relationship.js';
import { PrismaService } from '../prisma/prisma.service.js';

function buildProfileData(input: CreateProfileRequest) {
  const { fullName, gender, dateOfBirth, motherTongue, email, personal, location, additional } = input;
  const { height, physicalStatus, maritalStatus, religion, casteCommunity, dosham } = personal;
  // The detail fields only mean something while their parent says so; drop
  // them otherwise so no client can leave a stale, hidden value behind.
  const previousMarriageDetails = PRIOR_MARRIAGE_STATUSES.includes(maritalStatus)
    ? (personal.previousMarriageDetails ?? '')
    : '';
  const doshamDetails = dosham === 'YES' ? (personal.doshamDetails ?? '') : '';
  const { city, state, country, educationLevel, educationDetail, profession, employedIn, annualIncomeRange, annualIncomeCurrency } =
    location;

  return {
    fullName,
    gender,
    dateOfBirth: new Date(dateOfBirth),
    details: {
      motherTongue,
      email,
      height,
      physicalStatus,
      maritalStatus,
      religion,
      casteCommunity,
      dosham,
      previousMarriageDetails,
      doshamDetails,
      location: { city, state, country },
      education: { educationLevel, educationDetail, profession, employedIn, annualIncomeRange, annualIncomeCurrency },
      additional,
    },
  };
}

@Injectable()
export class ProfilesService {
  constructor(private readonly prisma: PrismaService) {}

  async getMyProfile(userId: string) {
    const profile = await this.prisma.profile.findUnique({ where: { userId } });
    if (!profile) {
      throw new NotFoundException('Profile not found for this user');
    }
    return profile;
  }

  async createProfile(userId: string, input: CreateProfileRequest) {
    const existing = await this.prisma.profile.findUnique({ where: { userId } });
    if (existing) {
      throw new ConflictException('Profile already exists for this user');
    }

    return this.prisma.profile.create({
      data: { userId, ...buildProfileData(input) },
    });
  }

  async updateProfile(userId: string, input: CreateProfileRequest) {
    const existing = await this.prisma.profile.findUnique({ where: { userId } });
    if (!existing) {
      throw new NotFoundException('Profile not found for this user');
    }

    // completionScore is intentionally left untouched here — it is a
    // known pre-existing gap (hardcoded to 0 on creation, never actually
    // calculated) and out of scope for this edit endpoint.
    return this.prisma.profile.update({
      where: { userId },
      data: buildProfileData(input),
    });
  }

  // "Browse Profiles" list: everyone except the caller, profiles the caller
  // has hidden themselves from (visibility HIDDEN), and anyone blocked in
  // either direction. MEMBERS_ONLY is intentionally included — there's no
  // tiered membership system yet to distinguish further, so any
  // authenticated caller counts as a member.
  async listOtherProfiles(callerUserId: string, offset: number, limit: number) {
    const blockedUserIds = await getBlockedUserIds(this.prisma, callerUserId);
    const where = {
      userId: { notIn: [callerUserId, ...blockedUserIds] },
      visibility: { not: 'HIDDEN' as const },
    };

    const [profiles, total] = await Promise.all([
      this.prisma.profile.findMany({ where, orderBy: { createdAt: 'desc' }, skip: offset, take: limit }),
      this.prisma.profile.count({ where }),
    ]);

    return { profiles, total };
  }

  // Same exclusion rules as listOtherProfiles, collapsed to a single 404 so a
  // hidden, blocked, or nonexistent profile id all look identical from the
  // outside — never confirm *why* a profile id doesn't resolve.
  async getOtherProfile(callerUserId: string, profileId: string) {
    const profile = await this.prisma.profile.findUnique({ where: { id: profileId } });
    if (!profile || profile.userId === callerUserId || profile.visibility === 'HIDDEN') {
      throw new NotFoundException('Profile not found');
    }
    if (await isBlockedEitherDirection(this.prisma, callerUserId, profile.userId)) {
      throw new NotFoundException('Profile not found');
    }
    return profile;
  }

  // Backs relationshipStatus (and the legacy hasSentInterest) on browse
  // list/detail responses — interests in BOTH directions, one batched query
  // per page. Delegates to the shared helper also used by discovery,
  // matching and InterestsService; reads prisma.interest directly rather
  // than depending on InterestsService, since InterestsModule already
  // imports ProfilesModule (the reverse would be circular).
  getRelationshipStates(callerUserId: string, otherUserIds: string[]): Promise<Map<string, RelationshipState>> {
    return getRelationshipStates(this.prisma, callerUserId, otherUserIds);
  }

  // Used by InterestsService for the self-check ("your own profileId !==
  // targetProfileId") and to resolve the caller's userId-keyed Interest rows
  // back to a profileId.
  async getOwnProfileOrThrow(userId: string) {
    const profile = await this.prisma.profile.findUnique({ where: { userId } });
    if (!profile) {
      throw new BadRequestException('Complete your profile before sending interests');
    }
    return profile;
  }
}
