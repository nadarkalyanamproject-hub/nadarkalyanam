'use client';

import { useEffect, useState, type FormEvent } from 'react';
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
  Sparkles,
  Star,
  User,
  Users,
} from 'lucide-react';
import { AppHeader } from '../app-header';
import { listInterests, listMatches, listNotifications, searchProfiles, sendInterest } from '../../lib/api-client';
import { useProfile } from '../../lib/use-profile';
import { useRegistration } from '../../app/providers/registration-provider';
import { DUMMY_PROFILES } from '../../lib/mock-profiles';

interface RecommendedMatchCard {
  id: string;
  name: string;
  age: number;
  city: string;
  state: string;
  educationAndJob: string;
  community: string;
  photoUrl: string;
  isVerified: boolean;
  hasSentInterest?: boolean;
}

const DEFAULT_RECOMMENDED: RecommendedMatchCard[] = [
  {
    id: 'rec-priya-01',
    name: 'Priya',
    age: 28,
    city: 'Chennai',
    state: 'Tamil Nadu',
    educationAndJob: 'MBA • IT Professional',
    community: 'Nadar • Hindu',
    photoUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=800&q=80',
    isVerified: true,
  },
  {
    id: 'rec-divya-02',
    name: 'Divya',
    age: 27,
    city: 'Coimbatore',
    state: 'Tamil Nadu',
    educationAndJob: 'B.Tech • Software Engineer',
    community: 'Nadar • Hindu',
    photoUrl: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&w=800&q=80',
    isVerified: true,
  },
  {
    id: 'rec-meena-03',
    name: 'Meena',
    age: 29,
    city: 'Bangalore',
    state: 'Karnataka',
    educationAndJob: 'M.Com • Banking',
    community: 'Nadar • Hindu',
    photoUrl: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=800&q=80',
    isVerified: true,
  },
  {
    id: 'rec-kavya-04',
    name: 'Kavya',
    age: 26,
    city: 'Madurai',
    state: 'Tamil Nadu',
    educationAndJob: 'BDS • Dentist',
    community: 'Nadar • Hindu',
    photoUrl: 'https://images.unsplash.com/photo-1524504388940-b1c1722653e1?auto=format&fit=crop&w=800&q=80',
    isVerified: true,
  },
  {
    id: 'rec-anitha-05',
    name: 'Anitha',
    age: 30,
    city: 'Chennai',
    state: 'Tamil Nadu',
    educationAndJob: 'CA • Finance Professional',
    community: 'Nadar • Hindu',
    photoUrl: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&w=800&q=80',
    isVerified: true,
  },
  {
    id: 'rec-swathi-06',
    name: 'Swathi',
    age: 28,
    city: 'Trichy',
    state: 'Tamil Nadu',
    educationAndJob: 'MBA • HR Professional',
    community: 'Nadar • Hindu',
    photoUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=800&q=80',
    isVerified: true,
  },
];

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
    try {
      await sendInterest(data.accessToken, { targetProfileId: matchId });
      setSentMap((prev) => ({ ...prev, [matchId]: true }));
    } catch {
      // For demo cards or fallback
      setSentMap((prev) => ({ ...prev, [matchId]: true }));
    } finally {
      setSendingId(null);
    }
  }

  const firstName = profile?.fullName ? profile.fullName.split(' ')[0] : 'ARJUN';
  const completionScore = profile?.completionScore && profile.completionScore > 0 ? profile.completionScore : 60;

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

          {/* 6 Cards Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            {DEFAULT_RECOMMENDED.map((person) => {
              const isSent = sentMap[person.id];
              const isSending = sendingId === person.id;

              return (
                <div
                  key={person.id}
                  className="bg-white rounded-2xl border border-[#E8DCCF] shadow-xs hover:shadow-md transition-all overflow-hidden flex flex-col justify-between group"
                >
                  <div>
                    {/* Photo with Verified Badge */}
                    <div className="relative aspect-[4/3] w-full bg-[#F3EDE6] overflow-hidden">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={person.photoUrl}
                        alt={person.name}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      />
                      {person.isVerified && (
                        <div className="absolute top-2 right-2 z-10">
                          <span className="inline-flex items-center gap-1 rounded-full bg-white/95 backdrop-blur-xs px-2 py-0.5 text-[10px] font-bold text-[#16A34A] shadow-xs">
                            <span className="text-[10px]">✓</span> Verified
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Card Content */}
                    <div className="p-3.5 space-y-1.5">
                      <Link href={`/browse/${person.id}`}>
                        <h3 className="font-bold text-sm sm:text-base text-[#2B1515] hover:text-[#7B1118] transition-colors truncate">
                          {person.name}, {person.age}
                        </h3>
                      </Link>

                      {/* City */}
                      <p className="text-xs text-[#73645C] flex items-center gap-1 truncate">
                        <MapPin className="h-3.5 w-3.5 shrink-0 text-[#9A3412]" />
                        <span>
                          {person.city}, {person.state}
                        </span>
                      </p>

                      {/* Job / Education */}
                      <p className="text-xs text-[#73645C] flex items-center gap-1 truncate">
                        <span className="text-[#9A3412] text-xs">🎓</span>
                        <span>{person.educationAndJob}</span>
                      </p>

                      {/* Community */}
                      <p className="text-xs text-[#73645C] flex items-center gap-1 truncate">
                        <span className="text-[#9A3412] text-xs">🌸</span>
                        <span>{person.community}</span>
                      </p>
                    </div>
                  </div>

                  {/* Send Interest CTA */}
                  <div className="p-3 pt-0">
                    <button
                      type="button"
                      disabled={isSent || isSending}
                      onClick={() => void handleSendInterest(person.id)}
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
            {/* Tile 1: Recently Joined */}
            <Link
              href="/search?sort=newest"
              className="bg-white rounded-2xl p-4 border border-[#E8DCCF] shadow-xs hover:shadow-md transition-all flex items-center justify-between group"
            >
              <div className="flex items-center gap-3">
                <div className="h-11 w-11 rounded-xl bg-[#FEE2E2] border border-[#FECDD3] flex items-center justify-center text-[#DC2626] shrink-0">
                  <Users className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="font-bold text-xs sm:text-sm text-[#2B1515] group-hover:text-[#7B1118] transition-colors">
                    Recently Joined
                  </h3>
                  <p className="text-[11px] text-[#73645C]">New members in the Nadar community</p>
                  <div className="flex items-center gap-1.5 mt-2">
                    <div className="flex -space-x-1.5">
                      <div className="h-5 w-5 rounded-full overflow-hidden border border-white">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src="https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=100&q=80"
                          alt=""
                          className="h-full w-full object-cover"
                        />
                      </div>
                      <div className="h-5 w-5 rounded-full overflow-hidden border border-white">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src="https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=100&q=80"
                          alt=""
                          className="h-full w-full object-cover"
                        />
                      </div>
                      <div className="h-5 w-5 rounded-full overflow-hidden border border-white">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src="https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&w=100&q=80"
                          alt=""
                          className="h-full w-full object-cover"
                        />
                      </div>
                    </div>
                    <span className="text-[11px] font-bold text-[#DC2626]">+124</span>
                  </div>
                </div>
              </div>
              <ChevronRight className="h-4 w-4 text-[#8C7B73] group-hover:text-[#7B1118] transition-colors" />
            </Link>

            {/* Tile 2: Verified Members */}
            <Link
              href="/search?verified=true"
              className="bg-white rounded-2xl p-4 border border-[#E8DCCF] shadow-xs hover:shadow-md transition-all flex items-center justify-between group"
            >
              <div className="flex items-center gap-3">
                <div className="h-11 w-11 rounded-xl bg-[#FEF3C7] border border-[#FDE68A] flex items-center justify-center text-[#D97706] shrink-0">
                  <ShieldCheck className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="font-bold text-xs sm:text-sm text-[#2B1515] group-hover:text-[#7B1118] transition-colors">
                    Verified Members
                  </h3>
                  <p className="text-[11px] text-[#73645C]">Identity verified profiles</p>
                  <div className="flex items-center gap-1.5 mt-2">
                    <div className="flex -space-x-1.5">
                      <div className="h-5 w-5 rounded-full overflow-hidden border border-white">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src="https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=100&q=80"
                          alt=""
                          className="h-full w-full object-cover"
                        />
                      </div>
                      <div className="h-5 w-5 rounded-full overflow-hidden border border-white">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src="https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=100&q=80"
                          alt=""
                          className="h-full w-full object-cover"
                        />
                      </div>
                      <div className="h-5 w-5 rounded-full overflow-hidden border border-white">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src="https://images.unsplash.com/photo-1492562080023-ab3db95bfbce?auto=format&fit=crop&w=100&q=80"
                          alt=""
                          className="h-full w-full object-cover"
                        />
                      </div>
                    </div>
                    <span className="text-[11px] font-bold text-[#D97706]">+86</span>
                  </div>
                </div>
              </div>
              <ChevronRight className="h-4 w-4 text-[#8C7B73] group-hover:text-[#7B1118] transition-colors" />
            </Link>

            {/* Tile 3: Nearby Matches */}
            <Link
              href="/search?city=Chennai"
              className="bg-white rounded-2xl p-4 border border-[#E8DCCF] shadow-xs hover:shadow-md transition-all flex items-center justify-between group"
            >
              <div className="flex items-center gap-3">
                <div className="h-11 w-11 rounded-xl bg-[#FFE4E6] border border-[#FECDD3] flex items-center justify-center text-[#E11D48] shrink-0">
                  <MapPin className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="font-bold text-xs sm:text-sm text-[#2B1515] group-hover:text-[#7B1118] transition-colors">
                    Nearby Matches
                  </h3>
                  <p className="text-[11px] text-[#73645C]">Members from Chennai and nearby</p>
                  <div className="flex items-center gap-1.5 mt-2">
                    <div className="flex -space-x-1.5">
                      <div className="h-5 w-5 rounded-full overflow-hidden border border-white">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src="https://images.unsplash.com/photo-1524504388940-b1c1722653e1?auto=format&fit=crop&w=100&q=80"
                          alt=""
                          className="h-full w-full object-cover"
                        />
                      </div>
                      <div className="h-5 w-5 rounded-full overflow-hidden border border-white">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src="https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?auto=format&fit=crop&w=100&q=80"
                          alt=""
                          className="h-full w-full object-cover"
                        />
                      </div>
                      <div className="h-5 w-5 rounded-full overflow-hidden border border-white">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src="https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&w=100&q=80"
                          alt=""
                          className="h-full w-full object-cover"
                        />
                      </div>
                    </div>
                    <span className="text-[11px] font-bold text-[#E11D48]">+72</span>
                  </div>
                </div>
              </div>
              <ChevronRight className="h-4 w-4 text-[#8C7B73] group-hover:text-[#7B1118] transition-colors" />
            </Link>

            {/* Tile 4: Most Compatible */}
            <Link
              href="/matches"
              className="bg-white rounded-2xl p-4 border border-[#E8DCCF] shadow-xs hover:shadow-md transition-all flex items-center justify-between group"
            >
              <div className="flex items-center gap-3">
                <div className="h-11 w-11 rounded-xl bg-[#FEF9C3] border border-[#FEF08A] flex items-center justify-center text-[#CA8A04] shrink-0">
                  <Star className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="font-bold text-xs sm:text-sm text-[#2B1515] group-hover:text-[#7B1118] transition-colors">
                    Most Compatible
                  </h3>
                  <p className="text-[11px] text-[#73645C]">Based on your preferences</p>
                  <div className="flex items-center gap-1.5 mt-2">
                    <div className="flex -space-x-1.5">
                      <div className="h-5 w-5 rounded-full overflow-hidden border border-white">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src="https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?auto=format&fit=crop&w=100&q=80"
                          alt=""
                          className="h-full w-full object-cover"
                        />
                      </div>
                      <div className="h-5 w-5 rounded-full overflow-hidden border border-white">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src="https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=100&q=80"
                          alt=""
                          className="h-full w-full object-cover"
                        />
                      </div>
                      <div className="h-5 w-5 rounded-full overflow-hidden border border-white">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src="https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=100&q=80"
                          alt=""
                          className="h-full w-full object-cover"
                        />
                      </div>
                    </div>
                    <span className="text-[11px] font-bold text-[#CA8A04]">+58</span>
                  </div>
                </div>
              </div>
              <ChevronRight className="h-4 w-4 text-[#8C7B73] group-hover:text-[#7B1118] transition-colors" />
            </Link>
          </div>
        </section>
      </main>
    </>
  );
}
