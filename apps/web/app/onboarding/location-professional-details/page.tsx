'use client';

import { useRouter } from 'next/navigation';
import { Suspense, useEffect, useState, type FormEvent } from 'react';
import { locationProfessionalSchema } from '@nadar-kalyanam/schemas';
import { Button, FormError } from '@nadar-kalyanam/ui';
import { OnboardingShell } from '../../../components/onboarding-shell';
import {
  LocationProfessionalFields,
  type LocationProfessionalFormState,
} from '../../../components/profile-form-fields/location-professional-fields';
import { getOverallCompletionPercent } from '../../../lib/onboarding-progress';
import { toFieldErrors } from '../../../lib/zod-errors';
import { INCOMPLETE_STEP_MESSAGE, incompleteStepErrors, useIncompleteVisit } from '../../../lib/incomplete-step';
import { useRequireAuth } from '../../../lib/use-require-auth';
import { useLeaveFinishedWizard } from '../../../lib/use-leave-finished-wizard';
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

// Mounts the step only once the saved draft has been loaded from localStorage.
export default function LocationProfessionalDetailsPage() {
  const { hydrated } = useRegistration();
  return hydrated ? (
    <Suspense fallback={null}>
      <LocationProfessionalStep />
    </Suspense>
  ) : null;
}

function LocationProfessionalStep() {
  const router = useRouter();
  const { ready } = useRequireAuth();
  const leavingFinishedWizard = useLeaveFinishedWizard(ready);
  const { data, saveStep, saveStepInput } = useRegistration();

  const [form, setForm] = useState<FormState>(() => ({
    ...EMPTY_FORM,
    ...(data.location as unknown as Partial<FormState>),
    ...(data.stepInputs?.location as Partial<FormState> | undefined),
  }));

  const incomplete = useIncompleteVisit();
  const [errors, setErrors] = useState<Record<string, string>>(() => incompleteStepErrors(incomplete, locationProfessionalSchema, form));
  const [incompleteNotice, setIncompleteNotice] = useState(incomplete);

  useEffect(() => {
    saveStepInput('location', form);
  }, [form, saveStepInput]);

  if (!ready || leavingFinishedWizard) return null;

  const activePercent = getOverallCompletionPercent(data, 3, form);

  function update<K extends keyof FormState>(key: K, value: string) {
    setForm((prev: FormState) => ({ ...prev, [key]: value }));
  }

  const isCountryValid = Boolean(form.country && form.country.trim() !== '');
  const isStateValid = Boolean(form.state && form.state.trim() !== '');
  const isCityValid = Boolean(
    (form.city && form.city !== 'Others' && form.city.trim() !== '') ||
    (form.city === 'Others' && form.cityOther && form.cityOther.trim() !== '')
  );
  const isEducationValid = Boolean(
    (form.educationLevel && form.educationLevel !== 'Other' && form.educationLevel.trim() !== '') ||
    (form.educationLevel === 'Other' && form.educationLevelOther && form.educationLevelOther.trim() !== '')
  );
  const isEmploymentValid = Boolean(
    (form.employedIn && form.employedIn !== 'Other' && form.employedIn.trim() !== '') ||
    (form.employedIn === 'Other' && form.employedInOther && form.employedInOther.trim() !== '')
  );
  const isOccupationValid = Boolean(
    (form.profession && form.profession !== 'Other' && form.profession.trim() !== '') ||
    (form.profession === 'Other' && form.professionOther && form.professionOther.trim() !== '')
  );
  const isIncomeValid = Boolean(
    (form.annualIncomeRange && form.annualIncomeRange !== 'Other' && form.annualIncomeRange.trim() !== '') ||
    (form.annualIncomeRange === 'Other' && form.annualIncomeRangeOther && form.annualIncomeRangeOther.trim() !== '')
  );

  const isComplete =
    isCountryValid &&
    isStateValid &&
    isCityValid &&
    isEducationValid &&
    isEmploymentValid &&
    isOccupationValid &&
    isIncomeValid;

  function handleBack() {
    saveStepInput('location', form);
    router.push('/onboarding/personal-religious-details');
  }

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const resolvedCity = form.city === 'Others' && form.cityOther?.trim() ? form.cityOther.trim() : form.city;
    const resolvedEducation = form.educationLevel === 'Other' && form.educationLevelOther?.trim() ? form.educationLevelOther.trim() : form.educationLevel;
    const resolvedDetail = form.educationDetail === 'Other' && form.educationDetailOther?.trim() ? form.educationDetailOther.trim() : form.educationDetail;
    const resolvedEmployment = form.employedIn === 'Other' && form.employedInOther?.trim() ? form.employedInOther.trim() : form.employedIn;
    const resolvedOccupation = form.profession === 'Other' && form.professionOther?.trim() ? form.professionOther.trim() : form.profession;
    const resolvedIncome = form.annualIncomeRange === 'Other' && form.annualIncomeRangeOther?.trim() ? form.annualIncomeRangeOther.trim() : form.annualIncomeRange;

    const payload = {
      city: resolvedCity,
      state: form.state,
      country: form.country || 'India',
      educationLevel: resolvedEducation,
      educationDetail: resolvedDetail,
      profession: resolvedOccupation,
      employedIn: resolvedEmployment,
      annualIncomeRange: resolvedIncome,
      annualIncomeCurrency: form.annualIncomeCurrency || 'INR',
    };

    const result = locationProfessionalSchema.safeParse(payload);
    if (!result.success) {
      setErrors(toFieldErrors(result.error));
      return;
    }
    setErrors({});
    setIncompleteNotice(false);
    saveStep('location', result.data);
    router.push('/onboarding/additional-details');
  }

  return (
    <OnboardingShell
      step={3}
      activePercent={activePercent}
      onBack={handleBack}
      title="Location & Professional Details"
      subtitle="Where you live and what you do"
    >
      <form className="flex flex-col gap-5" onSubmit={handleSubmit} noValidate>
        {incompleteNotice ? <FormError>{INCOMPLETE_STEP_MESSAGE}</FormError> : null}
        <LocationProfessionalFields form={form} errors={errors} onChange={update} />
        <div className="mt-2 flex justify-end">
          <Button type="submit" size="md" className="min-w-32" disabled={!isComplete}>
            Next
          </Button>
        </div>
      </form>
    </OnboardingShell>
  );
}
