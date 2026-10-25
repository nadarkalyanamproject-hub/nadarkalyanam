'use client';

import { COMPLEXIONS, DOSHAM_TYPES, PRIOR_MARRIAGE_STATUSES, type PersonalReligious } from '@nadar-kalyanam/schemas';
import { Field, Input, Select } from '@nadar-kalyanam/ui';
import { isRequired } from '../../lib/required-fields';
import { useSubjectLabels } from './profile-for';

export type PersonalReligiousFormState = Record<keyof PersonalReligious, string>;

const HEIGHT_OPTIONS = Array.from({ length: 78 - 54 + 1 }, (_, i) => {
  const totalInches = 54 + i; // 4'6" to 6'6"
  const feet = Math.floor(totalInches / 12);
  const inches = totalInches % 12;
  const cm = Math.round(totalInches * 2.54);
  return `${feet}'${inches}" (${cm} cm)`;
});

// Religion and Nadar subcategory are asked in step 1 (BasicDetailsFields).
// Dependent fields follow the Education detail pattern: hidden until the
// parent calls for them, shown directly below it, kept while the parent still
// calls for them, and cleared the moment it no longer does, so no hidden value
// is ever saved.
export function PersonalReligiousFields({
  form,
  errors,
  onChange,
}: {
  form: PersonalReligiousFormState;
  errors: Record<string, string>;
  onChange: <K extends keyof PersonalReligiousFormState>(key: K, value: string) => void;
}) {
  const subject = useSubjectLabels();
  const showPreviousMarriage = PRIOR_MARRIAGE_STATUSES.includes(form.maritalStatus);
  const showDoshamDetails = form.dosham === 'YES';

  return (
    <>
      <div className="grid grid-cols-2 gap-4">
        <Field label={subject.label('Height')} htmlFor="height" required={isRequired('personal', 'height')} error={errors.height}>
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

        <Field
          label={subject.label('Physical status')}
          htmlFor="physicalStatus"
          required={isRequired('personal', 'physicalStatus')}
          error={errors.physicalStatus}
        >
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

      <div className="grid grid-cols-2 items-start gap-4">
        <div className="flex flex-col gap-4">
          <Field
            label={subject.label('Marital status')}
            htmlFor="maritalStatus"
            required={isRequired('personal', 'maritalStatus')}
            error={errors.maritalStatus}
          >
            <Select
              id="maritalStatus"
              invalid={Boolean(errors.maritalStatus)}
              value={form.maritalStatus}
              onChange={(e) => {
                onChange('maritalStatus', e.target.value);
                if (!PRIOR_MARRIAGE_STATUSES.includes(e.target.value) && form.previousMarriageDetails) {
                  onChange('previousMarriageDetails', '');
                }
              }}
            >
              <option value="">Select</option>
              <option value="NEVER_MARRIED">Never married</option>
              <option value="DIVORCED">Divorced</option>
              <option value="WIDOWED">Widowed</option>
              <option value="AWAITING_DIVORCE">Awaiting divorce</option>
            </Select>
          </Field>
          {showPreviousMarriage && (
            <Field
              label={subject.label('Previous marriage details')}
              htmlFor="previousMarriageDetails"
              required={isRequired('personal', 'previousMarriageDetails')}
              error={errors.previousMarriageDetails}
            >
              <Input
                id="previousMarriageDetails"
                placeholder="e.g. Divorced in 2021, no children"
                invalid={Boolean(errors.previousMarriageDetails)}
                value={form.previousMarriageDetails}
                onChange={(e) => onChange('previousMarriageDetails', e.target.value)}
              />
            </Field>
          )}
        </div>

        <Field label={subject.label('Complexion (optional)')} htmlFor="complexion" required={isRequired('personal', 'complexion')} error={errors.complexion}>
          <Select id="complexion" invalid={Boolean(errors.complexion)} value={form.complexion} onChange={(e) => onChange('complexion', e.target.value)}>
            <option value="">Select</option>
            {COMPLEXIONS.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </Select>
        </Field>
      </div>

      <div className="grid grid-cols-2 items-start gap-4">
        <div className="flex flex-col gap-4">
          <Field
            label={subject.label('Dosham (optional)')}
            htmlFor="dosham"
            required={isRequired('personal', 'dosham')}
            error={errors.dosham}
            hint="Horoscope-related detail, if applicable"
          >
            <Select
              id="dosham"
              invalid={Boolean(errors.dosham)}
              value={form.dosham}
              onChange={(e) => {
                onChange('dosham', e.target.value);
                if (e.target.value !== 'YES' && form.doshamDetails) onChange('doshamDetails', '');
              }}
            >
              <option value="">Select</option>
              <option value="NO">No</option>
              <option value="YES">Yes</option>
              <option value="DONT_KNOW">Don&apos;t know</option>
            </Select>
          </Field>
          {showDoshamDetails && (
            <Field
              label={subject.label('Dosham details')}
              htmlFor="doshamDetails"
              required={isRequired('personal', 'doshamDetails')}
              error={errors.doshamDetails}
            >
              <Select
                id="doshamDetails"
                invalid={Boolean(errors.doshamDetails)}
                value={form.doshamDetails}
                onChange={(e) => onChange('doshamDetails', e.target.value)}
              >
                <option value="">Select dosham</option>
                {/* Keeps an older free-text answer selectable until it's changed. */}
                {form.doshamDetails && !(DOSHAM_TYPES as readonly string[]).includes(form.doshamDetails) && (
                  <option value={form.doshamDetails}>{form.doshamDetails}</option>
                )}
                {DOSHAM_TYPES.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </Select>
            </Field>
          )}
        </div>
      </div>
    </>
  );
}
