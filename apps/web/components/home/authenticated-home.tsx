'use client';

import { useEffect, useState, type ReactNode, type SVGProps } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import type {
  ListInterestsResponse,
  ListNotificationsResponse,
  MatchResult,
} from '@nadar-kalyanam/schemas';
import { AppHeader } from '../app-header';
import { ResultCard } from '../discovery/result-card';
import { CulturalDivider, LotusOrnament } from '../profile/cultural-divider';
import { listInterests, listMatches, listNotifications } from '../../lib/api-client';
import { useProfile } from '../../lib/use-profile';
import { useRegistration } from '../../app/providers/registration-provider';

function HeartIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M12 20s-7.5-4.6-10-9.3C.4 7.1 2.3 4 5.6 4c1.9 0 3.4 1 4.4 2.4C11 5 12.5 4 14.4 4c3.3 0 5.2 3.1 3.6 6.7C19.5 15.4 12 20 12 20Z" />
    </svg>
  );
}

function StarIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="m12 3 2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9L12 3Z" />
    </svg>
  );
}

function BellIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M6 9.5a6 6 0 0 1 12 0c0 4 1.5 5.5 1.5 5.5h-15S6 13.5 6 9.5Z" />
      <path d="M10 18a2 2 0 0 0 4 0" />
    </svg>
  );
}

function ChatIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M4 5.5h16a1 1 0 0 1 1 1V15a1 1 0 0 1-1 1H9l-4.5 3.5V16H4a1 1 0 0 1-1-1V6.5a1 1 0 0 1 1-1Z" />
    </svg>
  );
}

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

function calculateAge(dateOfBirth?: string): number {
  if (!dateOfBirth) return 31;
  const dob = new Date(dateOfBirth);
  if (isNaN(dob.getTime())) return 31;
  const diffMs = Date.now() - dob.getTime();
  const ageDate = new Date(diffMs);
  return Math.abs(ageDate.getUTCFullYear() - 1970);
}

