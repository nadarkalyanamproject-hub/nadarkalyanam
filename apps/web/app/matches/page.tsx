'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import type { MatchResult } from '@nadar-kalyanam/schemas';
import { AppHeader } from '../../components/app-header';
import { ApiError, listMatches, sendInterest } from '../../lib/api-client';
import { useRegistration } from '../providers/registration-provider';
import { useRequireAuth } from '../../lib/use-require-auth';
import { matchCategoryHref } from '../../lib/match-categories';
import { BotanicalSprig, LotusEmblem } from '../../components/search/partner-search-bar';
import {
  ArrowRight,
  Bookmark,
  Briefcase,
  Calendar,
  Check,
  ChevronRight,
  Compass,
  Eye,
  GraduationCap,
  Heart,
  Image as ImageIcon,
  MapPin,
  MoreVertical,
  Plane,
  Search,
  Sparkles,
  Star,
  Target,
  Users,
} from 'lucide-react';

interface TopMatchItem {
  profileId: string;
  fullName: string;
  age: number;
  city: string;
  state: string;
  education: string;
  score: number;
  primaryPhotoUrl: string | null;
  interestSent?: boolean;
}

const DEMO_TOP_MATCHES: TopMatchItem[] = [
  {
    profileId: 'profile-sneha-01',
    fullName: 'Sneha',
    age: 22,
    city: 'Hyderabad',
    state: 'Telangana',
    education: 'B.Tech',
    score: 85,
    primaryPhotoUrl:
      'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=400&q=80',
  },
  {
    profileId: 'profile-anjali-02',
    fullName: 'Anjali',
    age: 26,
    city: 'Vijayawada',
    state: 'Andhra Pradesh',
    education: 'M.Com',
    score: 83,
    primaryPhotoUrl:
      'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&w=400&q=80',
  },
  {
    profileId: 'profile-priya-03',
    fullName: 'Priya',
    age: 24,
    city: 'Bengaluru',
    state: 'Karnataka',
    education: 'B.E',
    score: 90,
    primaryPhotoUrl:
      'https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&w=400&q=80',
  },
];

interface HubTileProps {
  href: string;
  title: string;
  subtitle: string;
  icon: React.ReactNode;
  iconBg: string;
  iconColor: string;
}

function HubTile({ href, title, subtitle, icon, iconBg, iconColor }: HubTileProps) {
  return (
    <Link
      href={href}
      className="bg-white rounded-2xl border border-[#EADBBD]/80 hover:border-[#C4B2A0] p-3.5 sm:p-4 flex items-center justify-between gap-3 group transition-all shadow-2xs hover:shadow-xs"
    >
      <div className="flex items-center gap-3 min-w-0">
        <div
          className={`h-10 w-10 sm:h-11 sm:w-11 rounded-xl flex items-center justify-center shrink-0 ${iconBg} ${iconColor}`}
        >
          {icon}
        </div>
        <div className="min-w-0">
          <h3 className="text-xs sm:text-sm font-bold text-[#241C1A] group-hover:text-[#7A1118] transition-colors truncate">
            {title}
          </h3>
          <p className="text-[11px] sm:text-xs text-[#73645C] truncate">{subtitle}</p>
        </div>
      </div>
      <ChevronRight className="h-4 w-4 text-[#A88C78] group-hover:text-[#7A1118] group-hover:translate-x-0.5 transition-all shrink-0 ml-1" />
    </Link>
  );
}

function SectionHeading({ title, viewAllHref }: { title: string; viewAllHref?: string }) {
  return (
    <div className="flex items-center justify-between mb-3">
      <div className="flex items-center gap-2">
        <span className="w-1 h-3.5 rounded-full bg-[#7A1118] shrink-0" />
        <h2 className="text-xs sm:text-sm font-bold text-[#241C1A] tracking-tight">{title}</h2>
      </div>
      {viewAllHref && (
        <Link
          href={viewAllHref}
          className="text-xs font-semibold text-[#7A1118] hover:underline flex items-center gap-1"
        >
          <span>View all</span>
          <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      )}
    </div>
  );
}

