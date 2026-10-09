'use client';

import { useEffect, useState } from 'react';
import type { MatchResult, MyMembershipResponse, ProfileCard } from '@nadar-kalyanam/schemas';
import { AppHeader } from '../app-header';
import { SponsoredBanner } from './sponsored-banner';
import { SubscriptionCard } from './subscription-card';
import { VipPromo } from './vip-promo';
import { useMembershipPlans } from '../../lib/use-membership-plans';
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
  const vipPlan = useMembershipPlans()?.find((p) => p.isAssisted) ?? null;
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

  // One row (4 cards); the rest of the matches feed Daily Recommendations.
  const recommended = matches ? matches.slice(0, 4) : null;
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

      <main className="min-h-screen bg-nk-ivory text-nk-ink px-4 py-8 sm:px-6 lg:px-8 xl:px-12 2xl:px-16 space-y-12">
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
            4. VIP ASSISTED PROMOTION (hidden for members already on it)
            ========================================================================= */}
        {vipPlan && !membership?.plan?.isAssisted && <VipPromo plan={vipPlan} />}

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
