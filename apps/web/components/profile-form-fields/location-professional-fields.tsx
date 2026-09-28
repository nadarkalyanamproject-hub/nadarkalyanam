'use client';

import type { LocationProfessional } from '@nadar-kalyanam/schemas';
import { Field, Input, Select } from '@nadar-kalyanam/ui';
import { isRequired } from '../../lib/required-fields';

export type LocationProfessionalFormState = Record<keyof LocationProfessional, string>;

const INDIA_STATES_AND_UTS = [
  'Andaman and Nicobar Islands',
  'Andhra Pradesh',
  'Arunachal Pradesh',
  'Assam',
  'Bihar',
  'Chandigarh',
  'Chhattisgarh',
  'Dadra and Nagar Haveli and Daman and Diu',
  'Delhi',
  'Goa',
  'Gujarat',
  'Haryana',
  'Himachal Pradesh',
  'Jammu and Kashmir',
  'Jharkhand',
  'Karnataka',
  'Kerala',
  'Ladakh',
  'Lakshadweep',
  'Madhya Pradesh',
  'Maharashtra',
  'Manipur',
  'Meghalaya',
  'Mizoram',
  'Nagaland',
  'Odisha',
  'Puducherry',
  'Punjab',
  'Rajasthan',
  'Sikkim',
  'Tamil Nadu',
  'Telangana',
  'Tripura',
  'Uttar Pradesh',
  'Uttarakhand',
  'West Bengal',
];

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
      <div className="grid grid-cols-3 gap-4">
        <Field label="City" htmlFor="city" required={isRequired('location', 'city')} error={errors.city}>
          <Input
            id="city"
            invalid={Boolean(errors.city)}
            value={form.city}
            onChange={(e) => onChange('city', e.target.value)}
          />
        </Field>
        <Field label="State" htmlFor="state" required={isRequired('location', 'state')} error={errors.state}>
          <Select
            id="state"
            invalid={Boolean(errors.state)}
            value={form.state}
            onChange={(e) => onChange('state', e.target.value)}
          >
            <option value="">Select</option>
            {INDIA_STATES_AND_UTS.map((state) => (
              <option key={state} value={state}>
                {state}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Country" htmlFor="country" required={isRequired('location', 'country')} error={errors.country}>
          <Select id="country" disabled value={form.country} onChange={(e) => onChange('country', e.target.value)}>
            <option value="India">India</option>
          </Select>
        </Field>
      </div>

      <div className="grid grid-cols-2 gap-4">
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
            onChange={(e) => onChange('educationLevel', e.target.value)}
          />
        </Field>
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
            onChange={(e) => onChange('profession', e.target.value)}
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
          <Select
            id="annualIncomeCurrency"
            disabled
            invalid={Boolean(errors.annualIncomeCurrency)}
            value={form.annualIncomeCurrency}
            onChange={(e) => onChange('annualIncomeCurrency', e.target.value)}
          >
            <option value="INR">INR - Indian Rupee</option>
          </Select>
        </Field>
      </div>
    </>
  );
}
