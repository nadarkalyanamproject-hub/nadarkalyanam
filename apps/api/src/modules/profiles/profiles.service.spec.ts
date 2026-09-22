import { ConflictException, NotFoundException } from '@nestjs/common';
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
      },
    });
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
      },
    });
  });

  it('does not include completionScore in the update payload', async () => {
    const { service, prisma } = buildService();
    prisma.profile.findUnique.mockResolvedValueOnce({ id: 'profile-1' });

    await service.updateProfile('user-1', validPayload);

    const call = prisma.profile.update.mock.calls[0][0];
    expect(call.data).not.toHaveProperty('completionScore');
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
