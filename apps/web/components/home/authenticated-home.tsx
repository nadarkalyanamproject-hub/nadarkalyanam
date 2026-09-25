'use client';

import { useEffect, useState, type FormEvent, type ReactNode } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import type {
  ListInterestsResponse,
  ListNotificationsResponse,
  MatchResult,
  SearchProfileResult,
} from '@nadar-kalyanam/schemas';
import {
  Calendar,
  ChevronDown,
  ChevronRight,
  FileText,
  Heart,
  MapPin,
  Search,
  ShieldCheck,
  Star,
  User,
  Users,
} from 'lucide-react';
import { AppHeader, UserIcon } from '../app-header';
import { ApiError, listInterests, listMatches, listNotifications, searchProfiles, sendInterest } from '../../lib/api-client';
import { useProfile } from '../../lib/use-profile';
import { useRegistration } from '../../app/providers/registration-provider';

// One real avatar stack + honest count, reused by all four "More Profiles
// to Explore" tiles — never a hardcoded stock photo or an invented total.
function ExploreTile({
  href,
  icon,
  iconBg,
  iconBorder,
  iconColor,
  title,
  subtitle,
  profiles,
}: {
  href: string;
  icon: ReactNode;
  iconBg: string;
  iconBorder: string;
  iconColor: string;
  title: string;
  subtitle: string;
  profiles: { profileId: string; primaryPhotoUrl: string | null }[];
}) {
  const shown = profiles.slice(0, 3);
  const remaining = profiles.length - shown.length;

  return (
    <Link
      href={href}
      className="bg-white rounded-2xl p-4 border border-[#E8DCCF] shadow-xs hover:shadow-md transition-all flex items-center justify-between group"
    >
      <div className="flex items-center gap-3">
        <div
          className={`h-11 w-11 rounded-xl border flex items-center justify-center shrink-0 ${iconBg} ${iconBorder} ${iconColor}`}
        >
          {icon}
        </div>
        <div>
          <h3 className="font-bold text-xs sm:text-sm text-[#2B1515] group-hover:text-[#7B1118] transition-colors">
            {title}
          </h3>
          <p className="text-[11px] text-[#73645C]">{subtitle}</p>
          {shown.length > 0 && (
            <div className="flex items-center gap-1.5 mt-2">
              <div className="flex -space-x-1.5">
                {shown.map((p) =>
                  p.primaryPhotoUrl ? (
                    <div key={p.profileId} className="h-5 w-5 rounded-full overflow-hidden border border-white">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={p.primaryPhotoUrl} alt="" className="h-full w-full object-cover" />
                    </div>
                  ) : (
                    <div
                      key={p.profileId}
                      className="h-5 w-5 rounded-full border border-white bg-[#F3EDE6] flex items-center justify-center"
                    >
                      <UserIcon className="h-3 w-3 text-[#A88C78]" />
                    </div>
                  ),
                )}
              </div>
              {remaining > 0 && <span className={`text-[11px] font-bold ${iconColor}`}>+{remaining}</span>}
            </div>
          )}
        </div>
      </div>
      <ChevronRight className="h-4 w-4 text-[#8C7B73] group-hover:text-[#7B1118] transition-colors shrink-0" />
    </Link>
  );
}

const POPULAR_TAGS = [
  'Chennai',
  'Coimbatore',
  'Madurai',
  'Bangalore',
  'Trichy',
  'India',
  'Nadar Bride (25–30)',
];

