import { describe, expect, it } from 'vitest';
import { NADAR_SUBCATEGORIES, RELIGIONS, createProfileSchema, type AdditionalDetails } from '@nadar-kalyanam/schemas';
import { extractErrorMessage, fieldLabel } from './api-client';
import { buildProfilePayload, checkProfilePayload, firstIncompleteStep, sectionOfPath } from './build-profile-payload';
import type { RegistrationDraft } from './registration-types';

const basicDetails = {
  fullName: 'Arun Kumar',
  gender: 'MALE' as const,
  dateOfBirth: '1995-04-12',
  religion: RELIGIONS[0],
  casteCommunity: NADAR_SUBCATEGORIES[0],
  email: 'arun.kumar@example.in',
};
const personal = {
  height: `4'6" (137 cm)`,
  physicalStatus: 'NORMAL' as const,
  maritalStatus: 'NEVER_MARRIED' as const,
  previousMarriageDetails: '',
  doshamDetails: '',
};
const location = {
  city: 'Chennai',
  state: 'Tamil Nadu',
  country: 'India',
  educationLevel: 'Bachelors',
  educationDetail: '',
  profession: 'Engineer',
  employedIn: '',
  annualIncomeRange: '',
  annualIncomeCurrency: 'INR',
};
const additional: AdditionalDetails = {
  familyType: 'Middle Class',
  about: 'I am a software engineer living in Chennai who enjoys music, travel and family time.',
};
const complete: RegistrationDraft = { accessToken: 't', profileForPrefill: 'MYSELF', basicDetails, personal, location };

// What a draft saved before religion/community moved to step 1 (and mother
// tongue was dropped) still holds in localStorage.
const olderWizardDraft = {
  accessToken: 't',
  basicDetails: { fullName: 'Arun Kumar', gender: 'MALE', dateOfBirth: '1995-04-12', motherTongue: 'Tamil', email: 'a@b.in' },
  personal: { ...personal, religion: 'Hindu', casteCommunity: 'Nadar' },
  location,
} as unknown as RegistrationDraft;

// As sent over the wire: JSON drops undefined keys.
const overTheWire = (payload: unknown) => JSON.parse(JSON.stringify(payload)) as unknown;

describe('buildProfilePayload', () => {
  it('builds a body the server schema accepts from a complete draft', () => {
    const payload = buildProfilePayload(complete, additional);
    expect(createProfileSchema.safeParse(overTheWire(payload)).success).toBe(true);
    expect(checkProfilePayload(payload).ok).toBe(true);
    expect(payload).toMatchObject({ fullName: 'Arun Kumar', profileFor: 'MYSELF', personal, location, additional });
  });

  it('leaves lifestyle out unless given', () => {
    expect(buildProfilePayload(complete, additional)).not.toHaveProperty('lifestyle');
    expect(buildProfilePayload(complete, additional, { hobbies: [] })).toHaveProperty('lifestyle');
  });
});

describe('checkProfilePayload', () => {
  it('stops a draft saved by an older wizard before it reaches the API, pointing at step 1', () => {
    // The old guard only checked that each step existed, so this draft was
    // submitted and the server answered 400.
    expect(Boolean(olderWizardDraft.basicDetails && olderWizardDraft.personal && olderWizardDraft.location)).toBe(true);
    const check = checkProfilePayload(buildProfilePayload(olderWizardDraft, additional));
    expect(check.ok).toBe(false);
    if (check.ok) return;
    expect(check.step?.key).toBe('basicDetails');
    expect(check.issues.map((i) => i.path)).toEqual(['religion', 'casteCommunity']);
  });

  it('points at the first incomplete step', () => {
    const noHeight = { ...complete, personal: { ...personal, height: undefined } } as unknown as RegistrationDraft;
    const noCity = { ...complete, location: { ...location, city: undefined } } as unknown as RegistrationDraft;
    const both = { ...noHeight, location: noCity.location };
    expect(checkProfilePayload(buildProfilePayload(noHeight, additional))).toMatchObject({ ok: false, step: { key: 'personal' } });
    expect(checkProfilePayload(buildProfilePayload(noCity, additional))).toMatchObject({ ok: false, step: { key: 'location' } });
    expect(checkProfilePayload(buildProfilePayload(both, additional))).toMatchObject({ ok: false, step: { key: 'personal' } });
  });
});

describe('firstIncompleteStep', () => {
  it('is null for a complete draft and finds the step for missing or older data', () => {
    expect(firstIncompleteStep(complete)).toBeNull();
    expect(firstIncompleteStep({ ...complete, basicDetails: undefined })?.key).toBe('basicDetails');
    expect(firstIncompleteStep({ ...complete, location: undefined })?.key).toBe('location');
    expect(firstIncompleteStep(olderWizardDraft)?.key).toBe('basicDetails');
  });
});

describe('sectionOfPath', () => {
  it('maps createProfileSchema paths to wizard sections', () => {
    expect(sectionOfPath('email')).toBe('basicDetails');
    expect(sectionOfPath('personal.height')).toBe('personal');
    expect(sectionOfPath('location.city')).toBe('location');
    expect(sectionOfPath('additional.about')).toBe('additional');
    expect(sectionOfPath('lifestyle.hobbies.0')).toBe('lifestyle');
    expect(sectionOfPath('motherTongue')).toBeNull();
  });
});

describe('extractErrorMessage', () => {
  it('names each field, so an API running an older schema is recognisable', () => {
    // Verbatim 400 from POST /profiles when the API process was still on the
    // pre-merge schema while the web app had moved on.
    const body = {
      message: [
        { path: 'motherTongue', message: 'Invalid input: expected string, received undefined' },
        { path: 'personal.religion', message: 'Invalid input: expected string, received undefined' },
        { path: 'personal.casteCommunity', message: 'Invalid input: expected string, received undefined' },
      ],
    };
    expect(extractErrorMessage(body)).toBe(
      'Mother tongue: Invalid input: expected string, received undefined; ' +
        'Religion: Invalid input: expected string, received undefined; ' +
        'Caste community: Invalid input: expected string, received undefined',
    );
  });

  it('keeps plain string messages and the fallback', () => {
    expect(extractErrorMessage({ message: 'Profile already exists' })).toBe('Profile already exists');
    expect(extractErrorMessage(null)).toBe('Something went wrong. Please try again.');
    expect(fieldLabel('lifestyle.hobbies.0')).toBe('Hobbies');
  });
});
