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
  casteCommunity: '',
  email: '',
};

// The form's initial values come from the saved draft, which the provider
// loads from localStorage only after mount — so the step mounts after that.
// (Initializing any earlier is how a reload used to show an empty form.)
export default function BasicDetailsPage() {
  const { hydrated } = useRegistration();
  // Suspense: the step reads ?incomplete via useSearchParams.
  return hydrated ? (
    <Suspense fallback={null}>
      <BasicDetailsStep />
    </Suspense>
  ) : null;
}

function BasicDetailsStep() {
  const router = useRouter();
  const { ready } = useRequireAuth();
  const { data, saveStep, saveStepInput, clearAuth } = useRegistration();
  const [leaving, setLeaving] = useState(false);

  // Latest raw input wins over the last validated save, so whatever was
  // typed (even unsaved/invalid) is what comes back.
  const [form, setForm] = useState<FormState>(() => ({
    ...EMPTY_FORM,
    fullName: data.fullNamePrefill ?? EMPTY_FORM.fullName,
    gender: data.basicDetails?.gender ?? data.genderPrefill ?? EMPTY_FORM.gender,
    ...(data.basicDetails as unknown as Partial<FormState>),
    ...(data.stepInputs?.basicDetails as Partial<FormState> | undefined),
  }));
  // Sent back from the last step because this step's saved data is
  // incomplete: mark what's missing straight away.
  const incomplete = useIncompleteVisit();
  const [errors, setErrors] = useState<Record<string, string>>(() => incompleteStepErrors(incomplete, basicDetailsSchema, form));
  const [incompleteNotice, setIncompleteNotice] = useState(incomplete);
  const identity = useIdentityStatus(data.accessToken)?.identity ?? null;
  // Verified with DigiLocker: name and date of birth come from the ID.
  const values: FormState = identity ? { ...form, fullName: identity.name, dateOfBirth: identity.dateOfBirth } : form;

  // Every edit is also kept in the draft (unvalidated), so browser Back and
  // reload keep it too.
  useEffect(() => {
    saveStepInput('basicDetails', form);
  }, [form, saveStepInput]);

  if (!ready) return null;

  const activePercent = getOverallCompletionPercent(data, 1, values);

  function update<K extends keyof FormState>(key: K, value: string) {
    setForm((prev: FormState) => ({ ...prev, [key]: value }));
  }

  // There's no step before this one, and while signed in without a profile
  // every member page sends them back here, so Back signs out (as the
  // header's Log out does) and returns to the landing page.
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
    const result = basicDetailsSchema.safeParse(values);
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
      <form className="flex flex-col gap-4" onSubmit={handleSubmit} noValidate>
        {incompleteNotice ? <FormError>{INCOMPLETE_STEP_MESSAGE}</FormError> : null}
        <BasicDetailsFields form={values} errors={errors} onChange={update} identityLocked={Boolean(identity)} />
        <div className="mt-2 flex justify-end">
          <Button type="submit" size="md" className="min-w-32">
            Next
          </Button>
        </div>
      </form>
    </OnboardingShell>
  );
}