export function AuthenticatedHome() {
  const router = useRouter();
  const { data } = useRegistration();
  const { profile } = useProfile();
  const [interests, setInterests] = useState<ListInterestsResponse | null>(null);
  const [notifications, setNotifications] = useState<ListNotificationsResponse | null>(null);
  const [matches, setMatches] = useState<MatchResult[] | null>(null);
  const [discoverPool, setDiscoverPool] = useState<SearchProfileResult[] | null>(null);

  const [lookingFor, setLookingFor] = useState<'Nadar Bride' | 'Nadar Groom'>('Nadar Bride');
  const [ageRange, setAgeRange] = useState('25 – 32 yrs');
  const [locationCity, setLocationCity] = useState('Chennai');
  const [sentMap, setSentMap] = useState<Record<string, boolean>>({});
  const [sendingId, setSendingId] = useState<string | null>(null);
  const [sendError, setSendError] = useState<string | null>(null);

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
        // Best effort
      });
    return () => {
      cancelled = true;
    };
  }, [data.accessToken, profile]);

  function handleQuickSearch(e?: FormEvent) {
    e?.preventDefault();
    const params = new URLSearchParams();
    if (lookingFor === 'Nadar Bride') params.set('gender', 'FEMALE');
    if (lookingFor === 'Nadar Groom') params.set('gender', 'MALE');

    if (ageRange.includes('25')) {
      params.set('ageMin', '25');
      params.set('ageMax', '32');
    }
    if (locationCity && locationCity !== 'All Locations') {
      params.set('city', locationCity);
    }
    router.push(`/search?${params.toString()}`);
  }

  function handleTagClick(tag: string) {
    if (tag.includes('Bride')) {
      setLookingFor('Nadar Bride');
      router.push('/search?gender=FEMALE&ageMin=25&ageMax=30');
      return;
    }
    setLocationCity(tag);
    router.push(`/search?city=${encodeURIComponent(tag)}`);
  }

  async function handleSendInterest(matchId: string) {
    if (!data.accessToken || sentMap[matchId]) return;
    setSendingId(matchId);
    setSendError(null);
    try {
      await sendInterest(data.accessToken, { targetProfileId: matchId });
      setSentMap((prev) => ({ ...prev, [matchId]: true }));
    } catch (err) {
      setSendError(err instanceof ApiError ? err.message : 'Could not send interest. Please try again.');
    } finally {
      setSendingId(null);
    }
  }

  const firstName = profile?.fullName ? profile.fullName.split(' ')[0] : 'ARJUN';
  const completionScore = profile?.completionScore && profile.completionScore > 0 ? profile.completionScore : 60;

  // Real, derived from the same fetched pool — never hardcoded stock photos
  // or invented counts (see the tiles below).
  const ownCity = profile?.details?.location?.city;
  const newMembers = discoverPool ?? [];
  const verifiedMembers = (discoverPool ?? []).filter((p) => p.isVerified);
  const nearbyMembers = ownCity ? (discoverPool ?? []).filter((p) => p.city === ownCity) : [];

  return (
    <>
      <AppHeader />

      <main className="min-h-screen bg-[#FFFDF9] text-[#2B1515] px-4 py-8 sm:px-6 lg:px-8 xl:px-12 2xl:px-16 space-y-12">
        {/* =========================================================================
            1. HERO SECTION WITH TEMPLE BACKGROUND & FLOATING DUAL CARDS
            ========================================================================= */}
        <section
          className="relative w-full rounded-3xl overflow-hidden shadow-sm border border-[#EADBBD]/70 bg-cover bg-right lg:bg-center"
          style={{
            backgroundImage: `url('/assets/hero_bg.jpg')`,
            minHeight: '440px',
          }}
        >
          {/* Subtle warm wash overlay on left side so typography remains crystal clear */}
          <div className="absolute inset-0 bg-gradient-to-r from-[#FFFDF9]/95 via-[#FFFDF9]/90 to-transparent lg:w-[72%] w-full z-0" />

          <div className="relative z-10 p-6 sm:p-10 lg:p-12 max-w-7xl mx-auto flex flex-col justify-between h-full space-y-8">
            {/* Hero Text */}
            <div className="space-y-2 max-w-2xl">
              <p className="text-xs sm:text-sm font-bold tracking-[0.2em] text-[#9A3412] uppercase">
                WELCOME BACK, {firstName?.toUpperCase()}
              </p>
              <h1 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-[#5A121A] tracking-tight font-[family-name:var(--font-heading,serif)] leading-tight">
                Find someone who <br className="hidden sm:inline" />
                shares your values
              </h1>
              <p className="text-sm sm:text-base text-[#6E5D54] max-w-xl leading-relaxed pt-1">
                Connect with verified Nadar community members for a meaningful and lifelong journey.
              </p>
            </div>

            {/* Dual Cards Row: Search Widget + Profile Completion Card */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-stretch pt-2">
              {/* Quick Search Card (wider left card) */}
              <div className="lg:col-span-8 bg-white/95 backdrop-blur-md rounded-2xl p-5 sm:p-6 shadow-md border border-[#EADFD5]">
                <form
                  onSubmit={handleQuickSearch}
                  className="grid grid-cols-1 sm:grid-cols-4 gap-3 items-end"
                >
                  {/* Looking for */}
                  <div className="space-y-1 text-left">
                    <label className="text-xs font-semibold text-[#73645C]">Looking for</label>
                    <div className="relative flex items-center">
                      <User className="absolute left-3 h-4 w-4 text-[#A88C78] pointer-events-none" />
                      <select
                        value={lookingFor}
                        onChange={(e) =>
                          setLookingFor(e.target.value as 'Nadar Bride' | 'Nadar Groom')
                        }
                        className="w-full pl-9 pr-8 py-2.5 rounded-xl border border-[#DECDBB] bg-[#FFFDF9] text-xs sm:text-sm font-bold text-[#2B1515] appearance-none focus:outline-none focus:ring-1 focus:ring-[#7B1118]"
                      >
                        <option value="Nadar Bride">Nadar Bride</option>
                        <option value="Nadar Groom">Nadar Groom</option>
                      </select>
                      <ChevronDown className="absolute right-2.5 h-4 w-4 text-[#A88C78] pointer-events-none" />
                    </div>
                  </div>

                  {/* Age */}
                  <div className="space-y-1 text-left">
                    <label className="text-xs font-semibold text-[#73645C]">Age</label>
                    <div className="relative flex items-center">
                      <Calendar className="absolute left-3 h-4 w-4 text-[#A88C78] pointer-events-none" />
                      <select
                        value={ageRange}
                        onChange={(e) => setAgeRange(e.target.value)}
                        className="w-full pl-9 pr-8 py-2.5 rounded-xl border border-[#DECDBB] bg-[#FFFDF9] text-xs sm:text-sm font-bold text-[#2B1515] appearance-none focus:outline-none focus:ring-1 focus:ring-[#7B1118]"
                      >
                        <option value="21 – 25 yrs">21 – 25 yrs</option>
                        <option value="25 – 32 yrs">25 – 32 yrs</option>
                        <option value="28 – 35 yrs">28 – 35 yrs</option>
                        <option value="32 – 40 yrs">32 – 40 yrs</option>
                      </select>
                      <ChevronDown className="absolute right-2.5 h-4 w-4 text-[#A88C78] pointer-events-none" />
                    </div>
                  </div>

                  {/* Location */}
                  <div className="space-y-1 text-left">
                    <label className="text-xs font-semibold text-[#73645C]">Location</label>
                    <div className="relative flex items-center">
                      <MapPin className="absolute left-3 h-4 w-4 text-[#A88C78] pointer-events-none" />
                      <select
                        value={locationCity}
                        onChange={(e) => setLocationCity(e.target.value)}
                        className="w-full pl-9 pr-8 py-2.5 rounded-xl border border-[#DECDBB] bg-[#FFFDF9] text-xs sm:text-sm font-bold text-[#2B1515] appearance-none focus:outline-none focus:ring-1 focus:ring-[#7B1118]"
                      >
                        <option value="Chennai">Chennai</option>
                        <option value="Madurai">Madurai</option>
                        <option value="Coimbatore">Coimbatore</option>
                        <option value="Tirunelveli">Tirunelveli</option>
                        <option value="Tuticorin">Tuticorin</option>
                        <option value="Bangalore">Bangalore</option>
                        <option value="All Locations">All Locations</option>
                      </select>
                      <ChevronDown className="absolute right-2.5 h-4 w-4 text-[#A88C78] pointer-events-none" />
                    </div>
                  </div>

                  {/* Search Button */}
                  <div>
                    <button
                      type="submit"
                      className="w-full py-2.5 px-4 rounded-xl font-bold text-sm bg-[#7B1118] hover:bg-[#650B11] text-white shadow-md shadow-[#7B1118]/25 flex items-center justify-center gap-2 cursor-pointer transition-all active:scale-[0.99]"
                    >
                      <Search className="h-4 w-4" />
                      <span>Find Matches</span>
                    </button>
                  </div>
                </form>

                {/* Popular Tags */}
                <div className="flex flex-wrap items-center gap-2 pt-4 mt-2 border-t border-[#F2EAE0]">
                  <span className="text-xs font-bold text-[#8C7B73] mr-1">Popular:</span>
                  {POPULAR_TAGS.map((tag) => (
                    <button
                      key={tag}
                      type="button"
                      onClick={() => handleTagClick(tag)}
                      className="text-xs font-medium text-[#544640] bg-[#FAF5EE] hover:bg-[#F2E5D3] border border-[#EADBCA] px-3 py-1 rounded-full transition-colors cursor-pointer"
                    >
                      {tag}
                    </button>
                  ))}
                </div>
              </div>

              {/* Complete Your Profile Card (Right card) */}
              <div className="lg:col-span-4 bg-[#FFFBF5] rounded-2xl p-5 border border-[#EED7B8] shadow-sm flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2.5">
                      <div className="h-9 w-9 rounded-xl bg-[#FEF3C7] border border-[#FDE68A] flex items-center justify-center text-[#B45309]">
                        <FileText className="h-5 w-5" />
                      </div>
                      <Link
                        href="/profile"
                        className="font-bold text-sm text-[#2B1515] hover:text-[#7B1118] flex items-center gap-1 transition-colors"
                      >
                        Complete your profile <ChevronRight className="h-3.5 w-3.5" />
                      </Link>
                    </div>
                    <span className="text-xs font-extrabold text-[#7B1118]">
                      {completionScore}%
                    </span>
                  </div>

                  {/* Progress bar */}
                  <div className="w-full h-2 rounded-full bg-[#EADBCA] overflow-hidden mb-2.5">
                    <div
                      className="h-full rounded-full bg-[#F59E0B] transition-all duration-500"
                      style={{ width: `${completionScore}%` }}
                    />
                  </div>

                  <p className="text-xs text-[#73645C] leading-snug">
                    Add 3 more details to get better matches and 3x more responses.
                  </p>
                </div>

                <div className="pt-3">
                  <Link
                    href="/profile"
                    className="inline-flex items-center gap-1.5 text-xs font-bold text-[#7B1118] border border-[#E2CAA8] bg-white rounded-xl py-2 px-3 hover:bg-[#FDF6EC] transition-colors shadow-xs"
                  >
                    <span>Complete Profile</span>
                    <span>→</span>
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* =========================================================================
            2. RECOMMENDED MATCHES FOR YOU SECTION (6 CARDS ROW)
            ========================================================================= */}
        <section className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-2">
            <div>
              <h2 className="text-xl sm:text-2xl font-bold text-[#2B1515] font-[family-name:var(--font-heading,serif)]">
                Recommended Matches For You
              </h2>
              <p className="text-xs sm:text-sm text-[#73645C] mt-0.5">
                Curated based on your preferences, location, and lifestyle.
              </p>
            </div>
            <Link
              href="/matches"
              className="text-xs sm:text-sm font-bold text-[#7B1118] hover:underline inline-flex items-center gap-1"
            >
              <span>View All Matches</span>
              <span>→</span>
            </Link>
          </div>

          {sendError && <p className="text-xs font-semibold text-destructive">{sendError}</p>}

          {matches && matches.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
              {matches.map((match) => {
                const isSent = sentMap[match.profileId];
                const isSending = sendingId === match.profileId;

                return (
                  <div
                    key={match.profileId}
                    className="bg-white rounded-2xl border border-[#E8DCCF] shadow-xs hover:shadow-md transition-all overflow-hidden flex flex-col justify-between group"
                  >
                    <div>
                      {/* Photo with Verified Badge */}
                      <div className="relative aspect-[4/3] w-full bg-[#F3EDE6] overflow-hidden">
                        {match.primaryPhotoUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={match.primaryPhotoUrl}
                            alt={match.fullName}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                          />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center text-[#A88C78]">
                            <UserIcon className="h-10 w-10" />
                          </div>
                        )}
                        {match.isVerified && (
                          <div className="absolute top-2 right-2 z-10">
                            <span className="inline-flex items-center gap-1 rounded-full bg-white/95 backdrop-blur-xs px-2 py-0.5 text-[10px] font-bold text-[#16A34A] shadow-xs">
                              <span className="text-[10px]">✓</span> Verified
                            </span>
                          </div>
                        )}
                      </div>

                      {/* Card Content */}
                      <div className="p-3.5 space-y-1.5">
                        <Link href={`/browse/${match.profileId}`}>
                          <h3 className="font-bold text-sm sm:text-base text-[#2B1515] hover:text-[#7B1118] transition-colors truncate">
                            {match.fullName}, {match.age}
                          </h3>
                        </Link>

                        {match.city && (
                          <p className="text-xs text-[#73645C] flex items-center gap-1 truncate">
                            <MapPin className="h-3.5 w-3.5 shrink-0 text-[#9A3412]" />
                            <span>{match.city}</span>
                          </p>
                        )}

                        {match.profession && (
                          <p className="text-xs text-[#73645C] flex items-center gap-1 truncate">
                            <span className="text-[#9A3412] text-xs">🎓</span>
                            <span>{match.profession}</span>
                          </p>
                        )}

                        {match.religion && (
                          <p className="text-xs text-[#73645C] flex items-center gap-1 truncate">
                            <span className="text-[#9A3412] text-xs">🌸</span>
                            <span>{match.religion}</span>
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Send Interest CTA */}
                    <div className="p-3 pt-0">
                      <button
                        type="button"
                        disabled={isSent || isSending}
                        onClick={() => void handleSendInterest(match.profileId)}
                        className={`w-full py-2 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                          isSent
                            ? 'bg-[#F0FDF4] text-[#16A34A] border border-[#86EFAC]'
                            : 'bg-white hover:bg-[#FFF8F0] text-[#7B1118] border border-[#E7CDAF]'
                        }`}
                      >
                        <Heart
                          className={`h-3.5 w-3.5 ${
                            isSent ? 'fill-[#16A34A] text-[#16A34A]' : 'text-[#7B1118]'
                          }`}
                        />
                        <span>{isSent ? 'Interest Sent' : isSending ? 'Sending…' : 'Send Interest'}</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            matches && (
              // Compact — no giant empty rectangle.
              <div className="flex flex-col items-center gap-2 py-8 text-center">
                <p className="text-sm font-semibold text-[#2B1515]">No new recommendations yet</p>
                <p className="text-xs text-[#73645C] max-w-sm">
                  Try adjusting your preferences to discover more compatible profiles.
                </p>
                <Link
                  href="/matches"
                  className="mt-2 rounded-lg bg-[#7B1118] px-4 py-1.5 text-xs font-bold text-white hover:bg-[#650B11] transition-colors"
                >
                  Explore Matches
                </Link>
              </div>
            )
          )}
        </section>

        {/* =========================================================================
            3. MORE PROFILES TO EXPLORE (4 TILES)
            ========================================================================= */}
        <section className="space-y-4">
          <div>
            <h2 className="text-xl sm:text-2xl font-bold text-[#2B1515] font-[family-name:var(--font-heading,serif)]">
              More Profiles to Explore
            </h2>
            <p className="text-xs sm:text-sm text-[#73645C] mt-0.5">
              Discover new members, verified profiles, and people near you.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <ExploreTile
              href="/search?sort=newest"
              icon={<Users className="h-5 w-5" />}
              iconBg="bg-[#FEE2E2]"
              iconBorder="border-[#FECDD3]"
              iconColor="text-[#DC2626]"
              title="Recently Joined"
              subtitle="New members in the Nadar community"
              profiles={newMembers}
            />
            <ExploreTile
              href="/search?verified=true"
              icon={<ShieldCheck className="h-5 w-5" />}
              iconBg="bg-[#FEF3C7]"
              iconBorder="border-[#FDE68A]"
              iconColor="text-[#D97706]"
              title="Verified Members"
              subtitle="Identity verified profiles"
              profiles={verifiedMembers}
            />
            <ExploreTile
              href={ownCity ? `/search?city=${encodeURIComponent(ownCity)}` : '/search'}
              icon={<MapPin className="h-5 w-5" />}
              iconBg="bg-[#FFE4E6]"
              iconBorder="border-[#FECDD3]"
              iconColor="text-[#E11D48]"
              title="Nearby Matches"
              subtitle={ownCity ? `Members from ${ownCity} and nearby` : 'Members near you'}
              profiles={nearbyMembers}
            />
            <ExploreTile
              href="/matches"
              icon={<Star className="h-5 w-5" />}
              iconBg="bg-[#FEF9C3]"
              iconBorder="border-[#FEF08A]"
              iconColor="text-[#CA8A04]"
              title="Most Compatible"
              subtitle="Based on your preferences"
              profiles={matches ?? []}
            />
          </div>
        </section>
      </main>
    </>
  );
}
