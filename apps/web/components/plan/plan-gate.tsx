'use client';

import { useEffect, useState, type ReactNode } from 'react';
import Link from 'next/link';
import type { MyMembershipResponse } from '@nadar-kalyanam/schemas';
import { Crown } from 'lucide-react';
import { useRegistration } from '../../app/providers/registration-provider';
import { getMyMembership } from '../../lib/api-client';
import { formatPlanDate } from '../../lib/membership';
import { AppHeader } from '../app-header';

// One membership lookup per token, reused for a minute so moving between
// gated pages doesn't refetch it every time.
const CACHE_MS = 60_000;
let cache: { token: string; at: number; request: Promise<MyMembershipResponse> } | null = null;

function loadMembership(token: string): Promise<MyMembershipResponse> {
  if (!cache || cache.token !== token || Date.now() - cache.at > CACHE_MS) {
    const request = getMyMembership(token);
    cache = { token, at: Date.now(), request };
    request.catch(() => {
      if (cache?.request === request) cache = null;
    });
  }
  return cache.request;
}

// Wraps every page that needs a plan (search, matches, other members'
// profiles, interests, messages, unlocked contacts, home). When the server
// requires a plan and the member has none, shows the "choose a plan" screen
// instead of the page. The API enforces the same rule (PlanRequiredGuard);
// if this lookup fails the page renders and the API still refuses.
export function PlanGate({ children }: { children: ReactNode }) {
  const { data, hydrated } = useRegistration();
  const token = data.accessToken;
  const [state, setState] = useState<{ token: string; me: MyMembershipResponse | null } | null>(null);

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    loadMembership(token)
      .then((me) => {
        if (!cancelled) setState({ token, me });
      })
      .catch(() => {
        if (!cancelled) setState({ token, me: null });
      });
    return () => {
      cancelled = true;
    };
  }, [token]);

  if (!hydrated) return null;
  // Signed out: the page's own auth handling takes over.
  if (!token) return <>{children}</>;
  if (!state || state.token !== token) return <AppHeader />;
  if (state.me?.accessLocked) return <PlanRequiredScreen me={state.me} />;
  return <>{children}</>;
}

function PlanRequiredScreen({ me }: { me: MyMembershipResponse }) {
  return (
    <>
      <AppHeader />
      <main className="min-h-[70vh] bg-nk-ivory px-4 py-16 sm:px-6" data-testid="plan-required">
        <div className="mx-auto max-w-lg rounded-2xl border border-nk-line bg-white p-8 text-center shadow-xs">
          <Crown className="mx-auto h-8 w-8 text-nk-gold" />
          <h1 className="mt-4 font-[family-name:var(--font-heading,serif)] text-2xl font-bold text-nk-ink">
            Choose a membership plan to continue
          </h1>
          <p className="mt-3 text-sm leading-relaxed text-nk-ink-soft">
            Nadar Kalyanam is a members-only community. A plan lets you view member profiles, search for matches, send
            interests and chat with your connections.
          </p>
          {me.lastEnded && (
            <p className="mt-3 text-sm text-nk-maroon">
              Your {me.lastEnded.planName} plan ended on {formatPlanDate(me.lastEnded.endedAt)}. Renew to pick up where
              you left off.
            </p>
          )}
          <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:justify-center">
            <Link
              href="/membership"
              className="rounded-lg bg-nk-maroon px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-nk-maroon-deep"
            >
              See membership plans
            </Link>
            <Link
              href="/profile"
              className="rounded-lg border border-[#E7CDAF] px-5 py-2.5 text-sm font-semibold text-nk-maroon transition-colors hover:bg-[#FFF8F0]"
            >
              Complete your profile
            </Link>
          </div>
        </div>
      </main>
    </>
  );
}
