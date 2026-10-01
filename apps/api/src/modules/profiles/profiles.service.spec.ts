import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { createProfileSchema, type CreateProfileRequest } from '@nadar-kalyanam/schemas';
import { describe, expect, it, vi } from 'vitest';
import { ProfilesService } from './profiles.service.js';

const validPayload: CreateProfileRequest = {
  fullName: 'Meena Kumari',
  gender: 'FEMALE',
  dateOfBirth: '1998-04-12',
  motherTongue: 'Tamil',
  email: 'meena.kumari@example.com',
  personal: {
    height: `5'4" (163 cm)`,
    physicalStatus: 'NORMAL',
    maritalStatus: 'NEVER_MARRIED',
    religion: 'Hindu',
    casteCommunity: 'Nadar',
    dosham: 'NO',
    previousMarriageDetails: '',
    doshamDetails: '',
  },
  location: {
    city: 'Chennai',
    state: 'Tamil Nadu',
    country: 'India',
    educationLevel: 'Bachelors',
    educationDetail: 'B.Tech Computer Science',
    profession: 'Software Engineer',
    employedIn: 'Private',
    annualIncomeRange: '10-15 LPA',
    annualIncomeCurrency: 'INR',
  },
  additional: {
    familyType: 'Middle Class',
    about:
      'Looking for a like-minded partner who values family, honesty and shared growth in life together.',
  },
};

const storedProfile = {
  id: 'profile-1',
  userId: 'user-1',
  fullName: 'Meena Kumari',
  gender: 'FEMALE',
  dateOfBirth: new Date('1998-04-12'),
  completionScore: 40,
  details: {
    motherTongue: 'Tamil',
    email: 'meena.kumari@example.com',
    height: `5'4" (163 cm)`,
    physicalStatus: 'NORMAL',
    maritalStatus: 'NEVER_MARRIED',
    religion: 'Hindu',
    casteCommunity: 'Nadar',
    dosham: 'NO',
    location: { city: 'Chennai', state: 'Tamil Nadu', country: 'India' },
    education: {
      educationLevel: 'Bachelors',
      educationDetail: 'B.Tech Computer Science',
      profession: 'Software Engineer',
      employedIn: 'Private',
      annualIncomeRange: '10-15 LPA',
      annualIncomeCurrency: 'INR',
    },
    additional: validPayload.additional,
  },
};

function buildService() {
  const prisma = {
    profile: {
      findUnique: vi.fn().mockResolvedValue(null),
      create: vi.fn().mockResolvedValue({ id: 'profile-1', completionScore: 40 }),
      update: vi.fn().mockResolvedValue({ ...storedProfile, completionScore: 40 }),
      findMany: vi.fn().mockResolvedValue([]),
      count: vi.fn().mockResolvedValue(0),
    },
    block: {
      findMany: vi.fn().mockResolvedValue([]),
      findFirst: vi.fn().mockResolvedValue(null),
    },
    interest: {
      findMany: vi.fn().mockResolvedValue([]),
    },
    profilePhoto: {
      count: vi.fn().mockResolvedValue(0),
    },
  };
  const service = new ProfilesService(prisma as never);
  return { service, prisma };
}

