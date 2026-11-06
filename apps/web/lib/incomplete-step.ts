'use client';

import { useSearchParams } from 'next/navigation';
import type { z } from 'zod';
import { INCOMPLETE_PARAM } from './build-profile-payload';
import { toFieldErrors } from './zod-errors';

export const INCOMPLETE_STEP_MESSAGE =
  'Some details on this step are missing, so your profile could not be created yet. Please fill in the highlighted fields and continue.';

// The last step sends the member back here (?incomplete=1) when the saved
// draft is missing something. Uses useSearchParams, so the step must render
// inside a <Suspense> boundary.
export function useIncompleteVisit(): boolean {
  return useSearchParams().has(INCOMPLETE_PARAM);
}

// The step's field errors to show straight away on such a visit.
export function incompleteStepErrors(incomplete: boolean, schema: z.ZodType, values: unknown): Record<string, string> {
  if (!incomplete) return {};
  const result = schema.safeParse(values);
  return result.success ? {} : toFieldErrors(result.error);
}
