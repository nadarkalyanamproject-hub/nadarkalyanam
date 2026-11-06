import {
  basicDetailsSchema,
  createProfileSchema,
  locationProfessionalSchema,
  personalReligiousSchema,
  type AdditionalDetails,
  type CreateProfileRequest,
  type Lifestyle,
} from '@nadar-kalyanam/schemas';
import type { RegistrationDraft } from './registration-types';

// The steps before Finish, in wizard order, with the page each one lives on.
export const EARLIER_STEPS = [
  { key: 'basicDetails', schema: basicDetailsSchema, href: '/onboarding/basic-details', title: 'Basic Details' },
  { key: 'personal', schema: personalReligiousSchema, href: '/onboarding/personal-religious-details', title: 'Personal & Religious Details' },
  { key: 'location', schema: locationProfessionalSchema, href: '/onboarding/location-professional-details', title: 'Location & Professional Details' },
] as const;

export type EarlierStep = (typeof EARLIER_STEPS)[number];
export type WizardSection = EarlierStep['key'] | 'additional' | 'lifestyle';

// Query flag on a step's URL: open it with its missing fields already marked.
export const INCOMPLETE_PARAM = 'incomplete';

// The body for POST /profiles, built the same way the last step always has:
// step 1's fields at the top level, the other steps nested.
export function buildProfilePayload(
  draft: RegistrationDraft,
  additional: AdditionalDetails,
  lifestyle?: Lifestyle,
): Record<string, unknown> {
  return {
    ...draft.basicDetails,
    ...(draft.profileForPrefill ? { profileFor: draft.profileForPrefill } : {}),
    personal: draft.personal,
    location: draft.location,
    additional,
    ...(lifestyle ? { lifestyle } : {}),
  };
}

// Which wizard section a createProfileSchema issue path belongs to. Step 1's
// fields sit at the top level; unknown top-level keys (e.g. a field only an
// older server still expects) map to nothing.
export function sectionOfPath(path: string): WizardSection | null {
  const [head] = path.split('.');
  if (head === 'personal' || head === 'location' || head === 'additional' || head === 'lifestyle') return head;
  return head in basicDetailsSchema.shape ? 'basicDetails' : null;
}

// The first earlier step whose saved data doesn't pass its own schema (a step
// never finished, or saved by an older version of the wizard).
export function firstIncompleteStep(draft: RegistrationDraft): EarlierStep | null {
  return EARLIER_STEPS.find((step) => !step.schema.safeParse(draft[step.key]).success) ?? null;
}

export type ProfilePayloadCheck =
  | { ok: true; payload: CreateProfileRequest }
  | { ok: false; step: EarlierStep | null; issues: { path: string; message: string }[] };

// Runs the server's own schema on the client, so an incomplete draft is sent
// back to the step it's missing from instead of reaching the API.
export function checkProfilePayload(payload: Record<string, unknown>): ProfilePayloadCheck {
  const result = createProfileSchema.safeParse(payload);
  if (result.success) return { ok: true, payload: result.data };
  const issues = result.error.issues.map((issue) => ({ path: issue.path.join('.'), message: issue.message }));
  const sections = new Set(issues.map((issue) => sectionOfPath(issue.path)));
  const step = EARLIER_STEPS.find((s) => sections.has(s.key)) ?? null;
  return { ok: false, step, issues };
}
