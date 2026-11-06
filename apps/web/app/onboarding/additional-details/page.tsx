'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { additionalDetailsSchema, lifestyleSchema } from '@nadar-kalyanam/schemas';
import { Button, FormError } from '@nadar-kalyanam/ui';
import { OnboardingShell } from '../../../components/onboarding-shell';
import {
  AdditionalDetailsFields,
  type AdditionalDetailsFormState,
} from '../../../components/profile-form-fields/additional-details-fields';
import {
  LifestyleFields,
  isLifestyleFormEmpty,
  lifestyleFormFromDraft,
  lifestyleFormToDraft,
  type LifestyleFormState,
} from '../../../components/profile-form-fields/lifestyle-fields';
import { ApiError, createProfile, type ApiIssue } from '../../../lib/api-client';
import {
  INCOMPLETE_PARAM,
  buildProfilePayload,
  checkProfilePayload,
  firstIncompleteStep,
  sectionOfPath,
  type EarlierStep,
} from '../../../lib/build-profile-payload';
import { consumeAuthRedirectClaim } from '../../../lib/auth-events';
import { getOverallCompletionPercent } from '../../../lib/onboarding-progress';
import { toFieldErrors } from '../../../lib/zod-errors';
import { useRequireAuth } from '../../../lib/use-require-auth';
import { useRegistration } from '../../providers/registration-provider';
import { buildAboutDraft } from '../../../lib/about-draft';

type FormState = AdditionalDetailsFormState;

const incompleteHref = (step: EarlierStep) => `${step.href}?${INCOMPLETE_PARAM}=1`;

// This step's own fields from server validation issues ("additional.about"
// -> about); anything for another section stays in the form-level message.
function fieldErrorsFor(issues: ApiIssue[], section: 'additional' | 'lifestyle'): Record<string, string> {
  const errors: Record<string, string> = {};
  for (const issue of issues) {
    if (sectionOfPath(issue.path) !== section) continue;
    const key = issue.path.split('.')[1];
    if (key && !errors[key]) errors[key] = issue.message;
  }
  return errors;
}

const EMPTY_FORM: FormState = {
  familyType: '',
  netWorth: '',
  about: '',
};

// Mounts the step only once the saved draft has been loaded from
// localStorage, so the form can start from it (see basic-details). The
// guard and submit logic below are unchanged.
export default function AdditionalDetailsPage() {
  const { hydrated } = useRegistration();
  return hydrated ? <AdditionalDetailsStep /> : null;
}

