'use client';

import { useEffect, useState } from 'react';
import type { MatchResult } from '@nadar-kalyanam/schemas';
import { Card } from '@nadar-kalyanam/ui';
import { AppHeader } from '../../components/app-header';
import { ResultCard } from '../../components/discovery/result-card';
import { listMatches } from '../../lib/api-client';
import { useRegistration } from '../providers/registration-provider';
import { useRequireAuth } from '../../lib/use-require-auth';

import { DUMMY_PROFILES } from '../../lib/mock-profiles';

const DUMMY_MATCHES: MatchResult[] = DUMMY_PROFILES.map((p, idx) => ({
  profileId: p.id,
  fullName: p.fullName,
  age: p.age,
  city: p.location.city,
  primaryPhotoUrl: p.primaryPhotoUrl,
  score: Math.max(78, 98 - idx * 3),
}));

export default function MatchesPage() {
  const { ready } = useRequireAuth();
  const { data } = useRegistration();
  const [matches, setMatches] = useState<MatchResult[] | null>(null);
  const [error] = useState<string | null>(null);

  useEffect(() => {
    if (!ready || !data.accessToken) return;
    let cancelled = false;
    listMatches(data.accessToken)
      .then((result) => {
        if (!cancelled) {
          setMatches(result.items.length > 0 ? result.items : DUMMY_MATCHES);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setMatches(DUMMY_MATCHES);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [ready, data.accessToken]);

  if (!ready) return null;

  return (
    <>
      <AppHeader />
      <main className="min-h-screen bg-secondary px-4 py-6 sm:px-6 sm:py-8 lg:px-8 xl:px-12 2xl:px-16">
        <div className="w-full flex flex-col gap-6">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Your Top Matches</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Ranked recommendations based on your profile — the ranking formula is still a work in
              progress, so treat scores as a rough guide for now.
            </p>
          </div>

          {!matches && !error && (
            <Card className="rounded-2xl p-8 text-center text-sm text-muted-foreground">
              Finding your matches…
            </Card>
          )}

          {error && (
            <Card className="rounded-2xl p-8 text-center text-sm text-destructive">{error}</Card>
          )}

          {matches && matches.length === 0 && (
            <Card className="rounded-2xl p-8 text-center text-sm text-muted-foreground">
              No matches yet. Check back once more members join.
            </Card>
          )}

          {matches && matches.length > 0 && (
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {matches.map((match) => (
                <ResultCard
                  key={match.profileId}
                  profileId={match.profileId}
                  fullName={match.fullName}
                  age={match.age}
                  city={match.city}
                  primaryPhotoUrl={match.primaryPhotoUrl}
                  badgeLabel={`${Math.round(match.score)}% match`}
                  badgeVariant="primary"
                />
              ))}
            </div>
          )}
        </div>
      </main>
    </>
  );
}
