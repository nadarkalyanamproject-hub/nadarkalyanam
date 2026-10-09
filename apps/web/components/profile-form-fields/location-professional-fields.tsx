'use client';

import { INDIA_STATES_AND_UTS, type LocationProfessional } from '@nadar-kalyanam/schemas';
import { Field, Input, Select } from '@nadar-kalyanam/ui';
import { isRequired } from '../../lib/required-fields';

export type LocationProfessionalFormState = Record<keyof LocationProfessional, string>;

export function LocationProfessionalFields({
  form,
  errors,
  onChange,
}: {
  form: LocationProfessionalFormState;
  errors: Record<string, string>;
  onChange: <K extends keyof LocationProfessionalFormState>(key: K, value: string) => void;
}) {
  return (
    <>
      {/* Country is fixed to India (single option by design) and always has a
          value, so State needs no reveal gate. City is revealed once a State
          is chosen, directly below it, and cleared if State is emptied. */}
      <div className="grid grid-cols-2 items-start gap-4">
        <Field label="Country" htmlFor="country" required={isRequired('location', 'country')} error={errors.country}>
          {/* Single-option select, deliberately not `disabled`: it opens and
              shows its one value like any dropdown, but can't change. */}
          <Select id="country" value={form.country || 'India'} onChange={(e) => onChange('country', e.target.value)}>
            <option value="India">India</option>
          </Select>
        </Field>
        <div className="flex flex-col gap-4">
          <Field label="State" htmlFor="state" required={isRequired('location', 'state')} error={errors.state}>
            <Select
              id="state"
              invalid={Boolean(errors.state)}
              value={form.state}
              onChange={(e) => {
                onChange('state', e.target.value);
                if (!e.target.value && form.city) onChange('city', '');
              }}
            >
              <option value="">Select</option>
              {INDIA_STATES_AND_UTS.map((state) => (
                <option key={state} value={state}>
                  {state}
                </option>
              ))}
            </Select>
          </Field>
          {form.state !== '' && (
            <Field label="City" htmlFor="city" required={isRequired('location', 'city')} error={errors.city}>
              <Input
                id="city"
                invalid={Boolean(errors.city)}
                value={form.city}
                onChange={(e) => onChange('city', e.target.value)}
              />
            </Field>
          )}
        </div>
      </div>

      {/* Education detail elaborates on the level, so it's only shown once a
          level is entered (appearing right below it). Editing the level
          keeps the detail — it's in plain view to correct — but emptying the
          level hides it AND clears it, so no hidden value is ever saved. */}
      <div className="flex flex-col gap-4">
        <Field
          label="Educational details"
          htmlFor="educationLevel"
          required={isRequired('location', 'educationLevel')}
          error={errors.educationLevel}
        >
          <Input
            id="educationLevel"
            placeholder="e.g. Bachelors"
            invalid={Boolean(errors.educationLevel)}
            value={form.educationLevel}
            onChange={(e) => {
              onChange('educationLevel', e.target.value);
              if (!e.target.value.trim() && form.educationDetail) onChange('educationDetail', '');
            }}
          />
        </Field>
        {form.educationLevel.trim() !== '' && (
          <Field
            label="Education detail"
            htmlFor="educationDetail"
            required={isRequired('location', 'educationDetail')}
            error={errors.educationDetail}
          >
            <Input
              id="educationDetail"
              placeholder="e.g. B.Tech Computer Science"
              invalid={Boolean(errors.educationDetail)}
              value={form.educationDetail}
              onChange={(e) => onChange('educationDetail', e.target.value)}
            />
          </Field>
        )}
      </div>

      <div className="grid grid-cols-2 gap-4">
        <Field
          label="Occupation"
          htmlFor="profession"
          required={isRequired('location', 'profession')}
          error={errors.profession}
        >
          <Input
            id="profession"
            invalid={Boolean(errors.profession)}
            value={form.profession}
            onChange={(e) => {
              onChange('profession', e.target.value);
              // Currency is fixed (INR), not user data, so only the income
              // amount is reset when Occupation is emptied.
              if (!e.target.value.trim() && form.annualIncomeRange) onChange('annualIncomeRange', '');
            }}
          />
        </Field>
        <Field
          label="Employment type"
          htmlFor="employedIn"
          required={isRequired('location', 'employedIn')}
          error={errors.employedIn}
        >
          <Input
            id="employedIn"
            placeholder="e.g. Private, Government"
            invalid={Boolean(errors.employedIn)}
            value={form.employedIn}
            onChange={(e) => onChange('employedIn', e.target.value)}
          />
        </Field>
      </div>

      {form.profession.trim() !== '' && (
        <fieldset data-testid="income-details">
          <legend className="mb-3 text-sm font-semibold text-nk-maroon-bright">Income details</legend>
          <div className="grid grid-cols-2 gap-4">
            <Field
              label="Annual income"
              htmlFor="annualIncomeRange"
              required={isRequired('location', 'annualIncomeRange')}
              error={errors.annualIncomeRange}
            >
              <Input
                id="annualIncomeRange"
                placeholder="e.g. 10-15 LPA"
                invalid={Boolean(errors.annualIncomeRange)}
                value={form.annualIncomeRange}
                onChange={(e) => onChange('annualIncomeRange', e.target.value)}
              />
            </Field>
            <Field
              label="Annual income currency"
              htmlFor="annualIncomeCurrency"
              required={isRequired('location', 'annualIncomeCurrency')}
              error={errors.annualIncomeCurrency}
            >
              {/* Single-option select, not `disabled` (see Country above). */}
              <Select
                id="annualIncomeCurrency"
                invalid={Boolean(errors.annualIncomeCurrency)}
                value={form.annualIncomeCurrency || 'INR'}
                onChange={(e) => onChange('annualIncomeCurrency', e.target.value)}
              >
                <option value="INR">INR - Indian Rupee</option>
              </Select>
            </Field>
          </div>
        </fieldset>
      )}
    </>
  );
}