function AdditionalDetailsStep() {
  const router = useRouter();
  const { ready } = useRequireAuth();
  const { data, saveStep, saveStepInput, markProfileCreated, clearWizardDraft } = useRegistration();

  const [form, setForm] = useState<FormState>(() => ({
    ...EMPTY_FORM,
    ...(data.additional as unknown as Partial<FormState>),
    ...(data.stepInputs?.additional as Partial<FormState> | undefined),
  }));
  // Optional Lifestyle & Habits, sent with this step when anything is picked.
  const [lifestyle, setLifestyle] = useState<LifestyleFormState>(() =>
    lifestyleFormFromDraft(data.stepInputs?.lifestyle),
  );
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [lifestyleErrors, setLifestyleErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | undefined>();
  const [submitting, setSubmitting] = useState(false);
  // A successful submit already knows exactly where to go (/onboarding/success)
  // and navigates there itself. Without this, clearWizardDraft() below
  // re-renders this same page with basicDetails/personal/location now
  // undefined, and the guard effect right below fires too, racing the
  // explicit router.push and sending everyone back to step 1 instead.
  const skipWizardGuardRef = useRef(false);

  useEffect(() => {
    if (skipWizardGuardRef.current) return;
    // Same draft fields get wiped by a 401 (clearAuth resets the whole
    // draft, not just the auth fields) — createProfile below is an
    // authenticated call that could itself 401. That already has its own
    // navigation in flight via the shared claim; this guard must not also
    // redirect for that change. (AppHeader no longer renders during the
    // wizard, so logout can't fire from here — but the claim check still
    // guards the 401 path, which doesn't depend on AppHeader being mounted.)
    if (consumeAuthRedirectClaim()) return;
    if (!ready) return;
    // The profile was created meanwhile (e.g. Finish in another tab, which
    // also clears the shared draft): nothing is missing, so go home.
    if (data.hasProfile) {
      router.replace('/');
      return;
    }
    // Each earlier step must pass its own schema, not merely exist: a draft
    // saved by an older wizard, or edited elsewhere, is sent back to the
    // first step it's incomplete on, with that step's fields marked.
    const incomplete = firstIncompleteStep({ basicDetails: data.basicDetails, personal: data.personal, location: data.location });
    if (incomplete) router.replace(incompleteHref(incomplete));
  }, [ready, data.hasProfile, data.basicDetails, data.personal, data.location, router]);

  // Raw input is kept in the draft on every edit (no validation). Writes
  // only stepInputs, which the guard above doesn't read.
  useEffect(() => {
    saveStepInput('additional', form);
  }, [form, saveStepInput]);

  useEffect(() => {
    saveStepInput('lifestyle', lifestyleFormToDraft(lifestyle));
  }, [lifestyle, saveStepInput]);

  if (!ready || firstIncompleteStep(data)) return null;

  const activePercent = getOverallCompletionPercent(data, 4, form);

  function update<K extends keyof FormState>(key: K, value: string) {
    setForm((prev: FormState) => ({ ...prev, [key]: value }));
  }

  // Back keeps this step's input exactly as typed (no validation) and never
  // touches the rest of the draft.
  function handleBack() {
    saveStepInput('additional', form);
    router.push('/onboarding/location-professional-details');
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setFormError(undefined);

    const result = additionalDetailsSchema.safeParse(form);
    const lifestyleResult = lifestyleSchema.safeParse(lifestyle);
    setErrors(result.success ? {} : toFieldErrors(result.error));
    setLifestyleErrors(lifestyleResult.success ? {} : toFieldErrors(lifestyleResult.error));
    if (!result.success || !lifestyleResult.success) return;
    saveStep('additional', result.data);

    // Validate the whole request with the server's schema first: an
    // incomplete draft goes back to the step it's missing from and never
    // reaches the API.
    const check = checkProfilePayload(
      buildProfilePayload(data, result.data, isLifestyleFormEmpty(lifestyle) ? undefined : lifestyleResult.data),
    );
    if (!check.ok) {
      if (check.step) {
        router.push(incompleteHref(check.step));
      } else {
        setErrors(fieldErrorsFor(check.issues, 'additional'));
        setLifestyleErrors(fieldErrorsFor(check.issues, 'lifestyle'));
        setFormError('Some details are missing. Please check the highlighted fields.');
      }
      return;
    }

    setSubmitting(true);
    try {
      await createProfile(data.accessToken!, check.payload);
      skipWizardGuardRef.current = true;
      markProfileCreated();
      clearWizardDraft();
      // replace: Back from the welcome screen / Home never reopens the wizard.
      router.replace('/onboarding/success');
    } catch (error) {
      if (error instanceof ApiError && error.issues.length) {
        setErrors(fieldErrorsFor(error.issues, 'additional'));
        setLifestyleErrors(fieldErrorsFor(error.issues, 'lifestyle'));
      }
      setFormError(error instanceof ApiError ? error.message : 'Could not save your profile. Please try again.');
      setSubmitting(false);
    }
  }

  return (
    <OnboardingShell
      step={4}
      activePercent={activePercent}
      onBack={handleBack}
      backDisabled={submitting}
      title="Additional Details"
      subtitle="Your family, a bit about you and your lifestyle"
    >
      <form className="flex flex-col gap-4" onSubmit={handleSubmit} noValidate>
        <AdditionalDetailsFields
          form={form}
          errors={errors}
          onChange={update}
          writeAbout={() => buildAboutDraft({ ...data.basicDetails, ...data.location, familyType: form.familyType, profileFor: data.profileForPrefill })}
        />

        <div className="mt-2 border-t border-nk-line pt-5">
          <h3 className="text-base font-bold text-nk-ink">Lifestyle &amp; habits</h3>
          <p className="mt-0.5 text-xs text-nk-muted">Optional. You can add or change these later from My Profile.</p>
        </div>
        <LifestyleFields form={lifestyle} errors={lifestyleErrors} onChange={setLifestyle} />

        {formError ? <FormError>{formError}</FormError> : null}

        {/* The final action keeps its full-width, large treatment. */}
        <Button type="submit" size="lg" disabled={submitting} className="mt-2">
          {submitting ? 'Creating your profile...' : 'Finish & Create Profile'}
        </Button>
      </form>
    </OnboardingShell>
  );
}
