'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import type { MatchResult } from '@nadar-kalyanam/schemas';
import { AppHeader } from '../../components/app-header';
import { ApiError, listMatches, sendInterest } from '../../lib/api-client';
import { mustHaveNotice } from '../../lib/partner-preferences';
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
import { PlanGate } from '../../components/plan/plan-gate';

// Only real GET /matches fields. /matches carries no state or education, so
// the card shows city and profession when present and omits a line otherwise.
interface TopMatchItem {
  profileId: string;
  fullName: string;
  age: number;
  city: string | null;
  profession: string | null;
  score: number;
  primaryPhotoUrl: string | null;
  interestSent?: boolean;
}

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
      className="bg-white rounded-2xl border border-nk-line-gold/80 hover:border-[#C4B2A0] p-3.5 sm:p-4 flex items-center justify-between gap-3 group transition-all shadow-2xs hover:shadow-xs"
    >
      <div className="flex items-center gap-3 min-w-0">
        <div
          className={`h-10 w-10 sm:h-11 sm:w-11 rounded-xl flex items-center justify-center shrink-0 ${iconBg} ${iconColor}`}
        >
          {icon}
        </div>
        <div className="min-w-0">
          <h3 className="text-xs sm:text-sm font-bold text-nk-ink group-hover:text-nk-maroon transition-colors truncate">
            {title}
          </h3>
          <p className="text-[11px] sm:text-xs text-nk-muted truncate">{subtitle}</p>
        </div>
      </div>
      <ChevronRight className="h-4 w-4 text-[#A88C78] group-hover:text-nk-maroon group-hover:translate-x-0.5 transition-all shrink-0 ml-1" />
    </Link>
  );
}

function SectionHeading({ title, viewAllHref }: { title: string; viewAllHref?: string }) {
  return (
    <div className="flex items-center justify-between mb-3">
      <div className="flex items-center gap-2">
        <span className="w-1 h-3.5 rounded-sm bg-nk-maroon shrink-0" />
        <h2 className="text-xs sm:text-sm font-bold text-nk-ink tracking-tight">{title}</h2>
      </div>
      {viewAllHref && (
        <Link
          href={viewAllHref}
          className="text-xs font-semibold text-nk-maroon hover:underline flex items-center gap-1"
        >
          <span>View all</span>
          <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      )}
    </div>
  );
}

