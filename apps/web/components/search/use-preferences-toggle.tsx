'use client';

import { useState } from 'react';
import Link from 'next/link';
import type { SavedPartnerPreferences } from '@nadar-kalyanam/schemas';
import { ApiError, getPartnerPreferences } from '../../lib/api-client';
import { MARITAL_LABELS, preferenceSummary, searchFiltersFromPreferences } from '../../lib/partner-preferences';
import type { SearchFilters } from '../../lib/search-query';

// "Use my preferences" on Search: OFF by default, and while off nothing about
// Search changes. Turning it on fills the filters from the member's saved
// preferences (every applied value is listed here, so nothing filters
// invisibly); turning it off puts back exactly the filters they had before.
export function UsePreferencesToggle({
  accessToken,
  filters,
  onChange,
}: {
  accessToken: string;
  filters: SearchFilters;
  onChange: (filters: SearchFilters) => void;
}) {
  const [on, setOn] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [applied, setApplied] = useState<SavedPartnerPreferences | null>(null);
  const [before, setBefore] = useState<SearchFilters | null>(null);

  async function toggle(next: boolean) {
    setMessage(null);
    if (!next) {
      setOn(false);
      if (before) onChange(before);
      setBefore(null);
      setApplied(null);
      return;
    }
    setBusy(true);
    try {
      const { preferences } = await getPartnerPreferences(accessToken);
      if (!preferences || preferenceSummary(preferences).length === 0) {
        setMessage('none');
        return;
      }
      setBefore(filters);
      setApplied(preferences);
      onChange({ ...filters, ...searchFiltersFromPreferences(preferences) });
      setOn(true);
    } catch (err) {
      setMessage(err instanceof ApiError ? err.message : 'Could not load your preferences. Please try again.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-2xl border border-[#EADBBD] bg-white px-4 py-3 text-sm shadow-2xs" data-testid="use-preferences">
      <label className="flex items-center gap-2 font-semibold text-[#241C1A]">
        <input
          type="checkbox"
          checked={on}
          disabled={busy}
          onChange={(e) => void toggle(e.target.checked)}
          className="h-4 w-4 accent-[#7A1118]"
          data-testid="use-preferences-toggle"
        />
        Use my partner preferences
      </label>
      {message === 'none' && (
        <p className="mt-1 text-xs text-[#73645C]" data-testid="use-preferences-none">
          You haven&apos;t set partner preferences yet.{' '}
          <Link href="/profile#section-preferences" className="font-semibold text-[#7A1118] underline">
            Set them on your profile
          </Link>
          .
        </p>
      )}
      {message && message !== 'none' && (
        <p className="mt-1 text-xs font-semibold text-[#7A1118]" role="alert">
          {message}
        </p>
      )}
      {on && applied && (
        <p className="mt-1 text-xs text-[#5A493E]" data-testid="use-preferences-applied">
          Filtering by:{' '}
          {preferenceSummary(applied)
            .map(
              (line) =>
                `${line.label} ${line.label === 'Marital status' ? applied.maritalStatuses.map((m) => MARITAL_LABELS[m] ?? m).join(' or ') : line.value}`,
            )
            .join(' · ')}
          . Change any filter below, or untick to go back to your own filters.
        </p>
      )}
    </div>
  );
}