describe('createProfileSchema', () => {
  it('rejects a payload missing a required field', () => {
    const withoutFullName: Record<string, unknown> = { ...validPayload };
    delete withoutFullName.fullName;

    const result = createProfileSchema.safeParse(withoutFullName);

    expect(result.success).toBe(false);
  });

  it('accepts a fully populated payload', () => {
    const result = createProfileSchema.safeParse(validPayload);
    expect(result.success).toBe(true);
  });

  it('accepts a payload without the optional dosham field', () => {
    const personalWithoutDosham: Record<string, unknown> = { ...validPayload.personal };
    delete personalWithoutDosham.dosham;
    const result = createProfileSchema.safeParse({ ...validPayload, personal: personalWithoutDosham });
    expect(result.success).toBe(true);
  });

  it('rejects an about section under the 50-character minimum', () => {
    const result = createProfileSchema.safeParse({
      ...validPayload,
      additional: { ...validPayload.additional, about: 'Too short.' },
    });
    expect(result.success).toBe(false);
  });

  it('rejects an invalid email address', () => {
    const result = createProfileSchema.safeParse({ ...validPayload, email: 'not-an-email' });
    expect(result.success).toBe(false);
  });

  it('strips removed lifestyle fields even if a client still sends them', () => {
    const result = createProfileSchema.safeParse({
      ...validPayload,
      additional: {
        ...validPayload.additional,
        familyValues: 'Traditional',
        diet: 'Vegetarian',
        smokingHabit: 'No',
        drinkingHabit: 'No',
      },
    });
    expect(result.success).toBe(true);
    expect(result.success && result.data.additional).toEqual(validPayload.additional);
  });

  it('rejects a familyType value outside the three allowed options', () => {
    const result = createProfileSchema.safeParse({
      ...validPayload,
      additional: { ...validPayload.additional, familyType: 'Nuclear' },
    });
    expect(result.success).toBe(false);
  });

  it('accepts each of the three allowed familyType values', () => {
    for (const familyType of ['Middle Class', 'Upper Middle Class', 'Rich / Affluent (Elite)']) {
      const result = createProfileSchema.safeParse({
        ...validPayload,
        additional: { ...validPayload.additional, familyType },
      });
      expect(result.success).toBe(true);
    }
  });

  it('treats previousMarriageDetails and doshamDetails as optional (defaulting to empty)', () => {
    const personal: Record<string, unknown> = { ...validPayload.personal };
    delete personal.previousMarriageDetails;
    delete personal.doshamDetails;
    const result = createProfileSchema.safeParse({ ...validPayload, personal });
    expect(result.success).toBe(true);
    expect(result.success && result.data.personal.previousMarriageDetails).toBe('');
    expect(result.success && result.data.personal.doshamDetails).toBe('');
  });

  it('accepts previousMarriageDetails and doshamDetails up to 500 characters', () => {
    const result = createProfileSchema.safeParse({
      ...validPayload,
      personal: {
        ...validPayload.personal,
        maritalStatus: 'DIVORCED',
        previousMarriageDetails: 'x'.repeat(500),
        dosham: 'YES',
        doshamDetails: 'Chevvai dosham',
      },
    });
    expect(result.success).toBe(true);
  });

  it('rejects over-length previousMarriageDetails and doshamDetails', () => {
    for (const key of ['previousMarriageDetails', 'doshamDetails']) {
      const result = createProfileSchema.safeParse({
        ...validPayload,
        personal: { ...validPayload.personal, [key]: 'x'.repeat(501) },
      });
      expect(result.success).toBe(false);
    }
  });

  it('defaults country to India when omitted', () => {
    const locationWithoutCountry: Record<string, unknown> = { ...validPayload.location };
    delete locationWithoutCountry.country;
    const result = createProfileSchema.safeParse({ ...validPayload, location: locationWithoutCountry });
    expect(result.success && result.data.location.country).toBe('India');
  });
});

describe('ProfilesService', () => {
  it('persists the required scalar fields and nests the rest under details', async () => {
    const { service, prisma } = buildService();

    await service.createProfile('user-1', validPayload);

    expect(prisma.profile.create).toHaveBeenCalledWith({
      data: {
        userId: 'user-1',
        fullName: 'Meena Kumari',
        gender: 'FEMALE',
        dateOfBirth: new Date('1998-04-12'),
        details: {
          motherTongue: 'Tamil',
          email: 'meena.kumari@example.com',
          height: `5'4" (163 cm)`,
          physicalStatus: 'NORMAL',
          maritalStatus: 'NEVER_MARRIED',
          religion: 'Hindu',
          casteCommunity: 'Nadar',
          dosham: 'NO',
          previousMarriageDetails: '',
          doshamDetails: '',
          location: { city: 'Chennai', state: 'Tamil Nadu', country: 'India' },
          education: {
            educationLevel: 'Bachelors',
            educationDetail: 'B.Tech Computer Science',
            profession: 'Software Engineer',
            employedIn: 'Private',
            annualIncomeRange: '10-15 LPA',
            annualIncomeCurrency: 'INR',
          },
          additional: validPayload.additional,
        },
        // Every counted field is filled; no photo yet: 20 of 21.
        completionScore: 95,
      },
    });
  });

  it('stores the detail fields when their parent calls for them', async () => {
    const { service, prisma } = buildService();
    const personal = {
      ...validPayload.personal,
      maritalStatus: 'WIDOWED' as const,
      previousMarriageDetails: 'Widowed in 2020, one child',
      dosham: 'YES' as const,
      doshamDetails: 'Chevvai dosham',
    };

    await service.createProfile('user-1', { ...validPayload, personal });

    const details = prisma.profile.create.mock.calls[0][0].data.details;
    expect(details.previousMarriageDetails).toBe('Widowed in 2020, one child');
    expect(details.doshamDetails).toBe('Chevvai dosham');
  });

  it('drops the detail fields when their parent no longer calls for them', async () => {
    const { service, prisma } = buildService();
    prisma.profile.findUnique.mockResolvedValueOnce({ id: 'profile-1' });
    const personal = {
      ...validPayload.personal,
      maritalStatus: 'NEVER_MARRIED' as const,
      previousMarriageDetails: 'stale',
      dosham: 'DONT_KNOW' as const,
      doshamDetails: 'stale',
    };

    await service.updateProfile('user-1', { ...validPayload, personal });

    const details = prisma.profile.update.mock.calls[0][0].data.details;
    expect(details.previousMarriageDetails).toBe('');
    expect(details.doshamDetails).toBe('');
  });

  it('rejects creating a second profile for the same user', async () => {
    const { service, prisma } = buildService();
    prisma.profile.findUnique.mockResolvedValueOnce({ id: 'existing-profile' });

    await expect(service.createProfile('user-1', validPayload)).rejects.toBeInstanceOf(
      ConflictException,
    );
    expect(prisma.profile.create).not.toHaveBeenCalled();
  });
});

