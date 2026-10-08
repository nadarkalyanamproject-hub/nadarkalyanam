'use client';

import { useState, type FormEvent } from 'react';
import {
  INDIA_STATES_AND_UTS,
  MOTHER_TONGUES,
  partnerPreferencesSchema,
  type DoshamPreference,
  type SavedPartnerPreferences,
} from '@nadar-kalyanam/schemas';
import { Button, Field, FormError, Input, Select } from '@nadar-kalyanam/ui';
import { useRegistration } from '../../app/providers/registration-provider';
import { ApiError, resetPartnerPreferences, savePartnerPreferences } from '../../lib/api-client';
import {
  DOSHAM_PREFERENCE_LABELS,
  MARITAL_LABELS,
  parseCityList,
  preferenceSummary,
  preferencesFormFrom,
  toPreferencesRequest,
  type PreferencesForm,
} from '../../lib/partner-preferences';
import { toFieldErrors } from '../../lib/zod-errors';
import { AGE_MAX_OPTIONS, AGE_MIN_OPTIONS, HEIGHT_OPTIONS, INCOME_LAKH_OPTIONS } from '../search/partner-search-bar';

// Options for a select: the shared list, plus the saved value if it isn't
// in it (set some other way), so a saved value is never silently blank.
function withCurrent(options: { value: string; label: string }[], current: string, label: (v: string) => string) {
  return current && !options.some((o) => o.value === current) ? [...options, { value: current, label: label(current) }] : options;
}
const ages = (list: string[]) => list.map((a) => ({ value: a, label: `${a} yrs` }));

export function PartnerPreferencesView({ saved }: { saved: SavedPartnerPreferences | null }) {
  const lines = saved ? preferenceSummary(saved) : [];
  if (lines.length === 0) {
    return (
      <p className="text-sm text-[#776B62]" data-testid="preferences-empty">
        You haven&apos;t set any partner preferences. Add them to rank your Matches by what you&apos;re looking for.
      </p>
    );
  }
  return (
    <div className="space-y-3" data-testid="preferences-view">
      <dl className="grid grid-cols-1 gap-x-6 gap-y-4 sm:grid-cols-2">
        {lines.map((line) => (
          <div key={line.label}>
            <dt className="text-xs font-semibold uppercase tracking-wide text-[#776B62]">
              {line.label}
              {line.mustHave && (
                <span className="ml-2 rounded-md bg-[#7A0710]/10 px-2 py-0.5 text-[10px] font-bold normal-case text-[#7A0710]">Must have</span>
              )}
            </dt>
            <dd className="mt-0.5 text-sm font-medium text-[#2B211C]">{line.value}</dd>
          </div>
        ))}
      </dl>
      <p className="text-xs text-[#776B62]">Only you can see your preferences. They rank your Matches; must-haves also filter them.</p>
    </div>
  );
}

function CheckboxGroup({
  name,
  options,
  values,
  onChange,
  scroll = false,
}: {
  name: string;
  options: { value: string; label: string }[];
  values: string[];
  onChange: (values: string[]) => void;
  scroll?: boolean;
}) {
  return (
    <div
      className={`grid grid-cols-2 gap-x-4 gap-y-1.5 sm:grid-cols-3 ${scroll ? 'max-h-48 overflow-y-auto rounded-lg border border-[#E8DCC8] p-3' : ''}`}
    >
      {options.map((option) => (
        <label key={option.value} className="flex items-center gap-2 text-sm text-[#2B211C]">
          <input
            type="checkbox"
            name={name}
            checked={values.includes(option.value)}
            onChange={(e) => onChange(e.target.checked ? [...values, option.value] : values.filter((v) => v !== option.value))}
            className="h-4 w-4 accent-[#7A0710]"
          />
          {option.label}
        </label>
      ))}
    </div>
  );
}

