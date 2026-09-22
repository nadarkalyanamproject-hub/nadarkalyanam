'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { additionalDetailsSchema } from '@nadar-kalyanam/schemas';
import { Button, FormError } from '@nadar-kalyanam/ui';
import { OnboardingShell } from '../../../components/onboarding-shell';
import {
  AdditionalDetailsFields,
  type AdditionalDetailsFormState,
} from '../../../components/profile-form-fields/additional-details-fields';
import { ApiError, createProfile } from '../../../lib/api-client';
import { consumeAuthRedirectClaim } from '../../../lib/auth-events';
import { getOverallCompletionPercent } from '../../../lib/onboarding-progress';
import { toFieldErrors } from '../../../lib/zod-errors';
import { useRequireAuth } from '../../../lib/use-require-auth';
import { useRegistration } from '../../providers/registration-provider';

type FormState = AdditionalDetailsFormState;

const EMPTY_FORM: FormState = {
  familyType: '',
  about: '',
};

export default function AdditionalDetailsPage() {
  const router = useRouter();
  const { ready } = useRequireAuth();
  const { data, saveStep, markProfileCreated, clearWizardDraft } = useRegistration();

  const [form, setForm] = useState<FormState>(() => ({
    ...EMPTY_FORM,
    ...(data.additional as unknown as Partial<FormState>),
  }));
  const [errors, setErrors] = useState<Record<string, string>>({});
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
    if (!data.basicDetails) router.replace('/onboarding/basic-details');
    else if (!data.personal) router.replace('/onboarding/personal-religious-details');
    else if (!data.location) router.replace('/onboarding/location-professional-details');
  }, [ready, data.basicDetails, data.personal, data.location, router]);

  if (!ready || !data.basicDetails || !data.personal || !data.location) return null;

  const activePercent = getOverallCompletionPercent(data, 4, form);

  function update<K extends keyof FormState>(key: K, value: string) {
    setForm((prev: FormState) => ({ ...prev, [key]: value }));
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setFormError(undefined);

    const result = additionalDetailsSchema.safeParse(form);
    if (!result.success) {
      setErrors(toFieldErrors(result.error));
      return;
    }
    setErrors({});
    saveStep('additional', result.data);

    setSubmitting(true);
    try {
      await createProfile(data.accessToken!, {
        ...data.basicDetails!,
        personal: data.personal!,
        location: data.location!,
        additional: result.data,
      });
      skipWizardGuardRef.current = true;
      markProfileCreated();
      clearWizardDraft();
      router.push('/onboarding/success');
    } catch (error) {
      setFormError(error instanceof ApiError ? error.message : 'Could not save your profile. Please try again.');
      setSubmitting(false);
    }
  }

  return (
    <OnboardingShell
      step={4}
      activePercent={activePercent}
      title="Additional Details"
      subtitle="Your family status and a bit about you"
    >
      <form className="flex flex-col gap-4" onSubmit={handleSubmit} noValidate>
        <AdditionalDetailsFields form={form} errors={errors} onChange={update} />

        {formError ? <FormError>{formError}</FormError> : null}

        <Button type="submit" size="lg" disabled={submitting} className="mt-2">
          {submitting ? 'Creating your profile...' : 'Finish & Create Profile'}
        </Button>
      </form>
    </OnboardingShell>
  );
}
