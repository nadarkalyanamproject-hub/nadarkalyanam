import { describe, expect, it } from 'vitest';
import {
  isRequired,
  requiredFieldKeys,
  STEP_FIELD_IDS,
  STEP_SCHEMAS,
  UNMARKED_FIXED_FIELDS,
  type FormStep,
} from './required-fields';

const STEPS: FormStep[] = ['basicDetails', 'personal', 'location', 'additional'];

// The schema's own view of required-ness, straight from Zod.
function schemaRequiredKeys(step: FormStep): string[] {
  const shape = STEP_SCHEMAS[step].shape as Record<string, { isOptional(): boolean }>;
  return Object.keys(shape).filter((key) => !shape[key].isOptional());
}

describe('required-field markers', () => {
  it.each(STEPS)('%s: marked fields == schema-required keys minus the documented fixed-field exclusions', (step) => {
    const expected = schemaRequiredKeys(step).filter((key) => !(UNMARKED_FIXED_FIELDS[step] ?? []).includes(key));

    expect(requiredFieldKeys(step).sort()).toEqual(expected.sort());
  });

  it('matches the current schemas exactly (a schema change must be a deliberate, visible diff here)', () => {
    expect(requiredFieldKeys('basicDetails').sort()).toEqual(['dateOfBirth', 'email', 'fullName', 'gender', 'motherTongue']);
    expect(requiredFieldKeys('personal').sort()).toEqual([
      'casteCommunity',
      'height',
      'maritalStatus',
      'physicalStatus',
      'religion',
    ]);
    expect(requiredFieldKeys('location').sort()).toEqual(['city', 'educationLevel', 'profession', 'state']);
    expect(requiredFieldKeys('additional').sort()).toEqual(['about', 'familyType']);
  });

  it.each([
    ['personal', 'dosham'],
    ['location', 'educationDetail'],
    ['location', 'employedIn'],
    ['location', 'annualIncomeRange'],
    ['location', 'country'],
    ['location', 'annualIncomeCurrency'],
  ] as const)('%s.%s (optional or fixed) is never marked', (step, key) => {
    expect(isRequired(step, key)).toBe(false);
  });

  it('the client-only password field is in no schema and is never marked', () => {
    expect(isRequired('basicDetails', 'password')).toBe(false);
  });

  it.each(STEPS)('%s: every schema key has a field mapping (fails if a schema gains a key with no marker mapping)', (step) => {
    const schemaKeys = Object.keys(STEP_SCHEMAS[step].shape);
    const mapped = Object.keys(STEP_FIELD_IDS[step]);

    expect(schemaKeys.filter((key) => !mapped.includes(key))).toEqual([]);
    expect(mapped.filter((key) => !schemaKeys.includes(key))).toEqual([]);
  });

  it('every required key in particular is mapped to a rendered control', () => {
    for (const step of STEPS) {
      for (const key of requiredFieldKeys(step)) {
        expect(STEP_FIELD_IDS[step][key], `${step}.${key}`).toBeTruthy();
      }
    }
  });
});
