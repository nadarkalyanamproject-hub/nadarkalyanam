'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { ArrowLeft, Clock, Heart } from 'lucide-react';
import { AppHeader } from '../../../components/app-header';
import { MatchProfileCard, type MatchProfileCardData } from '../../../components/matches/match-profile-card';
import { BotanicalSprig } from '../../../components/search/partner-search-bar';
import {
  ApiError,
  listMatchCategory,
  listMatches,
  listNearbyMatches,
  listShortlistedMe,
  listShortlists,
} from '../../../lib/api-client';
import { findMatchCategory, type RealCategory, type RealCategorySource } from '../../../lib/match-categories';
import { mustHaveNotice } from '../../../lib/partner-preferences';
import { useRequireAuth } from '../../../lib/use-require-auth';
import { useRegistration } from '../../providers/registration-provider';

interface LoadedCategory {
  items: MatchProfileCardData[];
  // Replaces the generic empty message when the reason is more specific.
  emptyNote?: string;
  // Extra context shown under the description (e.g. which location "nearby" used).
  basisNote?: string;
  // Must-have partner preferences are holding members back: offer a way to relax them.
  relaxLink?: boolean;
}

// One real endpoint per category — no category is a client-side filter over
// another list.
async function loadCategory(accessToken: string, source: RealCategorySource): Promise<LoadedCategory> {
  switch (source) {
    case 'matches': {
      const { items, preferences } = await listMatches(accessToken, 50);
      const notice = mustHaveNotice(preferences, items.length);
      return {
        emptyNote: items.length === 0 && notice ? notice : undefined,
        basisNote: items.length > 0 && notice ? notice : undefined,
        relaxLink: Boolean(notice),
        items: items.map((m) => ({
          profileId: m.profileId,
          fullName: m.fullName,
          age: m.age,
          city: m.city,
          state: null,
          educationLevel: null,
          profession: m.profession,
          primaryPhotoUrl: m.primaryPhotoUrl,
          relationshipStatus: m.relationshipStatus,
          conversationId: m.conversationId,
          score: m.score,
        })),
      };
    }
    case 'shortlisted-by-you':
      return listShortlists(accessToken);
    case 'shortlisted-you':
      return listShortlistedMe(accessToken);
    case 'nearby': {
      const result = await listNearbyMatches(accessToken);
      const place = [result.city, result.state].filter(Boolean).join(', ');
      return {
        items: result.items,
        basisNote: place ? `Using the location in your profile: ${place}.` : undefined,
        emptyNote: place
          ? undefined
          : 'Your profile has no city or state yet. Add your location to your profile to see nearby matches.',
      };
    }
    default:
      return listMatchCategory(accessToken, source);
  }
}

