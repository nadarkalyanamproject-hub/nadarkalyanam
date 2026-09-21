import {
  additionalDetailsSchema,
  basicDetailsSchema,
  locationProfessionalSchema,
  personalReligiousSchema,
} from '@nadar-kalyanam/schemas';
import { getStepCompletionCounts } from './step-completion';
import type { RegistrationDraft } from './registration-types';

interface StepDefinition {
  draftKey: keyof Pick<RegistrationDraft, 'basicDetails' | 'personal' | 'location' | 'additional'>;
  schema: Parameters<typeof getStepCompletionCounts>[0];
  excludeKeys: string[];
}

// Order matters: this is the fixed, canonical order of the 4 onboarding steps,
// independent of which page is currently rendering.
const STEP_DEFINITIONS: StepDefinition[] = [
  { draftKey: 'basicDetails', schema: basicDetailsSchema, excludeKeys: [] },
  { draftKey: 'personal', schema: personalReligiousSchema, excludeKeys: [] },
  // country/annualIncomeCurrency are fixed/disabled values, not real user input —
  // excluded even though the schema already treats them as optional (see
  // location-professional-details/page.tsx for the same exclusion applied locally).
  { draftKey: 'location', schema: locationProfessionalSchema, excludeKeys: ['country', 'annualIncomeCurrency'] },
  { draftKey: 'additional', schema: additionalDetailsSchema, excludeKeys: [] },
];

// The denominator is fixed across the whole flow — computed once at module load
// from the schemas themselves, not re-derived on every render.
const TOTAL_REQUIRED_FIELDS = STEP_DEFINITIONS.reduce(
  (sum, def) => sum + getStepCompletionCounts(def.schema, {}, def.excludeKeys).total,
  0,
);

/**
 * One combined percentage across all 4 onboarding steps: already-saved steps
 * contribute their saved draft data, the current step contributes its live
 * in-progress form state, and not-yet-reached steps contribute nothing —
 * against the fixed total required-field count for the whole flow. Never
 * resets between steps and never reaches 100% from a single step alone.
 */
export function getOverallCompletionPercent(
  draft: RegistrationDraft,
  currentStep: number,
  currentStepValues: Record<string, unknown>,
): number {
  const filled = STEP_DEFINITIONS.reduce((sum, def, index) => {
    const stepNumber = index + 1;
    let values: Record<string, unknown>;
    if (stepNumber === currentStep) {
      values = currentStepValues;
    } else if (stepNumber < currentStep) {
      values = (draft[def.draftKey] as Record<string, unknown> | undefined) ?? {};
    } else {
      values = {};
    }
    return sum + getStepCompletionCounts(def.schema, values, def.excludeKeys).filled;
  }, 0);

  if (TOTAL_REQUIRED_FIELDS === 0) return 0;
  return Math.round((filled / TOTAL_REQUIRED_FIELDS) * 100);
}
