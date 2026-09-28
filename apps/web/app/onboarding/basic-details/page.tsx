'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState, type FormEvent } from 'react';
import { basicDetailsSchema } from '@nadar-kalyanam/schemas';
import { Button } from '@nadar-kalyanam/ui';
import { OnboardingShell } from '../../../components/onboarding-shell';
import {
  BasicDetailsFields,
  type BasicDetailsFormState,
} from '../../../components/profile-form-fields/basic-details-fields';
import { getOverallCompletionPercent } from '../../../lib/onboarding-progress';
import { toFieldErrors } from '../../../lib/zod-errors';
import { useRequireAuth } from '../../../lib/use-require-auth';
import { useRegistration } from '../../providers/registration-provider';

type FormState = BasicDetailsFormState;

const EMPTY_FORM: FormState = {
  fullName: '',
  gender: '',
  dateOfBirth: '',
  motherTongue: '',
  email: '',
};

// The form's initial values come from the saved draft, which the provider
// loads from localStorage only after mount — so the step mounts after that.
// (Initializing any earlier is how a reload used to show an empty form.)
export default function BasicDetailsPage() {
  const { hydrated } = useRegistration();
  return hydrated ? <BasicDetailsStep /> : null;
}

function BasicDetailsStep() {
  const router = useRouter();
  const { ready } = useRequireAuth();
  const { data, saveStep, saveStepInput } = useRegistration();

  // Latest raw input wins over the last validated save, so whatever was
  // typed (even unsaved/invalid) is what comes back.
  const [form, setForm] = useState<FormState>(() => ({
    ...EMPTY_FORM,
    fullName: data.fullNamePrefill ?? EMPTY_FORM.fullName,
    gender: data.basicDetails?.gender ?? data.genderPrefill ?? EMPTY_FORM.gender,
    ...(data.basicDetails as unknown as Partial<FormState>),
    ...(data.stepInputs?.basicDetails as Partial<FormState> | undefined),
  }));
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Every edit is also kept in the draft (unvalidated), so browser Back and
  // reload keep it too.
  useEffect(() => {
    saveStepInput('basicDetails', form);
  }, [form, saveStepInput]);

  if (!ready) return null;

  const activePercent = getOverallCompletionPercent(data, 1, form);

  function update<K extends keyof FormState>(key: K, value: string) {
    setForm((prev: FormState) => ({ ...prev, [key]: value }));
  }

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const result = basicDetailsSchema.safeParse(form);
    if (!result.success) {
      setErrors(toFieldErrors(result.error));
      return;
    }
    setErrors({});
    saveStep('basicDetails', result.data);
    router.push('/onboarding/personal-religious-details');
  }

  return (
    <OnboardingShell
      step={1}
      activePercent={activePercent}
      title="Basic Details"
      subtitle="Tell us a little about yourself"
    >
      <form className="flex flex-col gap-4" onSubmit={handleSubmit} noValidate>
        <BasicDetailsFields form={form} errors={errors} onChange={update} />
        <Button type="submit" size="lg" className="mt-2">
          Next
        </Button>
      </form>
    </OnboardingShell>
  );
}
