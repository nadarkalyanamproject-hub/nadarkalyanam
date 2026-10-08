'use client';

import type { ReactNode } from 'react';
import Link from 'next/link';
import type { RelationshipStatus } from '@nadar-kalyanam/schemas';
import { Briefcase, MapPin } from 'lucide-react';
import { UserIcon } from '../app-header';
import { ConnectedBadge, RelationshipAction } from '../relationship/relationship-action';
import { VerifiedBadge } from '../ui/verified-badge';

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

// The one member card used by every row on the home page.
export function HomeProfileCard({ profile }: { profile: HomeProfile }) {
  const place = [profile.city, profile.religion].filter(Boolean).join(' · ');
  return (
    <div className="group flex flex-col justify-between overflow-hidden rounded-2xl border border-[#E8DCCF] bg-white shadow-xs transition-all hover:shadow-md">
      <div>
        <div className="relative aspect-[4/3] w-full overflow-hidden bg-[#F3EDE6]">
          {profile.primaryPhotoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={profile.primaryPhotoUrl}
              alt={profile.fullName}
              className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-[#A88C78]">
              <UserIcon className="h-10 w-10" />
            </div>
          )}
        </div>

        <div className="p-3.5">
          <Link href={`/browse/${profile.profileId}`} className="flex items-center gap-1.5">
            <h3 className="flex min-w-0 text-sm font-bold text-[#2B1515] transition-colors hover:text-[#7B1118] sm:text-base">
              <span className="truncate">{profile.fullName}</span>
              <span className="shrink-0">, {profile.age}</span>
            </h3>
            {profile.isVerified && <VerifiedBadge className="h-4 w-4 shrink-0" />}
          </Link>

          {profile.relationshipStatus === 'CONNECTED' && <ConnectedBadge className="mt-1" />}

          {profile.profession && (
            <p className="mt-1 flex items-center gap-1.5 text-xs font-medium text-[#4A3B33]">
              <Briefcase className="h-3.5 w-3.5 shrink-0 text-[#8A7A70]" />
              <span className="truncate">{profile.profession}</span>
            </p>
          )}

          {place && (
            <p className="mt-1 flex items-center gap-1.5 text-xs text-[#8A7A70]">
              <MapPin className="h-3.5 w-3.5 shrink-0" />
              <span className="truncate">{place}</span>
            </p>
          )}
        </div>
      </div>

      {/* Interest action: Send / Sent / Respond / Message */}
      <div className="p-3 pt-0">
        <RelationshipAction
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
  columns = 4,
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
  columns?: 4 | 5;
  children?: ReactNode;
  testId?: string;
}) {
  const grid = columns === 5 ? 'xl:grid-cols-5' : 'xl:grid-cols-4';
  return (
    <section className="space-y-4" data-testid={testId}>
      <div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-end">
        <div>
          <h2 className="font-[family-name:var(--font-heading,serif)] text-xl font-bold text-[#2B1515] sm:text-2xl">
            {title}
          </h2>
          <p className="mt-0.5 text-xs text-[#73645C] sm:text-sm">{subtitle}</p>
        </div>
        {viewAllHref && (
          <Link
            href={viewAllHref}
            className="inline-flex items-center gap-1 text-xs font-bold text-[#7B1118] hover:underline sm:text-sm"
          >
            <span>{viewAllLabel}</span>
            <span aria-hidden="true">→</span>
          </Link>
        )}
      </div>

      {children}

      {error ? (
        <p role="alert" className="py-6 text-center text-sm font-medium text-[#7B1118]">
          {error}
        </p>
      ) : profiles === null ? (
        <div className={`grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 ${grid}`} aria-hidden="true">
          {Array.from({ length: columns }).map((_, index) => (
            <div key={index} className="h-72 rounded-2xl border border-[#F0E6D8] bg-[#FAF6EF]" />
          ))}
        </div>
      ) : profiles.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-[#E8DCCF] py-6 text-center text-sm text-[#73645C]">
          {emptyMessage}
        </p>
      ) : (
        <div className={`grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 ${grid}`}>
          {profiles.map((profile) => (
            <HomeProfileCard key={profile.profileId} profile={profile} />
          ))}
        </div>
      )}
    </section>
  );
}