function MatchesPageContent() {
  const { ready } = useRequireAuth();
  const { data } = useRegistration();
  const router = useRouter();

  // null while loading. Only real matches ever go in here.
  const [topMatches, setTopMatches] = useState<TopMatchItem[] | null>(null);
  const [topMatchesError, setTopMatchesError] = useState<string | null>(null);
  const [mustHaveNote, setMustHaveNote] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [sendingId, setSendingId] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [toastUpgrade, setToastUpgrade] = useState(false);

  useEffect(() => {
    if (!ready || !data.accessToken) return;
    let cancelled = false;

    listMatches(data.accessToken, 3)
      .then((result) => {
        if (cancelled) return;
        setMustHaveNote(mustHaveNotice(result.preferences, result.items.length));
        setTopMatches(
          result.items.map((m: MatchResult) => ({
            profileId: m.profileId,
            fullName: m.fullName.split(' ')[0] || m.fullName,
            age: m.age,
            city: m.city,
            profession: m.profession,
            // Never more than 100% (preference fit and listing bonus can push the raw score past it).
            score: Math.min(100, Math.round(m.score)),
            primaryPhotoUrl: m.primaryPhotoUrl,
            interestSent: m.relationshipStatus === 'INTEREST_SENT' || m.relationshipStatus === 'CONNECTED',
          })),
        );
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setTopMatchesError(err instanceof ApiError ? err.message : 'Could not load your top matches. Please try again.');
      });

    return () => {
      cancelled = true;
    };
  }, [ready, data.accessToken]);

  async function handleSendInterest(match: TopMatchItem) {
    if (match.interestSent) return;
    setSendingId(match.profileId);
    try {
      if (!data.accessToken) return;
      await sendInterest(data.accessToken, { targetProfileId: match.profileId });
      setToastUpgrade(false);
      setTopMatches((prev) =>
        (prev ?? []).map((m) => (m.profileId === match.profileId ? { ...m, interestSent: true } : m)),
      );
      setToastMessage(`Interest sent to ${match.fullName}!`);
      setTimeout(() => setToastMessage(null), 3500);
    } catch (err) {
      // The free monthly limit gets a link to the plans and stays up longer.
      const limit = err instanceof ApiError && err.code === 'PLAN_LIMIT_REACHED';
      setToastUpgrade(limit);
      setToastMessage(err instanceof ApiError ? err.message : 'Could not send interest. Please try again.');
      setTimeout(() => setToastMessage(null), limit ? 8000 : 3500);
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

  const query = searchQuery.trim().toLowerCase();
  const filteredTopMatches = (topMatches ?? []).filter(
    (m) =>
      !query ||
      [m.fullName, m.city, m.profession].some((field) => field?.toLowerCase().includes(query)),
  );

  return (
    <>
      <AppHeader />
      <main className="relative min-h-screen bg-nk-paper text-nk-ink overflow-hidden px-4 py-6 sm:px-6 sm:py-8 lg:px-8 xl:px-12 2xl:px-16">
        {/* Decorative corner foliage flourishes matching design system */}
        <BotanicalSprig className="pointer-events-none absolute -top-4 -right-4 w-44 h-44 sm:w-64 sm:h-64 text-[#C4A882] opacity-40 z-0" />
        <BotanicalSprig className="pointer-events-none absolute -bottom-4 -left-4 w-44 h-44 sm:w-64 sm:h-64 text-[#C4A882] opacity-35 rotate-180 z-0" />

        <div className="relative z-10 w-full max-w-7xl mx-auto flex flex-col gap-6">
          {/* Header Row: Title & Subtitle + Search Input */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3.5">
              <div className="h-11 w-11 sm:h-12 sm:w-12 rounded-full bg-[#FDF2F2] border border-[#F8D7DA] flex items-center justify-center text-nk-maroon shrink-0 shadow-2xs">
                <Heart className="h-5 w-5 sm:h-6 sm:w-6 fill-nk-maroon text-nk-maroon" />
              </div>
              <div>
                <h1 className="text-2xl sm:text-3xl font-bold text-nk-ink font-[family-name:var(--font-heading,serif)] tracking-tight">
                  Matches
                </h1>
                <p className="text-xs sm:text-sm text-nk-muted mt-0.5">
                  Find your perfect match with personalized recommendations.
                </p>
              </div>
            </div>

            {/* Search Input */}
            <form onSubmit={handleSearchSubmit} className="relative w-full sm:w-72">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-nk-subtle pointer-events-none" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search matches..."
                className="w-full pl-9 pr-4 py-2 bg-white/95 border border-nk-line-gold hover:border-[#C4B2A0] focus:border-nk-maroon focus:ring-1 focus:ring-nk-maroon rounded-md text-xs text-nk-ink placeholder-[#9C8E82] transition-colors outline-none shadow-2xs"
              />
            </form>
          </div>

          {/* Toast Notification */}
          {toastMessage && (
            <div className="rounded-2xl border border-emerald-200 bg-emerald-50/90 p-3.5 text-xs sm:text-sm font-medium text-emerald-800 flex items-center justify-between shadow-2xs">
              <span>
                {toastMessage}
                {toastUpgrade && (
                  <>
                    {' '}
                    <Link href="/membership" className="font-semibold underline">
                      Upgrade
                    </Link>
                  </>
                )}
              </span>
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
          <div className="bg-white rounded-2xl sm:rounded-3xl border border-nk-line-gold/80 p-5 sm:p-7 lg:p-8 shadow-[0_4px_24px_-4px_rgba(43,21,21,0.05)] space-y-6">
            {/* 1. All Matches */}
            <div>
              <SectionHeading title="All Matches" />
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
                <HubTile
                  href={matchCategoryHref('your-matches')}
                  title="Your Matches"
                  subtitle="View all the profiles that match your preferences"
                  icon={<Users className="h-5 w-5" />}
                  iconBg="bg-[#FDF2F2]"
                  iconColor="text-nk-maroon"
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
          <div className="bg-white rounded-2xl sm:rounded-3xl border border-nk-line-gold/80 p-5 sm:p-7 lg:p-8 shadow-[0_4px_24px_-4px_rgba(43,21,21,0.05)]">
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-2.5">
                <Sparkles className="h-5 w-5 text-nk-maroon" />
                <div>
                  <h2 className="text-base sm:text-lg font-bold text-nk-ink font-[family-name:var(--font-heading,serif)]">
                    Your Top Matches
                  </h2>
                  <p className="text-xs text-nk-muted">
                    Recommended based on your profile and preferences.
                  </p>
                </div>
              </div>

              <Link
                href={matchCategoryHref('your-matches')}
                className="px-4 py-2 rounded-md border border-nk-maroon/30 hover:border-nk-maroon hover:bg-nk-maroon/5 text-nk-maroon text-xs font-semibold flex items-center gap-1.5 transition-colors whitespace-nowrap"
              >
                <span>View All Matches</span>
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </div>

            {topMatchesError && (
              <p className="mt-5 rounded-2xl border border-red-200 bg-red-50/80 p-6 text-center text-sm font-medium text-nk-maroon" data-testid="top-matches-error">
                {topMatchesError}
              </p>
            )}
            {!topMatchesError && topMatches === null && (
              <p className="mt-5 py-6 text-center text-sm text-nk-muted">Loading your top matches…</p>
            )}
            {!topMatchesError && topMatches !== null && filteredTopMatches.length === 0 && (
              <p className="mt-5 py-6 text-center text-sm text-nk-muted" data-testid="top-matches-empty">
                {topMatches.length === 0
                  ? (mustHaveNote ?? 'No matches are available for your profile right now. Check back as new members join.')
                  : 'None of your top matches match that search.'}
              </p>
            )}
            {!topMatchesError && mustHaveNote && (
              <p className="mt-2 text-center text-xs text-nk-muted" data-testid="must-have-note">
                {topMatches && topMatches.length > 0 ? `${mustHaveNote} ` : ''}
                <Link href="/profile#section-preferences" className="font-semibold text-nk-maroon underline">
                  Relax your must-have preferences
                </Link>
              </p>
            )}

            {/* Match Cards Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5 mt-5" data-testid="top-matches-grid">
              {filteredTopMatches.map((match) => (
                <div
                  key={match.profileId}
                  data-profile-id={match.profileId}
                  className="bg-white rounded-2xl border border-nk-line-soft hover:border-nk-line-strong p-3.5 flex flex-col justify-between gap-3 transition-all shadow-2xs hover:shadow-xs"
                >
                  {/* Top Part: Avatar + Info + Score Pill */}
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="h-12 w-12 sm:h-14 sm:w-14 rounded-full overflow-hidden border border-nk-line-gold shrink-0 bg-nk-paper">
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
                        <h3 className="text-sm sm:text-base font-bold text-nk-ink truncate">
                          {match.fullName}, {match.age}
                        </h3>
                        {match.city && (
                          <p className="flex items-center gap-1 text-xs text-nk-muted mt-1 truncate">
                            <MapPin className="h-3 w-3 text-[#A88C78] shrink-0" />
                            <span className="truncate">{match.city}</span>
                          </p>
                        )}
                        {match.profession && (
                          <p className="flex items-center gap-1 text-xs text-nk-muted mt-0.5 truncate">
                            <Briefcase className="h-3 w-3 text-[#A88C78] shrink-0" />
                            <span className="truncate">{match.profession}</span>
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      <span className="bg-[#FDF2F2] border border-[#F8D7DA] text-[#C53030] text-[10px] font-bold px-2 py-0.5 rounded-md whitespace-nowrap">
                        {match.score}% match
                      </span>
                      <button
                        type="button"
                        aria-label="More options"
                        onClick={() => router.push(`/browse/${match.profileId}`)}
                        className="text-nk-subtle hover:text-nk-ink p-0.5"
                      >
                        <MoreVertical className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* Bottom Action Buttons */}
                  <div className="flex items-center gap-2 pt-1">
                    <Link
                      href={`/browse/${match.profileId}`}
                      className="border border-nk-gold text-nk-gold-text hover:bg-nk-gold/10 active:scale-[0.98] text-xs font-semibold py-1.5 px-3 rounded-md flex-1 text-center transition-colors whitespace-nowrap"
                    >
                      View Profile
                    </Link>

                    <button
                      type="button"
                      disabled={match.interestSent || sendingId === match.profileId}
                      onClick={() => void handleSendInterest(match)}
                      className={`text-xs font-semibold py-1.5 px-3 rounded-md flex-1 text-center transition-all whitespace-nowrap flex items-center justify-center gap-1 cursor-pointer ${
                        match.interestSent
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200 cursor-default'
                          : 'bg-nk-maroon hover:bg-[#620D13] active:scale-[0.98] text-white shadow-xs'
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

// Needs a membership plan when the server requires one (see PlanGate).
export default function MatchesPage() {
  return (
    <PlanGate>
      <MatchesPageContent />
    </PlanGate>
  );
}
