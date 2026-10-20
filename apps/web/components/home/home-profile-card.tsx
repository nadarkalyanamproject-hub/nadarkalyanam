'use client';

import type { ReactNode } from 'react';
import Link from 'next/link';
import type { RelationshipStatus } from '@nadar-kalyanam/schemas';
import { Briefcase, MapPin } from 'lucide-react';
import { UserIcon } from '../app-header';
import { ConnectedBadge, RelationshipAction } from '../relationship/relationship-action';
import { VerifiedBadge } from '../ui/verified-badge';
import { Reveal, StaggerGroup, StaggerItem } from '../motion/motion';

export interface HomeProfile {
  profileId: string;
  fullName: string;
  age: number;
  isVerified: boolean;
  primaryPhotoUrl: string | null;
  profession: string | null;
  city: string | null;
  religion?: string | null;
  relationshipStatus: RelationshipStatus;
  conversationId: string | null;
}

// The one member card used by every row on the home page. The whole card
// opens the profile: the name is the card's only link, and its ::after
// stretches over the card. Controls that do something else (the interest
// action) sit above that overlay, so clicking them never opens the profile.
export function HomeProfileCard({ profile }: { profile: HomeProfile }) {
  const place = [profile.city, profile.religion].filter(Boolean).join(' · ');
  return (
    <div className="group relative flex cursor-pointer flex-col justify-between overflow-hidden rounded-xl border border-nk-line bg-white shadow-xs transition-all hover:border-nk-gold-light hover:-translate-y-0.5 hover:shadow-md has-[a[data-card-link]:focus-visible]:ring-2 has-[a[data-card-link]:focus-visible]:ring-nk-maroon has-[a[data-card-link]:focus-visible]:ring-offset-2">
      <div>
        <div className="relative aspect-[4/3] w-full overflow-hidden bg-[#F3EDE6]">
          {profile.primaryPhotoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={profile.primaryPhotoUrl}
              alt={profile.fullName}
              className="h-full w-full object-cover object-[50%_25%] transition-transform duration-300 group-hover:scale-105"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-[#A88C78]">
              <UserIcon className="h-8 w-8" />
            </div>
          )}
        </div>

        <div className="px-2.5 pt-2 pb-2">
          <Link
            href={`/browse/${profile.profileId}`}
            data-card-link
            className="flex items-center gap-1.5 after:absolute after:inset-0 after:content-[''] focus:outline-none"
          >
            <h3 className="flex min-w-0 text-[13px] font-bold text-nk-ink transition-colors group-hover:text-nk-maroon">
              <span className="truncate">{profile.fullName}</span>
              <span className="shrink-0">, {profile.age}</span>
            </h3>
            {profile.isVerified && <VerifiedBadge className="h-3.5 w-3.5 shrink-0" />}
          </Link>

          {profile.relationshipStatus === 'CONNECTED' && <ConnectedBadge className="mt-1" />}

          {profile.profession && (
            <p className="mt-0.5 flex items-center gap-1 text-[11px] font-medium text-[#4A3B33]">
              <Briefcase className="h-3 w-3 shrink-0 text-nk-subtle" />
              <span className="truncate">{profile.profession}</span>
            </p>
          )}

          {place && (
            <p className="mt-0.5 flex items-center gap-1 text-[11px] text-nk-subtle">
              <MapPin className="h-3 w-3 shrink-0" />
              <span className="truncate">{place}</span>
            </p>
          )}
        </div>
      </div>

      {/* Interest action: Send / Sent / Respond / Message */}
      <div className="px-2.5 pb-2.5">
        <RelationshipAction
          className="relative z-10 cursor-auto"
          appearance="home"
          profileId={profile.profileId}
          relationshipStatus={profile.relationshipStatus}
          conversationId={profile.conversationId}
        />
      </div>
    </div>
  );
}

// A titled row of member cards with a "View all" link. Shows a loading
// placeholder until `profiles` arrives, its own error, or a one-line empty
// message, so one failing call never affects the rest of the page.
export function HomeProfileSection({
  title,
  subtitle,
  viewAllHref,
  viewAllLabel = 'View all',
  profiles,
  error,
  emptyMessage,
  columns = 6,
  children,
  testId,
}: {
  title: string;
  subtitle: string;
  viewAllHref?: string;
  viewAllLabel?: string;
  profiles: HomeProfile[] | null;
  error: string | null;
  emptyMessage: string;
  columns?: 5 | 6;
  children?: ReactNode;
  testId?: string;
}) {
  const grid = columns === 6 ? 'lg:grid-cols-5 xl:grid-cols-6' : 'lg:grid-cols-4 xl:grid-cols-5';
  return (
    <Reveal as="section" className="space-y-4" data-testid={testId}>
      <div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-end">
        <div>
          <h2 className="font-[family-name:var(--font-heading,serif)] text-xl font-bold text-nk-ink sm:text-2xl">
            {title}
          </h2>
          <p className="mt-0.5 text-xs text-nk-muted sm:text-sm">{subtitle}</p>
        </div>
        {viewAllHref && (
          <Link
            href={viewAllHref}
            className="inline-flex items-center gap-1 text-xs font-bold text-nk-maroon hover:underline sm:text-sm"
          >
            <span>{viewAllLabel}</span>
            <span aria-hidden="true">→</span>
          </Link>
        )}
      </div>

      {children}

      {error ? (
        <p role="alert" className="py-6 text-center text-sm font-medium text-nk-maroon">
          {error}
        </p>
      ) : profiles === null ? (
        <div className={`grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 ${grid}`} aria-hidden="true">
          {Array.from({ length: columns }).map((_, index) => (
            <div key={index} className="h-52 rounded-xl border border-[#F0E6D8] bg-[#FAF6EF]" />
          ))}
        </div>
      ) : profiles.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-nk-line py-6 text-center text-sm text-nk-muted">
          {emptyMessage}
        </p>
      ) : (
        <StaggerGroup className={`grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 ${grid}`}>
          {profiles.map((profile) => (
            <StaggerItem key={profile.profileId} className="flex [&>*]:flex-1">
              <HomeProfileCard profile={profile} />
            </StaggerItem>
          ))}
        </StaggerGroup>
      )}
    </Reveal>
  );
}
