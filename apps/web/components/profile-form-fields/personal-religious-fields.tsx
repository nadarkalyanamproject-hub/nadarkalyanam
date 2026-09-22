'use client';

import type { PersonalReligious } from '@nadar-kalyanam/schemas';
import { Field, Input, Select } from '@nadar-kalyanam/ui';

export type PersonalReligiousFormState = Record<keyof PersonalReligious, string>;

const HEIGHT_OPTIONS = Array.from({ length: 78 - 54 + 1 }, (_, i) => {
  const totalInches = 54 + i; // 4'6" to 6'6"
  const feet = Math.floor(totalInches / 12);
  const inches = totalInches % 12;
  const cm = Math.round(totalInches * 2.54);
  return `${feet}'${inches}" (${cm} cm)`;
});

export function PersonalReligiousFields({
  form,
  errors,
  onChange,
}: {
  form: PersonalReligiousFormState;
  errors: Record<string, string>;
  onChange: <K extends keyof PersonalReligiousFormState>(key: K, value: string) => void;
}) {
  return (
    <>
      <div className="grid grid-cols-2 gap-4">
        <Field label="Height" htmlFor="height" error={errors.height}>
          <Select
            id="height"
            invalid={Boolean(errors.height)}
            value={form.height}
            onChange={(e) => onChange('height', e.target.value)}
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
            onChange={(e) => onChange('physicalStatus', e.target.value)}
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
            onChange={(e) => onChange('maritalStatus', e.target.value)}
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
            onChange={(e) => onChange('religion', e.target.value)}
          />
        </Field>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <Field label="Community" htmlFor="casteCommunity" error={errors.casteCommunity}>
          <Input
            id="casteCommunity"
            invalid={Boolean(errors.casteCommunity)}
            value={form.casteCommunity}
            onChange={(e) => onChange('casteCommunity', e.target.value)}
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
            onChange={(e) => onChange('dosham', e.target.value)}
          >
            <option value="">Select</option>
            <option value="NO">No</option>
            <option value="YES">Yes</option>
            <option value="DONT_KNOW">Don&apos;t know</option>
          </Select>
        </Field>
      </div>
    </>
  );
}
