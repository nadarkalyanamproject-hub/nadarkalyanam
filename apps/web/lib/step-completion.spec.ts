import { z } from 'zod';
import { describe, expect, it } from 'vitest';
import { locationProfessionalSchema, personalReligiousSchema } from '@nadar-kalyanam/schemas';
import { getStepCompletionPercent } from './step-completion';

describe('getStepCompletionPercent', () => {
  it('returns 0 when no required fields are filled', () => {
    const percent = getStepCompletionPercent(personalReligiousSchema, {
      height: '',
      physicalStatus: '',
      maritalStatus: '',
      religion: '',
      casteCommunity: '',
      dosham: '',
    });
    expect(percent).toBe(0);
  });

  it('returns a correct intermediate percentage as required fields are filled in', () => {
    // 3 of 5 required fields (height, physicalStatus, maritalStatus) filled
    const percent = getStepCompletionPercent(personalReligiousSchema, {
      height: `5'4" (163 cm)`,
      physicalStatus: 'NORMAL',
      maritalStatus: 'NEVER_MARRIED',
      religion: '',
      casteCommunity: '',
      dosham: '',
    });
    expect(percent).toBe(60);
  });

  it('returns 100 once every required field is filled', () => {
    const percent = getStepCompletionPercent(personalReligiousSchema, {
      height: `5'4" (163 cm)`,
      physicalStatus: 'NORMAL',
      maritalStatus: 'NEVER_MARRIED',
      religion: 'Hindu',
      casteCommunity: 'Nadar',
      dosham: '',
    });
    expect(percent).toBe(100);
  });

  it('does not let an optional schema field affect the result', () => {
    const withoutDosham = getStepCompletionPercent(personalReligiousSchema, {
      height: `5'4" (163 cm)`,
      physicalStatus: 'NORMAL',
      maritalStatus: 'NEVER_MARRIED',
      religion: 'Hindu',
      casteCommunity: 'Nadar',
      dosham: '',
    });
    const withDosham = getStepCompletionPercent(personalReligiousSchema, {
      height: `5'4" (163 cm)`,
      physicalStatus: 'NORMAL',
      maritalStatus: 'NEVER_MARRIED',
      religion: 'Hindu',
      casteCommunity: 'Nadar',
      dosham: 'YES',
    });
    expect(withoutDosham).toBe(100);
    expect(withDosham).toBe(100);
  });

  it('does not let an excluded key affect the result even when required', () => {
    const values = {
      city: 'Chennai',
      state: 'Tamil Nadu',
      country: '',
      educationLevel: 'Bachelors',
      educationDetail: '',
      profession: 'Engineer',
      employedIn: '',
      annualIncomeRange: '',
      annualIncomeCurrency: '',
    };
    // country/annualIncomeCurrency are already schema-optional, so excluding them
    // explicitly should be a no-op here — confirms excludeKeys composes safely
    // with optional fields rather than double-counting or erroring.
    const percent = getStepCompletionPercent(locationProfessionalSchema, values, [
      'country',
      'annualIncomeCurrency',
    ]);
    // required-and-not-excluded: city, state, educationLevel, profession — all filled
    expect(percent).toBe(100);
  });

  it('excludes a key even if a future schema change made it required', () => {
    const schema = z.object({
      fullName: z.string().min(1),
      country: z.string().min(1),
    });
    const percent = getStepCompletionPercent(schema, { fullName: 'Meena', country: '' }, ['country']);
    expect(percent).toBe(100);
  });

  it('returns 0 rather than dividing by zero when there are no applicable fields', () => {
    const schema = z.object({
      onlyOptional: z.string().optional(),
    });
    const percent = getStepCompletionPercent(schema, { onlyOptional: '' });
    expect(percent).toBe(0);
  });
});
