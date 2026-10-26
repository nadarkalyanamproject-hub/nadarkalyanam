'use client';

import { useEffect, useState } from 'react';
import type { PublicProfileSummary } from '@nadar-kalyanam/schemas';
import { Card } from '@nadar-kalyanam/ui';
import { AppHeader } from '../../components/app-header';
import { ProfileCard } from '../../components/browse/profile-card';
import { ApiError, listProfiles } from '../../lib/api-client';
import { useRegistration } from '../providers/registration-provider';
import { useRequireAuth } from '../../lib/use-require-auth';
import { PlanGate } from '../../components/plan/plan-gate';

function BrowsePageContent() {
  const { ready } = useRequireAuth();
  const { data } = useRegistration();
  const [profiles, setProfiles] = useState<PublicProfileSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!ready || !data.accessToken) return;
    let cancelled = false;
    listProfiles(data.accessToken)
      // Only ever real members: none shows the empty state and a failed call
      // shows the error. Nothing is substituted for either.
      .then((result) => {
        if (!cancelled) setProfiles(result.items);
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof ApiError ? err.message : 'Could not load profiles. Please try again.');
      });
    return () => {
      cancelled = true;
    };
  }, [ready, data.accessToken]);

  if (!ready) return null;

  return (
    <>
      <AppHeader />
      <main className="min-h-screen bg-secondary px-4 py-12">
        <div className="mx-auto flex max-w-5xl flex-col gap-6">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Browse Profiles</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Discover other members and send an interest to start a conversation.
            </p>
          </div>

          {!profiles && !error && (
            <Card className="rounded-2xl p-8 text-center text-sm text-muted-foreground">
              Loading profiles…
            </Card>
          )}

          {error && (
            <Card role="alert" className="rounded-2xl p-8 text-center text-sm text-destructive">
              {error}
            </Card>
          )}

          {profiles && profiles.length === 0 && (
            <Card className="rounded-2xl p-8 text-center text-sm text-muted-foreground" data-testid="browse-empty">
              No profiles to show right now. New members appear here as they join.
            </Card>
          )}

          {profiles && profiles.length > 0 && (
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {profiles.map((profile) => (
                <ProfileCard key={profile.id} profile={profile} />
              ))}
            </div>
          )}
        </div>
      </main>
    </>
  );
}

// Needs a membership plan when the server requires one (see PlanGate).
export default function BrowsePage() {
  return (
    <PlanGate>
      <BrowsePageContent />
    </PlanGate>
  );
}
