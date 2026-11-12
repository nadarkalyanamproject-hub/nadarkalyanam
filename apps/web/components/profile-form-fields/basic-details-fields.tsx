'use client';

import { useState } from 'react';
import { NADAR_SUBCATEGORIES, RELIGIONS, type BasicDetails } from '@nadar-kalyanam/schemas';
import { Field, Input } from '@nadar-kalyanam/ui';
import { ProgressiveField } from '../motion/progressive-field';
import { SmartDropdown } from '../ui/smart-dropdown';
import { isRequired } from '../../lib/required-fields';
import { useSubjectLabels } from './profile-for';

export type BasicDetailsFormState = Record<keyof BasicDetails, string> & {
  motherTongue?: string;
  password?: string;
};

const GENDER_OPTIONS = [
  { value: 'MALE', label: 'Male' },
  { value: 'FEMALE', label: 'Female' },
  { value: 'OTHER', label: 'Other' },
];

const DOB_DAYS = Array.from({ length: 31 }, (_, i) => String(i + 1).padStart(2, '0'));
const DOB_MONTHS = [
  { value: '01', label: 'January' },
  { value: '02', label: 'February' },
  { value: '03', label: 'March' },
  { value: '04', label: 'April' },
  { value: '05', label: 'May' },
  { value: '06', label: 'June' },
  { value: '07', label: 'July' },
  { value: '08', label: 'August' },
  { value: '09', label: 'September' },
  { value: '10', label: 'October' },
  { value: '11', label: 'November' },
  { value: '12', label: 'December' },
];
const DOB_MAX_YEAR = new Date().getFullYear() - 18;
const DOB_MIN_YEAR = new Date().getFullYear() - 100;
const DOB_YEARS = Array.from({ length: DOB_MAX_YEAR - DOB_MIN_YEAR + 1 }, (_, i) => String(DOB_MAX_YEAR - i));

function parseDateOfBirth(value: string | undefined): { day: string; month: string; year: string } {
  const match = value?.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return { day: '', month: '', year: '' };
  const [, year, month, day] = match;
  return { day, month, year };
}

