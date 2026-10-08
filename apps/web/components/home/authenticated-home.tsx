'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import type { MatchResult, MyMembershipResponse, ProfileCard } from '@nadar-kalyanam/schemas';
import { Crown } from 'lucide-react';
import { AppHeader } from '../app-header';
import { SponsoredBanner } from './sponsored-banner';
import { SubscriptionCard } from './subscription-card';
import { HomeProfileSection } from './home-profile-card';
import { ApiError, getMyMembership, listMatchCategory, listMatches } from '../../lib/api-client';
import { pickDailyRecommendations } from '../../lib/daily-picks';
import { useProfile } from '../../lib/use-profile';
import { useRequireAuth } from '../../lib/use-require-auth';
import { useRegistration } from '../../app/providers/registration-provider';
import { matchCategoryHref } from '../../lib/match-categories';
import { PlanGate } from '../plan/plan-gate';

function AuthenticatedHomeContent() {
  const { data } = useRegistration();
  // Sends a signed-in user without a profile back to onboarding.
  const { ready } = useRequireAuth();
  const { profile } = useProfile();
  // Each row loads on its own, so one failing call only affects its own row.
  const [matches, setMatches] = useState<MatchResult[] | null>(null);
  const [matchesError, setMatchesError] = useState<string | null>(null);
  const [membership, setMembership] = useState<MyMembershipResponse | null>(null);
  const [membershipError, setMembershipError] = useState<string | null>(null);
  const [newlyJoined, setNewlyJoined] = useState<ProfileCard[] | null>(null);
  const [newlyJoinedError, setNewlyJoinedError] = useState<string | null>(null);
  const [viewedMe, setViewedMe] = useState<ProfileCard[] | null>(null);
  const [viewedMeError, setViewedMeError] = useState<string | null>(null);

  useEffect(() => {
    if (!data.accessToken || !profile) return;
    const token = data.accessToken;
    let cancelled = false;
    const message = (err: unknown, fallback: string) => (err instanceof ApiError ? err.message : fallback);

    // Up to 50 matches: the top 8 are "Recommended", the rest feed today's picks.
    listMatches(token, 50)
      .then((result) => {
        if (!cancelled) setMatches(result.items);
      })
      .catch((err: unknown) => {
        if (!cancelled) setMatchesError(message(err, 'Could not load recommendations.'));
      });
    getMyMembership(token)
      .then((result) => {
        if (!cancelled) setMembership(result);
      })
      .catch((err: unknown) => {
        if (!cancelled) setMembershipError(message(err, 'Could not load your membership.'));
      });
    listMatchCategory(token, 'newly-joined')
      .then((result) => {
        if (!cancelled) setNewlyJoined(result.items.slice(0, 4));
      })
      .catch((err: unknown) => {
        if (!cancelled) setNewlyJoinedError(message(err, 'Could not load new members.'));
      });
    listMatchCategory(token, 'viewed-me')
      .then((result) => {
        if (!cancelled) setViewedMe(result.items.slice(0, 4));
      })
      .catch((err: unknown) => {
        if (!cancelled) setViewedMeError(message(err, 'Could not load who viewed you.'));
      });

    return () => {
      cancelled = true;
    };
  }, [data.accessToken, profile]);

  const recommended = matches ? matches.slice(0, 8) : null;
  const dailyPicks =
    matches && recommended
      ? pickDailyRecommendations(matches, {
          userId: data.userId ?? profile?.id ?? '',
          count: 4,
          exclude: new Set(recommended.map((match) => match.profileId)),
        })
      : null;

  if (!ready) return null;

  return (
    <>
      <AppHeader />

      <main className="min-h-screen bg-[#FFFDF9] text-[#2B1515] px-4 py-8 sm:px-6 lg:px-8 xl:px-12 2xl:px-16 space-y-12">
        {/* =========================================================================
            SPONSORED ADVERTISEMENT BANNER
            ========================================================================= */}
        <SponsoredBanner />

        {/* =========================================================================
            2. SUBSCRIPTION SIDEBAR + RECOMMENDED MATCHES (4 PER ROW)
            ========================================================================= */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[280px_minmax(0,1fr)] lg:items-start">
          <aside className="order-2 lg:order-1 lg:sticky lg:top-24">
            <SubscriptionCard me={membership} error={membershipError} />
          </aside>

          <div className="order-1 lg:order-2">
            <HomeProfileSection
              title="Recommended Matches For You"
              subtitle="Curated based on your preferences, location, and lifestyle."
              viewAllHref="/matches"
              viewAllLabel="View All Matches"
              profiles={recommended}
              error={matchesError}
              emptyMessage="No recommendations yet. New ones appear here as more members join."
            />
          </div>
        </div>

        {/* =========================================================================
            3. DAILY RECOMMENDATIONS (NEW PICKS EVERY DAY, INDIA TIME)
            ========================================================================= */}
        <HomeProfileSection
          testId="home-daily"
          title="Daily Recommendations"
          subtitle="Fresh picks from your matches, chosen for you each day."
          viewAllHref="/matches"
          profiles={dailyPicks}
          error={matchesError}
          emptyMessage="You've seen everyone in today's picks. New recommendations arrive tomorrow."
        />

        {/* =========================================================================
            4. MEMBERSHIP UPGRADE BANNER (PREMIUM BENEFITS)
            ========================================================================= */}
        <section className="rounded-3xl bg-gradient-to-br from-[#FFFBF0] via-[#FFF9ED] to-[#FAF1DE] border border-[#EADBBD] p-6 sm:p-8 lg:p-10 shadow-xs relative overflow-hidden">
          {/* Subtle decorative background watermarks */}
          <div className="absolute -right-12 -bottom-12 w-64 h-64 rounded-full bg-[#C89B3C]/5 pointer-events-none" />
          <div className="absolute -left-12 -top-12 w-48 h-48 rounded-full bg-[#7B1118]/5 pointer-events-none" />

          <div className="relative z-10 flex flex-col lg:flex-row items-center justify-between gap-8">
            <div className="space-y-3 max-w-2xl text-center lg:text-left">
              <div className="inline-flex items-center gap-2 rounded-md bg-[#FAF0DC] px-3.5 py-1 text-xs font-bold text-[#7B1118] border border-[#EADBBD]">
                <Crown className="h-3.5 w-3.5 text-[#C89B3C]" />
                <span className="tracking-wider uppercase">MEMBERSHIP</span>
              </div>
              <h2 className="text-2xl sm:text-3xl font-extrabold text-[#2B1515] font-[family-name:var(--font-heading,serif)] tracking-tight">
                Membership Plans
              </h2>
              <p className="text-xs sm:text-sm text-[#73645C] leading-relaxed">
                Messaging the members you&apos;re connected with is already free for everyone. Paid plans are being set
                up: phone numbers, horoscope views and priority placement are coming soon, and online payment opens
                shortly.
              </p>
            </div>

            {/* CTA Box */}
            <div className="bg-white rounded-2xl p-6 border-2 border-[#C89B3C] shadow-md flex flex-col items-center text-center shrink-0 w-full sm:w-80">
              <h3 className="text-lg font-bold text-[#2B1515]">Gold &amp; Premium Plans</h3>
              <p className="text-xs text-[#73645C] mt-1 mb-4">
                See each plan&apos;s price and exactly what&apos;s available today.
              </p>
              <Link
                href="/membership"
                className="w-full py-2.5 px-4 rounded-xl font-bold text-xs sm:text-sm bg-gradient-to-r from-[#7B1118] to-[#600C12] hover:opacity-95 text-white shadow-md shadow-[#7B1118]/20 flex items-center justify-center gap-1.5 transition-all cursor-pointer"
              >
                <span>View Membership Plans</span>
                <span>→</span>
              </Link>
            </div>
          </div>
        </section>

        {/* =========================================================================
            5. NEWLY JOINED
            ========================================================================= */}
        <HomeProfileSection
          testId="home-newly-joined"
          title="Newly Joined"
          subtitle="Members who joined in the last 30 days."
          viewAllHref={matchCategoryHref('newly-joined')}
          profiles={newlyJoined}
          error={newlyJoinedError}
          emptyMessage="No new members in the last 30 days."
        />

        {/* =========================================================================
            6. PROFILE VIEWED YOU
            ========================================================================= */}
        <HomeProfileSection
          testId="home-viewed-you"
          title="Profile Viewed You"
          subtitle="Members who recently opened your profile."
          viewAllHref={matchCategoryHref('viewed-you')}
          profiles={viewedMe}
          error={viewedMeError}
          emptyMessage="No one has viewed your profile yet. A complete profile with a clear photo gets more views."
        />
      </main>
    </>
  );
}

// Needs a membership plan when the server requires one (see PlanGate).
export function AuthenticatedHome() {
  return (
    <PlanGate>
      <AuthenticatedHomeContent />
    </PlanGate>
  );
}