describe('ProfilesService.getMyProfile', () => {
  it('returns the profile row for the authenticated user', async () => {
    const { service, prisma } = buildService();
    prisma.profile.findUnique.mockResolvedValueOnce(storedProfile);

    const result = await service.getMyProfile('user-1');

    expect(prisma.profile.findUnique).toHaveBeenCalledWith({ where: { userId: 'user-1' } });
    expect(result).toEqual(storedProfile);
  });

  it('throws NotFoundException when no profile exists for the user', async () => {
    const { service, prisma } = buildService();
    prisma.profile.findUnique.mockResolvedValueOnce(null);

    await expect(service.getMyProfile('user-without-profile')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });
});

describe('ProfilesService.updateProfile', () => {
  it('updates the existing row with the same field mapping used on creation', async () => {
    const { service, prisma } = buildService();
    prisma.profile.findUnique.mockResolvedValueOnce({ id: 'profile-1' });

    const updatedPayload: CreateProfileRequest = {
      ...validPayload,
      fullName: 'Meena K. Nair',
      personal: { ...validPayload.personal, religion: 'Christian' },
    };

    await service.updateProfile('user-1', updatedPayload);

    expect(prisma.profile.update).toHaveBeenCalledWith({
      where: { userId: 'user-1' },
      data: {
        fullName: 'Meena K. Nair',
        gender: 'FEMALE',
        dateOfBirth: new Date('1998-04-12'),
        details: {
          motherTongue: 'Tamil',
          email: 'meena.kumari@example.com',
          height: `5'4" (163 cm)`,
          physicalStatus: 'NORMAL',
          maritalStatus: 'NEVER_MARRIED',
          religion: 'Christian',
          casteCommunity: 'Nadar',
          dosham: 'NO',
          previousMarriageDetails: '',
          doshamDetails: '',
          location: { city: 'Chennai', state: 'Tamil Nadu', country: 'India' },
          education: {
            educationLevel: 'Bachelors',
            educationDetail: 'B.Tech Computer Science',
            profession: 'Software Engineer',
            employedIn: 'Private',
            annualIncomeRange: '10-15 LPA',
            annualIncomeCurrency: 'INR',
          },
          additional: validPayload.additional,
        },
        // Every counted field is filled; no photo yet: 20 of 21.
        completionScore: 95,
      },
    });
  });

  it('recomputes completionScore from the saved fields and the photo count', async () => {
    const { service, prisma } = buildService();
    prisma.profile.findUnique.mockResolvedValue({ id: 'profile-1' });
    prisma.profilePhoto.count.mockResolvedValue(1);

    await service.updateProfile('user-1', validPayload);
    expect(prisma.profile.update.mock.calls[0][0].data.completionScore).toBe(100);
    expect(prisma.profilePhoto.count).toHaveBeenCalledWith({ where: { profileId: 'profile-1' } });

    // Clearing two optional fields lowers it: 19 of 21.
    await service.updateProfile('user-1', {
      ...validPayload,
      location: { ...validPayload.location, employedIn: '', annualIncomeRange: '' },
    });
    expect(prisma.profile.update.mock.calls[1][0].data.completionScore).toBe(90);
  });

  it('throws NotFoundException when no profile exists for the user', async () => {
    const { service, prisma } = buildService();
    prisma.profile.findUnique.mockResolvedValueOnce(null);

    await expect(service.updateProfile('user-without-profile', validPayload)).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(prisma.profile.update).not.toHaveBeenCalled();
  });
});

describe('ProfilesService.listOtherProfiles', () => {
  it('excludes the caller, blocked users in either direction, and hidden profiles via one query', async () => {
    const { service, prisma } = buildService();
    prisma.block.findMany.mockResolvedValueOnce([
      { initiatorId: 'caller-1', targetId: 'blocked-by-me' },
      { initiatorId: 'blocked-me', targetId: 'caller-1' },
    ]);
    prisma.profile.findMany.mockResolvedValueOnce([storedProfile]);
    prisma.profile.count.mockResolvedValueOnce(1);

    const result = await service.listOtherProfiles('caller-1', 0, 20);

    expect(prisma.profile.findMany).toHaveBeenCalledWith({
      where: {
        userId: { notIn: ['caller-1', 'blocked-by-me', 'blocked-me'] },
        visibility: { not: 'HIDDEN' },
      },
      orderBy: { createdAt: 'desc' },
      skip: 0,
      take: 20,
    });
    expect(result.profiles).toEqual([storedProfile]);
    expect(result.total).toBe(1);
  });
});

describe('ProfilesService.getOtherProfile', () => {
  it('returns the profile when visible, not the caller\'s own, and not blocked', async () => {
    const { service, prisma } = buildService();
    prisma.profile.findUnique.mockResolvedValueOnce({ ...storedProfile, visibility: 'PUBLIC' });

    const result = await service.getOtherProfile('caller-1', 'profile-1');

    expect(result).toMatchObject({ id: 'profile-1' });
  });

  it('404s for a hidden profile rather than revealing why it is excluded', async () => {
    const { service, prisma } = buildService();
    prisma.profile.findUnique.mockResolvedValueOnce({ ...storedProfile, visibility: 'HIDDEN' });

    await expect(service.getOtherProfile('caller-1', 'profile-1')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('404s for the caller\'s own profile id', async () => {
    const { service, prisma } = buildService();
    prisma.profile.findUnique.mockResolvedValueOnce({ ...storedProfile, userId: 'caller-1' });

    await expect(service.getOtherProfile('caller-1', 'profile-1')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('404s when the target user has blocked the caller, or vice versa', async () => {
    const { service, prisma } = buildService();
    prisma.profile.findUnique.mockResolvedValueOnce({ ...storedProfile, visibility: 'PUBLIC' });
    prisma.block.findFirst.mockResolvedValueOnce({ id: 'block-1' });

    await expect(service.getOtherProfile('caller-1', 'profile-1')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('404s for a profile id that does not exist', async () => {
    const { service, prisma } = buildService();
    prisma.profile.findUnique.mockResolvedValueOnce(null);

    await expect(service.getOtherProfile('caller-1', 'no-such-profile')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });
});

describe('ProfilesService.getRelationshipStates', () => {
  it('queries interests in BOTH directions in one batched query', async () => {
    const { service, prisma } = buildService();

    await service.getRelationshipStates('caller-1', ['user-b', 'user-c']);

    expect(prisma.interest.findMany).toHaveBeenCalledTimes(1);
    expect(prisma.interest.findMany.mock.calls[0][0].where).toEqual({
      status: { in: ['PENDING', 'ACCEPTED'] },
      OR: [
        { senderId: 'caller-1', targetId: { in: ['user-b', 'user-c'] } },
        { targetId: 'caller-1', senderId: { in: ['user-b', 'user-c'] } },
      ],
    });
  });

  it('returns an empty map without querying when there are no other users', async () => {
    const { service, prisma } = buildService();

    const result = await service.getRelationshipStates('caller-1', []);

    expect(result.size).toBe(0);
    expect(prisma.interest.findMany).not.toHaveBeenCalled();
  });
});

describe('ProfilesService.getOwnProfileOrThrow', () => {
  it('returns the caller\'s profile when it exists', async () => {
    const { service, prisma } = buildService();
    prisma.profile.findUnique.mockResolvedValueOnce(storedProfile);

    const result = await service.getOwnProfileOrThrow('user-1');
    expect(result).toEqual(storedProfile);
  });

  it('throws when the caller has no profile yet', async () => {
    const { service, prisma } = buildService();
    prisma.profile.findUnique.mockResolvedValueOnce(null);

    await expect(service.getOwnProfileOrThrow('user-without-profile')).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });
});
