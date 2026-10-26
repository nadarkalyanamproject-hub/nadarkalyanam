'use client';

import Link from 'next/link';
import type { SavedPartnerPreferences } from '@nadar-kalyanam/schemas';
import { MARITAL_LABELS, preferenceSummary } from '../../lib/partner-preferences';
import { PREFERENCES_EDITOR_HREF } from '../../lib/search-categories';
import { hasSavedPreferences } from '../../lib/search-plan';

// "Use my partner preferences" on Search. Its on/off state lives in the URL
// (?prefs=1), so it survives refresh and Back. With no saved preferences
// it's disabled and links to the editor; when on, every applied value is
// listed, so nothing filters invisibly.
export function UsePreferencesToggle({
  checked,
  onChange,
  preferences,
  error,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  // undefined while loading, null when none are saved.
  preferences: SavedPartnerPreferences | null | undefined;
  error: string | null;
}) {
  const saved = hasSavedPreferences(preferences) ? preferences : null;
  const disabled = !saved;

  return (
    <div className="rounded-2xl border border-nk-line-gold bg-white px-4 py-3 text-sm shadow-2xs" data-testid="use-preferences">
      <label className={`flex items-center gap-2 font-semibold ${disabled ? 'text-nk-muted' : 'text-nk-ink'}`}>
        <input
          type="checkbox"
          checked={checked && !disabled}
          disabled={disabled}
          onChange={(e) => onChange(e.target.checked)}
          className="h-4 w-4 accent-nk-maroon"
          data-testid="use-preferences-toggle"
        />
        Use my partner preferences
      </label>
      {preferences === undefined && !error && <p className="mt-1 text-xs text-nk-muted">Loading your preferences…</p>}
      {error && (
        <p className="mt-1 text-xs font-semibold text-nk-maroon" role="alert">
          {error}
        </p>
      )}
      {preferences !== undefined && !error && !saved && (
        <p className="mt-1 text-xs text-nk-muted" data-testid="use-preferences-none">
          You haven&apos;t set partner preferences yet.{' '}
          <Link href={PREFERENCES_EDITOR_HREF} className="font-semibold text-nk-maroon underline">
            Set your preferences
          </Link>
        </p>
      )}
      {saved && checked && (
        <p className="mt-1 text-xs text-nk-ink-soft" data-testid="use-preferences-applied">
          Filtering by:{' '}
          {preferenceSummary(saved)
            .map(
              (line) =>
                `${line.label} ${line.label === 'Marital status' ? saved.maritalStatuses.map((m) => MARITAL_LABELS[m] ?? m).join(' or ') : line.value}`,
            )
            .join(' · ')}
          .{' '}
          <Link href={PREFERENCES_EDITOR_HREF} className="font-semibold text-nk-maroon underline">
            Edit
          </Link>
        </p>
      )}
    </div>
  );
}
