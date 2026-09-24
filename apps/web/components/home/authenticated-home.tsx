'use client';

import { useEffect, useState, type FormEvent, type SVGProps } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import type {
  ListInterestsResponse,
  ListNotificationsResponse,
  MatchResult,
  SearchProfileResult,
} from '@nadar-kalyanam/schemas';
import { AppHeader } from '../app-header';
import { ResultCard } from '../discovery/result-card';
import { listInterests, listMatches, listNotifications, searchProfiles } from '../../lib/api-client';
import { useProfile } from '../../lib/use-profile';
import { useRegistration } from '../../app/providers/registration-provider';

function SearchIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" {...props}>
      <circle cx="11" cy="11" r="6.5" />
      <path d="m20 20-4.3-4.3" />
    </svg>
  );
}

function UserIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" {...props}>
      <circle cx="12" cy="8" r="3.5" />
      <path d="M4.5 20c1.4-3.4 4.3-5.2 7.5-5.2s6.1 1.8 7.5 5.2" />
    </svg>
  );
}

// A lighter, non-interactive card for the "Discover more" strips —
// deliberately not a second ResultCard: repeating the same bordered/
// Send-Interest card for every section is exactly the "identical card
// styling everywhere" look this page moved away from.
function MiniProfileChip({ profile }: { profile: SearchProfileResult }) {
  return (
    <Link
      href={`/browse/${profile.profileId}`}
      className="flex w-28 shrink-0 flex-col items-center gap-2 text-center sm:w-32"
    >
      <div className="h-20 w-20 overflow-hidden rounded-full bg-muted text-muted-foreground sm:h-24 sm:w-24">
        {profile.primaryPhotoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={profile.primaryPhotoUrl} alt="" className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full w-full items-center justify-center">
            <UserIcon className="h-8 w-8" />
          </div>
        )}
      </div>
      <p className="truncate text-xs font-semibold text-foreground">
        {profile.fullName}, {profile.age}
      </p>
      {profile.isVerified && <p className="text-[10px] font-semibold text-accent">Verified</p>}
    </Link>
  );
}

function DiscoverRow({ title, profiles }: { title: string; profiles: SearchProfileResult[] }) {
  if (profiles.length === 0) return null;
  return (
    <div className="flex flex-col gap-3">
      <h3 className="text-sm font-bold text-foreground">{title}</h3>
      <div className="flex gap-4 overflow-x-auto pb-1">
        {profiles.map((profile) => (
          <MiniProfileChip key={profile.profileId} profile={profile} />
        ))}
      </div>
    </div>
  );
}

