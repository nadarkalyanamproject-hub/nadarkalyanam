'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import type { Connection, ListMatchesResponse } from '@nadar-kalyanam/schemas';
import { ArrowRight, Heart } from 'lucide-react';
import { AppHeader } from '../../components/app-header';
import { MatchProfileCard, type MatchProfileCardData } from '../../components/matches/match-profile-card';
import { PlanGate } from '../../components/plan/plan-gate';
import { PageShell, SectionCard } from '../../components/ui/page-shell';
import { ApiError, listConnections, listMatches } from '../../lib/api-client';
import { connectionCard, topMatchCards } from '../../lib/matches-page';
import { mustHaveNotice } from '../../lib/partner-preferences';
import { PREFERENCES_EDITOR_HREF, searchCategoryHref } from '../../lib/search-categories';
import { useRequireAuth } from '../../lib/use-require-auth';
import { useRegistration } from '../providers/registration-provider';

// Connected members load a page at a time (the API allows up to 50 per page).
const CONNECTIONS_PAGE_SIZE = 12;
// The matching engine is asked for a few extra so the row stays full after
// connected members (shown in their own section) are left out.
const TOP_MATCHES_FETCH = 24;
const TOP_MATCHES_SHOWN = 8;

const GRID = 'grid grid-cols-1 gap-3.5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4';
const errorText = (err: unknown, fallback: string) => (err instanceof ApiError ? err.message : fallback);

function MatchesPageContent() {
  const { ready } = useRequireAuth();
  const { data } = useRegistration();
  const accessToken = data.accessToken;

  const [connections, setConnections] = useState<Connection[] | null>(null);
  const [connectionsTotal, setConnectionsTotal] = useState(0);
  const [nextOffset, setNextOffset] = useState<number | null>(null);
  const [connectionsError, setConnectionsError] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);

  const [matches, setMatches] = useState<ListMatchesResponse | null>(null);
  const [matchesError, setMatchesError] = useState<string | null>(null);

  useEffect(() => {
    if (!ready || !accessToken) return;
    let cancelled = false;
    listConnections(accessToken, { limit: CONNECTIONS_PAGE_SIZE })
      .then((page) => {
        if (cancelled) return;
        setConnections(page.items);
        setConnectionsTotal(page.total);
        setNextOffset(page.nextOffset);
      })
      .catch((err: unknown) => {
        if (!cancelled) setConnectionsError(errorText(err, 'Could not load your connections. Please try again.'));
      });
    listMatches(accessToken, TOP_MATCHES_FETCH)
      .then((result) => {
        if (!cancelled) setMatches(result);
      })
      .catch((err: unknown) => {
        if (!cancelled) setMatchesError(errorText(err, 'Could not load your matches. Please try again.'));
      });
    return () => {
      cancelled = true;
    };
  }, [ready, accessToken]);

  async function handleViewMore() {
    if (!accessToken || nextOffset === null) return;
    setLoadingMore(true);
    try {
      const page = await listConnections(accessToken, { offset: nextOffset, limit: CONNECTIONS_PAGE_SIZE });
      setConnections((prev) => [...(prev ?? []), ...page.items]);
      setConnectionsTotal(page.total);
      setNextOffset(page.nextOffset);
    } catch (err) {
      setConnectionsError(errorText(err, 'Could not load more connections. Please try again.'));
    } finally {
      setLoadingMore(false);
    }
  }

  if (!ready) return null;

  return (
    <>
      <AppHeader />
      <PageShell
        icon={<Heart className="h-5 w-5 fill-nk-maroon text-nk-maroon sm:h-6 sm:w-6" />}
        title="Matches"
        subtitle="The members you're connected with, and your best matches."
      >
        <SectionCard
          title={connections && connectionsTotal > 0 ? `Connected Members (${connectionsTotal})` : 'Connected Members'}
          testId="connected-members"
        >
          {connectionsError && !connections ? (
            <ErrorNote text={connectionsError} testId="connections-error" />
          ) : !connections ? (
            <Loading />
          ) : connections.length === 0 ? (
            <div className="py-4 text-center" data-testid="connections-empty">
              <p className="text-sm text-nk-muted">You haven&apos;t connected with anyone yet. Send or accept an interest to get started.</p>
              <Link href="/interests" className="mt-3 inline-flex rounded-md bg-nk-maroon px-4 py-2 text-xs font-semibold text-white hover:bg-[#620D13]">
                Go to Interests
              </Link>
            </div>
          ) : (
            <div className="flex flex-col gap-4">
              <CardGrid cards={connections.map(connectionCard)} />
              {connectionsError && <ErrorNote text={connectionsError} />}
              {nextOffset !== null && (
                <button
                  type="button"
                  onClick={() => void handleViewMore()}
                  disabled={loadingMore}
                  data-testid="connections-more"
                  className="self-center cursor-pointer rounded-xl border border-nk-line-strong bg-white px-6 py-2.5 text-xs font-semibold text-nk-maroon transition-colors hover:bg-nk-paper disabled:opacity-60 sm:text-sm"
                >
                  {loadingMore ? 'Loading…' : 'View more'}
                </button>
              )}
            </div>
          )}
        </SectionCard>

        <SectionCard
          title="Your Top Matches"
          testId="top-matches"
          action={
            matches?.preferences.hasPreferences ? (
              <Link href={searchCategoryHref('your-matches')} className="flex items-center gap-1 text-xs font-semibold text-nk-maroon hover:underline">
                View all <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            ) : undefined
          }
        >
          <TopMatches matches={matches} error={matchesError} />
        </SectionCard>
      </PageShell>
    </>
  );
}

