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
  ancestralOrigin: '',
  ancestralOriginOther: '',
  about: '',
};

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

  const [lifestyle, setLifestyle] = useState<LifestyleFormState>(() =>
    lifestyleFormFromDraft(data.stepInputs?.lifestyle),
  );
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [lifestyleErrors, setLifestyleErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | undefined>();
  const [submitting, setSubmitting] = useState(false);
  const skipWizardGuardRef = useRef(false);

  useEffect(() => {
    if (skipWizardGuardRef.current) return;
    if (consumeAuthRedirectClaim()) return;
    if (!ready) return;
    if (data.hasProfile) {
      router.replace('/');
      return;
    }
    const incomplete = firstIncompleteStep({ basicDetails: data.basicDetails, personal: data.personal, location: data.location });
    if (incomplete) router.replace(incompleteHref(incomplete));
  }, [ready, data.hasProfile, data.basicDetails, data.personal, data.location, router]);

  useEffect(() => {
    saveStepInput('additional', form as unknown as Record<string, string>);
  }, [form, saveStepInput]);

  useEffect(() => {
    saveStepInput('lifestyle', lifestyleFormToDraft(lifestyle));
  }, [lifestyle, saveStepInput]);

  if (!ready || firstIncompleteStep(data)) return null;

  const activePercent = getOverallCompletionPercent(data, 4, form);

  function update<K extends keyof FormState>(key: K, value: string) {
    setForm((prev: FormState) => ({ ...prev, [key]: value }));
  }

  const isFamilyTypeValid = Boolean(form.familyType && form.familyType.trim() !== '');
  const isAncestralOriginValid = Boolean(form.ancestralOrigin && form.ancestralOrigin.trim() !== '');
  const isAboutValid = Boolean(form.about && form.about.trim().length >= 50);
  const isComplete = isFamilyTypeValid && isAncestralOriginValid && isAboutValid;

  function handleBack() {
    saveStepInput('additional', form as unknown as Record<string, string>);
    router.push('/onboarding/location-professional-details');
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (submitting) return;
    setFormError(undefined);

    const stepErrors: Record<string, string> = {};
    if (!isFamilyTypeValid) stepErrors.familyType = 'Family status is required';
    if (!isAncestralOriginValid) stepErrors.ancestralOrigin = 'Ancestral origin is required';
    if (!isAboutValid) stepErrors.about = 'Write at least 50 characters';

    const result = additionalDetailsSchema.safeParse({
      familyType: form.familyType,
      netWorth: form.netWorth || undefined,
      about: form.about,
    });
    const lifestyleResult = lifestyleSchema.safeParse(lifestyle);

    const combinedErrors = {
      ...(result.success ? {} : toFieldErrors(result.error)),
      ...stepErrors,
    };

    setErrors(combinedErrors);
    setLifestyleErrors(lifestyleResult.success ? {} : toFieldErrors(lifestyleResult.error));
    if (!result.success || Object.keys(stepErrors).length > 0 || !lifestyleResult.success) return;

    saveStep('additional', result.data);

    // Validate the whole request with the server's schema first
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
      <form className="flex flex-col gap-5" onSubmit={handleSubmit} noValidate>
        <AdditionalDetailsFields
          form={form}
          errors={errors}
          onChange={update}
          writeAbout={() => buildAboutDraft({ ...data.basicDetails, ...data.location, familyType: form.familyType, profileFor: data.profileForPrefill })}
        />

        {/* Optional Lifestyle & Habits section */}
        <div className="mt-2 border-t border-nk-line pt-5">
          <h3 className="text-base font-bold text-nk-ink">Lifestyle &amp; habits</h3>
          <p className="mt-0.5 text-xs text-nk-muted">Optional. You can add or change these later from My Profile.</p>
        </div>
        <LifestyleFields form={lifestyle} errors={lifestyleErrors} onChange={setLifestyle} />

        {formError ? <FormError>{formError}</FormError> : null}

        <Button type="submit" size="lg" disabled={submitting || !isComplete} className="mt-2">
          {submitting ? 'Creating your profile...' : 'Finish & Create Profile'}
        </Button>
      </form>
    </OnboardingShell>
  );
}
