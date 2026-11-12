'use client';

import {
  ANNUAL_INCOME_CURRENCIES,
  ANNUAL_INCOME_RANGES,
  EDUCATION_DETAILS,
  EDUCATION_LEVELS,
  EMPLOYMENT_TYPES,
  getCitiesForState,
  INDIA_STATES_AND_UTS,
  OCCUPATIONS,
  type LocationProfessional,
} from '@nadar-kalyanam/schemas';
import { Field, Input } from '@nadar-kalyanam/ui';
import { ProgressiveField } from '../motion/progressive-field';
import { SmartDropdown } from '../ui/smart-dropdown';
import { isRequired } from '../../lib/required-fields';
import { useSubjectLabels } from './profile-for';

export type LocationProfessionalFormState = Record<keyof LocationProfessional, string> & {
  cityOther?: string;
  educationLevelOther?: string;
  educationDetailOther?: string;
  employedInOther?: string;
  professionOther?: string;
  annualIncomeRangeOther?: string;
};

const CURRENCY_OPTIONS = ANNUAL_INCOME_CURRENCIES.map((curr) => ({
  value: curr.code,
  label: curr.label,
}));

export function LocationProfessionalFields({
  form,
  errors,
  onChange,
  progressive = true,
}: {
  form: LocationProfessionalFormState;
  errors: Record<string, string>;
  onChange: <K extends keyof LocationProfessionalFormState>(key: K, value: string) => void;
  progressive?: boolean;
}) {
  const subject = useSubjectLabels();
  const cityOptions = getCitiesForState(form.state);

  // Progressive reveal conditions:
  // 1. Show Country first
  // 2. After selecting Country, display State
  const isCountryComplete = Boolean(form.country && form.country.trim() !== '');
  const showState = !progressive || isCountryComplete;

  // 3. After selecting State, display City
  const isStateComplete = Boolean(form.state && form.state.trim() !== '');
  const showCity = !progressive || (showState && isStateComplete);

  // 4. After selecting City, display Educational Details, Employment Type, Occupation
  const isCityComplete = Boolean(
    (form.city && form.city !== 'Others' && form.city.trim() !== '') ||
    (form.city === 'Others' && form.cityOther && form.cityOther.trim() !== '')
  );
  const showProfessional = !progressive || (showCity && isCityComplete);

  // 5. After completing professional details, display Annual Income Currency, Annual Income
  const isEducationComplete = Boolean(
    (form.educationLevel && form.educationLevel !== 'Other' && form.educationLevel.trim() !== '') ||
    (form.educationLevel === 'Other' && form.educationLevelOther && form.educationLevelOther.trim() !== '')
  );
  const isEmploymentComplete = Boolean(
    (form.employedIn && form.employedIn !== 'Other' && form.employedIn.trim() !== '') ||
    (form.employedIn === 'Other' && form.employedInOther && form.employedInOther.trim() !== '')
  );
  const isOccupationComplete = Boolean(
    (form.profession && form.profession !== 'Other' && form.profession.trim() !== '') ||
    (form.profession === 'Other' && form.professionOther && form.professionOther.trim() !== '')
  );

  const isProfessionalComplete = isEducationComplete && isEmploymentComplete && isOccupationComplete;
  const showIncome = !progressive || (showProfessional && isProfessionalComplete);

  if (!progressive) {
    return (
      <div className="flex flex-col gap-4">
        <div className="grid grid-cols-1 md:grid-cols-2 items-start gap-4">
          <Field label={subject.label('Country')} htmlFor="country" required={isRequired('location', 'country')} error={errors.country}>
            <SmartDropdown
              id="country"
              value={form.country || 'India'}
              onChange={(val) => onChange('country', val)}
              options={['India']}
              placeholder="Select country"
              searchable={false}
            />
          </Field>

          <div className="flex flex-col gap-4">
            <Field label={subject.label('State')} htmlFor="state" required={isRequired('location', 'state')} error={errors.state}>
              <SmartDropdown
                id="state"
                invalid={Boolean(errors.state)}
                value={form.state}
                onChange={(val) => {
                  onChange('state', val);
                  if (!val && form.city) onChange('city', '');
                }}
                options={INDIA_STATES_AND_UTS}
                placeholder="Select state"
                searchable={true}
                searchPlaceholder="Search state..."
              />
            </Field>

            {form.state !== '' && (
              <div className="flex flex-col gap-3">
                <Field label={subject.label('City')} htmlFor="city" required={isRequired('location', 'city')} error={errors.city}>
                  <SmartDropdown
                    id="city"
                    invalid={Boolean(errors.city)}
                    value={form.city}
                    onChange={(val) => {
                      onChange('city', val);
                      if (val !== 'Others' && form.cityOther) onChange('cityOther', '');
                    }}
                    options={cityOptions}
                    placeholder="Select city"
                    searchable={true}
                    searchPlaceholder="Search city..."
                  />
                </Field>

                {form.city === 'Others' && (
                  <Field label={subject.label('Enter city (if not listed)')} htmlFor="cityOther" error={errors.city}>
                    <Input
                      id="cityOther"
                      placeholder="Enter your city name"
                      value={form.cityOther ?? ''}
                      onChange={(e) => onChange('cityOther', e.target.value)}
                    />
                  </Field>
                )}
              </div>
            )}
          </div>
        </div>

        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-3">
            <Field
              label={subject.label('Educational details')}
              htmlFor="educationLevel"
              required={isRequired('location', 'educationLevel')}
              error={errors.educationLevel}
            >
              <SmartDropdown
                id="educationLevel"
                invalid={Boolean(errors.educationLevel)}
                value={form.educationLevel}
                onChange={(val) => {
                  onChange('educationLevel', val);
                  if (val !== 'Other' && form.educationLevelOther) onChange('educationLevelOther', '');
                  if (!val.trim() && form.educationDetail) onChange('educationDetail', '');
                }}
                options={EDUCATION_LEVELS}
                placeholder="Select educational details"
                searchable={true}
                searchPlaceholder="Search degree / qualification..."
              />
            </Field>

            {form.educationLevel === 'Other' && (
              <Field label={subject.label('Enter educational details')} htmlFor="educationLevelOther" error={errors.educationLevel}>
                <Input
                  id="educationLevelOther"
                  placeholder="e.g. Specific Degree / Qualification"
                  value={form.educationLevelOther ?? ''}
                  onChange={(e) => onChange('educationLevelOther', e.target.value)}
                />
              </Field>
            )}
          </div>

          <div className="flex flex-col gap-3">
            <Field
              label={subject.label('Education detail')}
              htmlFor="educationDetail"
              required={isRequired('location', 'educationDetail')}
              error={errors.educationDetail}
            >
              <SmartDropdown
                id="educationDetail"
                invalid={Boolean(errors.educationDetail)}
                value={form.educationDetail}
                onChange={(val) => {
                  onChange('educationDetail', val);
                  if (val !== 'Other' && form.educationDetailOther) onChange('educationDetailOther', '');
                }}
                options={EDUCATION_DETAILS}
                placeholder="Select stream / specialization (Optional)"
                searchable={true}
                searchPlaceholder="Search stream / subject..."
              />
            </Field>

            {form.educationDetail === 'Other' && (
              <Field label={subject.label('Enter education stream')} htmlFor="educationDetailOther" error={errors.educationDetail}>
                <Input
                  id="educationDetailOther"
                  placeholder="e.g. Computer Science, Mechanical"
                  value={form.educationDetailOther ?? ''}
                  onChange={(e) => onChange('educationDetailOther', e.target.value)}
                />
              </Field>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="flex flex-col gap-3">
            <Field
              label={subject.label('Employment type')}
              htmlFor="employedIn"
              required={isRequired('location', 'employedIn')}
              error={errors.employedIn}
            >
              <SmartDropdown
                id="employedIn"
                invalid={Boolean(errors.employedIn)}
                value={form.employedIn}
                onChange={(val) => {
                  onChange('employedIn', val);
                  if (val !== 'Other' && form.employedInOther) onChange('employedInOther', '');
                }}
                options={EMPLOYMENT_TYPES}
                placeholder="Select employment type"
                searchable={false}
              />
            </Field>

            {form.employedIn === 'Other' && (
              <Field label={subject.label('Enter employment type')} htmlFor="employedInOther" error={errors.employedIn}>
                <Input
                  id="employedInOther"
                  placeholder="e.g. Private, Government, Business"
                  value={form.employedInOther ?? ''}
                  onChange={(e) => onChange('employedInOther', e.target.value)}
                />
              </Field>
            )}
          </div>

          <div className="flex flex-col gap-3">
            <Field
              label={subject.label('Occupation')}
              htmlFor="profession"
              required={isRequired('location', 'profession')}
              error={errors.profession}
            >
              <SmartDropdown
                id="profession"
                invalid={Boolean(errors.profession)}
                value={form.profession}
                onChange={(val) => {
                  onChange('profession', val);
                  if (val !== 'Other' && form.professionOther) onChange('professionOther', '');
                  if (!val.trim() && form.annualIncomeRange) onChange('annualIncomeRange', '');
                }}
                options={OCCUPATIONS}
                placeholder="Select occupation"
                searchable={true}
                searchPlaceholder="Search occupation..."
              />
            </Field>

            {form.profession === 'Other' && (
              <Field label={subject.label('Enter occupation')} htmlFor="professionOther" error={errors.profession}>
                <Input
                  id="professionOther"
                  placeholder="e.g. Software Developer, Doctor"
                  value={form.professionOther ?? ''}
                  onChange={(e) => onChange('professionOther', e.target.value)}
                />
              </Field>
            )}
          </div>
        </div>

        <fieldset data-testid="income-details">
          <legend className="mb-3 text-sm font-semibold text-nk-maroon-bright">Income details</legend>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Field
              label={subject.label('Annual income currency')}
              htmlFor="annualIncomeCurrency"
              required={isRequired('location', 'annualIncomeCurrency')}
              error={errors.annualIncomeCurrency}
            >
              <SmartDropdown
                id="annualIncomeCurrency"
                invalid={Boolean(errors.annualIncomeCurrency)}
                value={form.annualIncomeCurrency || 'INR'}
                onChange={(val) => onChange('annualIncomeCurrency', val)}
                options={CURRENCY_OPTIONS}
                placeholder="Select currency"
                searchable={false}
              />
            </Field>

            <div className="flex flex-col gap-3">
              <Field
                label={subject.label('Annual income')}
                htmlFor="annualIncomeRange"
                required={isRequired('location', 'annualIncomeRange')}
                error={errors.annualIncomeRange}
              >
                <SmartDropdown
                  id="annualIncomeRange"
                  invalid={Boolean(errors.annualIncomeRange)}
                  value={form.annualIncomeRange}
                  onChange={(val) => {
                    onChange('annualIncomeRange', val);
                    if (val !== 'Other' && form.annualIncomeRangeOther) onChange('annualIncomeRangeOther', '');
                  }}
                  options={ANNUAL_INCOME_RANGES}
                  placeholder="Select annual income"
                  searchable={false}
                />
              </Field>

              {form.annualIncomeRange === 'Other' && (
                <Field label={subject.label('Enter annual income')} htmlFor="annualIncomeRangeOther" error={errors.annualIncomeRange}>
                  <Input
                    id="annualIncomeRangeOther"
                    placeholder="e.g. 10-15 LPA"
                    value={form.annualIncomeRangeOther ?? ''}
                    onChange={(e) => onChange('annualIncomeRangeOther', e.target.value)}
                  />
                </Field>
              )}
            </div>
          </div>
        </fieldset>
      </div>
    );
  }

  // Progressive Onboarding Mode (Step 3):
  // 1. Show Country first.
  // 2. After selecting Country, display State.
  // 3. After selecting State, display City.
  // 4. After selecting City, display Educational Details, Education Detail, Employment Type, Occupation.
  // 5. After completing professional details, display Annual Income Currency, Annual Income.
  return (
    <div className="flex flex-col gap-5">
      {/* 1. Country shown first */}
      <Field
        label={subject.label('Country')}
        htmlFor="country"
        required
        error={errors.country}
      >
        <SmartDropdown
          id="country"
          value={form.country || 'India'}
          onChange={(val) => {
            onChange('country', val);
            if (!val && form.state) {
              onChange('state', '');
              onChange('city', '');
            }
          }}
          options={['India']}
          placeholder="Select country"
          searchable={false}
        />
      </Field>

      {/* 2. State displayed after selecting Country */}
      {showState && (
        <ProgressiveField>
          <Field
            label={subject.label('State')}
            htmlFor="state"
            required
            error={errors.state}
          >
            <SmartDropdown
              id="state"
              invalid={Boolean(errors.state)}
              value={form.state}
              onChange={(val) => {
                onChange('state', val);
                if (!val && form.city) {
                  onChange('city', '');
                }
              }}
              options={INDIA_STATES_AND_UTS}
              placeholder="Select state"
              searchable={true}
              searchPlaceholder="Search state..."
            />
          </Field>
        </ProgressiveField>
      )}

      {/* 3. City displayed after selecting State (Dropdown Menu) */}
      {showCity && (
        <ProgressiveField>
          <div className="flex flex-col gap-3">
            <Field
              label={subject.label('City')}
              htmlFor="city"
              required
              error={errors.city}
            >
              <SmartDropdown
                id="city"
                invalid={Boolean(errors.city)}
                value={form.city}
                onChange={(val) => {
                  onChange('city', val);
                  if (val !== 'Others' && form.cityOther) onChange('cityOther', '');
                }}
                options={cityOptions}
                placeholder="Select city"
                searchable={true}
                searchPlaceholder="Search city..."
              />
            </Field>

            {form.city === 'Others' && (
              <ProgressiveField>
                <Field
                  label={subject.label('Enter city (if not listed)')}
                  htmlFor="cityOther"
                  error={errors.city}
                >
                  <Input
                    id="cityOther"
                    placeholder="Enter your city name"
                    value={form.cityOther ?? ''}
                    onChange={(e) => onChange('cityOther', e.target.value)}
                  />
                </Field>
              </ProgressiveField>
            )}
          </div>
        </ProgressiveField>
      )}

      {/* 4. Educational Details, Employment Type, Occupation displayed after City */}
      {showProfessional && (
        <ProgressiveField>
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-3">
              <Field
                label={subject.label('Educational details')}
                htmlFor="educationLevel"
                required
                error={errors.educationLevel}
              >
                <SmartDropdown
                  id="educationLevel"
                  invalid={Boolean(errors.educationLevel)}
                  value={form.educationLevel}
                  onChange={(val) => {
                    onChange('educationLevel', val);
                    if (val !== 'Other' && form.educationLevelOther) onChange('educationLevelOther', '');
                    if (!val.trim() && form.educationDetail) onChange('educationDetail', '');
                  }}
                  options={EDUCATION_LEVELS}
                  placeholder="Select educational details"
                  searchable={true}
                  searchPlaceholder="Search degree / qualification..."
                />
              </Field>

              {form.educationLevel === 'Other' && (
                <ProgressiveField>
                  <Field
                    label={subject.label('Enter educational details')}
                    htmlFor="educationLevelOther"
                    error={errors.educationLevel}
                  >
                    <Input
                      id="educationLevelOther"
                      placeholder="e.g. Specific Degree / Qualification"
                      value={form.educationLevelOther ?? ''}
                      onChange={(e) => onChange('educationLevelOther', e.target.value)}
                    />
                  </Field>
                </ProgressiveField>
              )}

              <Field
                label={subject.label('Education detail')}
                htmlFor="educationDetail"
                error={errors.educationDetail}
              >
                <SmartDropdown
                  id="educationDetail"
                  invalid={Boolean(errors.educationDetail)}
                  value={form.educationDetail}
                  onChange={(val) => {
                    onChange('educationDetail', val);
                    if (val !== 'Other' && form.educationDetailOther) onChange('educationDetailOther', '');
                  }}
                  options={EDUCATION_DETAILS}
                  placeholder="Select stream / specialization (Optional)"
                  searchable={true}
                  searchPlaceholder="Search stream / subject..."
                />
              </Field>

              {form.educationDetail === 'Other' && (
                <ProgressiveField>
                  <Field
                    label={subject.label('Enter education stream')}
                    htmlFor="educationDetailOther"
                    error={errors.educationDetail}
                  >
                    <Input
                      id="educationDetailOther"
                      placeholder="e.g. Computer Science, Mechanical"
                      value={form.educationDetailOther ?? ''}
                      onChange={(e) => onChange('educationDetailOther', e.target.value)}
                    />
                  </Field>
                </ProgressiveField>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="flex flex-col gap-3">
                <Field
                  label={subject.label('Employment type')}
                  htmlFor="employedIn"
                  required
                  error={errors.employedIn}
                >
                  <SmartDropdown
                    id="employedIn"
                    invalid={Boolean(errors.employedIn)}
                    value={form.employedIn}
                    onChange={(val) => {
                      onChange('employedIn', val);
                      if (val !== 'Other' && form.employedInOther) onChange('employedInOther', '');
                    }}
                    options={EMPLOYMENT_TYPES}
                    placeholder="Select employment type"
                    searchable={false}
                  />
                </Field>

                {form.employedIn === 'Other' && (
                  <ProgressiveField>
                    <Field
                      label={subject.label('Enter employment type')}
                      htmlFor="employedInOther"
                      error={errors.employedIn}
                    >
                      <Input
                        id="employedInOther"
                        placeholder="e.g. Private, Government, Business"
                        value={form.employedInOther ?? ''}
                        onChange={(e) => onChange('employedInOther', e.target.value)}
                      />
                    </Field>
                  </ProgressiveField>
                )}
              </div>

              <div className="flex flex-col gap-3">
                <Field
                  label={subject.label('Occupation')}
                  htmlFor="profession"
                  required
                  error={errors.profession}
                >
                  <SmartDropdown
                    id="profession"
                    invalid={Boolean(errors.profession)}
                    value={form.profession}
                    onChange={(val) => {
                      onChange('profession', val);
                      if (val !== 'Other' && form.professionOther) onChange('professionOther', '');
                      if (!val.trim() && form.annualIncomeRange) {
                        onChange('annualIncomeRange', '');
                      }
                    }}
                    options={OCCUPATIONS}
                    placeholder="Select occupation"
                    searchable={true}
                    searchPlaceholder="Search occupation..."
                  />
                </Field>

                {form.profession === 'Other' && (
                  <ProgressiveField>
                    <Field
                      label={subject.label('Enter occupation')}
                      htmlFor="professionOther"
                      error={errors.profession}
                    >
                      <Input
                        id="professionOther"
                        placeholder="e.g. Software Developer, Doctor"
                        value={form.professionOther ?? ''}
                        onChange={(e) => onChange('professionOther', e.target.value)}
                      />
                    </Field>
                  </ProgressiveField>
                )}
              </div>
            </div>
          </div>
        </ProgressiveField>
      )}

      {/* 5. Annual Income Currency and Annual Income displayed after completing professional details */}
      {showIncome && (
        <ProgressiveField>
          <fieldset data-testid="income-details" className="pt-2">
            <legend className="mb-3 text-sm font-semibold text-nk-maroon-bright">Income Details</legend>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Field
                label={subject.label('Annual income currency')}
                htmlFor="annualIncomeCurrency"
                required
                error={errors.annualIncomeCurrency}
              >
                <SmartDropdown
                  id="annualIncomeCurrency"
                  invalid={Boolean(errors.annualIncomeCurrency)}
                  value={form.annualIncomeCurrency || 'INR'}
                  onChange={(val) => onChange('annualIncomeCurrency', val)}
                  options={CURRENCY_OPTIONS}
                  placeholder="Select currency"
                  searchable={false}
                />
              </Field>

              <div className="flex flex-col gap-3">
                <Field
                  label={subject.label('Annual income')}
                  htmlFor="annualIncomeRange"
                  required
                  error={errors.annualIncomeRange}
                >
                  <SmartDropdown
                    id="annualIncomeRange"
                    invalid={Boolean(errors.annualIncomeRange)}
                    value={form.annualIncomeRange}
                    onChange={(val) => {
                      onChange('annualIncomeRange', val);
                      if (val !== 'Other' && form.annualIncomeRangeOther) onChange('annualIncomeRangeOther', '');
                    }}
                    options={ANNUAL_INCOME_RANGES}
                    placeholder="Select annual income"
                    searchable={false}
                  />
                </Field>

                {form.annualIncomeRange === 'Other' && (
                  <ProgressiveField>
                    <Field
                      label={subject.label('Enter annual income')}
                      htmlFor="annualIncomeRangeOther"
                      error={errors.annualIncomeRange}
                    >
                      <Input
                        id="annualIncomeRangeOther"
                        placeholder="e.g. 10-15 LPA"
                        value={form.annualIncomeRangeOther ?? ''}
                        onChange={(e) => onChange('annualIncomeRangeOther', e.target.value)}
                      />
                    </Field>
                  </ProgressiveField>
                )}
              </div>
            </div>
          </fieldset>
        </ProgressiveField>
      )}
    </div>
  );
}
