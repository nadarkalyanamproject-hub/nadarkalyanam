'use client';

import type { AdditionalDetails } from '@nadar-kalyanam/schemas';
import { Field, Select, Textarea } from '@nadar-kalyanam/ui';

export type AdditionalDetailsFormState = Record<keyof AdditionalDetails, string>;

export function AdditionalDetailsFields({
  form,
  errors,
  onChange,
}: {
  form: AdditionalDetailsFormState;
  errors: Record<string, string>;
  onChange: <K extends keyof AdditionalDetailsFormState>(key: K, value: string) => void;
}) {
  return (
    <>
      <Field label="Family status" htmlFor="familyType" error={errors.familyType}>
        <Select
          id="familyType"
          invalid={Boolean(errors.familyType)}
          value={form.familyType}
          onChange={(e) => onChange('familyType', e.target.value)}
        >
          <option value="">Select</option>
          <option value="Middle Class">Middle Class</option>
          <option value="Upper Middle Class">Upper Middle Class</option>
          <option value="Rich / Affluent (Elite)">Rich / Affluent (Elite)</option>
        </Select>
      </Field>

      <Field label="About you" htmlFor="about" error={errors.about} hint="At least 50 characters">
        <Textarea
          id="about"
          invalid={Boolean(errors.about)}
          value={form.about}
          onChange={(e) => onChange('about', e.target.value)}
        />
      </Field>
    </>
  );
}
