'use client';

import { useState } from 'react';
import { NADAR_SUBCATEGORIES, RELIGIONS, type BasicDetails } from '@nadar-kalyanam/schemas';
import { Field, Input, Select } from '@nadar-kalyanam/ui';
import { isRequired } from '../../lib/required-fields';

export type BasicDetailsFormState = Record<keyof BasicDetails, string>;

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
}: {
  form: BasicDetailsFormState;
  errors: Record<string, string>;
  onChange: <K extends keyof BasicDetailsFormState>(key: K, value: string) => void;
  // After DigiLocker: name and date of birth come from the ID and can't be
  // edited (the API ignores any change to them too).
  identityLocked?: boolean;
}) {
  const [dob, setDob] = useState(() => parseDateOfBirth(form.dateOfBirth));
  const shownDob = identityLocked ? parseDateOfBirth(form.dateOfBirth) : dob;
  const lockedHint = identityLocked ? 'From DigiLocker' : undefined;

  function updateDob(part: 'day' | 'month' | 'year', value: string) {
    const next = { ...dob, [part]: value };
    setDob(next);
    onChange('dateOfBirth', next.day && next.month && next.year ? `${next.year}-${next.month}-${next.day}` : '');
  }

  return (
    <>
      <Field label="Full name" htmlFor="fullName" required={isRequired('basicDetails', 'fullName')} error={errors.fullName} hint={lockedHint}>
        <Input
          id="fullName"
          disabled={identityLocked}
          invalid={Boolean(errors.fullName)}
          value={form.fullName}
          onChange={(e) => onChange('fullName', e.target.value)}
        />
      </Field>

      <Field label="Gender" htmlFor="gender" required={isRequired('basicDetails', 'gender')} error={errors.gender}>
        <Select
          id="gender"
          invalid={Boolean(errors.gender)}
          value={form.gender}
          onChange={(e) => onChange('gender', e.target.value)}
        >
          <option value="">Select</option>
          <option value="MALE">Male</option>
          <option value="FEMALE">Female</option>
          <option value="OTHER">Other</option>
        </Select>
      </Field>

      {/* One group label (and one "*") for the three date selects. */}
      <Field
        label="Date of birth"
        htmlFor="dobDay"
        required={isRequired('basicDetails', 'dateOfBirth')}
        error={errors.dateOfBirth}
        hint={lockedHint}
      >
        <div className="grid grid-cols-3 gap-4">
          <Select
            id="dobDay"
            aria-label="Day"
            invalid={Boolean(errors.dateOfBirth)}
            value={shownDob.day}
            disabled={identityLocked}
            onChange={(e) => updateDob('day', e.target.value)}
          >
            <option value="">Day</option>
            {DOB_DAYS.map((day) => (
              <option key={day} value={day}>
                {day}
              </option>
            ))}
          </Select>
          <Select
            id="dobMonth"
            aria-label="Month"
            invalid={Boolean(errors.dateOfBirth)}
            value={shownDob.month}
            disabled={identityLocked}
            onChange={(e) => updateDob('month', e.target.value)}
          >
            <option value="">Month</option>
            {DOB_MONTHS.map((month) => (
              <option key={month.value} value={month.value}>
                {month.label}
              </option>
            ))}
          </Select>
          <Select
            id="dobYear"
            aria-label="Year"
            invalid={Boolean(errors.dateOfBirth)}
            value={shownDob.year}
            disabled={identityLocked}
            onChange={(e) => updateDob('year', e.target.value)}
          >
            <option value="">Year</option>
            {DOB_YEARS.map((year) => (
              <option key={year} value={year}>
                {year}
              </option>
            ))}
          </Select>
        </div>
      </Field>

      <div className="grid grid-cols-2 gap-4">
        <Field label="Religion" htmlFor="religion" required={isRequired('basicDetails', 'religion')} error={errors.religion}>
          <Select
            id="religion"
            invalid={Boolean(errors.religion)}
            value={form.religion}
            onChange={(e) => onChange('religion', e.target.value)}
          >
            <option value="">Select</option>
            {RELIGIONS.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </Select>
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
        label="Nadar subcategory"
        htmlFor="casteCommunity"
        required={isRequired('basicDetails', 'casteCommunity')}
        error={errors.casteCommunity}
      >
        <Select
          id="casteCommunity"
          invalid={Boolean(errors.casteCommunity)}
          value={form.casteCommunity}
          onChange={(e) => onChange('casteCommunity', e.target.value)}
        >
          <option value="">Select</option>
          {NADAR_SUBCATEGORIES.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </Select>
      </Field>
    </>
  );
}