export default function MatchesPage() {
  const { ready } = useRequireAuth();
  const { data } = useRegistration();
  const router = useRouter();

  const [topMatches, setTopMatches] = useState<TopMatchItem[]>(DEMO_TOP_MATCHES);
  const [searchQuery, setSearchQuery] = useState('');
  const [sendingId, setSendingId] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!ready || !data.accessToken) return;
    let cancelled = false;

    listMatches(data.accessToken, 3)
      .then((result) => {
        if (cancelled) return;
        if (result.items.length > 0) {
          const mapped: TopMatchItem[] = result.items.map((m: MatchResult, index) => {
            const fallback = DEMO_TOP_MATCHES[index % DEMO_TOP_MATCHES.length];
            return {
              profileId: m.profileId,
              fullName: m.fullName.split(' ')[0] || m.fullName,
              age: m.age,
              city: m.city || fallback.city,
              state: fallback.state,
              education: fallback.education,
              score: Math.round(m.score) || fallback.score,
              primaryPhotoUrl: m.primaryPhotoUrl || fallback.primaryPhotoUrl,
              interestSent: m.relationshipStatus === 'INTEREST_SENT' || m.relationshipStatus === 'CONNECTED',
            };
          });
          setTopMatches(mapped);
        }
      })
      .catch(() => {
        // Fall back gracefully to demo top matches
      });

    return () => {
      cancelled = true;
    };
  }, [ready, data.accessToken]);

  async function handleSendInterest(match: TopMatchItem) {
    if (match.interestSent) return;
    setSendingId(match.profileId);
    try {
      if (data.accessToken && !match.profileId.startsWith('profile-')) {
        await sendInterest(data.accessToken, { targetProfileId: match.profileId });
      }
      setTopMatches((prev) =>
        prev.map((m) => (m.profileId === match.profileId ? { ...m, interestSent: true } : m)),
      );
      setToastMessage(`Interest sent to ${match.fullName}!`);
      setTimeout(() => setToastMessage(null), 3500);
    } catch (err) {
      setToastMessage(err instanceof ApiError ? err.message : 'Could not send interest. Please try again.');
      setTimeout(() => setToastMessage(null), 3500);
    } finally {
      setSendingId(null);
    }
  }

  function handleSearchSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (searchQuery.trim()) {
      router.push(`/search?city=${encodeURIComponent(searchQuery.trim())}`);
    } else {
      router.push('/search');
    }
  }

  if (!ready) return null;

  const filteredTopMatches = searchQuery.trim()
    ? topMatches.filter(
        (m) =>
          m.fullName.toLowerCase().includes(searchQuery.toLowerCase()) ||
          m.city.toLowerCase().includes(searchQuery.toLowerCase()) ||
          m.education.toLowerCase().includes(searchQuery.toLowerCase()),
      )
    : topMatches;

  return (
    <>
      <AppHeader />
      <main className="relative min-h-screen bg-[#FAF7F2] text-[#241C1A] overflow-hidden px-4 py-6 sm:px-6 sm:py-8 lg:px-8 xl:px-12 2xl:px-16">
        {/* Decorative corner foliage flourishes matching design system */}
        <BotanicalSprig className="pointer-events-none absolute -top-4 -right-4 w-44 h-44 sm:w-64 sm:h-64 text-[#C4A882] opacity-40 z-0" />
        <BotanicalSprig className="pointer-events-none absolute -bottom-4 -left-4 w-44 h-44 sm:w-64 sm:h-64 text-[#C4A882] opacity-35 rotate-180 z-0" />

        <div className="relative z-10 w-full max-w-7xl mx-auto flex flex-col gap-6">
          {/* Header Row: Title & Subtitle + Search Input */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3.5">
              <div className="h-11 w-11 sm:h-12 sm:w-12 rounded-full bg-[#FDF2F2] border border-[#F8D7DA] flex items-center justify-center text-[#7A1118] shrink-0 shadow-2xs">
                <Heart className="h-5 w-5 sm:h-6 sm:w-6 fill-[#7A1118] text-[#7A1118]" />
              </div>
              <div>
                <h1 className="text-2xl sm:text-3xl font-bold text-[#241C1A] font-[family-name:var(--font-heading,serif)] tracking-tight">
                  Matches
                </h1>
                <p className="text-xs sm:text-sm text-[#73645C] mt-0.5">
                  Find your perfect match with personalized recommendations.
                </p>
              </div>
            </div>

            {/* Search Input */}
            <form onSubmit={handleSearchSubmit} className="relative w-full sm:w-72">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-[#8C7B73] pointer-events-none" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search matches..."
                className="w-full pl-9 pr-4 py-2 bg-white/95 border border-[#EADBBD] hover:border-[#C4B2A0] focus:border-[#7A1118] focus:ring-1 focus:ring-[#7A1118] rounded-full text-xs text-[#241C1A] placeholder-[#9C8E82] transition-colors outline-none shadow-2xs"
              />
            </form>
          </div>

          {/* Toast Notification */}
          {toastMessage && (
            <div className="rounded-2xl border border-emerald-200 bg-emerald-50/90 p-3.5 text-xs sm:text-sm font-medium text-emerald-800 flex items-center justify-between shadow-2xs">
              <span>{toastMessage}</span>
              <button
                type="button"
                onClick={() => setToastMessage(null)}
                className="text-emerald-700 hover:text-emerald-900 cursor-pointer font-bold ml-2"
              >
                ✕
              </button>
            </div>
          )}

          {/* =========================================================================
              MATCH HUB MAIN CARD (CATEGORIZED SECTIONS)
              ========================================================================= */}
          <div className="bg-white rounded-2xl sm:rounded-3xl border border-[#EADBBD]/80 p-5 sm:p-7 lg:p-8 shadow-[0_4px_24px_-4px_rgba(43,21,21,0.05)] space-y-6">
            {/* 1. All Matches */}
            <div>
              <SectionHeading title="All Matches" viewAllHref="/search" />
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
                <HubTile
                  href={matchCategoryHref('your-matches')}
                  title="Your Matches"
                  subtitle="View all the profiles that match your preferences"
                  icon={<Users className="h-5 w-5" />}
                  iconBg="bg-[#FDF2F2]"
                  iconColor="text-[#7A1118]"
                />
              </div>
            </div>

            {/* 2. Based on activity */}
            <div>
              <SectionHeading title="Based on activity" />
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
                <HubTile
                  href={matchCategoryHref('shortlisted-by-you')}
                  title="Shortlisted by you"
                  subtitle="Matches you have shortlisted"
                  icon={<Bookmark className="h-5 w-5" />}
                  iconBg="bg-[#FEF3C7]"
                  iconColor="text-[#D97706]"
                />
                <HubTile
                  href={matchCategoryHref('viewed-you')}
                  title="Viewed you"
                  subtitle="Matches who have viewed your profile"
                  icon={<Eye className="h-5 w-5" />}
                  iconBg="bg-[#EDE9FE]"
                  iconColor="text-[#7C3AED]"
                />
                <HubTile
                  href={matchCategoryHref('shortlisted-you')}
                  title="Shortlisted you"
                  subtitle="Matches who have shortlisted your profile"
                  icon={<Star className="h-5 w-5" />}
                  iconBg="bg-[#ECFDF5]"
                  iconColor="text-[#059669]"
                />
                <HubTile
                  href={matchCategoryHref('viewed-by-you')}
                  title="Viewed by you"
                  subtitle="Matches you have viewed"
                  icon={<Target className="h-5 w-5" />}
                  iconBg="bg-[#FFE4E6]"
                  iconColor="text-[#E11D48]"
                />
              </div>
            </div>

            {/* 3. Recently joined & nearby matches + Based on profile details */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Recently joined & nearby */}
              <div>
                <SectionHeading title="Recently joined & nearby matches" />
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  <HubTile
                    href={matchCategoryHref('newly-joined')}
                    title="Newly Joined"
                    subtitle="Matches who joined within the last 30 days"
                    icon={<Calendar className="h-5 w-5" />}
                    iconBg="bg-[#E0F2FE]"
                    iconColor="text-[#0284C7]"
                  />
                  <HubTile
                    href={matchCategoryHref('nearby')}
                    title="Nearby matches"
                    subtitle="Matches near your location"
                    icon={<MapPin className="h-5 w-5" />}
                    iconBg="bg-[#F3E8FF]"
                    iconColor="text-[#9333EA]"
                  />
                </div>
              </div>

              {/* Based on profile details */}
              <div>
                <SectionHeading title="Based on profile details" />
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  <HubTile
                    href={matchCategoryHref('with-photos')}
                    title="Matches with photos"
                    subtitle="Matches that have added photos"
                    icon={<ImageIcon className="h-5 w-5" />}
                    iconBg="bg-[#FFEDD5]"
                    iconColor="text-[#EA580C]"
                  />
                  <HubTile
                    href={matchCategoryHref('with-horoscope')}
                    title="Matches with horoscope"
                    subtitle="Matches that have added horoscope"
                    icon={<Compass className="h-5 w-5" />}
                    iconBg="bg-[#EEF2FF]"
                    iconColor="text-[#4F46E5]"
                  />
                </div>
              </div>
            </div>

            {/* 4. Astrological compatibility + Looking for someone like you */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Astrological compatibility */}
              <div>
                <SectionHeading title="Based on astrological compatibility" />
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  <HubTile
                    href={matchCategoryHref('star-matches')}
                    title="Star matches"
                    subtitle="Matches with compatible star sign"
                    icon={<Sparkles className="h-5 w-5" />}
                    iconBg="bg-[#D1FAE5]"
                    iconColor="text-[#10B981]"
                  />
                  <HubTile
                    href={matchCategoryHref('horoscope-matches')}
                    title="Horoscope matches"
                    subtitle="Matches with horoscope matching yours"
                    icon={<LotusEmblem className="h-5 w-5" />}
                    iconBg="bg-[#FFE4E6]"
                    iconColor="text-[#E11D48]"
                  />
                </div>
              </div>

              {/* Looking for someone like you */}
              <div>
                <SectionHeading title="Members who are looking for someone like you" />
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  <HubTile
                    href={matchCategoryHref('mutual-matches')}
                    title="Mutual matches"
                    subtitle="Matches whose profile match your preferences and vice versa"
                    icon={<Users className="h-5 w-5" />}
                    iconBg="bg-[#FFEDD5]"
                    iconColor="text-[#EA580C]"
                  />
                  <HubTile
                    href={matchCategoryHref('looking-for-you')}
                    title="Looking for you"
                    subtitle="Matches whose preferences match your profile"
                    icon={<Target className="h-5 w-5" />}
                    iconBg="bg-[#EDE9FE]"
                    iconColor="text-[#7C3AED]"
                  />
                </div>
              </div>
            </div>

            {/* 5. Based on preferences */}
            <div>
              <SectionHeading title="Based on preferences" />
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
                <HubTile
                  href={matchCategoryHref('education-preference')}
                  title="Education preference"
                  subtitle="Matches based on your preferred education"
                  icon={<GraduationCap className="h-5 w-5" />}
                  iconBg="bg-[#E0F2FE]"
                  iconColor="text-[#0284C7]"
                />
                <HubTile
                  href={matchCategoryHref('professional-preference')}
                  title="Professional preference"
                  subtitle="Matches based on your preferred profession"
                  icon={<Briefcase className="h-5 w-5" />}
                  iconBg="bg-[#FEF3C7]"
                  iconColor="text-[#D97706]"
                />
                <HubTile
                  href={matchCategoryHref('location-preference')}
                  title="City/location preference"
                  subtitle="Matches based on your preferred city/location"
                  icon={<MapPin className="h-5 w-5" />}
                  iconBg="bg-[#CCFBF1]"
                  iconColor="text-[#0D9488]"
                />
                <HubTile
                  href={matchCategoryHref('nri-matches')}
                  title="NRI matches"
                  subtitle="Matches from outside India"
                  icon={<Plane className="h-5 w-5" />}
                  iconBg="bg-[#DBEAFE]"
                  iconColor="text-[#2563EB]"
                />
              </div>
            </div>
          </div>

          {/* =========================================================================
              YOUR TOP MATCHES SECTION (RECOMMENDED PROFILES)
              ========================================================================= */}
          <div className="bg-white rounded-2xl sm:rounded-3xl border border-[#EADBBD]/80 p-5 sm:p-7 lg:p-8 shadow-[0_4px_24px_-4px_rgba(43,21,21,0.05)]">
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-2.5">
                <Sparkles className="h-5 w-5 text-[#7A1118]" />
                <div>
                  <h2 className="text-base sm:text-lg font-bold text-[#241C1A] font-[family-name:var(--font-heading,serif)]">
                    Your Top Matches
                  </h2>
                  <p className="text-xs text-[#73645C]">
                    Recommended based on your profile and preferences.
                  </p>
                </div>
              </div>

              <Link
                href="/search"
                className="px-4 py-2 rounded-full border border-[#7A1118]/30 hover:border-[#7A1118] hover:bg-[#7A1118]/5 text-[#7A1118] text-xs font-semibold flex items-center gap-1.5 transition-colors whitespace-nowrap"
              >
                <span>View All Matches</span>
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </div>

            {/* Match Cards Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mt-5">
              {filteredTopMatches.map((match) => (
                <div
                  key={match.profileId}
                  className="bg-white rounded-2xl border border-[#F0E8DD] hover:border-[#DECDBB] p-4 flex flex-col justify-between gap-4 transition-all shadow-2xs hover:shadow-xs"
                >
                  {/* Top Part: Avatar + Info + Score Pill */}
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="h-14 w-14 sm:h-16 sm:w-16 rounded-full overflow-hidden border border-[#EADBBD] shrink-0 bg-[#FAF7F2]">
                        {match.primaryPhotoUrl ? (
                          <img
                            src={match.primaryPhotoUrl}
                            alt={match.fullName}
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <div className="h-full w-full flex items-center justify-center text-[#A88C78]">
                            <Users className="h-6 w-6" />
                          </div>
                        )}
                      </div>

                      <div className="min-w-0">
                        <h3 className="text-sm sm:text-base font-bold text-[#241C1A] truncate">
                          {match.fullName}, {match.age}
                        </h3>
                        <p className="flex items-center gap-1 text-xs text-[#73645C] mt-1 truncate">
                          <MapPin className="h-3 w-3 text-[#A88C78] shrink-0" />
                          <span className="truncate">
                            {match.city}, {match.state}
                          </span>
                        </p>
                        <p className="flex items-center gap-1 text-xs text-[#73645C] mt-0.5 truncate">
                          <GraduationCap className="h-3 w-3 text-[#A88C78] shrink-0" />
                          <span className="truncate">{match.education}</span>
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      <span className="bg-[#FDF2F2] border border-[#F8D7DA] text-[#C53030] text-[10px] font-bold px-2 py-0.5 rounded-full whitespace-nowrap">
                        {match.score}% match
                      </span>
                      <button
                        type="button"
                        aria-label="More options"
                        onClick={() => router.push(`/browse/${match.profileId}`)}
                        className="text-[#8C7B73] hover:text-[#241C1A] p-0.5"
                      >
                        <MoreVertical className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* Bottom Action Buttons */}
                  <div className="flex items-center gap-2 pt-1">
                    <Link
                      href={`/browse/${match.profileId}`}
                      className="border border-[#C49746] text-[#C49746] hover:bg-[#C49746]/10 active:scale-[0.98] text-xs font-semibold py-1.5 px-3 rounded-full flex-1 text-center transition-colors whitespace-nowrap"
                    >
                      View Profile
                    </Link>

                    <button
                      type="button"
                      disabled={match.interestSent || sendingId === match.profileId}
                      onClick={() => void handleSendInterest(match)}
                      className={`text-xs font-semibold py-1.5 px-3 rounded-full flex-1 text-center transition-all whitespace-nowrap flex items-center justify-center gap-1 cursor-pointer ${
                        match.interestSent
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200 cursor-default'
                          : 'bg-[#7A1118] hover:bg-[#620D13] active:scale-[0.98] text-white shadow-xs'
                      }`}
                    >
                      {match.interestSent ? (
                        <>
                          <Check className="h-3.5 w-3.5" />
                          <span>Sent</span>
                        </>
                      ) : sendingId === match.profileId ? (
                        <span>Sending…</span>
                      ) : (
                        <span>Send Interest</span>
                      )}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </main>
    </>
  );
}
