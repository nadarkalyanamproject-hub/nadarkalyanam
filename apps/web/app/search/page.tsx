'use client';

import { Suspense, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import type { SavedPartnerPreferences } from '@nadar-kalyanam/schemas';
import { Clock, Search as SearchIcon } from 'lucide-react';
import { AppHeader } from '../../components/app-header';
import { ResultCard } from '../../components/discovery/result-card';
import { CategoryTile } from '../../components/search/category-tile';
import { UsePreferencesToggle } from '../../components/search/use-preferences-toggle';
import { PageShell, SectionCard } from '../../components/ui/page-shell';
import { ApiError, getPartnerPreferences, searchProfiles } from '../../lib/api-client';
import { loadCategory, toResultItem, type ResultItem } from '../../lib/category-loader';
import { CATEGORY_GROUPS, PREFERENCES_EDITOR_HREF, SEARCH_CATEGORIES, searchHref } from '../../lib/search-categories';
import { planSearch, type SearchPlan } from '../../lib/search-plan';
import { toSearchQuery } from '../../lib/search-query';
import { useRegistration } from '../providers/registration-provider';
import { useRequireAuth } from '../../lib/use-require-auth';
import { PlanGate } from '../../components/plan/plan-gate';

interface Results {
  // The plan these results belong to; anything else is stale.
  key: string;
  items: ResultItem[];
  total: number | null;
  nextCursor: string | null;
  emptyNote?: string;
  basisNote?: string;
  relaxLink?: boolean;
  error?: string;
}

// Identifies what a plan loads, so results are only shown for the plan
// that produced them.
function planKey(plan: SearchPlan): string | null {
  if (plan.kind === 'endpoint') return `endpoint:${plan.source}`;
  if (plan.kind === 'search') return `search:${plan.category?.slug ?? ''}:${JSON.stringify(toSearchQuery(plan.filters))}`;
  return null;
}

const errorText = (err: unknown, fallback: string) => (err instanceof ApiError ? err.message : fallback);

function SearchPageContent() {
  const { ready } = useRequireAuth();
  const { data } = useRegistration();
  const router = useRouter();
  const searchParams = useSearchParams();
  const accessToken = data.accessToken;

  // The category and the preferences toggle live in the URL, so a refresh,
  // Back or a shared link shows the same thing.
  const slug = searchParams.get('category');
  const usePreferences = searchParams.get('prefs') === '1';

  const [preferences, setPreferences] = useState<SavedPartnerPreferences | null | undefined>(undefined);
  const [preferencesError, setPreferencesError] = useState<string | null>(null);
  useEffect(() => {
    if (!ready || !accessToken) return;
    let cancelled = false;
    getPartnerPreferences(accessToken)
      .then((result) => {
        if (!cancelled) setPreferences(result.preferences);
      })
      .catch((err: unknown) => {
        if (!cancelled) setPreferencesError(errorText(err, 'Could not load your partner preferences.'));
      });
    return () => {
      cancelled = true;
    };
  }, [ready, accessToken]);

  const plan = planSearch({ slug, usePreferences, preferences });
  const key = planKey(plan);

  const [results, setResults] = useState<Results | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  useEffect(() => {
    if (!ready || !accessToken || !key) return;
    let cancelled = false;
    const done = (next: Omit<Results, 'key'>) => {
      if (!cancelled) setResults({ key, ...next });
    };
    if (plan.kind === 'endpoint') {
      loadCategory(accessToken, plan.source)
        .then((loaded) => done({ ...loaded, total: null, nextCursor: null }))
        .catch((err: unknown) => done({ items: [], total: null, nextCursor: null, error: errorText(err, 'Could not load these members. Please try again.') }));
    } else if (plan.kind === 'search') {
      searchProfiles(accessToken, toSearchQuery(plan.filters))
        .then((page) => done({ items: page.items.map(toResultItem), total: page.total, nextCursor: page.nextCursor }))
        .catch((err: unknown) => done({ items: [], total: null, nextCursor: null, error: errorText(err, 'Search failed. Please try again.') }));
    }
    return () => {
      cancelled = true;
    };
    // `key` captures everything about the plan that changes what's loaded.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, accessToken, key]);

  async function handleLoadMore() {
    if (plan.kind !== 'search' || !results?.nextCursor || !accessToken) return;
    const forKey = results.key;
    setLoadingMore(true);
    try {
      const page = await searchProfiles(accessToken, { ...toSearchQuery(plan.filters), cursor: results.nextCursor });
      setResults((prev) =>
        prev && prev.key === forKey
          ? { ...prev, items: [...prev.items, ...page.items.map(toResultItem)], total: page.total, nextCursor: page.nextCursor }
          : prev,
      );
    } catch (err) {
      setResults((prev) => (prev && prev.key === forKey ? { ...prev, error: errorText(err, 'Could not load more profiles. Please try again.') } : prev));
    } finally {
      setLoadingMore(false);
    }
  }

  // Choosing a category from the list below brings its results into view.
  const resultsRef = useRef<HTMLDivElement>(null);
  const previousSlug = useRef(slug);
  useEffect(() => {
    if (previousSlug.current === slug) return;
    previousSlug.current = slug;
    if (slug) resultsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [slug]);

  if (!ready) return null;

  const current = results && results.key === key ? results : null;

  return (
    <>
      <AppHeader />
      <PageShell
        icon={<SearchIcon className="h-5 w-5 sm:h-6 sm:w-6" />}
        title="Search"
        subtitle="Browse members by category, or by your partner preferences."
      >
        <UsePreferencesToggle
          checked={usePreferences}
          onChange={(next) => router.push(searchHref({ category: slug, usePreferences: next }), { scroll: false })}
          preferences={preferences}
          error={preferencesError}
        />

        {plan.kind !== 'idle' && (
          <div ref={resultsRef} className="scroll-mt-24">
            <ResultsPanel
              plan={plan}
              results={current}
              preferencesError={preferencesError}
              loadingMore={loadingMore}
              onLoadMore={() => void handleLoadMore()}
              clearHref={searchHref({ category: null, usePreferences: false })}
            />
          </div>
        )}

        {CATEGORY_GROUPS.map((group) => (
          <SectionCard key={group.key} title={group.title} testId={`category-group-${group.key}`}>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {SEARCH_CATEGORIES.filter((category) => category.group === group.key).map((category) => (
                <CategoryTile
                  key={category.slug}
                  category={category}
                  selected={category.slug === slug}
                  href={searchHref({ category: category.slug, usePreferences })}
                />
              ))}
            </div>
          </SectionCard>
        ))}
      </PageShell>
    </>
  );
}

function ResultsPanel({
  plan,
  results,
  preferencesError,
  loadingMore,
  onLoadMore,
  clearHref,
}: {
  plan: Exclude<SearchPlan, { kind: 'idle' }>;
  results: Results | null;
  preferencesError: string | null;
  loadingMore: boolean;
  onLoadMore: () => void;
  clearHref: string;
}) {
  const category = 'category' in plan ? plan.category : null;
  const title = plan.kind === 'unknown' ? 'Category not found' : (category?.title ?? 'Your partner preferences');
  const clear = (
    <Link href={clearHref} scroll={false} className="text-xs font-semibold text-nk-maroon hover:underline" data-testid="clear-selection">
      Clear
    </Link>
  );

  return (
    <SectionCard title={title} action={clear} testId="search-results">
      {category && category.kind === 'real' && <p className="-mt-2 mb-3 text-xs text-nk-muted sm:text-sm">{category.description}</p>}

      {plan.kind === 'unknown' && (
        <p className="text-sm text-nk-muted" data-testid="category-unknown">
          We couldn&apos;t find that category. Choose one from the list below.
        </p>
      )}

      {plan.kind === 'coming-soon' && (
        <div className="mx-auto max-w-xl py-4 text-center" data-testid="coming-soon">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full border border-nk-line-strong bg-nk-paper text-nk-maroon">
            <Clock className="h-5 w-5" />
          </div>
          <p className="text-[11px] font-bold uppercase tracking-wider text-nk-gold-text">Coming soon</p>
          <p className="mt-2 text-sm text-nk-ink sm:text-base">{plan.category.message}</p>
        </div>
      )}

      {plan.kind === 'waiting-for-preferences' &&
        (preferencesError ? (
          <p className="rounded-2xl border border-red-200 bg-red-50/80 p-4 text-center text-sm font-medium text-nk-maroon" role="alert">
            {preferencesError}
          </p>
        ) : (
          <p className="py-6 text-center text-sm text-nk-muted">Loading your preferences…</p>
        ))}

      {plan.kind === 'needs-preferences' && (
        <div className="mx-auto max-w-xl py-4 text-center" data-testid="needs-preferences">
          <p className="text-sm text-nk-ink">
            {plan.missing === 'location'
              ? "You haven't chosen any preferred states or cities in your partner preferences yet."
              : "You haven't set partner preferences yet, so there's nothing to filter by."}
          </p>
          <Link
            href={PREFERENCES_EDITOR_HREF}
            className="mt-4 inline-flex rounded-md bg-nk-maroon px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-[#620D13]"
          >
            Set your preferences
          </Link>
        </div>
      )}

      {(plan.kind === 'endpoint' || plan.kind === 'search') && (
        <div className="flex flex-col gap-4">
          {plan.note && (
            <p className="rounded-xl border border-nk-line-gold bg-nk-paper px-3 py-2 text-xs text-nk-ink-soft" data-testid="preferences-note">
              {plan.note}
            </p>
          )}
          {!results ? (
            <p className="py-6 text-center text-sm text-nk-muted" data-testid="results-loading">
              Loading…
            </p>
          ) : results.error && results.items.length === 0 ? (
            <p className="rounded-2xl border border-red-200 bg-red-50/80 p-6 text-center text-sm font-medium text-nk-maroon" data-testid="results-error">
              {results.error}
            </p>
          ) : (
            <>
              {results.basisNote && (
                <p className="text-xs text-nk-muted" data-testid="results-basis">
                  {results.basisNote}
                </p>
              )}
              {results.relaxLink && (
                <Link href={PREFERENCES_EDITOR_HREF} className="text-xs font-semibold text-nk-maroon underline" data-testid="relax-must-haves">
                  Relax your must-have preferences
                </Link>
              )}
              {results.items.length === 0 ? (
                <p className="py-6 text-center text-sm text-nk-muted" data-testid="results-empty">
                  {results.emptyNote ??
                    (category?.kind === 'real' ? category.emptyMessage : 'No members match your partner preferences yet.')}
                </p>
              ) : (
                <>
                  <p className="text-xs font-semibold text-nk-ink sm:text-sm" data-testid="results-count">
                    {resultCount(results)}
                  </p>
                  <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
                    {results.items.map((profile) => (
                      <ResultCard
                        key={profile.profileId}
                        profileId={profile.profileId}
                        fullName={profile.fullName}
                        age={profile.age}
                        city={profile.city}
                        primaryPhotoUrl={profile.primaryPhotoUrl}
                        relationshipStatus={profile.relationshipStatus}
                        conversationId={profile.conversationId}
                        verified={profile.isVerified}
                      />
                    ))}
                  </div>
                  {results.error && (
                    <p className="text-center text-xs font-semibold text-nk-maroon" role="alert">
                      {results.error}
                    </p>
                  )}
                  {results.nextCursor && (
                    <button
                      type="button"
                      onClick={onLoadMore}
                      disabled={loadingMore}
                      className="self-center cursor-pointer rounded-xl border border-nk-line-strong bg-white px-6 py-2.5 text-xs font-semibold text-nk-maroon transition-colors hover:bg-nk-paper disabled:opacity-60 sm:text-sm"
                    >
                      {loadingMore ? 'Loading…' : 'Load more profiles'}
                    </button>
                  )}
                </>
              )}
            </>
          )}
        </div>
      )}
    </SectionCard>
  );
}

function resultCount(results: Results): string {
  const shown = results.items.length;
  if (results.total !== null) {
    const noun = results.total === 1 ? 'member' : 'members';
    return results.total > shown ? `${results.total} ${noun} · showing ${shown}` : `${results.total} ${noun}`;
  }
  // Category lists are capped at 50 (no pagination yet); say so at the cap.
  if (shown >= 50) return `Showing the first ${shown} members`;
  return shown === 1 ? '1 member' : `${shown} members`;
}

function SearchPageWithSuspense() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-nk-paper">
          <div className="text-xs font-medium text-nk-muted">Loading search…</div>
        </div>
      }
    >
      <SearchPageContent />
    </Suspense>
  );
}

// Needs a membership plan when the server requires one (see PlanGate).
export default function SearchPage() {
  return (
    <PlanGate>
      <SearchPageWithSuspense />
    </PlanGate>
  );
}
