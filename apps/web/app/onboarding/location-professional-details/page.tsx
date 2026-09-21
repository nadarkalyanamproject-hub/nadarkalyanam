'use client';

import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import { locationProfessionalSchema, type LocationProfessional } from '@nadar-kalyanam/schemas';
import { Button, Field, Input, Select } from '@nadar-kalyanam/ui';
import { OnboardingShell } from '../../../components/onboarding-shell';
import { getOverallCompletionPercent } from '../../../lib/onboarding-progress';
import { toFieldErrors } from '../../../lib/zod-errors';
import { useRequireAuth } from '../../../lib/use-require-auth';
import { useRegistration } from '../../providers/registration-provider';

type FormState = Record<keyof LocationProfessional, string>;

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

const INDIA_STATES_AND_UTS = [
  'Andaman and Nicobar Islands',
  'Andhra Pradesh',
  'Arunachal Pradesh',
  'Assam',
  'Bihar',
  'Chandigarh',
  'Chhattisgarh',
  'Dadra and Nagar Haveli and Daman and Diu',
  'Delhi',
  'Goa',
  'Gujarat',
  'Haryana',
  'Himachal Pradesh',
  'Jammu and Kashmir',
  'Jharkhand',
  'Karnataka',
  'Kerala',
  'Ladakh',
  'Lakshadweep',
  'Madhya Pradesh',
  'Maharashtra',
  'Manipur',
  'Meghalaya',
  'Mizoram',
  'Nagaland',
  'Odisha',
  'Puducherry',
  'Punjab',
  'Rajasthan',
  'Sikkim',
  'Tamil Nadu',
  'Telangana',
  'Tripura',
  'Uttar Pradesh',
  'Uttarakhand',
  'West Bengal',
];

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
    setForm((prev) => ({ ...prev, [key]: value }));
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
        <div className="grid grid-cols-3 gap-4">
          <Field label="City" htmlFor="city" error={errors.city}>
            <Input
              id="city"
              invalid={Boolean(errors.city)}
              value={form.city}
              onChange={(e) => update('city', e.target.value)}
            />
          </Field>
          <Field label="State" htmlFor="state" error={errors.state}>
            <Select
              id="state"
              invalid={Boolean(errors.state)}
              value={form.state}
              onChange={(e) => update('state', e.target.value)}
            >
              <option value="">Select</option>
              {INDIA_STATES_AND_UTS.map((state) => (
                <option key={state} value={state}>
                  {state}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Country" htmlFor="country" error={errors.country}>
            <Select id="country" disabled value={form.country} onChange={(e) => update('country', e.target.value)}>
              <option value="India">India</option>
            </Select>
          </Field>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <Field label="Educational details" htmlFor="educationLevel" error={errors.educationLevel}>
            <Input
              id="educationLevel"
              placeholder="e.g. Bachelors"
              invalid={Boolean(errors.educationLevel)}
              value={form.educationLevel}
              onChange={(e) => update('educationLevel', e.target.value)}
            />
          </Field>
          <Field label="Education detail" htmlFor="educationDetail" error={errors.educationDetail}>
            <Input
              id="educationDetail"
              placeholder="e.g. B.Tech Computer Science"
              invalid={Boolean(errors.educationDetail)}
              value={form.educationDetail}
              onChange={(e) => update('educationDetail', e.target.value)}
            />
          </Field>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <Field label="Occupation" htmlFor="profession" error={errors.profession}>
            <Input
              id="profession"
              invalid={Boolean(errors.profession)}
              value={form.profession}
              onChange={(e) => update('profession', e.target.value)}
            />
          </Field>
          <Field label="Employment type" htmlFor="employedIn" error={errors.employedIn}>
            <Input
              id="employedIn"
              placeholder="e.g. Private, Government"
              invalid={Boolean(errors.employedIn)}
              value={form.employedIn}
              onChange={(e) => update('employedIn', e.target.value)}
            />
          </Field>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <Field label="Annual income" htmlFor="annualIncomeRange" error={errors.annualIncomeRange}>
            <Input
              id="annualIncomeRange"
              placeholder="e.g. 10-15 LPA"
              invalid={Boolean(errors.annualIncomeRange)}
              value={form.annualIncomeRange}
              onChange={(e) => update('annualIncomeRange', e.target.value)}
            />
          </Field>
          <Field
            label="Annual income currency"
            htmlFor="annualIncomeCurrency"
            error={errors.annualIncomeCurrency}
          >
            <Select
              id="annualIncomeCurrency"
              disabled
              invalid={Boolean(errors.annualIncomeCurrency)}
              value={form.annualIncomeCurrency}
              onChange={(e) => update('annualIncomeCurrency', e.target.value)}
            >
              <option value="INR">INR - Indian Rupee</option>
            </Select>
          </Field>
        </div>

        <Button type="submit" size="lg" className="mt-2">
          Next
        </Button>
      </form>
    </OnboardingShell>
  );
}
