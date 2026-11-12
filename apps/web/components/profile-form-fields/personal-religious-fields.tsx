'use client';

import {
  COMPLEXIONS,
  PRIOR_MARRIAGE_STATUSES,
  type PersonalReligious,
} from '@nadar-kalyanam/schemas';
import { Field, Input } from '@nadar-kalyanam/ui';
import { ProgressiveField } from '../motion/progressive-field';
import { SmartDropdown } from '../ui/smart-dropdown';
import { isRequired } from '../../lib/required-fields';
import { useSubjectLabels } from './profile-for';
import { DoshamDetailsDropdown } from './dosham-details-dropdown';

export type PersonalReligiousFormState = Record<keyof PersonalReligious, string> & {
  religion?: string;
  caste?: string;
  subcaste?: string;
  casteCommunity?: string;
};

const HEIGHT_OPTIONS = Array.from({ length: 78 - 54 + 1 }, (_, i) => {
  const totalInches = 54 + i; // 4'6" to 6'6"
  const feet = Math.floor(totalInches / 12);
  const inches = totalInches % 12;
  const cm = Math.round(totalInches * 2.54);
  return `${feet}'${inches}" (${cm} cm)`;
});

const PHYSICAL_STATUS_OPTIONS = [
  { value: 'NORMAL', label: 'Normal' },
  { value: 'PHYSICALLY_CHALLENGED', label: 'Physically challenged' },
];

const MARITAL_STATUS_OPTIONS = [
  { value: 'NEVER_MARRIED', label: 'Never married' },
  { value: 'DIVORCED', label: 'Divorced' },
  { value: 'WIDOWED', label: 'Widowed' },
  { value: 'AWAITING_DIVORCE', label: 'Awaiting divorce' },
];

const DOSHAM_OPTIONS = [
  { value: 'NO', label: 'No' },
  { value: 'YES', label: 'Yes' },
  { value: 'DONT_KNOW', label: "Don't know" },
];

