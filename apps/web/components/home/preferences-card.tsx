import Link from 'next/link';
import type { SavedPartnerPreferences } from '@nadar-kalyanam/schemas';
import { SlidersHorizontal } from 'lucide-react';
import { preferenceSummary } from '../../lib/partner-preferences';
import { PREFERENCES_EDITOR_HREF } from '../../lib/search-categories';

const BUTTON =
  'inline-flex shrink-0 items-center justify-center rounded-xl border border-nk-line-gold bg-nk-cream px-4 py-2 text-xs font-semibold text-nk-maroon-deep transition-colors hover:border-nk-gold-light hover:bg-[#FBF1DC] sm:text-sm';

// "Set Your Preferences" on Home: an invitation when none are saved, or a
// short summary of what is saved (only real values) with a way to update.
export function PreferencesCard({
  preferences,
  error,
}: {
  // undefined while loading, null when none are saved.
  preferences: SavedPartnerPreferences | null | undefined;
  error: string | null;
}) {
  const lines = preferences ? preferenceSummary(preferences) : [];
  const isSet = lines.length > 0;

  return (
    <section
      className="flex min-h-[88px] flex-col gap-3 rounded-2xl border border-nk-line-gold/80 bg-white p-4 shadow-2xs sm:flex-row sm:items-center sm:justify-between sm:p-5"
      data-testid="home-preferences"
      data-state={error ? 'error' : preferences === undefined ? 'loading' : isSet ? 'set' : 'empty'}
    >
      <div className="flex min-w-0 items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-[#F8D7DA] bg-[#FDF2F2] text-nk-maroon">
          <SlidersHorizontal className="h-5 w-5" />
        </div>
        <div className="min-w-0">
          <h2 className="text-sm font-bold text-nk-ink sm:text-base">{isSet ? 'Your Partner Preferences' : 'Set Your Preferences'}</h2>
          {error ? (
            <p className="mt-0.5 text-xs text-nk-maroon sm:text-sm" role="alert">
              {error}
            </p>
          ) : preferences === undefined ? (
            <p className="mt-0.5 text-xs text-nk-muted sm:text-sm">Loading your preferences…</p>
          ) : isSet ? (
            <ul className="mt-2 flex flex-wrap gap-1.5" aria-label="Saved preferences">
              {lines.map((line) => (
                <li key={line.label} className="rounded-full border border-nk-line-gold bg-nk-paper px-2.5 py-0.5 text-[11px] text-nk-ink-soft sm:text-xs">
                  <span className="font-semibold">{line.label}:</span> {line.value}
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-0.5 text-xs text-nk-muted sm:text-sm">Tell us who you&apos;re looking for to get better matches.</p>
          )}
        </div>
      </div>
      {preferences !== undefined && (
        <Link href={PREFERENCES_EDITOR_HREF} className={BUTTON} data-testid="home-preferences-button">
          {isSet ? 'Update preferences' : error ? 'Open preferences' : 'Set Your Preferences'}
        </Link>
      )}
    </section>
  );
}
