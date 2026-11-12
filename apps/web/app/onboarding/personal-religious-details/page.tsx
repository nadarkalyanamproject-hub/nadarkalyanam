'use client';

import { useRouter } from 'next/navigation';
import { Suspense, useEffect, useState, type FormEvent } from 'react';
import { PRIOR_MARRIAGE_STATUSES, personalReligiousSchema } from '@nadar-kalyanam/schemas';
import { Button, FormError } from '@nadar-kalyanam/ui';
import { OnboardingShell } from '../../../components/onboarding-shell';
import {
  PersonalReligiousFields,
  type PersonalReligiousFormState,
} from '../../../components/profile-form-fields/personal-religious-fields';
import { getOverallCompletionPercent } from '../../../lib/onboarding-progress';
import { toFieldErrors } from '../../../lib/zod-errors';
import { INCOMPLETE_STEP_MESSAGE, incompleteStepErrors, useIncompleteVisit } from '../../../lib/incomplete-step';
import { useRequireAuth } from '../../../lib/use-require-auth';
import { useLeaveFinishedWizard } from '../../../lib/use-leave-finished-wizard';
import { useRegistration } from '../../providers/registration-provider';

type FormState = PersonalReligiousFormState;

const EMPTY_FORM: FormState = {
  height: '',
  physicalStatus: '',
  maritalStatus: '',
  previousMarriageDetails: '',
  complexion: '',
  dosham: '',
  doshamDetails: '',
};

// Mounts the step only once the saved draft has been loaded from
// localStorage, so the form can start from it.
export default function PersonalReligiousDetailsPage() {
  const { hydrated } = useRegistration();
  return hydrated ? (
    <Suspense fallback={null}>
      <PersonalReligiousStep />
    </Suspense>
  ) : null;
}

function PersonalReligiousStep() {
  const router = useRouter();
  const { ready } = useRequireAuth();
  const leavingFinishedWizard = useLeaveFinishedWizard(ready);
  const { data, saveStep, saveStepInput } = useRegistration();

  const [form, setForm] = useState<FormState>(() => {
    const rawStepInputs = (data.stepInputs?.personal as Partial<FormState> | undefined) ?? {};
    const existingPersonal = (data.personal as unknown as Partial<FormState>) ?? {};

    return {
      ...EMPTY_FORM,
      ...existingPersonal,
      ...rawStepInputs,
    };
  });

  const incomplete = useIncompleteVisit();
  const [errors, setErrors] = useState<Record<string, string>>(() => incompleteStepErrors(incomplete, personalReligiousSchema, form));
  const [incompleteNotice, setIncompleteNotice] = useState(incomplete);

  useEffect(() => {
    saveStepInput('personal', form as unknown as Record<string, string>);
  }, [form, saveStepInput]);

  if (!ready || leavingFinishedWizard) return null;

  const activePercent = getOverallCompletionPercent(data, 2, form);

  function update<K extends keyof FormState>(key: K, value: string) {
    setForm((prev: FormState) => ({ ...prev, [key]: value }));
  }

  const isHeightValid = Boolean(form.height && form.height.trim() !== '');
  const isPhysicalValid = Boolean(form.physicalStatus && form.physicalStatus.trim() !== '');
  const isMaritalValid = Boolean(form.maritalStatus && form.maritalStatus.trim() !== '');
  const isPreviousMarriageValid = !PRIOR_MARRIAGE_STATUSES.includes(form.maritalStatus) || Boolean(form.previousMarriageDetails?.trim());
  const isDoshamValid = form.dosham !== 'YES' || Boolean(form.doshamDetails?.trim());

  const isComplete =
    isHeightValid &&
    isPhysicalValid &&
    isMaritalValid &&
    isPreviousMarriageValid &&
    isDoshamValid;

  function handleBack() {
    saveStepInput('personal', form as unknown as Record<string, string>);
    router.push('/onboarding/basic-details');
  }

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const result = personalReligiousSchema.safeParse(form);

    if (!result.success) {
      setErrors(toFieldErrors(result.error));
      return;
    }

    if (!isDoshamValid) {
      setErrors({ doshamDetails: 'Select your dosham details' });
      return;
    }

    setErrors({});
    setIncompleteNotice(false);

    saveStep('personal', result.data);
    router.push('/onboarding/location-professional-details');
  }

  return (
    <OnboardingShell
      step={2}
      activePercent={activePercent}
      onBack={handleBack}
      title="Personal Details"
      subtitle="A few more details about you"
    >
      <form className="flex flex-col gap-5" onSubmit={handleSubmit} noValidate>
        {incompleteNotice ? <FormError>{INCOMPLETE_STEP_MESSAGE}</FormError> : null}
        <PersonalReligiousFields form={form} errors={errors} onChange={update} />
        <div className="mt-2 flex justify-end">
          <Button type="submit" size="md" className="min-w-32" disabled={!isComplete}>
            Next
          </Button>
        </div>
      </form>
    </OnboardingShell>
  );
}