export function PersonalReligiousFields({
  form,
  errors,
  onChange,
  progressive = true,
}: {
  form: PersonalReligiousFormState;
  errors: Record<string, string>;
  onChange: <K extends keyof PersonalReligiousFormState>(key: K, value: string) => void;
  progressive?: boolean;
}) {
  const subject = useSubjectLabels();
  const showPreviousMarriage = PRIOR_MARRIAGE_STATUSES.includes(form.maritalStatus);
  const showDoshamDetails = form.dosham === 'YES';

  // Progressive reveal conditions:
  // 1. Show Height first
  const isHeightComplete = Boolean(form.height && form.height.trim() !== '');
  const showPhysicalAndMarital = !progressive || isHeightComplete;

  // 2. After completing Height, display Physical Status and Marital Status together
  const isPhysicalAndMaritalComplete = Boolean(
    form.physicalStatus &&
    form.physicalStatus.trim() !== '' &&
    form.maritalStatus &&
    form.maritalStatus.trim() !== '' &&
    (!PRIOR_MARRIAGE_STATUSES.includes(form.maritalStatus) || (form.previousMarriageDetails?.trim() ?? '') !== '')
  );

  // 3. After completing both fields, display Complexion (Optional) and Dosham (Optional)
  const showComplexionAndDosham = !progressive || (isHeightComplete && isPhysicalAndMaritalComplete);

  if (!progressive) {
    return (
      <div className="flex flex-col gap-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Field label={subject.label('Height')} htmlFor="height" required={isRequired('personal', 'height')} error={errors.height}>
            <SmartDropdown
              id="height"
              invalid={Boolean(errors.height)}
              value={form.height}
              onChange={(val) => onChange('height', val)}
              options={HEIGHT_OPTIONS}
              placeholder="Select height"
              searchable={true}
              searchPlaceholder="Search height..."
            />
          </Field>

          <Field
            label={subject.label('Physical status')}
            htmlFor="physicalStatus"
            required={isRequired('personal', 'physicalStatus')}
            error={errors.physicalStatus}
          >
            <SmartDropdown
              id="physicalStatus"
              invalid={Boolean(errors.physicalStatus)}
              value={form.physicalStatus}
              onChange={(val) => onChange('physicalStatus', val)}
              options={PHYSICAL_STATUS_OPTIONS}
              placeholder="Select physical status"
              searchable={false}
            />
          </Field>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 items-start gap-4">
          <div className="flex flex-col gap-4">
            <Field
              label={subject.label('Marital status')}
              htmlFor="maritalStatus"
              required={isRequired('personal', 'maritalStatus')}
              error={errors.maritalStatus}
            >
              <SmartDropdown
                id="maritalStatus"
                invalid={Boolean(errors.maritalStatus)}
                value={form.maritalStatus}
                onChange={(val) => {
                  onChange('maritalStatus', val);
                  if (!PRIOR_MARRIAGE_STATUSES.includes(val) && form.previousMarriageDetails) {
                    onChange('previousMarriageDetails', '');
                  }
                }}
                options={MARITAL_STATUS_OPTIONS}
                placeholder="Select marital status"
                searchable={false}
              />
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
                  value={form.previousMarriageDetails ?? ''}
                  onChange={(e) => onChange('previousMarriageDetails', e.target.value)}
                />
              </Field>
            )}
          </div>

          <Field label={subject.label('Complexion (optional)')} htmlFor="complexion" required={isRequired('personal', 'complexion')} error={errors.complexion}>
            <SmartDropdown
              id="complexion"
              invalid={Boolean(errors.complexion)}
              value={form.complexion ?? ''}
              onChange={(val) => onChange('complexion', val)}
              options={COMPLEXIONS}
              placeholder="Select complexion"
              searchable={false}
            />
          </Field>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 items-start gap-4">
          <div className="flex flex-col gap-4">
            <Field
              label={subject.label('Dosham (optional)')}
              htmlFor="dosham"
              required={isRequired('personal', 'dosham')}
              error={errors.dosham}
              hint="Horoscope-related detail, if applicable"
            >
              <SmartDropdown
                id="dosham"
                invalid={Boolean(errors.dosham)}
                value={form.dosham ?? ''}
                onChange={(val) => {
                  onChange('dosham', val);
                  if (val !== 'YES' && form.doshamDetails) onChange('doshamDetails', '');
                }}
                options={DOSHAM_OPTIONS}
                placeholder="Select dosham"
                searchable={false}
              />
            </Field>
            {showDoshamDetails && (
              <DoshamDetailsDropdown
                value={form.doshamDetails ?? ''}
                onChange={(val) => onChange('doshamDetails', val)}
                error={errors.doshamDetails}
                label={subject.label('Dosham details')}
              />
            )}
          </div>
        </div>
      </div>
    );
  }

  // Progressive Onboarding Mode (Step 2):
  // 1. Show Height first.
  // 2. After completing Height, display Physical Status and Marital Status together.
  // 3. After completing both fields, display Complexion (Optional) and Dosham (Optional).
  // 4. When Dosham is YES, display attractive Dosham Details dropdown.
  return (
    <div className="flex flex-col gap-5">
      {/* 1. Height shown first */}
      <Field
        label={subject.label('Height')}
        htmlFor="height"
        required
        error={errors.height}
      >
        <SmartDropdown
          id="height"
          invalid={Boolean(errors.height)}
          value={form.height}
          onChange={(val) => onChange('height', val)}
          options={HEIGHT_OPTIONS}
          placeholder="Select height"
          searchable={true}
          searchPlaceholder="Search height..."
        />
      </Field>

      {/* 2. Physical Status and Marital Status together after Height is completed */}
      {showPhysicalAndMarital && (
        <ProgressiveField>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Field
              label={subject.label('Physical status')}
              htmlFor="physicalStatus"
              required
              error={errors.physicalStatus}
            >
              <SmartDropdown
                id="physicalStatus"
                invalid={Boolean(errors.physicalStatus)}
                value={form.physicalStatus}
                onChange={(val) => onChange('physicalStatus', val)}
                options={PHYSICAL_STATUS_OPTIONS}
                placeholder="Select physical status"
                searchable={false}
              />
            </Field>

            <div className="flex flex-col gap-3">
              <Field
                label={subject.label('Marital status')}
                htmlFor="maritalStatus"
                required
                error={errors.maritalStatus}
              >
                <SmartDropdown
                  id="maritalStatus"
                  invalid={Boolean(errors.maritalStatus)}
                  value={form.maritalStatus}
                  onChange={(val) => {
                    onChange('maritalStatus', val);
                    if (!PRIOR_MARRIAGE_STATUSES.includes(val) && form.previousMarriageDetails) {
                      onChange('previousMarriageDetails', '');
                    }
                  }}
                  options={MARITAL_STATUS_OPTIONS}
                  placeholder="Select marital status"
                  searchable={false}
                />
              </Field>

              {showPreviousMarriage && (
                <ProgressiveField>
                  <Field
                    label={subject.label('Previous marriage details')}
                    htmlFor="previousMarriageDetails"
                    required
                    error={errors.previousMarriageDetails}
                  >
                    <Input
                      id="previousMarriageDetails"
                      placeholder="e.g. Divorced in 2021, no children"
                      invalid={Boolean(errors.previousMarriageDetails)}
                      value={form.previousMarriageDetails ?? ''}
                      onChange={(e) => onChange('previousMarriageDetails', e.target.value)}
                    />
                  </Field>
                </ProgressiveField>
              )}
            </div>
          </div>
        </ProgressiveField>
      )}

      {/* 3. Complexion and Dosham displayed after completing Physical Status and Marital Status */}
      {showComplexionAndDosham && (
        <ProgressiveField>
          <div className="grid grid-cols-1 md:grid-cols-2 items-start gap-4">
            <Field
              label={subject.label('Complexion (optional)')}
              htmlFor="complexion"
              error={errors.complexion}
            >
              <SmartDropdown
                id="complexion"
                invalid={Boolean(errors.complexion)}
                value={form.complexion ?? ''}
                onChange={(val) => onChange('complexion', val)}
                options={COMPLEXIONS}
                placeholder="Select complexion"
                searchable={false}
              />
            </Field>

            <div className="flex flex-col gap-3">
              <Field
                label={subject.label('Dosham (optional)')}
                htmlFor="dosham"
                error={errors.dosham}
                hint="Horoscope-related detail, if applicable"
              >
                <SmartDropdown
                  id="dosham"
                  invalid={Boolean(errors.dosham)}
                  value={form.dosham ?? ''}
                  onChange={(val) => {
                    onChange('dosham', val);
                    if (val !== 'YES' && form.doshamDetails) {
                      onChange('doshamDetails', '');
                    }
                  }}
                  options={DOSHAM_OPTIONS}
                  placeholder="Select dosham"
                  searchable={false}
                />
              </Field>

              {showDoshamDetails && (
                <ProgressiveField>
                  <DoshamDetailsDropdown
                    value={form.doshamDetails ?? ''}
                    onChange={(val) => onChange('doshamDetails', val)}
                    error={errors.doshamDetails}
                    label={subject.label('Dosham details')}
                  />
                </ProgressiveField>
              )}
            </div>
          </div>
        </ProgressiveField>
      )}
    </div>
  );
}
