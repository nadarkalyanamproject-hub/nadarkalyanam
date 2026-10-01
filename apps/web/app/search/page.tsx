'use client';

import { Suspense, useCallback, useEffect, useState, type FormEvent } from 'react';
import { useSearchParams } from 'next/navigation';
import type { SearchProfileResult } from '@nadar-kalyanam/schemas';
import { AppHeader } from '../../components/app-header';
import { ResultCard } from '../../components/discovery/result-card';
import { ApiError, searchProfiles } from '../../lib/api-client';
import { useRegistration } from '../providers/registration-provider';
import { useRequireAuth } from '../../lib/use-require-auth';
import { BotanicalSprig, PartnerSearchBar } from '../../components/search/partner-search-bar';
import {
  EMPTY_SEARCH_FILTERS,
  filtersFromUrl,
  hasAnyFilter,
  toSearchQuery,
  type SearchFilters,
} from '../../lib/search-query';

type SearchOutcome =
  | { items: SearchProfileResult[]; total: number; nextCursor: string | null; filters: SearchFilters }
  | { error: string };

function SearchPageContent() {
  const { ready } = useRequireAuth();
  const { data } = useRegistration();
  const searchParams = useSearchParams();

  const [initialFilters] = useState(() => filtersFromUrl(searchParams));
  const hasUrlQuery = hasAnyFilter(initialFilters);
  const [filters, setFilters] = useState<SearchFilters>(initialFilters);

  const [results, setResults] = useState<SearchProfileResult[] | null>(null);
  const [total, setTotal] = useState<number | null>(null);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  // The filters the shown results/count belong to, to flag a stale count.
  const [searchedFilters, setSearchedFilters] = useState<SearchFilters | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  // A search arriving via the URL (e.g. the home page's quick search) starts
  // in the loading state, so the effect below never sets state synchronously.
  const [loading, setLoading] = useState(hasUrlQuery);
  const [error, setError] = useState<string | null>(null);

  // Only ever real results: 0 matches shows the empty state and a failed call
  // shows the error state. No fake/demo profiles are ever substituted.
  const runSearch = useCallback(
    async (currentFilters: SearchFilters): Promise<SearchOutcome> => {
      try {
        const result = await searchProfiles(data.accessToken!, toSearchQuery(currentFilters));
        return { items: result.items, total: result.total, nextCursor: result.nextCursor, filters: currentFilters };
      } catch (err) {
        return { error: err instanceof ApiError ? err.message : 'Search failed. Please try again.' };
      }
    },
    [data.accessToken],
  );

  function applyOutcome(outcome: SearchOutcome) {
    const ok = 'items' in outcome;
    setResults(ok ? outcome.items : null);
    setTotal(ok ? outcome.total : null);
    setNextCursor(ok ? outcome.nextCursor : null);
    setSearchedFilters(ok ? outcome.filters : null);
    setError(ok ? null : outcome.error);
    setLoading(false);
  }

  // Next page for the filters that produced the current results.
  async function handleLoadMore() {
    if (!searchedFilters || !nextCursor) return;
    setLoadingMore(true);
    try {
      const page = await searchProfiles(data.accessToken!, { ...toSearchQuery(searchedFilters), cursor: nextCursor });
      setResults((prev) => [...(prev ?? []), ...page.items]);
      setTotal(page.total);
      setNextCursor(page.nextCursor);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not load more profiles. Please try again.');
    } finally {
      setLoadingMore(false);
    }
  }

  // Runs once auth is ready if the page was opened with filters in the URL
  // (state is only set in the promise callback, never synchronously here).
  useEffect(() => {
    if (!ready || !hasUrlQuery) return;
    let cancelled = false;
    void runSearch(initialFilters).then((outcome) => {
      if (!cancelled) applyOutcome(outcome);
    });
    return () => {
      cancelled = true;
    };
  }, [ready, hasUrlQuery, initialFilters, runSearch]);

  function handleSearchSubmit(e?: FormEvent) {
    e?.preventDefault();
    setLoading(true);
    setError(null);
    void runSearch(filters).then(applyOutcome);
  }

  function handleClear() {
    setFilters(EMPTY_SEARCH_FILTERS);
    setResults(null);
    setTotal(null);
    setNextCursor(null);
    setSearchedFilters(null);
    setError(null);
  }

  const countIsStale =
    searchedFilters !== null && JSON.stringify(searchedFilters) !== JSON.stringify(filters);

  if (!ready) return null;

  return (
    <>
      <AppHeader />
      <main className="relative min-h-screen bg-[#FAF7F2] text-[#241C1A] overflow-hidden px-4 py-6 sm:px-6 sm:py-8 lg:px-8 xl:px-12 2xl:px-16">
        {/* Decorative corner foliage flourishes matching the reference design */}
        <BotanicalSprig className="pointer-events-none absolute -top-4 -right-4 w-44 h-44 sm:w-64 sm:h-64 text-[#C4A882] opacity-40 z-0" />
        <BotanicalSprig className="pointer-events-none absolute -bottom-4 -left-4 w-44 h-44 sm:w-64 sm:h-64 text-[#C4A882] opacity-35 rotate-180 z-0" />

        <div className="relative z-10 w-full max-w-7xl mx-auto flex flex-col gap-8">
          {/* Main search card matching reference visual */}
          <PartnerSearchBar
            filters={filters}
            onChange={setFilters}
            onSearch={handleSearchSubmit}
            onClear={handleClear}
            loading={loading}
            showBrandHeader={true}
            matchCount={total}
            countIsStale={countIsStale}
          />

          {/* Error Message */}
          {error && (
            <div className="rounded-2xl border border-red-200 bg-red-50/80 p-6 text-center text-sm font-medium text-[#7A1118]">
              {error}
            </div>
          )}

          {/* Empty Results state */}
          {results && results.length === 0 && !error && (
            <div className="bg-white rounded-2xl sm:rounded-3xl border border-[#EADBBD] p-8 sm:p-12 text-center max-w-xl mx-auto shadow-xs">
              <div className="h-12 w-12 rounded-full bg-[#FAF7F2] border border-[#DECDBB] flex items-center justify-center mx-auto mb-3 text-[#7A1118]">
                <BotanicalSprig className="h-6 w-6 text-[#C4A882]" />
              </div>
              <h3 className="text-base sm:text-lg font-bold text-[#241C1A] font-[family-name:var(--font-heading,serif)]">
                No profiles match these filters
              </h3>
              <p className="mt-1 text-xs sm:text-sm text-[#73645C] max-w-md mx-auto">
                Try removing a filter or widening a range to see more profiles.
              </p>
              <button
                type="button"
                onClick={handleClear}
                className="mt-4 px-4 py-2 rounded-xl text-xs font-semibold text-[#7A1118] bg-[#FAF7F2] hover:bg-[#F3EDE3] border border-[#DECDBB] transition-colors"
              >
                Clear all filters
              </button>
            </div>
          )}

          {/* Search Results Grid */}
          {results && results.length > 0 && (
            <div className="flex flex-col gap-5 pt-2">
              <div className="flex items-center justify-between border-b border-[#EADBBD]/60 pb-3">
                <p className="text-xs sm:text-sm font-semibold text-[#241C1A]">
                  Found <span className="text-[#7A1118] font-bold">{total ?? results.length}</span>{' '}
                  {total === 1 ? 'profile' : 'profiles'} matching your criteria
                  {total !== null && total > results.length && (
                    <span className="font-normal text-[#73645C]"> · showing {results.length}</span>
                  )}
                </p>
                <button
                  type="button"
                  onClick={handleClear}
                  className="text-xs font-medium text-[#73645C] hover:text-[#7A1118] underline transition-colors cursor-pointer"
                >
                  Reset search
                </button>
              </div>

              <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
                {results.map((profile) => (
                  <ResultCard
                    key={profile.profileId}
                    profileId={profile.profileId}
                    fullName={profile.fullName}
                    age={profile.age}
                    city={profile.city}
                    primaryPhotoUrl={profile.primaryPhotoUrl}
                    relationshipStatus={profile.relationshipStatus}
                    conversationId={profile.conversationId}
                    badgeLabel={profile.isVerified ? 'Verified' : undefined}
                    badgeVariant="accent"
                  />
                ))}
              </div>

              {nextCursor && (
                <button
                  type="button"
                  onClick={() => void handleLoadMore()}
                  disabled={loadingMore}
                  className="self-center px-6 py-2.5 rounded-xl text-xs sm:text-sm font-semibold text-[#7A1118] bg-white hover:bg-[#FAF7F2] border border-[#DECDBB] transition-colors cursor-pointer disabled:opacity-60"
                >
                  {loadingMore ? 'Loading…' : 'Load more profiles'}
                </button>
              )}
            </div>
          )}
        </div>
      </main>
    </>
  );
}

export default function SearchPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-[#FAF7F2] flex items-center justify-center">
          <div className="text-xs font-medium text-[#73645C]">Loading search…</div>
        </div>
      }
    >
      <SearchPageContent />
    </Suspense>
  );
}