// What "/" renders for an already-logged-in visitor. Hierarchy: find
// someone → recommended profiles → discover more → your activity →
// complete your profile. Sections are separated by plain rules, not each
// wrapped in its own bordered/shadowed card.
export function AuthenticatedHome() {
  const router = useRouter();
  const { data } = useRegistration();
  const { profile, loading: profileLoading } = useProfile();
  const [interests, setInterests] = useState<ListInterestsResponse | null>(null);
  const [notifications, setNotifications] = useState<ListNotificationsResponse | null>(null);
  const [matches, setMatches] = useState<MatchResult[] | null>(null);
  const [discoverPool, setDiscoverPool] = useState<SearchProfileResult[] | null>(null);

  const [lookingForGender, setLookingForGender] = useState<'MALE' | 'FEMALE' | ''>('');
  const [ageRange, setAgeRange] = useState('21-28');
  const [cityFilter, setCityFilter] = useState('');

  useEffect(() => {
    if (!data.accessToken || !profile) return;
    let cancelled = false;
    Promise.all([
      listInterests(data.accessToken),
      listNotifications(data.accessToken),
      listMatches(data.accessToken, 8),
      searchProfiles(data.accessToken, { sort: 'newest', limit: 12 }),
    ])
      .then(([interestsResult, notificationsResult, matchesResult, discoverResult]) => {
        if (cancelled) return;
        setInterests(interestsResult);
        setNotifications(notificationsResult);
        setMatches(matchesResult.items);
        setDiscoverPool(discoverResult.items);
      })
      .catch(() => {
        // Best-effort overview widgets — one failing just leaves that
        // section empty rather than blocking the page.
      });
    return () => {
      cancelled = true;
    };
  }, [data.accessToken, profile]);

  function handleQuickSearch(e: FormEvent) {
    e.preventDefault();
    const [ageMin, ageMax] = ageRange.split('-');
    const params = new URLSearchParams();
    if (ageMin) params.set('ageMin', ageMin);
    if (ageMax) params.set('ageMax', ageMax);
    if (cityFilter.trim()) params.set('city', cityFilter.trim());
    if (lookingForGender) params.set('gender', lookingForGender);
    router.push(`/search?${params.toString()}`);
  }

  const firstName = profile?.fullName?.split(' ')[0];
  const pendingInterests = interests?.received.filter((i) => i.status === 'PENDING').length ?? 0;
  const unreadNotifications = notifications?.items.filter((n) => !n.read).length ?? 0;
  const hasActivity = pendingInterests > 0 || unreadNotifications > 0;

  const verifiedProfiles = discoverPool?.filter((p) => p.isVerified) ?? [];
  const ownCity = profile?.details?.location?.city;
  const nearbyProfiles = ownCity
    ? (discoverPool?.filter((p) => p.city === ownCity) ?? [])
    : [];
  const hasDiscoverContent = (discoverPool?.length ?? 0) > 0 || verifiedProfiles.length > 0 || nearbyProfiles.length > 0;

  return (
    <>
      <AppHeader />
      <main className="min-h-screen bg-background px-4 py-10 text-foreground sm:px-6 lg:px-8">
        <div className="mx-auto flex w-full max-w-5xl flex-col gap-10">
          {/* 1. Welcome + search panel */}
          <section className="flex flex-col items-center gap-6 text-center">
            <div>
              <h1 className="text-2xl font-bold text-primary sm:text-3xl">
                {firstName ? `Welcome back, ${firstName}` : 'Welcome back'}
              </h1>
              <p className="mt-1 text-sm text-muted-foreground">Find someone who shares your values.</p>
            </div>

            {!profileLoading && !profile && (
              <div className="flex flex-col items-center gap-3 border-t border-border pt-6">
                <p className="text-sm text-muted-foreground">
                  Complete your profile to start browsing matches and sending interests.
                </p>
                <Link
                  href="/onboarding/basic-details"
                  className="rounded-md bg-primary px-5 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90"
                >
                  Complete profile
                </Link>
              </div>
            )}

            {profile && (
              <form
                onSubmit={handleQuickSearch}
                className="flex w-full max-w-2xl flex-col gap-3 border-t border-border pt-5 sm:flex-row sm:items-end"
              >
                <div className="flex-1 text-left">
                  <label className="text-xs font-semibold text-muted-foreground">Looking for</label>
                  <select
                    value={lookingForGender}
                    onChange={(e) => setLookingForGender(e.target.value as 'MALE' | 'FEMALE' | '')}
                    className="mt-1 w-full rounded-md border border-input bg-card px-3 py-2 text-sm text-foreground focus:border-primary focus:outline-none"
                  >
                    <option value="">Anyone</option>
                    <option value="FEMALE">Bride</option>
                    <option value="MALE">Groom</option>
                  </select>
                </div>
                <div className="flex-1 text-left">
                  <label className="text-xs font-semibold text-muted-foreground">Age</label>
                  <select
                    value={ageRange}
                    onChange={(e) => setAgeRange(e.target.value)}
                    className="mt-1 w-full rounded-md border border-input bg-card px-3 py-2 text-sm text-foreground focus:border-primary focus:outline-none"
                  >
                    <option value="20-25">20 – 25</option>
                    <option value="21-28">21 – 28</option>
                    <option value="25-32">25 – 32</option>
                    <option value="28-36">28 – 36</option>
                    <option value="35-45">35 – 45</option>
                  </select>
                </div>
                <div className="flex-1 text-left">
                  <label className="text-xs font-semibold text-muted-foreground">Location</label>
                  <input
                    type="text"
                    placeholder="e.g. Chennai"
                    value={cityFilter}
                    onChange={(e) => setCityFilter(e.target.value)}
                    className="mt-1 w-full rounded-md border border-input bg-card px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none"
                  />
                </div>
                <button
                  type="submit"
                  className="inline-flex items-center justify-center gap-1.5 rounded-md bg-primary px-5 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90"
                >
                  <SearchIcon className="h-4 w-4" />
                  Find Matches
                </button>
              </form>
            )}
          </section>

          {profile && (
            <>
              {/* 2. Recommended matches */}
              <section className="flex flex-col gap-4 border-t border-border pt-8">
                <div className="flex items-center justify-between">
                  <h2 className="text-lg font-bold text-primary">Recommended Matches</h2>
                  <Link href="/matches" className="text-sm font-semibold text-accent hover:underline">
                    View all →
                  </Link>
                </div>

                {matches && matches.length > 0 ? (
                  <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
                    {matches.slice(0, 4).map((match) => (
                      <ResultCard
                        key={match.profileId}
                        profileId={match.profileId}
                        fullName={match.fullName}
                        age={match.age}
                        city={match.city}
                        primaryPhotoUrl={match.primaryPhotoUrl}
                        badgeLabel={`${Math.round(match.score)}% match`}
                        badgeVariant="accent"
                      />
                    ))}
                  </div>
                ) : (
                  matches && (
                    <div className="flex flex-col items-center gap-3 py-8 text-center">
                      <p className="text-sm font-semibold text-foreground">No new recommendations yet</p>
                      <p className="text-xs text-muted-foreground">
                        Try adjusting your preferences to discover more compatible profiles.
                      </p>
                      <Link
                        href="/matches"
                        className="mt-1 rounded-md bg-primary px-4 py-1.5 text-xs font-semibold text-primary-foreground hover:opacity-90"
                      >
                        Explore Matches
                      </Link>
                    </div>
                  )
                )}
              </section>

              {/* 3. Discover more profiles */}
              {hasDiscoverContent && (
                <section className="flex flex-col gap-6 border-t border-border pt-8">
                  <h2 className="text-lg font-bold text-primary">Discover more profiles</h2>
                  <DiscoverRow title="New to Nadar Kalyanam" profiles={(discoverPool ?? []).slice(0, 6)} />
                  <DiscoverRow title="Verified members" profiles={verifiedProfiles.slice(0, 6)} />
                  {nearbyProfiles.length > 0 && (
                    <DiscoverRow title={`Near you${ownCity ? ` · ${ownCity}` : ''}`} profiles={nearbyProfiles.slice(0, 6)} />
                  )}
                </section>
              )}

              {/* 4. Your activity — only when there's something to show */}
              {hasActivity && (
                <section className="flex flex-col gap-2 border-t border-border pt-8">
                  <h2 className="text-lg font-bold text-primary">Your activity</h2>
                  <ul className="flex flex-col gap-1.5 text-sm">
                    {pendingInterests > 0 && (
                      <li>
                        <Link href="/interests" className="text-foreground hover:text-primary">
                          {pendingInterests} {pendingInterests === 1 ? 'person' : 'people'} showed interest in you
                        </Link>
                      </li>
                    )}
                    {unreadNotifications > 0 && (
                      <li>
                        <Link href="/notifications" className="text-foreground hover:text-primary">
                          {unreadNotifications} new {unreadNotifications === 1 ? 'update' : 'updates'}
                        </Link>
                      </li>
                    )}
                  </ul>
                </section>
              )}

              {/* 5. Complete your profile */}
              {profile.completionScore < 100 && (
                <Link
                  href="/profile"
                  className="flex items-center justify-between border-t border-border py-5 text-sm font-semibold text-primary hover:opacity-80"
                >
                  <span>Complete your profile ({profile.completionScore}%)</span>
                  <span>→</span>
                </Link>
              )}
            </>
          )}
        </div>
      </main>
    </>
  );
}
