'use client';

import { useEffect, useState, type ReactNode } from 'react';
import Link from 'next/link';
import type { MyMembershipResponse } from '@nadar-kalyanam/schemas';
import { CalendarHeart, CheckCircle2, Circle, Crown } from 'lucide-react';
import { useRegistration } from '../../app/providers/registration-provider';
import { getMyMembership } from '../../lib/api-client';
import { daysUntil, formatPlanDate, formatPlanLastDay } from '../../lib/membership';
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
  if (state.me?.preLaunch) return <PreLaunchScreen me={state.me} opensAt={state.me.preLaunch.opensAt} />;
  if (state.me?.accessLocked) return <PlanRequiredScreen me={state.me} />;
  return <>{children}</>;
}

// Before launch day matching is closed for everyone (the API answers
// PRE_LAUNCH): say when it opens and, for campaign sign-ups, how to earn the
// launch offer.
function PreLaunchScreen({ me, opensAt }: { me: MyMembershipResponse; opensAt: string }) {
  const offer = me.launchOffer;
  const days = daysUntil(opensAt);
  return (
    <>
      <AppHeader />
      <main className="min-h-[70vh] bg-nk-ivory px-4 py-16 sm:px-6" data-testid="pre-launch">
        <div className="mx-auto max-w-lg rounded-2xl border border-nk-line bg-white p-8 text-center shadow-xs">
          <CalendarHeart className="mx-auto h-8 w-8 text-nk-gold" />
          <h1 className="mt-4 font-[family-name:var(--font-heading,serif)] text-2xl font-bold text-nk-ink">
            Matching opens on {formatPlanDate(opensAt)}
          </h1>
          <p className="mt-1 text-sm font-semibold text-nk-maroon">
            {days === 1 ? '1 day to go' : `${days} days to go`}
          </p>
          <p className="mt-3 text-sm leading-relaxed text-nk-ink-soft">
            Members are joining now, so there will be real profiles to see from the first day. Until then, complete
            your profile and add photos so the right families can find you.
          </p>

          {offer && (
            <div className="mt-6 rounded-xl border border-nk-line-gold bg-nk-paper p-5 text-left" data-testid="launch-offer">
              <p className="text-sm font-bold text-nk-ink">
                Launch offer: {offer.planName} free, {formatPlanDate(offer.startsAt)} – {formatPlanLastDay(offer.endsAt)}
              </p>
              {offer.earned ? (
                <p className="mt-2 flex items-start gap-2 text-sm text-nk-ink-soft" data-testid="launch-offer-earned">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-nk-maroon" />
                  You have it. Your free {offer.planName} plan starts on {formatPlanDate(offer.startsAt)}.
                </p>
              ) : (
                <>
                  <p className="mt-1 text-sm text-nk-ink-soft">
                    Finish these by {formatPlanLastDay(offer.qualifyBy)} to get it:
                  </p>
                  <ul className="mt-3 space-y-2 text-sm">
                    <OfferStep done={!offer.needs.profile} label="Your profile details" />
                    <OfferStep done={!offer.needs.photo} label="At least one photo" />
                  </ul>
                </>
              )}
            </div>
          )}

          <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:justify-center">
            <Link
              href="/profile"
              className="rounded-lg bg-nk-maroon px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-nk-maroon-deep"
            >
              {offer && !offer.earned ? 'Complete your profile' : 'View your profile'}
            </Link>
          </div>
        </div>
      </main>
    </>
  );
}

function OfferStep({ done, label }: { done: boolean; label: string }) {
  return (
    <li className="flex items-center gap-2" data-done={done}>
      {done ? <CheckCircle2 className="h-4 w-4 text-nk-maroon" /> : <Circle className="h-4 w-4 text-nk-subtle" />}
      <span className={done ? 'text-nk-ink' : 'text-nk-ink-soft'}>{label}</span>
    </li>
  );
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