function TopMatches({ matches, error }: { matches: ListMatchesResponse | null; error: string | null }) {
  if (error) return <ErrorNote text={error} testId="top-matches-error" />;
  if (!matches) return <Loading />;

  // Ranked by partner preferences: with none set there's nothing to rank by,
  // so ask for them instead of showing an unrelated list.
  if (!matches.preferences.hasPreferences) {
    return (
      <div className="py-4 text-center" data-testid="top-matches-no-preferences">
        <p className="text-sm text-nk-muted">Tell us who you&apos;re looking for, and your top matches will appear here.</p>
        <Link href={PREFERENCES_EDITOR_HREF} className="mt-3 inline-flex rounded-md bg-nk-maroon px-4 py-2 text-xs font-semibold text-white hover:bg-[#620D13]">
          Set your preferences
        </Link>
      </div>
    );
  }

  const cards = topMatchCards(matches.items, TOP_MATCHES_SHOWN);
  const notice = mustHaveNotice(matches.preferences, cards.length);
  return (
    <div className="flex flex-col gap-3">
      {notice && (
        <p className="text-xs text-nk-muted" data-testid="must-have-note">
          {notice}{' '}
          <Link href={PREFERENCES_EDITOR_HREF} className="font-semibold text-nk-maroon underline">
            Relax your must-have preferences
          </Link>
        </p>
      )}
      {cards.length === 0 ? (
        <p className="py-4 text-center text-sm text-nk-muted" data-testid="top-matches-empty">
          No new matches for your preferences right now. Check back as new members join.
        </p>
      ) : (
        <CardGrid cards={cards} testId="top-matches-grid" />
      )}
    </div>
  );
}

function CardGrid({ cards, testId }: { cards: MatchProfileCardData[]; testId?: string }) {
  return (
    <div className={GRID} data-testid={testId}>
      {cards.map((card) => (
        <MatchProfileCard key={card.profileId} profile={card} />
      ))}
    </div>
  );
}

function Loading() {
  return <p className="py-6 text-center text-sm text-nk-muted">Loading…</p>;
}

function ErrorNote({ text, testId }: { text: string; testId?: string }) {
  return (
    <p className="rounded-2xl border border-red-200 bg-red-50/80 p-4 text-center text-sm font-medium text-nk-maroon" data-testid={testId} role="alert">
      {text}
    </p>
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