export default function MatchCategoryPage() {
  const { ready } = useRequireAuth();
  const { data } = useRegistration();
  const params = useParams<{ category: string }>();
  const category = findMatchCategory(params.category);
  const realCategory = category?.kind === 'real' ? category : null;

  const [loaded, setLoaded] = useState<LoadedCategory | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!ready || !data.accessToken || !realCategory) return;
    let cancelled = false;
    loadCategory(data.accessToken, realCategory.source)
      .then((result) => {
        if (!cancelled) setLoaded(result);
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof ApiError ? err.message : 'Could not load these matches. Please try again.');
      });
    return () => {
      cancelled = true;
    };
  }, [ready, data.accessToken, realCategory]);

  if (!ready) return null;

  return (
    <>
      <AppHeader />
      <main className="relative min-h-screen bg-[#FAF7F2] text-[#241C1A] overflow-hidden px-4 py-6 sm:px-6 sm:py-8 lg:px-8 xl:px-12 2xl:px-16">
        <BotanicalSprig className="pointer-events-none absolute -top-4 -right-4 w-44 h-44 sm:w-64 sm:h-64 text-[#C4A882] opacity-40 z-0" />
        <BotanicalSprig className="pointer-events-none absolute -bottom-4 -left-4 w-44 h-44 sm:w-64 sm:h-64 text-[#C4A882] opacity-35 rotate-180 z-0" />

        <div className="relative z-10 w-full max-w-7xl mx-auto flex flex-col gap-6">
          <Link
            href="/matches"
            data-testid="back-to-matches"
            className="self-start inline-flex items-center gap-1.5 rounded-full border border-[#EADBBD] bg-white/95 px-3.5 py-1.5 text-xs font-semibold text-[#7A1118] hover:border-[#7A1118] hover:bg-[#7A1118]/5 transition-colors shadow-2xs"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Back to Matches
          </Link>

          <div className="flex items-center gap-3.5">
            <div className="h-11 w-11 sm:h-12 sm:w-12 rounded-full bg-[#FDF2F2] border border-[#F8D7DA] flex items-center justify-center text-[#7A1118] shrink-0 shadow-2xs">
              <Heart className="h-5 w-5 sm:h-6 sm:w-6 fill-[#7A1118] text-[#7A1118]" />
            </div>
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold text-[#241C1A] font-[family-name:var(--font-heading,serif)] tracking-tight">
                {category?.title ?? 'Matches'}
              </h1>
              <p className="text-xs sm:text-sm text-[#73645C] mt-0.5">
                {realCategory ? realCategory.description : (category?.subtitle ?? 'This category does not exist.')}
              </p>
            </div>
          </div>

          <div className="bg-white rounded-2xl sm:rounded-3xl border border-[#EADBBD]/80 p-5 sm:p-7 lg:p-8 shadow-[0_4px_24px_-4px_rgba(43,21,21,0.05)]">
            {!category && <p className="text-sm text-[#73645C]">We couldn&apos;t find that category.</p>}

            {category?.kind === 'coming-soon' && (
              <div className="mx-auto max-w-xl py-6 text-center" data-testid="coming-soon">
                <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full border border-[#DECDBB] bg-[#FAF7F2] text-[#7A1118]">
                  <Clock className="h-5 w-5" />
                </div>
                <p className="text-[11px] font-bold uppercase tracking-wider text-[#A88C78]">Coming soon</p>
                <p className="mt-2 text-sm sm:text-base text-[#241C1A]">{category.message}</p>
                {category.alternative && (
                  <Link
                    href={category.alternative.href}
                    className="mt-4 inline-flex rounded-full border border-[#7A1118]/30 px-4 py-2 text-xs font-semibold text-[#7A1118] hover:border-[#7A1118] hover:bg-[#7A1118]/5 transition-colors"
                  >
                    {category.alternative.label}
                  </Link>
                )}
              </div>
            )}

            {realCategory && <RealCategoryResults category={realCategory} loaded={loaded} error={error} />}
          </div>
        </div>
      </main>
    </>
  );
}

function RealCategoryResults({
  category,
  loaded,
  error,
}: {
  category: RealCategory;
  loaded: LoadedCategory | null;
  error: string | null;
}) {
  if (error) {
    return (
      <p className="rounded-2xl border border-red-200 bg-red-50/80 p-6 text-center text-sm font-medium text-[#7A1118]" data-testid="category-error">
        {error}
      </p>
    );
  }
  if (!loaded) return <p className="py-6 text-center text-sm text-[#73645C]">Loading…</p>;

  return (
    <div className="flex flex-col gap-4">
      {loaded.basisNote && <p className="text-xs text-[#73645C]" data-testid="category-basis">{loaded.basisNote}</p>}
      {loaded.relaxLink && (
        <Link href="/profile#section-preferences" className="text-xs font-semibold text-[#7A1118] underline" data-testid="relax-must-haves">
          Relax your must-have preferences
        </Link>
      )}
      {loaded.items.length === 0 ? (
        <p className="py-6 text-center text-sm text-[#73645C]" data-testid="category-empty">
          {loaded.emptyNote ?? category.emptyMessage}
        </p>
      ) : (
        <>
          <p className="text-xs sm:text-sm font-semibold text-[#241C1A]">
            {/* Lists are capped at 50 (no pagination yet) — say so at the cap. */}
            {loaded.items.length >= 50
              ? `Showing the first ${loaded.items.length} members`
              : loaded.items.length === 1
                ? '1 member'
                : `${loaded.items.length} members`}
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
            {loaded.items.map((profile) => (
              <MatchProfileCard key={profile.profileId} profile={profile} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
