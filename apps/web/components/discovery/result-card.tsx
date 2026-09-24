'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Button, Card } from '@nadar-kalyanam/ui';
import { UserIcon } from '../app-header';
import { ApiError, sendInterest } from '../../lib/api-client';
import { useRegistration } from '../../app/providers/registration-provider';

// Theme-token badges only (bg-primary / bg-accent), never a raw hex or
// Tailwind palette color — keeps every result card on the same two-color
// system as the rest of the app regardless of which page renders it.
const BADGE_STYLES = {
  primary: 'bg-[#FEF3C7] text-[#92400E] border border-[#FDE68A] font-bold',
  accent: 'bg-[#7A0710] text-[#FDE68A] border border-[#D6A33A]/50 font-bold',
} as const;

export function ResultCard({
  profileId,
  fullName,
  age,
  city,
  primaryPhotoUrl,
  badgeLabel,
  badgeVariant = 'primary',
}: {
  profileId: string;
  fullName: string;
  age: number;
  city: string | null;
  primaryPhotoUrl: string | null;
  badgeLabel?: string;
  badgeVariant?: keyof typeof BADGE_STYLES;
}) {
  const { data } = useRegistration();
  const [sent, setSent] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | undefined>();

  async function handleSendInterest() {
    setSending(true);
    setError(undefined);
    try {
      await sendInterest(data.accessToken!, { targetProfileId: profileId });
      setSent(true);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not send interest. Please try again.');
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="group flex flex-col overflow-hidden rounded-2xl border border-[#E8DCC8] bg-[#FFFFFF] shadow-sm transition-all duration-200 hover:border-[#F59E0B] hover:shadow-md">
      <div className="relative aspect-[4/3] w-full overflow-hidden bg-[#FAF6EF]">
        {primaryPhotoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={primaryPhotoUrl}
            alt=""
            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-[#968A82]">
            <UserIcon className="h-14 w-14" />
          </div>
        )}
        {badgeLabel && (
          <span
            className={`absolute right-2.5 top-2.5 rounded px-2.5 py-0.5 text-[11px] font-semibold tracking-wide shadow-xs ${BADGE_STYLES[badgeVariant]}`}
          >
            {badgeLabel}
          </span>
        )}
      </div>

      <div className="flex flex-1 flex-col p-4 sm:p-5">
        <h3 className="font-[family-name:var(--font-body)] text-base font-bold text-[#2B211C]">
          {fullName}, {age}
        </h3>
        {city && <p className="mt-1 text-xs font-medium text-[#776B62]">{city}</p>}

        {error ? <p className="mt-2 text-xs text-[#94151C]">{error}</p> : null}

        <div className="mt-4 flex gap-2 pt-2 border-t border-[#F3EBDD]">
          <Link href={`/browse/${profileId}`} className="flex-1">
            <button
              type="button"
              className="w-full rounded-lg border border-[#E8DCC8] bg-[#FFFDF9] py-2 text-xs font-semibold text-[#7A0710] shadow-2xs transition-all hover:border-[#F59E0B] hover:bg-[#FEF3C7]"
            >
              View Profile
            </button>
          </Link>
          <button
            type="button"
            disabled={sent || sending}
            onClick={() => void handleSendInterest()}
            className="flex-1 rounded-lg bg-gradient-to-r from-[#94151C] to-[#7A0710] py-2 text-xs font-semibold text-white shadow-2xs transition-all hover:from-[#A81C24] hover:to-[#94151C] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {sent ? '✓ Interest Sent' : sending ? 'Sending…' : 'Send Interest'}
          </button>
        </div>
      </div>
    </div>
  );
}
