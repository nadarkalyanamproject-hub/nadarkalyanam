'use client';

import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import { personalReligiousSchema } from '@nadar-kalyanam/schemas';
import { Button } from '@nadar-kalyanam/ui';
import { OnboardingShell } from '../../../components/onboarding-shell';
import {
  PersonalReligiousFields,
  type PersonalReligiousFormState,
} from '../../../components/profile-form-fields/personal-religious-fields';
import { getOverallCompletionPercent } from '../../../lib/onboarding-progress';
import { toFieldErrors } from '../../../lib/zod-errors';
import { useRequireAuth } from '../../../lib/use-require-auth';
import { useRegistration } from '../../providers/registration-provider';

type FormState = PersonalReligiousFormState;

const EMPTY_FORM: FormState = {
  height: '',
  physicalStatus: 'NORMAL',
  maritalStatus: '',
  religion: '',
  casteCommunity: '',
  dosham: '',
};

export default function PersonalReligiousDetailsPage() {
  const router = useRouter();
  const { ready } = useRequireAuth();
  const { data, saveStep } = useRegistration();

  const [form, setForm] = useState<FormState>(() => ({
    ...EMPTY_FORM,
    ...(data.personal as unknown as Partial<FormState>),
  }));
  const [errors, setErrors] = useState<Record<string, string>>({});

  if (!ready) return null;

  const activePercent = getOverallCompletionPercent(data, 2, form);

  function update<K extends keyof FormState>(key: K, value: string) {
    setForm((prev: FormState) => ({ ...prev, [key]: value }));
  }

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const result = personalReligiousSchema.safeParse(form);
    if (!result.success) {
      setErrors(toFieldErrors(result.error));
      return;
    }
    setErrors({});
    saveStep('personal', result.data);
    router.push('/onboarding/location-professional-details');
  }

  return (
    <OnboardingShell
      step={2}
      activePercent={activePercent}
      title="Personal & Religious Details"
      subtitle="A few more details about you"
    >
      <form className="flex flex-col gap-4" onSubmit={handleSubmit} noValidate>
        <PersonalReligiousFields form={form} errors={errors} onChange={update} />
        <Button type="submit" size="lg" className="mt-2">
          Next
        </Button>
      </form>
    </OnboardingShell>
  );
}
