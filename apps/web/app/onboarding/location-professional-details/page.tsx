'use client';

import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import { locationProfessionalSchema } from '@nadar-kalyanam/schemas';
import { Button } from '@nadar-kalyanam/ui';
import { OnboardingShell } from '../../../components/onboarding-shell';
import {
  LocationProfessionalFields,
  type LocationProfessionalFormState,
} from '../../../components/profile-form-fields/location-professional-fields';
import { getOverallCompletionPercent } from '../../../lib/onboarding-progress';
import { toFieldErrors } from '../../../lib/zod-errors';
import { useRequireAuth } from '../../../lib/use-require-auth';
import { useRegistration } from '../../providers/registration-provider';

type FormState = LocationProfessionalFormState;

const EMPTY_FORM: FormState = {
  city: '',
  state: '',
  country: 'India',
  educationLevel: '',
  educationDetail: '',
  profession: '',
  employedIn: '',
  annualIncomeRange: '',
  annualIncomeCurrency: 'INR',
};

export default function LocationProfessionalDetailsPage() {
  const router = useRouter();
  const { ready } = useRequireAuth();
  const { data, saveStep } = useRegistration();

  const [form, setForm] = useState<FormState>(() => ({
    ...EMPTY_FORM,
    ...(data.location as unknown as Partial<FormState>),
  }));
  const [errors, setErrors] = useState<Record<string, string>>({});

  if (!ready) return null;

  const activePercent = getOverallCompletionPercent(data, 3, form);

  function update<K extends keyof FormState>(key: K, value: string) {
    setForm((prev: FormState) => ({ ...prev, [key]: value }));
  }

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const result = locationProfessionalSchema.safeParse(form);
    if (!result.success) {
      setErrors(toFieldErrors(result.error));
      return;
    }
    setErrors({});
    saveStep('location', result.data);
    router.push('/onboarding/additional-details');
  }

  return (
    <OnboardingShell
      step={3}
      activePercent={activePercent}
      title="Location & Professional Details"
      subtitle="Where you live and what you do"
    >
      <form className="flex flex-col gap-4" onSubmit={handleSubmit} noValidate>
        <LocationProfessionalFields form={form} errors={errors} onChange={update} />
        <Button type="submit" size="lg" className="mt-2">
          Next
        </Button>
      </form>
    </OnboardingShell>
  );
}
