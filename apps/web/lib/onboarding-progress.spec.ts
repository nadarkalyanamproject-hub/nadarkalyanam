import { describe, expect, it } from 'vitest';
import type { RegistrationDraft } from './registration-types';
import { getOverallCompletionPercent } from './onboarding-progress';

// Real required-field counts per schema (verified via schema introspection):
// basicDetails=5, personal=5, location=4 (city/state/educationLevel/profession —
// country and annualIncomeCurrency excluded), additional=2. Total = 16.
const TOTAL = 16;

const completeBasicDetails = {
  fullName: 'Meena Kumari',
  gender: 'FEMALE',
  dateOfBirth: '1998-04-12',
  motherTongue: 'Tamil',
  email: 'meena@example.com',
};

const completePersonal = {
  height: `5'4" (163 cm)`,
  physicalStatus: 'NORMAL',
  maritalStatus: 'NEVER_MARRIED',
  religion: 'Hindu',
  casteCommunity: 'Nadar',
};

const completeLocation = {
  city: 'Chennai',
  state: 'Tamil Nadu',
  educationLevel: 'Bachelors',
  profession: 'Engineer',
};

const completeAdditional = {
  familyType: 'Middle Class',
  about: 'x'.repeat(60),
};

describe('getOverallCompletionPercent', () => {
  it('is 0 on step 1 with nothing filled in and nothing saved yet', () => {
    const draft: RegistrationDraft = {};
    const percent = getOverallCompletionPercent(draft, 1, {});
    expect(percent).toBe(0);
  });

  it('reflects proportional weighting rather than equal 25% per step', () => {
    // Step 1 alone (5 of 16 required fields) should be ~31%, not 25%.
    const draft: RegistrationDraft = {};
    const percent = getOverallCompletionPercent(draft, 1, completeBasicDetails);
    expect(percent).toBe(Math.round((5 / TOTAL) * 100));
    expect(percent).not.toBe(25);
  });

  it('does not reset when moving to the next step — carries forward saved steps', () => {
    // Step 1 was already saved (5/16) and the user is now on step 2 with nothing
    // filled in yet. The percentage must reflect step 1's contribution, not 0.
    const draft: RegistrationDraft = { basicDetails: completeBasicDetails as never };
    const percent = getOverallCompletionPercent(draft, 2, {});
    expect(percent).toBe(Math.round((5 / TOTAL) * 100));
    expect(percent).toBeGreaterThan(0);
  });

  it('sums saved prior steps with the live current step as the user fills it in', () => {
    const draft: RegistrationDraft = {
      basicDetails: completeBasicDetails as never,
      personal: completePersonal as never,
    };
    // On step 3, with 2 of its 4 required fields filled live.
    const percent = getOverallCompletionPercent(draft, 3, { city: 'Chennai', state: 'Tamil Nadu' });
    expect(percent).toBe(Math.round(((5 + 5 + 2) / TOTAL) * 100));
  });

  it('does not count steps after the current one', () => {
    const draftWithFutureData: RegistrationDraft = {
      basicDetails: completeBasicDetails as never,
      // additional saved even though the user is only on step 2 (shouldn't happen
      // via the real UI, but the calculation must not count it regardless)
      additional: completeAdditional as never,
    };
    const percent = getOverallCompletionPercent(draftWithFutureData, 2, {});
    expect(percent).toBe(Math.round((5 / TOTAL) * 100));
  });

  it('decreases when a filled current-step field is cleared', () => {
    const draft: RegistrationDraft = {};
    const filled = getOverallCompletionPercent(draft, 1, completeBasicDetails);
    const cleared = getOverallCompletionPercent(draft, 1, { ...completeBasicDetails, email: '' });
    expect(cleared).toBeLessThan(filled);
  });

  it('reaches 100% only when every required field across all 4 steps is complete', () => {
    const almostThere: RegistrationDraft = {
      basicDetails: completeBasicDetails as never,
      personal: completePersonal as never,
      location: completeLocation as never,
    };
    // Step 4 (current) missing "about"
    const notQuite = getOverallCompletionPercent(almostThere, 4, { familyType: 'Middle Class', about: '' });
    expect(notQuite).toBeLessThan(100);

    const complete = getOverallCompletionPercent(almostThere, 4, completeAdditional);
    expect(complete).toBe(100);
  });

  it('never reaches 100% from a single step alone', () => {
    const draft: RegistrationDraft = {};
    const percent = getOverallCompletionPercent(draft, 1, completeBasicDetails);
    expect(percent).toBeLessThan(100);
  });
});
