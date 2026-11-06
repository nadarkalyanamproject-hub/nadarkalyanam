'use client';

import { useRouter } from 'next/navigation';
import { Suspense, useEffect, useState, type FormEvent } from 'react';
import { personalReligiousSchema } from '@nadar-kalyanam/schemas';
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
import { useRegistration } from '../../providers/registration-provider';

type FormState = PersonalReligiousFormState;

const EMPTY_FORM: FormState = {
  height: '',
  physicalStatus: 'NORMAL',
  complexion: '',
  maritalStatus: '',
  dosham: '',
  previousMarriageDetails: '',
  doshamDetails: '',
};

// Mounts the step only once the saved draft has been loaded from
// localStorage, so the form can start from it (see basic-details).
export default function PersonalReligiousDetailsPage() {
  const { hydrated } = useRegistration();
  // Suspense: the step reads ?incomplete via useSearchParams.
  return hydrated ? (
    <Suspense fallback={null}>
      <PersonalReligiousStep />
    </Suspense>
  ) : null;
}

function PersonalReligiousStep() {
  const router = useRouter();
  const { ready } = useRequireAuth();
  const { data, saveStep, saveStepInput } = useRegistration();

  const [form, setForm] = useState<FormState>(() => ({
    ...EMPTY_FORM,
    ...(data.personal as unknown as Partial<FormState>),
    ...(data.stepInputs?.personal as Partial<FormState> | undefined),
  }));
  // Sent back from the last step because this step's saved data is
  // incomplete: mark what's missing straight away.
  const incomplete = useIncompleteVisit();
  const [errors, setErrors] = useState<Record<string, string>>(() => incompleteStepErrors(incomplete, personalReligiousSchema, form));
  const [incompleteNotice, setIncompleteNotice] = useState(incomplete);

  // Raw input is kept in the draft on every edit (no validation).
  useEffect(() => {
    saveStepInput('personal', form);
  }, [form, saveStepInput]);

  if (!ready) return null;

  const activePercent = getOverallCompletionPercent(data, 2, form);

  function update<K extends keyof FormState>(key: K, value: string) {
    setForm((prev: FormState) => ({ ...prev, [key]: value }));
  }

  // Back keeps this step's input exactly as typed (no validation) and never
  // touches the rest of the draft.
  function handleBack() {
    saveStepInput('personal', form);
    router.push('/onboarding/basic-details');
  }

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const result = personalReligiousSchema.safeParse(form);
    if (!result.success) {
      setErrors(toFieldErrors(result.error));
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
      title="Personal & Religious Details"
      subtitle="A few more details about you"
    >
      <form className="flex flex-col gap-4" onSubmit={handleSubmit} noValidate>
        {incompleteNotice ? <FormError>{INCOMPLETE_STEP_MESSAGE}</FormError> : null}
        <PersonalReligiousFields form={form} errors={errors} onChange={update} />
        <div className="mt-2 flex justify-end">
          <Button type="submit" size="md" className="min-w-32">
            Next
          </Button>
        </div>
      </form>
    </OnboardingShell>
  );
}
