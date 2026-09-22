import { describe, expect, it } from 'vitest';
import type { Profile } from '../../generated/prisma/client.js';
import { toPublicProfileDetail, toPublicProfileSummary } from './profiles.controller.js';

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
