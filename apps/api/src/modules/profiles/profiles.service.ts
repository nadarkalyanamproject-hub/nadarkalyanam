import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import {
  DEFAULT_PHONE_VISIBILITY,
  NET_WORTH_FAMILY_STATUS,
  PRIOR_MARRIAGE_STATUSES,
  type CreateProfileRequest,
  type Lifestyle,
  type PhoneVisibility,
  type ProfileVisibility,
} from '@nadar-kalyanam/schemas';
import { computeCompletionScore } from '../../common/profile-completion.js';
import { visibleProfilesWhere } from '../../common/profile-cards.js';
import { getRelationshipStates, type RelationshipState } from '../../common/relationship.js';
import { PrismaService } from '../prisma/prisma.service.js';

// What an update falls back to for a part the request leaves out, so saving
// one section never wipes another.
type Kept = { lifestyle?: CreateProfileRequest['lifestyle']; profileFor?: CreateProfileRequest['profileFor'] };

function buildProfileData(input: CreateProfileRequest, kept: Kept = {}) {
  const { fullName, gender, dateOfBirth, religion, casteCommunity, email, personal, location } = input;
  const lifestyle = input.lifestyle ?? kept.lifestyle;
  const profileFor = input.profileFor ?? kept.profileFor;
  // Net worth is asked only of rich families; drop it for any other status.
  const additional =
    input.additional.familyType === NET_WORTH_FAMILY_STATUS ? input.additional : { ...input.additional, netWorth: undefined };
  const { height, physicalStatus, complexion, maritalStatus, dosham } = personal;
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
    // Mother tongue is no longer asked, so a profile saved now has none.
    details: {
      ...(profileFor ? { profileFor } : {}),
      email,
      height,
      physicalStatus,
      complexion,
      maritalStatus,
      religion,
      casteCommunity,
      dosham,
      previousMarriageDetails,
      doshamDetails,
      location: { city, state, country },
      education: { educationLevel, educationDetail, profession, employedIn, annualIncomeRange, annualIncomeCurrency },
      additional,
      ...(lifestyle ? { lifestyle } : {}),
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

  // After DigiLocker, the ID's name and date of birth replace whatever was
  // sent: members can't change them (VerificationService sets them).
  private async withVerifiedIdentity<T extends { fullName: string; dateOfBirth: Date }>(userId: string, data: T): Promise<T & { isVerified?: true }> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { identityVerifiedAt: true, identityName: true, identityDateOfBirth: true },
    });
    if (!user?.identityVerifiedAt || !user.identityName || !user.identityDateOfBirth) return data;
    return { ...data, fullName: user.identityName, dateOfBirth: user.identityDateOfBirth, isVerified: true };
  }

  async createProfile(userId: string, input: CreateProfileRequest) {
    const existing = await this.prisma.profile.findUnique({ where: { userId } });
    if (existing) {
      throw new ConflictException('Profile already exists for this user');
    }

    // A brand-new profile has no photos yet.
    const data = await this.withVerifiedIdentity(userId, buildProfileData(input));
    return this.prisma.profile.create({
      // Nobody shares their phone number until they turn it on.
      data: { userId, ...data, phoneVisibility: DEFAULT_PHONE_VISIBILITY, completionScore: computeCompletionScore(data, 0) },
    });
  }

  async updateProfile(userId: string, input: CreateProfileRequest) {
    const existing = await this.prisma.profile.findUnique({ where: { userId } });
    if (!existing) {
      throw new NotFoundException('Profile not found for this user');
    }

    const kept = (existing.details as Kept | null) ?? {};
    const data = await this.withVerifiedIdentity(userId, buildProfileData(input, kept));
    const photoCount = await this.prisma.profilePhoto.count({ where: { profileId: existing.id } });
    return this.prisma.profile.update({
      where: { userId },
      data: { ...data, completionScore: computeCompletionScore(data, photoCount) },
    });
  }

  // Lifestyle & Habits only: merged into the stored details, leaving every
  // other field (and the completion score, which doesn't count it) untouched.
  async updateLifestyle(userId: string, lifestyle: Lifestyle) {
    const existing = await this.prisma.profile.findUnique({ where: { userId } });
    if (!existing) {
      throw new NotFoundException('Profile not found for this user');
    }
    const details = (existing.details ?? {}) as Record<string, unknown>;
    return this.prisma.profile.update({ where: { userId }, data: { details: { ...details, lifestyle } } });
  }

  async updateVisibility(userId: string, visibility: ProfileVisibility) {
    const existing = await this.prisma.profile.findUnique({ where: { userId } });
    if (!existing) {
      throw new NotFoundException('Profile not found for this user');
    }
    return this.prisma.profile.update({ where: { userId }, data: { visibility } });
  }

  // The owner's consent for connected paid members to unlock their phone
  // number. Takes effect immediately, including over earlier unlocks.
  async updatePhoneVisibility(userId: string, phoneVisibility: PhoneVisibility) {
    const existing = await this.prisma.profile.findUnique({ where: { userId } });
    if (!existing) {
      throw new NotFoundException('Profile not found for this user');
    }
    return this.prisma.profile.update({ where: { userId }, data: { phoneVisibility } });
  }

  // "Browse Profiles" list: the app-wide visibility rule (visibleProfilesWhere,
  // shared with search, matches and shortlists) — never the caller, never
  // anyone blocked in either direction, never a HIDDEN profile, never an
  // account that isn't ACTIVE. MEMBERS_ONLY is included: every caller is a
  // signed-in member.
  async listOtherProfiles(callerUserId: string, offset: number, limit: number) {
    const where = await visibleProfilesWhere(this.prisma, callerUserId);

    const [profiles, total] = await Promise.all([
      // Plan tier first (spotlight, priority, standard), then newest; id
      // makes the order total so offset pages never skip or repeat.
      this.prisma.profile.findMany({
        where,
        orderBy: [{ searchBoost: 'desc' }, { createdAt: 'desc' }, { id: 'asc' }],
        skip: offset,
        take: limit,
      }),
      this.prisma.profile.count({ where }),
    ]);

    return { profiles, total };
  }

  // Same rule as listOtherProfiles, in one query, so a hidden, blocked,
  // inactive or nonexistent profile id all 404 identically — never confirm
  // *why* a profile id doesn't resolve.
  async getOtherProfile(callerUserId: string, profileId: string) {
    const profile = await this.prisma.profile.findFirst({
      where: { AND: [await visibleProfilesWhere(this.prisma, callerUserId), { id: profileId }] },
    });
    if (!profile) {
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
