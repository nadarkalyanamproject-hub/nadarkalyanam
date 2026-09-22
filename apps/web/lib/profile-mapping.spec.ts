import { describe, expect, it } from 'vitest';
import type { ProfileResponse } from '@nadar-kalyanam/schemas';
import {
  profileToAdditionalDetailsForm,
  profileToBasicDetailsForm,
  profileToLocationProfessionalForm,
  profileToPersonalReligiousForm,
  toCreateProfileRequest,
} from './profile-mapping';

const COMPLETE_PROFILE: ProfileResponse = {
  id: 'profile-1',
  fullName: 'Meena Kumari',
  gender: 'FEMALE',
  dateOfBirth: '1998-04-12',
  completionScore: 100,
  details: {
    motherTongue: 'Tamil',
    email: 'meena@example.com',
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
    additional: { familyType: 'Middle Class', about: 'Looking for a like-minded partner.' },
  },
  photos: [],
};

// Mirrors a real row found in the dev database: a profile written before the
// details.additional restructuring, using an entirely different obsolete
// shape (no `additional`, no `location`/`education` nesting the way the
// current schema expects). `details` is cast through `as unknown as` the
// same way the API controller does for the raw Prisma JSON column — this is
// deliberately NOT a valid ProfileDetails at the type level, because that's
// exactly what a stale row is at runtime.
const STALE_PROFILE: ProfileResponse = {
  ...COMPLETE_PROFILE,
  id: 'profile-stale',
  details: {
    religion: 'HINDU',
    casteCommunity: 'BRAHMIN',
    maritalStatus: 'NEVER_MARRIED',
    location: { city: 'NELLORE', state: 'ANDHRA', country: 'India' },
    education: {
      educationLevel: 'BACHELOR',
      educationDetail: 'COMPUTER SCIENCE',
      profession: 'DEVELOPER',
      employedIn: 'PRIVATE',
      annualIncomeRange: '10LPA',
      annualIncomeCurrency: 'INR',
    },
    // No `additional`, `motherTongue`, `email`, `height`, `physicalStatus`,
    // or `dosham` at all — the pre-restructuring shape nested this under a
    // top-level `family` key instead, which the current schema never reads.
  } as unknown as ProfileResponse['details'],
};

describe('profile-mapping with a complete profile', () => {
  it('maps every real field through without dropping or replacing it', () => {
    expect(profileToBasicDetailsForm(COMPLETE_PROFILE)).toEqual({
      fullName: 'Meena Kumari',
      gender: 'FEMALE',
      dateOfBirth: '1998-04-12',
      motherTongue: 'Tamil',
      email: 'meena@example.com',
    });
    expect(profileToLocationProfessionalForm(COMPLETE_PROFILE)).toEqual({
      city: 'Chennai',
      state: 'Tamil Nadu',
      country: 'India',
      educationLevel: 'Bachelors',
      educationDetail: 'B.Tech Computer Science',
      profession: 'Software Engineer',
      employedIn: 'Private',
      annualIncomeRange: '10-15 LPA',
      annualIncomeCurrency: 'INR',
    });
    expect(profileToAdditionalDetailsForm(COMPLETE_PROFILE)).toEqual({
      familyType: 'Middle Class',
      about: 'Looking for a like-minded partner.',
    });
  });
});

describe('profile-mapping with a stale/incomplete profile (missing details.additional)', () => {
  it('does not throw for any mapping function', () => {
    expect(() => toCreateProfileRequest(STALE_PROFILE)).not.toThrow();
    expect(() => profileToBasicDetailsForm(STALE_PROFILE)).not.toThrow();
    expect(() => profileToPersonalReligiousForm(STALE_PROFILE)).not.toThrow();
    expect(() => profileToLocationProfessionalForm(STALE_PROFILE)).not.toThrow();
    expect(() => profileToAdditionalDetailsForm(STALE_PROFILE)).not.toThrow();
  });

  it('falls back missing fields to the same empty sentinel every edit form already uses', () => {
    expect(profileToAdditionalDetailsForm(STALE_PROFILE)).toEqual({ familyType: '', about: '' });
    expect(profileToBasicDetailsForm(STALE_PROFILE)).toEqual({
      fullName: 'Meena Kumari',
      gender: 'FEMALE',
      dateOfBirth: '1998-04-12',
      motherTongue: '',
      email: '',
    });
  });

  it('still maps the groups that ARE present on the stale profile correctly', () => {
    expect(profileToLocationProfessionalForm(STALE_PROFILE)).toMatchObject({
      city: 'NELLORE',
      state: 'ANDHRA',
      educationLevel: 'BACHELOR',
      profession: 'DEVELOPER',
    });
  });
});
