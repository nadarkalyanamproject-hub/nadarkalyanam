'use client';

import { useRef, useState, type ChangeEvent, type FormEvent } from 'react';
import { INDIA_STATES_AND_UTS, NAKSHATRAS, RASIS, updateHoroscopeSchema, type MyHoroscope } from '@nadar-kalyanam/schemas';
import { Button, Field, FormError, Input, Select } from '@nadar-kalyanam/ui';
import { useRegistration } from '../../app/providers/registration-provider';
import {
  ApiError,
  confirmHoroscopeChart,
  deleteHoroscopeChart,
  requestHoroscopeChartUploadUrl,
  saveMyHoroscope,
  uploadPhotoToStorage,
} from '../../lib/api-client';
import {
  HOROSCOPE_VISIBILITY_OPTIONS,
  horoscopeFormFrom,
  horoscopeRows,
  toHoroscopeRequest,
  type HoroscopeForm,
} from '../../lib/partner-preferences';
import { toFieldErrors } from '../../lib/zod-errors';

const CHART_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_CHART_BYTES = 5 * 1024 * 1024;

function visibilityLabel(h: MyHoroscope | null): string {
  const option = HOROSCOPE_VISIBILITY_OPTIONS.find((o) => o.value === (h?.visibility ?? 'HIDDEN'))!;
  const birth =
    h?.visibility !== 'HIDDEN' && h?.shareBirthDetails ? ' Birth time and place are shared too.' : ' Birth time and place are not shared.';
  return `${option.label}: ${option.help}${h && h.visibility !== 'HIDDEN' ? birth : ''}`;
}

// The owner's own view: everything they entered, who can see it, and the
// chart image with its moderation state.
export function HoroscopeOwnerView({ saved, onChanged }: { saved: MyHoroscope | null; onChanged: (h: MyHoroscope | null, message: string) => void }) {
  const rows = saved
    ? horoscopeRows({
        ...saved,
        birthPlace: {
          city: saved.birthCity,
          state: saved.birthState,
          country: saved.birthCountry,
        },
      })
    : [];
  return (
    <div className="space-y-4" data-testid="horoscope-owner-view">
      <p className="rounded-lg bg-[#FFF9ED] px-3 py-2 text-xs text-[#5A493E]" data-testid="horoscope-visibility">
        <span className="font-semibold text-[#7A0710]">Who can see this — </span>
        {visibilityLabel(saved)}
      </p>
      {rows.length === 0 ? (
        <p className="text-sm text-[#776B62]" data-testid="horoscope-empty">
          You haven&apos;t added horoscope details.
        </p>
      ) : (
        <dl className="grid grid-cols-1 gap-x-6 gap-y-4 sm:grid-cols-2">
          {rows.map((row) => (
            <div key={row.label}>
              <dt className="text-xs font-semibold uppercase tracking-wide text-[#776B62]">{row.label}</dt>
              <dd className="mt-0.5 text-sm font-medium text-[#2B211C]">{row.value}</dd>
            </div>
          ))}
        </dl>
      )}
      <HoroscopeChartCard saved={saved} onChanged={onChanged} />
    </div>
  );
}

