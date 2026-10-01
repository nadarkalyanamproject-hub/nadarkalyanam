import { describe, expect, it } from 'vitest';
import { COMPLETION_FIELDS, computeCompletionScore, missingCompletionFields } from './profile-completion.js';

const FULL = {
  fullName: 'Meena Raj',
  gender: 'FEMALE',
  dateOfBirth: new Date('1996-01-01'),
  details: {
    motherTongue: 'Tamil',
    email: 'meena@example.com',
    height: `5'3" (160 cm)`,
    physicalStatus: 'NORMAL',
    maritalStatus: 'NEVER_MARRIED',
    religion: 'Hindu',
    casteCommunity: 'Nadar',
    dosham: 'NO',
    location: { city: 'Madurai', state: 'Tamil Nadu', country: 'India' },
    education: {
      educationLevel: 'B.E',
      educationDetail: 'Computer Science',
      profession: 'Engineer',
      employedIn: 'Private',
      annualIncomeRange: '8-12 LPA',
      annualIncomeCurrency: 'INR',
    },
    additional: { familyType: 'Middle Class', about: 'About me.' },
  },
};

function withDetails(overrides: Record<string, unknown>) {
  const d = FULL.details;
  return {
    ...FULL,
    details: {
      ...d,
      ...overrides,
      education: { ...d.education, ...(overrides.education as object) },
      location: { ...d.location, ...(overrides.location as object) },
      additional: { ...d.additional, ...(overrides.additional as object) },
    },
  };
}

describe('profile completion score', () => {
  it('counts 21 fields: the 20 onboarding fields plus a photo', () => {
    expect(COMPLETION_FIELDS).toHaveLength(21);
  });

  it('is 100 with every field filled and a photo', () => {
    expect(computeCompletionScore(FULL, 1)).toBe(100);
    expect(computeCompletionScore(FULL, 3)).toBe(100);
  });

  it('is 95 with every field filled but no photo (20/21)', () => {
    expect(computeCompletionScore(FULL, 0)).toBe(95);
    expect(missingCompletionFields(FULL, 0)).toEqual(['photo']);
  });

  it('counts blank and whitespace-only values as missing', () => {
    const profile = withDetails({
      dosham: undefined,
      education: { educationDetail: '', employedIn: '   ', annualIncomeRange: '' },
    });
    expect(missingCompletionFields(profile, 0).sort()).toEqual(
      ['annualIncomeRange', 'dosham', 'educationDetail', 'employedIn', 'photo'].sort(),
    );
    expect(computeCompletionScore(profile, 0)).toBe(Math.round((16 / 21) * 100)); // 76
  });

  it('does not count conditional follow-ups or fields members cannot enter', () => {
    const profile = withDetails({ previousMarriageDetails: '', doshamDetails: '' });
    expect(computeCompletionScore(profile, 1)).toBe(100);
  });

  it('handles a profile with no details at all (legacy rows)', () => {
    expect(computeCompletionScore({ fullName: 'X Y', gender: 'MALE', dateOfBirth: '1990-01-01', details: {} }, 0)).toBe(
      Math.round((3 / 21) * 100),
    );
  });
});
