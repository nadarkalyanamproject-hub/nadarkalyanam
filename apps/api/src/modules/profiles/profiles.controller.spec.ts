import { describe, expect, it, vi } from 'vitest';
import type { Profile } from '../../generated/prisma/client.js';
import { ProfilesController, toPublicProfileDetail, toPublicProfileSummary } from './profiles.controller.js';

// The privacy requirement this project treats as non-negotiable: email must
// never appear in a response representing another user's profile. These
// tests assert it explicitly on the actual serialized JSON shape, not just
// by inspecting the mapper's source.

const rawProfile = {
  id: 'profile-1',
  userId: 'user-1',
  fullName: 'Meena Kumari',
  gender: 'FEMALE',
  dateOfBirth: new Date('1998-04-12'),
  visibility: 'PUBLIC',
  completionScore: 100,
  isVerified: false,
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
    additional: { familyType: 'Middle Class', about: 'Looking for a partner.' },
  },
  fieldVisibility: {},
  createdAt: new Date(),
  updatedAt: new Date(),
} as unknown as Profile;

describe('toPublicProfileSummary', () => {
  it('never includes an email field, in the object or its serialized JSON', () => {
    const summary = toPublicProfileSummary(rawProfile, null, false);

    expect(summary).not.toHaveProperty('email');
    expect(JSON.stringify(summary)).not.toContain('meena.kumari@example.com');
    expect(JSON.stringify(summary)).not.toContain('email');
  });

  it('does not include the raw dateOfBirth, only the computed age', () => {
    const summary = toPublicProfileSummary(rawProfile, null, false);

    expect(summary).not.toHaveProperty('dateOfBirth');
    expect(typeof summary.age).toBe('number');
  });

  it('still surfaces the real, non-sensitive fields correctly', () => {
    const summary = toPublicProfileSummary(rawProfile, 'https://photos.example/primary.jpg', false);

    expect(summary).toMatchObject({
      id: 'profile-1',
      fullName: 'Meena Kumari',
      gender: 'FEMALE',
      location: { city: 'Chennai', state: 'Tamil Nadu' },
      religion: 'Hindu',
      profession: 'Software Engineer',
      maritalStatus: 'NEVER_MARRIED',
      primaryPhotoUrl: 'https://photos.example/primary.jpg',
    });
  });

  it('passes hasSentInterest through as given, both true and false', () => {
    expect(toPublicProfileSummary(rawProfile, null, true).hasSentInterest).toBe(true);
    expect(toPublicProfileSummary(rawProfile, null, false).hasSentInterest).toBe(false);
  });
});

describe('toPublicProfileDetail', () => {
  it('never includes an email field, in the object or its serialized JSON', () => {
    const detail = toPublicProfileDetail(rawProfile, [], false);

    expect(detail).not.toHaveProperty('email');
    expect(JSON.stringify(detail)).not.toContain('meena.kumari@example.com');
    expect(JSON.stringify(detail)).not.toContain('email');
  });

  it('does not include the raw dateOfBirth, only the computed age', () => {
    const detail = toPublicProfileDetail(rawProfile, [], false);

    expect(detail).not.toHaveProperty('dateOfBirth');
    expect(typeof detail.age).toBe('number');
  });

  it('still surfaces the fuller detail fields correctly', () => {
    const detail = toPublicProfileDetail(rawProfile, [], false);

    expect(detail).toMatchObject({
      motherTongue: 'Tamil',
      height: `5'4" (163 cm)`,
      physicalStatus: 'NORMAL',
      casteCommunity: 'Nadar',
      dosham: 'NO',
      additional: { familyType: 'Middle Class', about: 'Looking for a partner.' },
    });
  });

  it('passes hasSentInterest through as given, both true and false', () => {
    expect(toPublicProfileDetail(rawProfile, [], true).hasSentInterest).toBe(true);
    expect(toPublicProfileDetail(rawProfile, [], false).hasSentInterest).toBe(false);
  });
});

// The bucket is private — every photo URL in every response below must be
// whatever PhotosService/StorageService produced (a pre-signed URL), never
// a plain string this layer built itself. Each test's mock returns a
// signed-looking URL and asserts it survives unmodified into the response.
describe('ProfilesController — photo URLs are signed, not plain', () => {
  const SIGNED_URL =
    'https://s3.example.com/bucket/profiles/profile-1/photo.jpg?X-Amz-Signature=abc123&X-Amz-Expires=3600';

  function buildController(photos: unknown[] = [{ id: 'photo-1', url: SIGNED_URL, isPrimary: true, sortOrder: 0 }]) {
    const profilesService = {
      getMyProfile: vi.fn().mockResolvedValue(rawProfile),
      updateProfile: vi.fn().mockResolvedValue(rawProfile),
      listOtherProfiles: vi.fn().mockResolvedValue({ profiles: [rawProfile], total: 1 }),
      getSentInterestTargetUserIds: vi.fn().mockResolvedValue(new Set()),
      getOtherProfile: vi.fn().mockResolvedValue(rawProfile),
    };
    const photosService = { getPhotosForProfile: vi.fn().mockResolvedValue(photos) };
    const controller = new ProfilesController(profilesService as never, photosService as never);
    return { controller, photosService };
  }

  it('GET /profiles/me returns the signed photo URL unmodified', async () => {
    const { controller } = buildController();

    const result = await controller.getMe({ userId: 'user-1' });

    expect(result.photos[0].url).toBe(SIGNED_URL);
  });

  it('GET /profiles (list) returns the signed primaryPhotoUrl unmodified', async () => {
    const { controller } = buildController();

    const result = await controller.list({ userId: 'user-1' });

    expect(result.items[0].primaryPhotoUrl).toBe(SIGNED_URL);
  });

  it('GET /profiles/:id returns the signed photo URLs unmodified', async () => {
    const { controller } = buildController();

    const result = await controller.getOne({ userId: 'user-1' }, 'profile-1');

    expect(result.primaryPhotoUrl).toBe(SIGNED_URL);
    expect(result.photos[0].url).toBe(SIGNED_URL);
  });
});