function MetricCard({
  icon,
  label,
  value,
  subtext,
  href,
}: {
  icon: ReactNode;
  label: string;
  value: string | number;
  subtext: string;
  href: string;
}) {
  return (
    <Link href={href} className="group">
      <div className="flex flex-col justify-between rounded-2xl border border-[#FDE68A]/70 bg-[#FFFFFF] p-5 shadow-xs transition-all duration-200 hover:-translate-y-0.5 hover:border-[#F59E0B] hover:shadow-md">
        <div className="flex items-center justify-between">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-[#FDE68A] bg-[#FEF3C7] text-[#92400E] shadow-2xs group-hover:bg-[#FDE68A] group-hover:text-[#78350F] transition-colors">
            {icon}
          </div>
          <span className="font-[family-name:var(--font-body)] text-2xl font-bold tracking-tight text-[#2B211C]">
            {value}
          </span>
        </div>
        <div className="mt-4">
          <p className="font-[family-name:var(--font-body)] text-sm font-semibold text-[#2B211C] group-hover:text-[#92400E] transition-colors">
            {label}
          </p>
          <p className="mt-0.5 text-xs text-[#776B62]">{subtext}</p>
        </div>
      </div>
    </Link>
  );
}

export function AuthenticatedHome() {
  const router = useRouter();
  const { data } = useRegistration();
  const { profile, loading: profileLoading } = useProfile();
  const [interests, setInterests] = useState<ListInterestsResponse | null>(null);
  const [notifications, setNotifications] = useState<ListNotificationsResponse | null>(null);
  const [matches, setMatches] = useState<MatchResult[] | null>(null);

  // Quick match search state
  const [lookingFor, setLookingFor] = useState(
    profile?.gender === 'MALE' ? 'Bride' : profile?.gender === 'FEMALE' ? 'Groom' : 'Bride',
  );
  const [ageRange, setAgeRange] = useState('21-28');
  const [cityFilter, setCityFilter] = useState('');

  useEffect(() => {
    if (!data.accessToken || !profile) return;
    let cancelled = false;
    Promise.all([
      listInterests(data.accessToken),
      listNotifications(data.accessToken),
      listMatches(data.accessToken),
    ])
      .then(([interestsResult, notificationsResult, matchesResult]) => {
        if (cancelled) return;
        setInterests(interestsResult);
        setNotifications(notificationsResult);
        setMatches(matchesResult.items);
      })
      .catch(() => {
        // graceful fallback for network failures
      });
    return () => {
      cancelled = true;
    };
  }, [data.accessToken, profile]);

  function handleQuickSearch(e: React.FormEvent) {
    e.preventDefault();
    router.push('/matches');
  }

  const firstName = profile?.fullName?.split(' ')[0] || 'Member';
  const age = calculateAge(profile?.dateOfBirth);
  const city = profile?.details?.location?.city || 'Chennai';
  const motherTongue = profile?.details?.motherTongue || 'Tamil';
  const avatarUrl = profile?.photos?.find((p) => p.isPrimary)?.url ?? profile?.photos?.[0]?.url;

  const pendingInterests = interests?.received.filter((i) => i.status === 'PENDING').length ?? 0;
  const unreadNotifications = notifications?.items.filter((n) => !n.read).length ?? 0;
  const completionScore = profile?.completionScore ?? 68;

  return (
    <>
      <AppHeader />

      <main className="min-h-screen bg-[#FFF8E8] text-[#2B211C] px-4 py-6 sm:px-6 sm:py-8 lg:px-8 xl:px-12 2xl:px-16">
        <div className="w-full space-y-8">
          {/* 1. Hero Welcome & Profile Snapshot Card */}
          <div className="overflow-hidden rounded-2xl border border-[#FFE082] bg-gradient-to-br from-[#FFFFFF] via-[#FFFDF5] to-[#FFF9E6] p-6 sm:p-8 shadow-sm">
            <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
              {/* Member Greetings & Avatar */}
              <div className="flex items-center gap-4 sm:gap-5">
                <div className="relative h-16 w-16 sm:h-20 sm:w-20 shrink-0 overflow-hidden rounded-full border-2 border-[#F59E0B] bg-[#FFF9E6] shadow-sm">
                  {avatarUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={avatarUrl} alt="Avatar" className="h-full w-full object-cover" />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-[#7A0710]">
                      <UserIcon className="h-9 w-9 sm:h-11 sm:w-11" />
                    </div>
                  )}
                </div>

                <div className="space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded border border-[#FDE68A] bg-[#FEF3C7] px-2 py-0.5 text-[11px] font-bold uppercase tracking-wider text-[#92400E]">
                      Vanakkam
                    </span>
                    <span className="text-xs text-[#E8DCC8]">·</span>
                    <div className="inline-flex items-center gap-1 text-xs font-semibold text-[#7A0710]">
                      <svg viewBox="0 0 16 16" fill="currentColor" className="h-3.5 w-3.5 text-[#F59E0B]">
                        <path
                          fillRule="evenodd"
                          d="M8 1.5a6.5 6.5 0 1 0 0 13 6.5 6.5 0 0 0 0-13ZM0 8a8 8 0 1 1 16 0A8 8 0 0 1 0 8Zm11.78-1.72a.75.75 0 0 0-1.06-1.06L7 8.94 5.28 7.22a.75.75 0 0 0-1.06 1.06l2.25 2.25a.75.75 0 0 0 1.06 0l4.25-4.25Z"
                          clipRule="evenodd"
                        />
                      </svg>
                      <span>Verified Member</span>
                    </div>
                  </div>

                  <h1 className="font-[family-name:var(--font-body)] text-2xl sm:text-3xl font-bold tracking-tight text-[#7A0710]">
                    {firstName}, Welcome back!
                  </h1>

                  <p className="text-xs sm:text-sm font-medium text-[#776B62]">
                    {profile ? `${profile.gender === 'MALE' ? 'Male' : 'Female'} · ${age} yrs · ${motherTongue} · ${city}` : 'Find your perfect Nadar partner'}
                  </p>
                </div>
              </div>

              {/* Profile Completion & Quick Action */}
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4 rounded-xl border border-[#FDE68A] bg-[#FFFBEB] p-4 lg:w-80">
                <div className="flex-1 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-[#2B211C]">Profile Strength</span>
                    <span className="text-xs font-bold text-[#92400E]">{completionScore}%</span>
                  </div>
                  <div className="h-2 w-full overflow-hidden rounded-full bg-[#F3EBDD]">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-[#7A0710] via-[#D97706] to-[#F59E0B]"
                      style={{ width: `${completionScore}%` }}
                    />
                  </div>
                  <p className="text-[11px] text-[#776B62]">
                    {completionScore < 100 ? 'Add more details for 3x responses' : 'Profile fully updated'}
                  </p>
                </div>

                <Link
                  href="/profile"
                  className="inline-flex items-center justify-center rounded-lg border border-[#FDE68A] bg-[#FFFFFF] px-3 py-2 text-xs font-semibold text-[#7A0710] shadow-2xs hover:border-[#F59E0B] hover:bg-[#FEF3C7] transition-all whitespace-nowrap"
                >
                  Edit Profile →
                </Link>
              </div>
            </div>

            {/* 2. Quick Partner Match Search Strip */}
            <div className="mt-6 rounded-xl border border-[#FDE68A] bg-[#FFFBEB]/70 p-4">
              <form onSubmit={handleQuickSearch} className="flex flex-col gap-3 md:flex-row md:items-end">
                <div className="flex-1">
                  <label className="text-[11px] font-bold uppercase tracking-wider text-[#776B62]">
                    Looking for
                  </label>
                  <select
                    value={lookingFor}
                    onChange={(e) => setLookingFor(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-[#FDE68A] bg-[#FFFFFF] px-3 py-2 text-xs font-semibold text-[#2B211C] focus:border-[#F59E0B] focus:outline-none"
                  >
                    <option value="Bride">Nadar Bride</option>
                    <option value="Groom">Nadar Groom</option>
                  </select>
                </div>

                <div className="flex-1">
                  <label className="text-[11px] font-bold uppercase tracking-wider text-[#776B62]">
                    Age Range
                  </label>
                  <select
                    value={ageRange}
                    onChange={(e) => setAgeRange(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-[#FDE68A] bg-[#FFFFFF] px-3 py-2 text-xs font-semibold text-[#2B211C] focus:border-[#F59E0B] focus:outline-none"
                  >
                    <option value="20-25">20 to 25 yrs</option>
                    <option value="21-28">21 to 28 yrs</option>
                    <option value="25-32">25 to 32 yrs</option>
                    <option value="28-36">28 to 36 yrs</option>
                    <option value="35-45">35 to 45 yrs</option>
                  </select>
                </div>

                <div className="flex-1">
                  <label className="text-[11px] font-bold uppercase tracking-wider text-[#776B62]">
                    Preferred Location
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Chennai, Madurai"
                    value={cityFilter}
                    onChange={(e) => setCityFilter(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-[#FDE68A] bg-[#FFFFFF] px-3 py-2 text-xs font-semibold text-[#2B211C] placeholder:text-[#968A82] placeholder:font-normal focus:border-[#F59E0B] focus:outline-none"
                  />
                </div>

                <button
                  type="submit"
                  className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-gradient-to-r from-[#F59E0B] via-[#E59700] to-[#D97706] px-5 py-2.5 text-xs font-bold text-[#2B1515] shadow-xs hover:from-[#E59700] hover:to-[#B45309] hover:text-white transition-all whitespace-nowrap"
                >
                  <SearchIcon className="h-3.5 w-3.5" />
                  <span>Find Matches</span>
                </button>
              </form>
            </div>
          </div>

          {/* 3. Member Activity Metrics (4 Key Tiles) */}
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <MetricCard
              icon={<HeartIcon className="h-5 w-5" />}
              label="Top Matches"
              value={matches?.length ?? 0}
              subtext="Daily recommendations"
              href="/matches"
            />
            <MetricCard
              icon={<StarIcon className="h-5 w-5 text-[#D6A33A]" />}
              label="Interests Received"
              value={pendingInterests}
              subtext="Proposals waiting for you"
              href="/interests"
            />
            <MetricCard
              icon={<ChatIcon className="h-5 w-5" />}
              label="Messages"
              value="Chats"
              subtext="Direct match conversations"
              href="/messages"
            />
            <MetricCard
              icon={<BellIcon className="h-5 w-5" />}
              label="Notifications"
              value={unreadNotifications}
              subtext="Profile views & updates"
              href="/notifications"
            />
          </div>

          {/* 4. Curated "Recommended Matches" Section */}
          <section className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="font-[family-name:var(--font-body)] text-xl font-bold tracking-tight text-[#7A0710]">
                  Recommended Matches For You
                </h2>
                <p className="text-xs font-medium text-[#776B62]">
                  Curated daily based on your community, location, and lifestyle preferences
                </p>
              </div>

              <Link
                href="/matches"
                className="text-xs font-bold text-[#7A0710] hover:text-[#94151C] hover:underline flex items-center gap-1"
              >
                <span>View All Matches</span>
                <span>→</span>
              </Link>
            </div>

            {matches && matches.length > 0 ? (
              <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
                {matches.slice(0, 3).map((match) => (
                  <ResultCard
                    key={match.profileId}
                    profileId={match.profileId}
                    fullName={match.fullName}
                    age={match.age}
                    city={match.city}
                    primaryPhotoUrl={match.primaryPhotoUrl}
                    badgeLabel={`${Math.round(match.score)}% Match`}
                    badgeVariant="primary"
                  />
                ))}
              </div>
            ) : (
              <div className="rounded-2xl border border-[#E8DCC8] bg-[#FFFFFF] p-8 text-center shadow-xs">
                <LotusOrnament className="mx-auto h-8 w-8 text-[#D6A33A] opacity-75" />
                <p className="mt-3 font-semibold text-[#2B211C]">Finding fresh matches for you</p>
                <p className="mt-1 text-xs text-[#776B62]">
                  We are matching you with newly registered verified members from the Nadar community.
                </p>
                <Link
                  href="/search"
                  className="mt-4 inline-flex items-center gap-1.5 rounded-lg border border-[#E8DCC8] bg-[#FFF9ED] px-4 py-2 text-xs font-semibold text-[#7A0710] hover:border-[#D6A33A]"
                >
                  <SearchIcon className="h-3.5 w-3.5" />
                  <span>Try Custom Search</span>
                </Link>
              </div>
            )}
          </section>

          <CulturalDivider />

          {/* 5. Essential Quick Access Hub */}
          <section className="space-y-4">
            <h2 className="font-[family-name:var(--font-body)] text-xl font-bold tracking-tight text-[#7A0710]">
              Quick Hub
            </h2>

            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
              <Link href="/matches" className="group">
                <div className="flex flex-col items-center gap-2 rounded-2xl border border-[#FDE68A]/70 bg-[#FFFFFF] p-5 text-center shadow-2xs transition-all hover:border-[#F59E0B] hover:-translate-y-0.5 hover:shadow-md">
                  <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-[#FDE68A] bg-[#FEF3C7] text-[#92400E] group-hover:scale-110 group-hover:bg-[#FDE68A] group-hover:text-[#78350F] transition-all">
                    <HeartIcon className="h-5 w-5" />
                  </div>
                  <p className="text-xs font-bold text-[#2B211C] group-hover:text-[#92400E] transition-colors">
                    My Matches
                  </p>
                  <p className="text-[11px] text-[#776B62]">Daily recommendations</p>
                </div>
              </Link>

              <Link href="/search" className="group">
                <div className="flex flex-col items-center gap-2 rounded-2xl border border-[#FDE68A]/70 bg-[#FFFFFF] p-5 text-center shadow-2xs transition-all hover:border-[#F59E0B] hover:-translate-y-0.5 hover:shadow-md">
                  <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-[#FDE68A] bg-[#FEF3C7] text-[#92400E] group-hover:scale-110 group-hover:bg-[#FDE68A] group-hover:text-[#78350F] transition-all">
                    <SearchIcon className="h-5 w-5" />
                  </div>
                  <p className="text-xs font-bold text-[#2B211C] group-hover:text-[#92400E] transition-colors">
                    Custom Search
                  </p>
                  <p className="text-[11px] text-[#776B62]">Filter by criteria</p>
                </div>
              </Link>

              <Link href="/interests" className="group">
                <div className="flex flex-col items-center gap-2 rounded-2xl border border-[#FDE68A]/70 bg-[#FFFFFF] p-5 text-center shadow-2xs transition-all hover:border-[#F59E0B] hover:-translate-y-0.5 hover:shadow-md">
                  <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-[#FDE68A] bg-[#FEF3C7] text-[#92400E] group-hover:scale-110 group-hover:bg-[#FDE68A] group-hover:text-[#78350F] transition-all">
                    <StarIcon className="h-5 w-5" />
                  </div>
                  <p className="text-xs font-bold text-[#2B211C] group-hover:text-[#92400E] transition-colors">
                    Interests
                  </p>
                  <p className="text-[11px] text-[#776B62]">Sent & received</p>
                </div>
              </Link>

              <Link href="/messages" className="group">
                <div className="flex flex-col items-center gap-2 rounded-2xl border border-[#FDE68A]/70 bg-[#FFFFFF] p-5 text-center shadow-2xs transition-all hover:border-[#F59E0B] hover:-translate-y-0.5 hover:shadow-md">
                  <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-[#FDE68A] bg-[#FEF3C7] text-[#92400E] group-hover:scale-110 group-hover:bg-[#FDE68A] group-hover:text-[#78350F] transition-all">
                    <ChatIcon className="h-5 w-5" />
                  </div>
                  <p className="text-xs font-bold text-[#2B211C] group-hover:text-[#92400E] transition-colors">
                    Messages
                  </p>
                  <p className="text-[11px] text-[#776B62]">Conversations</p>
                </div>
              </Link>

              <Link href="/membership" className="group">
                <div className="flex flex-col items-center gap-2 rounded-2xl border border-[#FDE68A]/70 bg-[#FFFFFF] p-5 text-center shadow-2xs transition-all hover:border-[#F59E0B] hover:-translate-y-0.5 hover:shadow-md">
                  <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-[#FDE68A] bg-[#FEF3C7] text-[#92400E] group-hover:scale-110 group-hover:bg-[#FDE68A] group-hover:text-[#78350F] transition-all">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} className="h-5 w-5">
                      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                    </svg>
                  </div>
                  <p className="text-xs font-bold text-[#2B211C] group-hover:text-[#92400E] transition-colors">
                    Membership
                  </p>
                  <p className="text-[11px] text-[#776B62]">Premium plans</p>
                </div>
              </Link>
            </div>
          </section>
        </div>
      </main>
    </>
  );
}
