'use client';

import { useState } from 'react';
import type { BasicDetails } from '@nadar-kalyanam/schemas';
import { Field, Input, Select } from '@nadar-kalyanam/ui';

export type BasicDetailsFormState = Record<keyof BasicDetails, string>;

const MOTHER_TONGUE_OPTIONS = [
  'Tamil',
  'Telugu',
  'Kannada',
  'Malayalam',
  'Hindi',
  'Marathi',
  'Gujarati',
  'Punjabi',
  'Bengali',
  'Odia',
  'Urdu',
  'English',
  'Other',
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

function EyeIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8Z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function EyeOffIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
      <path d="M17.94 17.94A10.94 10.94 0 0 1 12 20c-7 0-11-8-11-8a21.8 21.8 0 0 1 5.06-6.06" />
      <path d="M9.9 4.24A10.94 10.94 0 0 1 12 4c7 0 11 8 11 8a21.77 21.77 0 0 1-2.16 3.19" />
      <path d="M14.12 14.12a3 3 0 1 1-4.24-4.24" />
      <line x1="1" y1="1" x2="23" y2="23" />
    </svg>
  );
}

export function BasicDetailsFields({
  form,
  errors,
  onChange,
}: {
  form: BasicDetailsFormState;
  errors: Record<string, string>;
  onChange: <K extends keyof BasicDetailsFormState>(key: K, value: string) => void;
}) {
  const [dob, setDob] = useState(() => parseDateOfBirth(form.dateOfBirth));

  // UI-only field: this app authenticates by phone/OTP only — there is no
  // password login anywhere in the system (no endpoint, no hashing). This
  // value exists purely for visual/UX parity with the reference design and
  // is validated here for feedback only. It is intentionally kept out of
  // `BasicDetailsFormState`/`BasicDetails`, so it is never saved to the
  // registration draft or sent to any API — it is discarded the moment this
  // component unmounts, in both the onboarding and profile-edit contexts.
  // Revisit only if a future task decides to build real password-based auth.
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const passwordError =
    password.length > 0 && (password.length < 8 || password.length > 20)
      ? 'Password must be 8-20 characters'
      : undefined;

  function updateDob(part: 'day' | 'month' | 'year', value: string) {
    const next = { ...dob, [part]: value };
    setDob(next);
    onChange('dateOfBirth', next.day && next.month && next.year ? `${next.year}-${next.month}-${next.day}` : '');
  }

  return (
    <>
      <Field label="Full name" htmlFor="fullName" error={errors.fullName}>
        <Input
          id="fullName"
          invalid={Boolean(errors.fullName)}
          value={form.fullName}
          onChange={(e) => onChange('fullName', e.target.value)}
        />
      </Field>

      <Field label="Gender" htmlFor="gender" error={errors.gender}>
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

      <Field label="Date of birth" htmlFor="dobDay" error={errors.dateOfBirth}>
        <div className="grid grid-cols-3 gap-4">
          <Select
            id="dobDay"
            aria-label="Day"
            invalid={Boolean(errors.dateOfBirth)}
            value={dob.day}
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
            value={dob.month}
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
            value={dob.year}
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
        <Field label="Mother tongue" htmlFor="motherTongue" error={errors.motherTongue}>
          <Select
            id="motherTongue"
            invalid={Boolean(errors.motherTongue)}
            value={form.motherTongue}
            onChange={(e) => onChange('motherTongue', e.target.value)}
          >
            <option value="">Select</option>
            {MOTHER_TONGUE_OPTIONS.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </Select>
        </Field>

        <Field label="Email" htmlFor="email" error={errors.email}>
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

      {/*
        UI-only field — see comment above the `password` state declaration.
        Not part of BasicDetails/basicDetailsSchema, never persisted or transmitted.
      */}
      <Field
        label="Create password"
        htmlFor="password"
        error={passwordError}
        hint={passwordError ? undefined : '8-20 characters'}
      >
        <div className="relative">
          <Input
            id="password"
            type={showPassword ? 'text' : 'password'}
            autoComplete="new-password"
            invalid={Boolean(passwordError)}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="pr-10"
          />
          <button
            type="button"
            onClick={() => setShowPassword((prev) => !prev)}
            className="absolute inset-y-0 right-0 flex w-10 items-center justify-center text-muted-foreground hover:text-foreground"
            aria-label={showPassword ? 'Hide password' : 'Show password'}
          >
            {showPassword ? <EyeOffIcon /> : <EyeIcon />}
          </button>
        </div>
      </Field>
    </>
  );
}
