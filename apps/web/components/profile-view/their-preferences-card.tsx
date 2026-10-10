'use client';

import type { PublicProfileDetail } from '@nadar-kalyanam/schemas';
import { CheckCircle2, HeartHandshake, MinusCircle, XCircle } from 'lucide-react';
import { theirPreferenceRows } from '../../lib/partner-preferences';
import { useProfile } from '../../lib/use-profile';
import { UserIcon } from '../app-header';

function Avatar({ url, label }: { url: string | null | undefined; label: string }) {
  return (
    <div className="h-12 w-12 shrink-0 overflow-hidden rounded-lg border border-nk-line-gold bg-nk-paper" title={label}>
      {url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={url} alt={label} className="h-full w-full object-cover" />
      ) : (
        <div className="flex h-full w-full items-center justify-center text-[#A88C78]">
          <UserIcon className="h-5 w-5" />
        </div>
      )}
    </div>
  );
}

// "Her/His Partner Preferences" on another member's profile: what they're
// looking for, and whether the viewing member matches each point.
export function TheirPreferencesCard({ profile }: { profile: PublicProfileDetail }) {
  const { profile: me } = useProfile();
  if (!profile.theirPreferences) return null;

  const { preferences, fit } = profile.theirPreferences;
  const rows = theirPreferenceRows(preferences, fit);
  const pronoun = profile.gender === 'FEMALE' ? 'her' : profile.gender === 'MALE' ? 'his' : 'their';
  const title = `${pronoun[0].toUpperCase()}${pronoun.slice(1)} Partner Preferences`;
  const myPhoto = me?.photos.find((photo) => photo.isPrimary)?.url ?? me?.photos[0]?.url;

  return (
    <div
      className="rounded-3xl border border-nk-line-soft bg-white p-6 shadow-[0_4px_24px_rgba(0,0,0,0.02)] sm:p-7"
      data-testid="their-preferences"
    >
      <div className="flex items-center gap-2.5 border-b border-nk-line-soft pb-4">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-[#F2D6DC] bg-[#FAF5F6] text-nk-maroon">
          <HeartHandshake className="h-4 w-4" />
        </div>
        <div>
          <h2 className="font-[family-name:var(--font-playfair)] font-serif text-lg font-bold text-[#1E293B] sm:text-xl">
            {title}
          </h2>
          <p className="text-xs text-nk-muted">What {profile.fullName.split(' ')[0]} is looking for in a partner</p>
        </div>
      </div>

      {/* Match summary: their photo, the score, the viewer's photo */}
      <div className="mt-5 flex items-center justify-between gap-4 rounded-2xl border border-[#F2D6DC] bg-[#FDF8F9] p-3 sm:p-4">
        <Avatar url={profile.primaryPhotoUrl} label={profile.fullName} />
        <p className="text-center text-sm font-semibold text-nk-ink sm:text-base">
          You match{' '}
          <span className="text-nk-maroon">
            {fit.matched}/{fit.total}
          </span>{' '}
          of {pronoun} preferences
        </p>
        <Avatar url={myPhoto} label="You" />
      </div>

      <div className="mt-5">
        <div className="flex items-center justify-between border-b border-nk-line-soft pb-2 text-[11px] font-semibold uppercase tracking-wider text-nk-subtle">
          <span>Preference</span>
          <span>You match</span>
        </div>
        <ul className="divide-y divide-[#F5F0E8]">
          {rows.map((row) => (
            <li key={row.key} className="grid grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)_auto] items-center gap-3 py-3 text-sm">
              <span className="text-nk-ink-soft">
                Preferred {row.label.toLowerCase()}
                {row.mustHave && <span className="block text-[11px] font-semibold text-[#B45309]">Must have</span>}
              </span>
              <span className="font-semibold text-nk-ink">{row.value}</span>
              {row.matched === true ? (
                <CheckCircle2 className="h-5 w-5 text-[#15803D]" aria-label="You match" />
              ) : row.matched === false ? (
                <XCircle className="h-5 w-5 text-[#B9AFA8]" aria-label="You don't match" />
              ) : (
                <MinusCircle className="h-5 w-5 text-[#D6CFC8]" aria-label="Not stated on your profile" />
              )}
            </li>
          ))}
        </ul>
        {fit.unknown > 0 && (
          <p className="mt-3 text-xs text-nk-subtle">
            {fit.unknown === 1 ? 'One preference' : `${fit.unknown} preferences`} couldn&apos;t be checked because your
            profile doesn&apos;t state it.
          </p>
        )}
      </div>
    </div>
  );
}
