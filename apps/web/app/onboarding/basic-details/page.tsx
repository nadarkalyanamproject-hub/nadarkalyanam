'use client';

import { useRouter } from 'next/navigation';
import { Suspense, useEffect, useState, type FormEvent } from 'react';
import { basicDetailsSchema } from '@nadar-kalyanam/schemas';
import { Button, FormError } from '@nadar-kalyanam/ui';
import { OnboardingShell } from '../../../components/onboarding-shell';
import {
  BasicDetailsFields,
  type BasicDetailsFormState,
} from '../../../components/profile-form-fields/basic-details-fields';
import { getOverallCompletionPercent } from '../../../lib/onboarding-progress';
import { toFieldErrors } from '../../../lib/zod-errors';
import { INCOMPLETE_STEP_MESSAGE, incompleteStepErrors, useIncompleteVisit } from '../../../lib/incomplete-step';
import { useRequireAuth } from '../../../lib/use-require-auth';
import { useLeaveFinishedWizard } from '../../../lib/use-leave-finished-wizard';
import { useRegistration } from '../../providers/registration-provider';
import { useIdentityStatus } from '../../../lib/identity-status';
import { logout } from '../../../lib/api-client';
import { claimAuthRedirect } from '../../../lib/auth-events';

type FormState = BasicDetailsFormState;

const EMPTY_FORM: FormState = {
  fullName: '',
  gender: '',
  dateOfBirth: '',
  religion: '',
  email: '',
  casteCommunity: '',
};

// The form's initial values come from the saved draft, which the provider
// loads from localStorage only after mount — so the step mounts after that.
export default function BasicDetailsPage() {
  const { hydrated } = useRegistration();
  return hydrated ? (
    <Suspense fallback={null}>
      <BasicDetailsStep />
    </Suspense>
  ) : null;
}

function BasicDetailsStep() {
  const router = useRouter();
  const { ready } = useRequireAuth();
  const leavingFinishedWizard = useLeaveFinishedWizard(ready);
  const { data, saveStep, saveStepInput, clearAuth } = useRegistration();
  const [leaving, setLeaving] = useState(false);

  // Latest raw input wins over the last validated save, so whatever was
  // typed (even unsaved/invalid) is what comes back.
  const [form, setForm] = useState<FormState>(() => ({
    ...EMPTY_FORM,
    fullName: data.basicDetails?.fullName ?? data.fullNamePrefill ?? EMPTY_FORM.fullName,
    gender: data.basicDetails?.gender ?? data.genderPrefill ?? EMPTY_FORM.gender,
    dateOfBirth: data.basicDetails?.dateOfBirth ?? EMPTY_FORM.dateOfBirth,
    religion: data.basicDetails?.religion ?? EMPTY_FORM.religion,
    email: data.basicDetails?.email ?? EMPTY_FORM.email,
    casteCommunity: data.basicDetails?.casteCommunity ?? EMPTY_FORM.casteCommunity,
    ...(data.stepInputs?.basicDetails as Partial<FormState> | undefined),
  }));

  const incomplete = useIncompleteVisit();
  const [errors, setErrors] = useState<Record<string, string>>(() => incompleteStepErrors(incomplete, basicDetailsSchema, form));
  const [incompleteNotice, setIncompleteNotice] = useState(incomplete);
  const identity = useIdentityStatus(data.accessToken)?.identity ?? null;
  // Verified with DigiLocker: name and date of birth come from the ID.
  const values: FormState = identity ? { ...form, fullName: identity.name, dateOfBirth: identity.dateOfBirth } : form;

  useEffect(() => {
    saveStepInput('basicDetails', form);
  }, [form, saveStepInput]);

  if (!ready || leavingFinishedWizard) return null;

  const activePercent = getOverallCompletionPercent(data, 1, values);

  function update<K extends keyof FormState>(key: K, value: string) {
    setForm((prev: FormState) => ({ ...prev, [key]: value }));
  }

  const isFullNameValid = Boolean(values.fullName && values.fullName.trim().length >= 2);
  const isGenderValid = Boolean(values.gender && ['MALE', 'FEMALE', 'OTHER'].includes(values.gender));
  const isDobValid = Boolean(values.dateOfBirth && /^\d{4}-\d{2}-\d{2}$/.test(values.dateOfBirth));
  const isReligionValid = Boolean(values.religion && values.religion.trim() !== '');
  const isEmailValid = Boolean(values.email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email.trim()));
  const isCasteValid = Boolean(values.casteCommunity && values.casteCommunity.trim() !== '');
  const isComplete = isFullNameValid && isGenderValid && isDobValid && isReligionValid && isEmailValid && isCasteValid;

  async function handleBack() {
    if (leaving) return;
    setLeaving(true);
    claimAuthRedirect();
    try {
      if (data.accessToken) await logout(data.accessToken);
    } catch {
      // Signed out locally below anyway; the token expires on its own.
    } finally {
      clearAuth();
      router.push('/');
    }
  }

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const result = basicDetailsSchema.safeParse({
      fullName: values.fullName,
      gender: values.gender,
      dateOfBirth: values.dateOfBirth,
      religion: values.religion,
      email: values.email,
      casteCommunity: values.casteCommunity,
    });

    if (!result.success) {
      setErrors(toFieldErrors(result.error));
      return;
    }

    setErrors({});
    setIncompleteNotice(false);

    saveStep('basicDetails', result.data);
    router.push('/onboarding/personal-religious-details');
  }

  return (
    <OnboardingShell
      step={1}
      activePercent={activePercent}
      onBack={handleBack}
      backDisabled={leaving}
      backLabel="Back to log in"
      title="Basic Details"
      subtitle="Tell us a little about yourself"
    >
      <form className="flex flex-col gap-5" onSubmit={handleSubmit} noValidate>
        {incompleteNotice ? <FormError>{INCOMPLETE_STEP_MESSAGE}</FormError> : null}
        <BasicDetailsFields form={values} errors={errors} onChange={update} identityLocked={Boolean(identity)} />
        <div className="mt-2 flex justify-end">
          <Button type="submit" size="md" className="min-w-32" disabled={!isComplete}>
            Next
          </Button>
        </div>
      </form>
    </OnboardingShell>
  );
}
