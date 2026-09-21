'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState, type FormEvent } from 'react';
import { additionalDetailsSchema, type AdditionalDetails } from '@nadar-kalyanam/schemas';
import { Button, Field, FormError, Select, Textarea } from '@nadar-kalyanam/ui';
import { OnboardingShell } from '../../../components/onboarding-shell';
import { ApiError, createProfile } from '../../../lib/api-client';
import { getOverallCompletionPercent } from '../../../lib/onboarding-progress';
import { toFieldErrors } from '../../../lib/zod-errors';
import { useRequireAuth } from '../../../lib/use-require-auth';
import { useRegistration } from '../../providers/registration-provider';

type FormState = Record<keyof AdditionalDetails, string>;

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

  useEffect(() => {
    if (!ready) return;
    if (!data.basicDetails) router.replace('/onboarding/basic-details');
    else if (!data.personal) router.replace('/onboarding/personal-religious-details');
    else if (!data.location) router.replace('/onboarding/location-professional-details');
  }, [ready, data.basicDetails, data.personal, data.location, router]);

  if (!ready || !data.basicDetails || !data.personal || !data.location) return null;

  const activePercent = getOverallCompletionPercent(data, 4, form);

  function update<K extends keyof FormState>(key: K, value: string) {
    setForm((prev) => ({ ...prev, [key]: value }));
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
        <Field label="Family status" htmlFor="familyType" error={errors.familyType}>
          <Select
            id="familyType"
            invalid={Boolean(errors.familyType)}
            value={form.familyType}
            onChange={(e) => update('familyType', e.target.value)}
          >
            <option value="">Select</option>
            <option value="Middle Class">Middle Class</option>
            <option value="Upper Middle Class">Upper Middle Class</option>
            <option value="Rich / Affluent (Elite)">Rich / Affluent (Elite)</option>
          </Select>
        </Field>

        <Field
          label="About you"
          htmlFor="about"
          error={errors.about}
          hint="At least 50 characters"
        >
          <Textarea
            id="about"
            invalid={Boolean(errors.about)}
            value={form.about}
            onChange={(e) => update('about', e.target.value)}
          />
        </Field>

        {formError ? <FormError>{formError}</FormError> : null}

        <Button type="submit" size="lg" disabled={submitting} className="mt-2">
          {submitting ? 'Creating your profile...' : 'Finish & Create Profile'}
        </Button>
      </form>
    </OnboardingShell>
  );
}