export function BasicDetailsFields({
  form,
  errors,
  onChange,
  identityLocked = false,
  progressive = true,
}: {
  form: BasicDetailsFormState;
  errors: Record<string, string>;
  onChange: <K extends keyof BasicDetailsFormState>(key: K, value: string) => void;
  // After DigiLocker: name and date of birth come from the ID and can't be
  // edited (the API ignores any change to them too).
  identityLocked?: boolean;
  progressive?: boolean;
}) {
  const subject = useSubjectLabels();
  const [dob, setDob] = useState(() => parseDateOfBirth(form.dateOfBirth));
  const shownDob = identityLocked ? parseDateOfBirth(form.dateOfBirth) : dob;
  const lockedHint = identityLocked ? 'From DigiLocker' : undefined;

  function updateDob(part: 'day' | 'month' | 'year', value: string) {
    const next = { ...dob, [part]: value };
    setDob(next);
    onChange('dateOfBirth', next.day && next.month && next.year ? `${next.year}-${next.month}-${next.day}` : '');
  }

  // Progressive reveal conditions (matching reference design):
  // 1. Full name shown first
  // 2. Gender after Full name is entered
  // 3. Date of birth after Gender is selected
  // 4. Religion and Email together after Date of birth is completed
  // 5. Nadar subcategory after Religion and Email are completed
  const isFullNameComplete = Boolean(form.fullName && form.fullName.trim().length >= 2);
  const showGender = !progressive || isFullNameComplete;

  const isGenderComplete = Boolean(form.gender && form.gender.trim() !== '');
  const showDob = !progressive || (showGender && isGenderComplete);

  const isDobComplete = Boolean(
    shownDob.day &&
    shownDob.month &&
    shownDob.year &&
    form.dateOfBirth &&
    /^\d{4}-\d{2}-\d{2}$/.test(form.dateOfBirth)
  );
  const showReligionAndEmail = !progressive || (showDob && isDobComplete);

  const isEmailValid = Boolean(form.email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim()));
  const isReligionComplete = Boolean(form.religion && form.religion.trim() !== '');
  const showSubcategory = !progressive || (showReligionAndEmail && isReligionComplete && isEmailValid);

  if (!progressive) {
    return (
      <div className="flex flex-col gap-4">
        <Field label={subject.label('Full name')} htmlFor="fullName" required={isRequired('basicDetails', 'fullName')} error={errors.fullName} hint={lockedHint}>
          <Input
            id="fullName"
            disabled={identityLocked}
            invalid={Boolean(errors.fullName)}
            value={form.fullName}
            onChange={(e) => onChange('fullName', e.target.value)}
          />
        </Field>

        <Field label={subject.label('Gender')} htmlFor="gender" required={isRequired('basicDetails', 'gender')} error={errors.gender}>
          <SmartDropdown
            id="gender"
            invalid={Boolean(errors.gender)}
            value={form.gender}
            onChange={(val) => onChange('gender', val)}
            options={GENDER_OPTIONS}
            placeholder="Select gender"
            searchable={false}
          />
        </Field>

        <Field
          label={subject.label('Date of birth')}
          htmlFor="dobDay"
          required={isRequired('basicDetails', 'dateOfBirth')}
          error={errors.dateOfBirth}
          hint={lockedHint}
        >
          <div className="grid grid-cols-3 gap-3 md:gap-4">
            <SmartDropdown
              id="dobDay"
              aria-label="Day"
              invalid={Boolean(errors.dateOfBirth)}
              value={shownDob.day}
              disabled={identityLocked}
              onChange={(val) => updateDob('day', val)}
              options={DOB_DAYS}
              placeholder="Day"
              searchable={false}
            />
            <SmartDropdown
              id="dobMonth"
              aria-label="Month"
              invalid={Boolean(errors.dateOfBirth)}
              value={shownDob.month}
              disabled={identityLocked}
              onChange={(val) => updateDob('month', val)}
              options={DOB_MONTHS}
              placeholder="Month"
              searchable={false}
            />
            <SmartDropdown
              id="dobYear"
              aria-label="Year"
              invalid={Boolean(errors.dateOfBirth)}
              value={shownDob.year}
              disabled={identityLocked}
              onChange={(val) => updateDob('year', val)}
              options={DOB_YEARS}
              placeholder="Year"
              searchable={true}
              searchPlaceholder="Search year..."
            />
          </div>
        </Field>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Field label={subject.label('Religion')} htmlFor="religion" required={isRequired('basicDetails', 'religion')} error={errors.religion}>
            <SmartDropdown
              id="religion"
              invalid={Boolean(errors.religion)}
              value={form.religion}
              onChange={(val) => onChange('religion', val)}
              options={RELIGIONS}
              placeholder="Select religion"
              searchable={false}
            />
          </Field>

          <Field label="Email" htmlFor="email" required={isRequired('basicDetails', 'email')} error={errors.email}>
            <Input
              id="email"
              type="email"
              autoComplete="email"
              placeholder="you@example.com"
              invalid={Boolean(errors.email)}
              value={form.email}
              onChange={(e) => onChange('email', e.target.value)}
            />
          </Field>
        </div>

        <Field
          label={subject.label('Nadar subcategory')}
          htmlFor="casteCommunity"
          required={isRequired('basicDetails', 'casteCommunity')}
          error={errors.casteCommunity}
        >
          <SmartDropdown
            id="casteCommunity"
            invalid={Boolean(errors.casteCommunity)}
            value={form.casteCommunity}
            onChange={(val) => onChange('casteCommunity', val)}
            options={NADAR_SUBCATEGORIES}
            placeholder="Select Nadar subcategory"
            searchable={true}
            searchPlaceholder="Search subcategory..."
          />
        </Field>
      </div>
    );
  }

  // Progressive Onboarding Mode (Step 1):
  // 1. Full name shown first
  // 2. Gender after Full name is completed
  // 3. Date of birth after Gender is selected
  // 4. Religion and Email together after Date of birth is completed
  // 5. Nadar subcategory after Religion and Email are completed
  return (
    <div className="flex flex-col gap-5">
      {/* 1. Full name shown first */}
      <Field
        label={subject.label('Full name')}
        htmlFor="fullName"
        required
        error={errors.fullName}
        hint={lockedHint}
      >
        <Input
          id="fullName"
          disabled={identityLocked}
          invalid={Boolean(errors.fullName)}
          placeholder="Enter full name"
          value={form.fullName}
          onChange={(e) => onChange('fullName', e.target.value)}
        />
      </Field>

      {/* 2. Gender after Full name is entered */}
      {showGender && (
        <ProgressiveField>
          <Field
            label={subject.label('Gender')}
            htmlFor="gender"
            required
            error={errors.gender}
          >
            <SmartDropdown
              id="gender"
              invalid={Boolean(errors.gender)}
              value={form.gender}
              onChange={(val) => onChange('gender', val)}
              options={GENDER_OPTIONS}
              placeholder="Select gender"
              searchable={false}
            />
          </Field>
        </ProgressiveField>
      )}

      {/* 3. Date of birth after Gender is selected */}
      {showDob && (
        <ProgressiveField>
          <Field
            label={subject.label('Date of birth')}
            htmlFor="dobDay"
            required
            error={errors.dateOfBirth}
            hint={lockedHint}
          >
            <div className="grid grid-cols-3 gap-3 md:gap-4">
              <SmartDropdown
                id="dobDay"
                aria-label="Day"
                invalid={Boolean(errors.dateOfBirth)}
                value={shownDob.day}
                disabled={identityLocked}
                onChange={(val) => updateDob('day', val)}
                options={DOB_DAYS}
                placeholder="Day"
                searchable={false}
              />
              <SmartDropdown
                id="dobMonth"
                aria-label="Month"
                invalid={Boolean(errors.dateOfBirth)}
                value={shownDob.month}
                disabled={identityLocked}
                onChange={(val) => updateDob('month', val)}
                options={DOB_MONTHS}
                placeholder="Month"
                searchable={false}
              />
              <SmartDropdown
                id="dobYear"
                aria-label="Year"
                invalid={Boolean(errors.dateOfBirth)}
                value={shownDob.year}
                disabled={identityLocked}
                onChange={(val) => updateDob('year', val)}
                options={DOB_YEARS}
                placeholder="Year"
                searchable={true}
                searchPlaceholder="Search year..."
              />
            </div>
          </Field>
        </ProgressiveField>
      )}

      {/* 4. Religion and Email side by side after Date of birth is completed */}
      {showReligionAndEmail && (
        <ProgressiveField>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Field
              label={subject.label('Religion')}
              htmlFor="religion"
              required
              error={errors.religion}
            >
              <SmartDropdown
                id="religion"
                invalid={Boolean(errors.religion)}
                value={form.religion}
                onChange={(val) => onChange('religion', val)}
                options={RELIGIONS}
                placeholder="Select religion"
                searchable={false}
              />
            </Field>

            <Field
              label="Email"
              htmlFor="email"
              required
              error={errors.email}
            >
              <Input
                id="email"
                type="email"
                autoComplete="email"
                placeholder="you@example.com"
                invalid={Boolean(errors.email)}
                value={form.email}
                onChange={(e) => onChange('email', e.target.value)}
              />
            </Field>
          </div>
        </ProgressiveField>
      )}

      {/* 5. Nadar subcategory after Religion and Email are completed */}
      {showSubcategory && (
        <ProgressiveField>
          <Field
            label={subject.label('Nadar subcategory')}
            htmlFor="casteCommunity"
            required
            error={errors.casteCommunity}
          >
            <SmartDropdown
              id="casteCommunity"
              invalid={Boolean(errors.casteCommunity)}
              value={form.casteCommunity}
              onChange={(val) => onChange('casteCommunity', val)}
              options={NADAR_SUBCATEGORIES}
              placeholder="Select Nadar subcategory"
              searchable={true}
              searchPlaceholder="Search subcategory..."
            />
          </Field>
        </ProgressiveField>
      )}
    </div>
  );
}
