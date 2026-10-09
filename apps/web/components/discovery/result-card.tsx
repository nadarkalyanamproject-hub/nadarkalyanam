'use client';

import Link from 'next/link';
import type { RelationshipStatus } from '@nadar-kalyanam/schemas';
import { UserIcon } from '../app-header';
import { ConnectedBadge, RelationshipAction } from '../relationship/relationship-action';
import { VerifiedBadge } from '../ui/verified-badge';

// Theme-token badges only (bg-primary / bg-accent), never a raw hex or
// Tailwind palette color — keeps every result card on the same two-color
// system as the rest of the app regardless of which page renders it.
const BADGE_STYLES = {
  primary: 'bg-[#FEF3C7] text-[#92400E] border border-[#FDE68A] font-bold',
  accent: 'bg-nk-maroon text-[#FDE68A] border border-nk-gold-light/50 font-bold',
} as const;

export function ResultCard({
  profileId,
  fullName,
  age,
  city,
  primaryPhotoUrl,
  badgeLabel,
  badgeVariant = 'primary',
  verified = false,
  relationshipStatus,
  conversationId,
}: {
  profileId: string;
  fullName: string;
  age: number;
  city: string | null;
  primaryPhotoUrl: string | null;
  badgeLabel?: string;
  badgeVariant?: keyof typeof BADGE_STYLES;
  verified?: boolean;
  relationshipStatus: RelationshipStatus;
  conversationId: string | null;
}) {
  return (
    <div className="group flex flex-col overflow-hidden rounded-2xl border border-nk-line bg-[#FFFFFF] shadow-sm transition-all duration-200 hover:border-[#F59E0B] hover:shadow-md">
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
        <h3 className="flex items-center gap-1.5 font-[family-name:var(--font-body)] text-base font-bold text-nk-ink">
          <span className="flex min-w-0">
            <span className="truncate">{fullName}</span>
            <span className="shrink-0">, {age}</span>
          </span>
          {verified && <VerifiedBadge className="h-4 w-4 shrink-0" />}
        </h3>
        {city && <p className="mt-1 text-xs font-medium text-nk-muted">{city}</p>}
        {relationshipStatus === 'CONNECTED' && <ConnectedBadge className="mt-1.5 self-start" />}

        <div className="mt-4 flex items-start gap-2 pt-2 border-t border-nk-line-soft">
          <Link href={`/browse/${profileId}`} className="flex-1">
            <button
              type="button"
              className="w-full rounded-lg border border-nk-line bg-nk-ivory py-2 text-xs font-semibold text-nk-maroon shadow-2xs transition-all hover:border-[#F59E0B] hover:bg-[#FEF3C7]"
            >
              View Profile
            </button>
          </Link>
          <RelationshipAction
            className="flex-1"
            appearance="discovery"
            profileId={profileId}
            relationshipStatus={relationshipStatus}
            conversationId={conversationId}
          />
        </div>
      </div>
    </div>
  );
}
