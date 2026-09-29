import {
  additionalDetailsSchema,
  basicDetailsSchema,
  locationProfessionalSchema,
  personalReligiousSchema,
} from '@nadar-kalyanam/schemas';
import { getRequiredKeys } from './step-completion';

// Which onboarding/profile fields show a required "*". Derived from the same
// Zod schemas that validate Next/Save, so a marker can't drift from what is
// actually enforced — there is deliberately no hand-written list of
// required labels here.

export type FormStep = 'basicDetails' | 'personal' | 'location' | 'additional';

export const STEP_SCHEMAS = {
  basicDetails: basicDetailsSchema,
  personal: personalReligiousSchema,
  location: locationProfessionalSchema,
  additional: additionalDetailsSchema,
} as const;

// Fixed/disabled fields that carry a default rather than user input. They're
// schema-optional today; listed so they stay unmarked even if that changes.
// (Same two fields the progress bar excludes in lib/onboarding-progress.ts.)
export const UNMARKED_FIXED_FIELDS: Partial<Record<FormStep, string[]>> = {
  location: ['country', 'annualIncomeCurrency'],
};

const REQUIRED: Record<FormStep, ReadonlySet<string>> = {
  basicDetails: new Set(getRequiredKeys(STEP_SCHEMAS.basicDetails, UNMARKED_FIXED_FIELDS.basicDetails)),
  personal: new Set(getRequiredKeys(STEP_SCHEMAS.personal, UNMARKED_FIXED_FIELDS.personal)),
  location: new Set(getRequiredKeys(STEP_SCHEMAS.location, UNMARKED_FIXED_FIELDS.location)),
  additional: new Set(getRequiredKeys(STEP_SCHEMAS.additional, UNMARKED_FIXED_FIELDS.additional)),
};

export function isRequired(step: FormStep, fieldKey: string): boolean {
  return REQUIRED[step].has(fieldKey);
}

export function requiredFieldKeys(step: FormStep): string[] {
  return [...REQUIRED[step]];
}

// Schema key -> the id of the control its <Field> label points at (htmlFor).
// Every schema key must appear here: the unit test fails if a schema gains a
// key with no mapping, and the browser check uses these ids to confirm each
// label's "*" matches isRequired(). Date of birth is three selects under one
// group label, which points at the day select.
export const STEP_FIELD_IDS: Record<FormStep, Record<string, string>> = {
  basicDetails: {
    fullName: 'fullName',
    gender: 'gender',
    dateOfBirth: 'dobDay',
    motherTongue: 'motherTongue',
    email: 'email',
  },
  personal: {
    height: 'height',
    physicalStatus: 'physicalStatus',
    maritalStatus: 'maritalStatus',
    religion: 'religion',
    casteCommunity: 'casteCommunity',
    dosham: 'dosham',
    previousMarriageDetails: 'previousMarriageDetails',
    doshamDetails: 'doshamDetails',
  },
  location: {
    city: 'city',
    state: 'state',
    country: 'country',
    educationLevel: 'educationLevel',
    educationDetail: 'educationDetail',
    profession: 'profession',
    employedIn: 'employedIn',
    annualIncomeRange: 'annualIncomeRange',
    annualIncomeCurrency: 'annualIncomeCurrency',
  },
  additional: {
    familyType: 'familyType',
    about: 'about',
  },
};
