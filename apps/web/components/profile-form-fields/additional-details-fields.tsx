'use client';

import { NET_WORTH_FAMILY_STATUS, NET_WORTH_RANGES, type AdditionalDetails } from '@nadar-kalyanam/schemas';
import { Sparkles } from 'lucide-react';
import { Field, Select, Textarea } from '@nadar-kalyanam/ui';
import { isRequired } from '../../lib/required-fields';
import { useSubjectLabels } from './profile-for';

export type AdditionalDetailsFormState = Record<keyof AdditionalDetails, string>;

export function AdditionalDetailsFields({
  form,
  errors,
  onChange,
  writeAbout,
}: {
  form: AdditionalDetailsFormState;
  errors: Record<string, string>;
  onChange: <K extends keyof AdditionalDetailsFormState>(key: K, value: string) => void;
  // Returns a two-line About you from the member's other answers
  // (lib/about-draft.ts); shows the "Write it for me" button when given.
  writeAbout?: () => string;
}) {
  const subject = useSubjectLabels();
  return (
    <>
      <Field
        label="Family status"
        htmlFor="familyType"
        required={isRequired('additional', 'familyType')}
        error={errors.familyType}
      >
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

      {form.familyType === NET_WORTH_FAMILY_STATUS && (
        <Field
          label="Family net worth (optional)"
          htmlFor="netWorth"
          required={isRequired('additional', 'netWorth')}
          error={errors.netWorth}
        >
          <Select
            id="netWorth"
            invalid={Boolean(errors.netWorth)}
            value={form.netWorth}
            onChange={(e) => onChange('netWorth', e.target.value)}
          >
            <option value="">Select</option>
            {NET_WORTH_RANGES.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </Select>
        </Field>
      )}

      <Field
        label={subject.about}
        htmlFor="about"
        required={isRequired('additional', 'about')}
        error={errors.about}
        hint="At least 50 characters. You can edit anything written for you."
      >
        <Textarea
          id="about"
          invalid={Boolean(errors.about)}
          value={form.about}
          onChange={(e) => onChange('about', e.target.value)}
        />
      </Field>

      {writeAbout && (
        <button
          type="button"
          onClick={() => onChange('about', writeAbout())}
          data-testid="write-about"
          className="inline-flex items-center gap-1.5 self-end text-xs font-semibold text-nk-maroon hover:text-nk-maroon-deep"
        >
          <Sparkles className="h-3.5 w-3.5" />
          {form.about.trim() ? 'Write it again for me' : 'Write it for me'}
        </button>
      )}
    </>
  );
}