function HoroscopeChartCard({ saved, onChanged }: { saved: MyHoroscope | null; onChanged: (h: MyHoroscope | null, message: string) => void }) {
  const { data } = useRegistration();
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const chart = saved?.chart ?? null;

  async function upload(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    setError(null);
    if (!CHART_TYPES.includes(file.type)) return setError('Please choose a JPEG, PNG or WEBP image.');
    if (file.size > MAX_CHART_BYTES) return setError('Image must be smaller than 5 MB.');
    setBusy(true);
    try {
      const { uploadUrl, objectKey } = await requestHoroscopeChartUploadUrl(data.accessToken!, file.type);
      await uploadPhotoToStorage(uploadUrl, file);
      const result = await confirmHoroscopeChart(data.accessToken!, objectKey);
      onChanged(
        result.horoscope,
        result.horoscope?.chart?.status === 'APPROVED' ? 'Chart uploaded.' : 'Chart uploaded. It will be shown after our team reviews it.',
      );
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not upload the chart. Please try again.');
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    setError(null);
    setBusy(true);
    try {
      const result = await deleteHoroscopeChart(data.accessToken!);
      onChanged(result.horoscope, 'Chart removed.');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not remove the chart. Please try again.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-xl border border-[#E8DCC8] p-4" data-testid="horoscope-chart">
      <p className="text-sm font-semibold text-[#2B211C]">Jathagam chart image (optional)</p>
      <p className="mt-0.5 text-xs text-[#776B62]">Shown to the same members as your horoscope, and only after our team has reviewed it.</p>
      {chart && (
        <div className="mt-3 flex flex-wrap items-start gap-4">
          {/* eslint-disable-next-line @next/next/no-img-element -- short-lived signed URL */}
          <img src={chart.url} alt="Your jathagam chart" className="h-40 w-auto max-w-full rounded-lg border border-[#E8DCC8] object-contain" />
          <div className="text-xs">
            <p data-testid="chart-status" className="font-semibold">
              {chart.status === 'APPROVED'
                ? 'Approved'
                : chart.status === 'PENDING'
                  ? 'Waiting for review — not shown to anyone yet'
                  : 'Not approved'}
            </p>
            {chart.status === 'REJECTED' && chart.rejectionReason && <p className="mt-1 text-[#94151C]">Reason: {chart.rejectionReason}</p>}
          </div>
        </div>
      )}
      {error && (
        <p className="mt-2 text-xs font-semibold text-[#94151C]" role="alert">
          {error}
        </p>
      )}
      <div className="mt-3 flex flex-wrap gap-2">
        <input ref={input} type="file" accept={CHART_TYPES.join(',')} className="hidden" onChange={(e) => void upload(e)} data-testid="chart-input" />
        <Button type="button" size="sm" variant="outline" disabled={busy} onClick={() => input.current?.click()}>
          {busy ? 'Working…' : chart ? 'Replace chart' : 'Upload chart'}
        </Button>
        {chart && (
          <Button type="button" size="sm" variant="outline" disabled={busy} onClick={() => void remove()}>
            Remove chart
          </Button>
        )}
      </div>
    </div>
  );
}

export function HoroscopeEditor({
  saved,
  onCancel,
  onSaved,
}: {
  saved: MyHoroscope | null;
  onCancel: () => void;
  onSaved: (h: MyHoroscope | null, message: string) => void;
}) {
  const { data } = useRegistration();
  const [form, setForm] = useState<HoroscopeForm>(() => horoscopeFormFrom(saved));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | undefined>();
  const [busy, setBusy] = useState(false);
  const set = <K extends keyof HoroscopeForm>(key: K, value: HoroscopeForm[K]) => setForm((prev) => ({ ...prev, [key]: value }));
  const india = form.birthCountry.trim() === '' || form.birthCountry.trim().toLowerCase() === 'india';

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setFormError(undefined);
    const request = toHoroscopeRequest({
      ...form,
      birthState: india ? form.birthState : '',
    });
    const result = updateHoroscopeSchema.safeParse(request);
    if (!result.success) {
      setErrors(toFieldErrors(result.error));
      return;
    }
    setErrors({});
    setBusy(true);
    try {
      const response = await saveMyHoroscope(data.accessToken!, request);
      onSaved(response.horoscope, 'Horoscope details saved.');
    } catch (error) {
      setFormError(error instanceof ApiError ? error.message : 'Could not save your horoscope. Please try again.');
      setBusy(false);
    }
  }

  const rasiOptions = RASIS.map((r) => (
    <option key={r.code} value={r.code}>
      {r.label} ({r.english})
    </option>
  ));
  const dosham = (id: string, key: 'sevvaiDosham' | 'raguKethuDosham', label: string) => (
    <Field label={label} htmlFor={id} error={errors[key]}>
      <Select id={id} value={form[key]} onChange={(e) => set(key, e.target.value)}>
        <option value="">Not stated</option>
        <option value="NO">No</option>
        <option value="YES">Yes</option>
        <option value="DONT_KNOW">Don&apos;t know</option>
      </Select>
    </Field>
  );

  return (
    <form className="flex flex-col gap-5" onSubmit={handleSubmit} noValidate data-testid="horoscope-form">
      <fieldset className="rounded-xl border border-[#E8DCC8] p-4">
        <legend className="px-1 text-sm font-semibold text-[#7A0710]">Who can see your horoscope</legend>
        <div className="space-y-2">
          {HOROSCOPE_VISIBILITY_OPTIONS.map((o) => (
            <label key={o.value} className="flex items-start gap-2 text-sm">
              <input
                type="radio"
                name="horoscope-visibility"
                value={o.value}
                checked={form.visibility === o.value}
                onChange={() => set('visibility', o.value)}
                className="mt-1 h-4 w-4 accent-[#7A0710]"
              />
              <span>
                <span className="font-semibold text-[#2B211C]">{o.label}</span>
                <span className="block text-xs text-[#776B62]">{o.help}</span>
              </span>
            </label>
          ))}
        </div>
        <label className="mt-3 flex items-start gap-2 text-sm">
          <input
            type="checkbox"
            checked={form.shareBirthDetails}
            onChange={(e) => set('shareBirthDetails', e.target.checked)}
            className="mt-1 h-4 w-4 accent-[#7A0710]"
            data-testid="share-birth-details"
          />
          <span>
            <span className="font-semibold text-[#2B211C]">Also show my birth time and place</span>
            <span className="block text-xs text-[#776B62]">
              Off by default. Only shown to the members chosen above, never in search results or lists.
            </span>
          </span>
        </label>
      </fieldset>

      <p className="text-xs text-[#776B62]">Your date of birth comes from your basic details. Leave anything you don&apos;t know blank.</p>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Birth time (24-hour)" htmlFor="h-time" error={errors.birthTime}>
          <Input id="h-time" type="time" value={form.birthTime} onChange={(e) => set('birthTime', e.target.value)} />
        </Field>
        <Field label="Birth city / town" htmlFor="h-city" error={errors.birthCity}>
          <Input id="h-city" value={form.birthCity} maxLength={60} onChange={(e) => set('birthCity', e.target.value)} />
        </Field>
        <Field label="Birth country" htmlFor="h-country" error={errors.birthCountry}>
          <Input id="h-country" value={form.birthCountry} maxLength={60} onChange={(e) => set('birthCountry', e.target.value)} />
        </Field>
        {india && (
          <Field label="Birth state" htmlFor="h-state" error={errors.birthState}>
            <Select id="h-state" value={form.birthState} onChange={(e) => set('birthState', e.target.value)}>
              <option value="">Select</option>
              {INDIA_STATES_AND_UTS.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </Select>
          </Field>
        )}
        <Field label="Rasi" htmlFor="h-rasi" error={errors.rasi}>
          <Select id="h-rasi" value={form.rasi} onChange={(e) => set('rasi', e.target.value)}>
            <option value="">Not stated</option>
            {rasiOptions}
          </Select>
        </Field>
        <Field label="Nakshatra (star)" htmlFor="h-star" error={errors.nakshatra}>
          <Select
            id="h-star"
            value={form.nakshatra}
            onChange={(e) =>
              setForm((prev) => ({
                ...prev,
                nakshatra: e.target.value,
                nakshatraPada: e.target.value ? prev.nakshatraPada : '',
              }))
            }
          >
            <option value="">Not stated</option>
            {NAKSHATRAS.map((n) => (
              <option key={n.code} value={n.code}>
                {n.label}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Pada" htmlFor="h-pada" error={errors.nakshatraPada}>
          <Select id="h-pada" value={form.nakshatraPada} disabled={!form.nakshatra} onChange={(e) => set('nakshatraPada', e.target.value)}>
            <option value="">Not stated</option>
            {[1, 2, 3, 4].map((p) => (
              <option key={p} value={String(p)}>
                {p}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Lagnam" htmlFor="h-lagnam" error={errors.lagnam}>
          <Select id="h-lagnam" value={form.lagnam} onChange={(e) => set('lagnam', e.target.value)}>
            <option value="">Not stated</option>
            {rasiOptions}
          </Select>
        </Field>
        {dosham('h-sevvai', 'sevvaiDosham', 'Sevvai (Chevvai) dosham')}
        {dosham('h-ragu', 'raguKethuDosham', 'Raghu-Kethu dosham')}
      </div>

      {formError ? <FormError>{formError}</FormError> : null}
      <div className="flex gap-3">
        <Button type="submit" size="lg" disabled={busy}>
          {busy ? 'Saving...' : 'Save horoscope'}
        </Button>
        <Button type="button" variant="outline" size="lg" disabled={busy} onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
