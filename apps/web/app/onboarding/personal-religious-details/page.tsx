'use client';

import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import { personalReligiousSchema, type PersonalReligious } from '@nadar-kalyanam/schemas';
import { Button, Field, Input, Select } from '@nadar-kalyanam/ui';
import { OnboardingShell } from '../../../components/onboarding-shell';
import { getOverallCompletionPercent } from '../../../lib/onboarding-progress';
import { toFieldErrors } from '../../../lib/zod-errors';
import { useRequireAuth } from '../../../lib/use-require-auth';
import { useRegistration } from '../../providers/registration-provider';

type FormState = Record<keyof PersonalReligious, string>;

const EMPTY_FORM: FormState = {
  height: '',
  physicalStatus: 'NORMAL',
  maritalStatus: '',
  religion: '',
  casteCommunity: '',
  dosham: '',
};

const HEIGHT_OPTIONS = Array.from({ length: 78 - 54 + 1 }, (_, i) => {
  const totalInches = 54 + i; // 4'6" to 6'6"
  const feet = Math.floor(totalInches / 12);
  const inches = totalInches % 12;
  const cm = Math.round(totalInches * 2.54);
  return `${feet}'${inches}" (${cm} cm)`;
});

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
    setForm((prev) => ({ ...prev, [key]: value }));
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
        <div className="grid grid-cols-2 gap-4">
          <Field label="Height" htmlFor="height" error={errors.height}>
            <Select
              id="height"
              invalid={Boolean(errors.height)}
              value={form.height}
              onChange={(e) => update('height', e.target.value)}
            >
              <option value="">Select</option>
              {HEIGHT_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </Select>
          </Field>

          <Field label="Physical status" htmlFor="physicalStatus" error={errors.physicalStatus}>
            <Select
              id="physicalStatus"
              invalid={Boolean(errors.physicalStatus)}
              value={form.physicalStatus}
              onChange={(e) => update('physicalStatus', e.target.value)}
            >
              <option value="NORMAL">Normal</option>
              <option value="PHYSICALLY_CHALLENGED">Physically challenged</option>
            </Select>
          </Field>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <Field label="Marital status" htmlFor="maritalStatus" error={errors.maritalStatus}>
            <Select
              id="maritalStatus"
              invalid={Boolean(errors.maritalStatus)}
              value={form.maritalStatus}
              onChange={(e) => update('maritalStatus', e.target.value)}
            >
              <option value="">Select</option>
              <option value="NEVER_MARRIED">Never married</option>
              <option value="DIVORCED">Divorced</option>
              <option value="WIDOWED">Widowed</option>
              <option value="AWAITING_DIVORCE">Awaiting divorce</option>
            </Select>
          </Field>
          <Field label="Religion" htmlFor="religion" error={errors.religion}>
            <Input
              id="religion"
              invalid={Boolean(errors.religion)}
              value={form.religion}
              onChange={(e) => update('religion', e.target.value)}
            />
          </Field>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <Field label="Community" htmlFor="casteCommunity" error={errors.casteCommunity}>
            <Input
              id="casteCommunity"
              invalid={Boolean(errors.casteCommunity)}
              value={form.casteCommunity}
              onChange={(e) => update('casteCommunity', e.target.value)}
            />
          </Field>
          <Field
            label="Dosham (optional)"
            htmlFor="dosham"
            error={errors.dosham}
            hint="Horoscope-related detail, if applicable"
          >
            <Select
              id="dosham"
              invalid={Boolean(errors.dosham)}
              value={form.dosham}
              onChange={(e) => update('dosham', e.target.value)}
            >
              <option value="">Select</option>
              <option value="NO">No</option>
              <option value="YES">Yes</option>
              <option value="DONT_KNOW">Don&apos;t know</option>
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