function MustHave({ checked, onChange, id }: { checked: boolean; onChange: (v: boolean) => void; id: string }) {
  return (
    <label htmlFor={id} className="mt-2 flex items-center gap-2 text-xs font-semibold text-[#7A0710]">
      <input id={id} type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="h-4 w-4 accent-[#7A0710]" />
      Must have (only show matches that meet this)
    </label>
  );
}

export function PartnerPreferencesEditor({
  saved,
  onCancel,
  onSaved,
}: {
  saved: SavedPartnerPreferences | null;
  onCancel: () => void;
  onSaved: (saved: SavedPartnerPreferences | null, message: string) => void;
}) {
  const { data } = useRegistration();
  const [form, setForm] = useState<PreferencesForm>(() => preferencesFormFrom(saved));
  const [cityText, setCityText] = useState(() => (saved?.cities ?? []).join(', '));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | undefined>();
  const [busy, setBusy] = useState(false);
  const set = <K extends keyof PreferencesForm>(key: K, value: PreferencesForm[K]) => setForm((prev) => ({ ...prev, [key]: value }));

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setFormError(undefined);
    const request = toPreferencesRequest({
      ...form,
      cities: parseCityList(cityText),
    });
    const result = partnerPreferencesSchema.safeParse(request);
    if (!result.success) {
      setErrors(toFieldErrors(result.error));
      return;
    }
    setErrors({});
    setBusy(true);
    try {
      const response = await savePartnerPreferences(data.accessToken!, request);
      onSaved(response.preferences, 'Partner preferences saved.');
    } catch (error) {
      setFormError(error instanceof ApiError ? error.message : 'Could not save your preferences. Please try again.');
      setBusy(false);
    }
  }

  async function handleReset() {
    setFormError(undefined);
    setBusy(true);
    try {
      await resetPartnerPreferences(data.accessToken!);
      onSaved(null, 'Partner preferences cleared.');
    } catch (error) {
      setFormError(error instanceof ApiError ? error.message : 'Could not reset your preferences. Please try again.');
      setBusy(false);
    }
  }

  const heightOptions = HEIGHT_OPTIONS;
  return (
    <form className="flex flex-col gap-5" onSubmit={handleSubmit} noValidate data-testid="preferences-form">
      <p className="text-xs text-[#776B62]">Leave anything blank for &ldquo;doesn&apos;t matter&rdquo;. Only you can see these.</p>

      <div>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Age from" htmlFor="pref-age-min" error={errors.ageMin}>
            <Select id="pref-age-min" value={form.ageMin} onChange={(e) => set('ageMin', e.target.value)}>
              <option value="">Any</option>
              {withCurrent(ages(AGE_MIN_OPTIONS), form.ageMin, (v) => `${v} yrs`).map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Age to" htmlFor="pref-age-max" error={errors.ageMax}>
            <Select id="pref-age-max" value={form.ageMax} onChange={(e) => set('ageMax', e.target.value)}>
              <option value="">Any</option>
              {withCurrent(ages(AGE_MAX_OPTIONS), form.ageMax, (v) => `${v} yrs`).map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </Select>
          </Field>
        </div>
        <MustHave id="pref-must-age" checked={form.mustHaveAge} onChange={(v) => set('mustHaveAge', v)} />
        {errors.mustHaveAge && <p className="mt-1 text-xs font-semibold text-destructive">{errors.mustHaveAge}</p>}
      </div>

      <div className="grid grid-cols-2 gap-4">
        <Field label="Height from" htmlFor="pref-height-min" error={errors.heightMinCm}>
          <Select id="pref-height-min" value={form.heightMinCm} onChange={(e) => set('heightMinCm', e.target.value)}>
            <option value="">Any</option>
            {withCurrent(heightOptions, form.heightMinCm, (v) => `${v} cm`).map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Height to" htmlFor="pref-height-max" error={errors.heightMaxCm}>
          <Select id="pref-height-max" value={form.heightMaxCm} onChange={(e) => set('heightMaxCm', e.target.value)}>
            <option value="">Any</option>
            {withCurrent(heightOptions, form.heightMaxCm, (v) => `${v} cm`).map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </Select>
        </Field>
      </div>

      <div>
        <p className="mb-2 text-sm font-semibold text-[#2B211C]">Marital status</p>
        <CheckboxGroup
          name="pref-marital"
          options={Object.entries(MARITAL_LABELS).map(([value, label]) => ({
            value,
            label,
          }))}
          values={form.maritalStatuses}
          onChange={(v) => set('maritalStatuses', v)}
        />
        <MustHave id="pref-must-marital" checked={form.mustHaveMaritalStatus} onChange={(v) => set('mustHaveMaritalStatus', v)} />
        {errors.mustHaveMaritalStatus && <p className="mt-1 text-xs font-semibold text-destructive">{errors.mustHaveMaritalStatus}</p>}
      </div>

      <div>
        <p className="mb-2 text-sm font-semibold text-[#2B211C]">Mother tongue</p>
        <CheckboxGroup
          name="pref-tongue"
          options={MOTHER_TONGUES.map((t) => ({ value: t, label: t }))}
          values={form.motherTongues}
          onChange={(v) => set('motherTongues', v)}
        />
      </div>

      <div>
        <p className="mb-1 text-sm font-semibold text-[#2B211C]">Location (India)</p>
        <p className="mb-2 text-xs text-[#776B62]">Choose states and/or type cities. Leave both empty for anywhere.</p>
        <CheckboxGroup
          name="pref-states"
          options={INDIA_STATES_AND_UTS.map((s) => ({ value: s, label: s }))}
          values={form.states}
          onChange={(v) => set('states', v)}
          scroll
        />
        <Field label="Cities (comma-separated)" htmlFor="pref-cities" error={errors.cities} className="mt-3">
          <Input
            id="pref-cities"
            value={cityText}
            onChange={(e) => setCityText(e.target.value)}
            placeholder="e.g. Chennai, Madurai"
            maxLength={400}
          />
        </Field>
        <MustHave id="pref-must-location" checked={form.mustHaveLocation} onChange={(v) => set('mustHaveLocation', v)} />
        {errors.mustHaveLocation && <p className="mt-1 text-xs font-semibold text-destructive">{errors.mustHaveLocation}</p>}
      </div>

      <div className="grid grid-cols-2 gap-4">
        <Field label="Annual income from" htmlFor="pref-income-min" error={errors.incomeMinLakhs}>
          <Select id="pref-income-min" value={form.incomeMinLakhs} onChange={(e) => set('incomeMinLakhs', e.target.value)}>
            <option value="">Any</option>
            {withCurrent(INCOME_LAKH_OPTIONS, form.incomeMinLakhs, (v) => `₹${v} L`).map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Annual income to" htmlFor="pref-income-max" error={errors.incomeMaxLakhs}>
          <Select id="pref-income-max" value={form.incomeMaxLakhs} onChange={(e) => set('incomeMaxLakhs', e.target.value)}>
            <option value="">Any</option>
            {withCurrent(INCOME_LAKH_OPTIONS, form.incomeMaxLakhs, (v) => `₹${v} L`).map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </Select>
        </Field>
      </div>

      <Field label="Dosham" htmlFor="pref-dosham" hint="Uses the Dosham answer on their profile.">
        <Select id="pref-dosham" value={form.doshamPreference} onChange={(e) => set('doshamPreference', e.target.value as DoshamPreference)}>
          {Object.entries(DOSHAM_PREFERENCE_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </Select>
      </Field>

      {formError ? <FormError>{formError}</FormError> : null}

      <div className="mt-1 flex flex-wrap gap-3">
        <Button type="submit" size="lg" disabled={busy}>
          {busy ? 'Saving...' : 'Save preferences'}
        </Button>
        <Button type="button" variant="outline" size="lg" disabled={busy} onClick={onCancel}>
          Cancel
        </Button>
        {saved && (
          <Button type="button" variant="outline" size="lg" disabled={busy} onClick={() => void handleReset()} data-testid="preferences-reset">
            Reset (clear all)
          </Button>
        )}
      </div>
    </form>
  );
}
