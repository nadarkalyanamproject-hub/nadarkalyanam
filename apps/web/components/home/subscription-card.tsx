'use client';

import Link from 'next/link';
import type { MembershipPlanResponse, MyMembershipResponse } from '@nadar-kalyanam/schemas';
import { Check, Crown } from 'lucide-react';
import { daysLeft, daysLeftLabel, discountPercent, durationLabel, formatPlanDate, formatPrice } from '../../lib/membership';
import { useMembershipPlans } from '../../lib/use-membership-plans';

// Home page sidebar: the member's own plan at a glance, from
// GET /me/membership (loaded by the home page, which also uses it to decide
// whether to show the "Become a paid member" section).
export function SubscriptionCard({ me, error }: { me: MyMembershipResponse | null; error: string | null }) {
  return (
    <div className="rounded-2xl border border-nk-line bg-white p-5 shadow-xs" data-testid="home-subscription">
      <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-nk-subtle">
        <Crown className="h-3.5 w-3.5 text-nk-gold" />
        Subscription
      </div>

      {error ? (
        <p role="alert" className="mt-3 text-sm text-nk-maroon">
          {error}
        </p>
      ) : !me ? (
        <div className="mt-3 space-y-2" aria-hidden="true">
          <div className="h-5 w-32 rounded bg-[#F3EDE6]" />
          <div className="h-3 w-full rounded bg-[#F3EDE6]" />
          <div className="h-3 w-2/3 rounded bg-[#F3EDE6]" />
        </div>
      ) : me.status === 'ACTIVE' && me.plan ? (
        <ActivePlan me={me} plan={me.plan} />
      ) : (
        <FreePlan me={me} />
      )}
    </div>
  );
}

function ActivePlan({ me, plan }: { me: MyMembershipResponse; plan: NonNullable<MyMembershipResponse['plan']> }) {
  const left = me.expiresAt ? daysLeft(me.expiresAt) : null;
  return (
    <>
      <h3 className="mt-2 text-lg font-bold text-nk-ink">{plan.name}</h3>
      {me.expiresAt && left !== null && (
        <p className="mt-0.5 text-xs text-nk-muted">
          Active until {formatPlanDate(me.expiresAt)}{' '}
          <span className={left <= 7 ? 'font-semibold text-[#B45309]' : ''}>({daysLeftLabel(left)})</span>
        </p>
      )}

      <dl className="mt-4 space-y-2 border-t border-nk-line-soft pt-4 text-xs">
        <div className="flex justify-between gap-2">
          <dt className="text-nk-muted">Interests</dt>
          <dd className="font-semibold text-nk-ink">Unlimited</dd>
        </div>
        <div className="flex justify-between gap-2">
          <dt className="text-nk-muted">Phone unlocks left</dt>
          <dd className="font-semibold text-nk-ink">
            {me.phoneUnlocksRemaining === null ? 'Unlimited' : me.phoneUnlocksRemaining}
          </dd>
        </div>
      </dl>

      <Link
        href="/membership"
        className="mt-5 block w-full rounded-lg border border-[#E7CDAF] py-2 text-center text-xs font-semibold text-nk-maroon transition-colors hover:bg-[#FFF8F0]"
      >
        Manage membership
      </Link>
    </>
  );
}

// The lowest-priced self-serve plan: what the sidebar promotes to a member
// without one.
function entryPlan(plans: MembershipPlanResponse[] | null): MembershipPlanResponse | null {
  const selfServe = (plans ?? []).filter((p) => !p.isAssisted);
  return selfServe.reduce<MembershipPlanResponse | null>((low, p) => (!low || p.priceInPaise < low.priceInPaise ? p : low), null);
}

function FreePlan({ me }: { me: MyMembershipResponse }) {
  const plan = entryPlan(useMembershipPlans());
  const used = me.interestsUsedThisMonth ?? 0;
  const limit = me.interestsLimit;
  const percent = limit ? Math.min(100, Math.round((used / limit) * 100)) : 0;
  const off = plan ? discountPercent(plan.priceInPaise, plan.originalPriceInPaise) : null;
  // The plan's own features that work today; the general list until it loads.
  const benefits = plan
    ? plan.features.filter((f) => f.available).slice(0, 4).map((f) => f.label)
    : ['Unlimited interests', 'View phone numbers of your connections', 'Priority placement in search'];

  return (
    <>
      <h3 className="mt-2 text-lg font-bold text-nk-ink" data-testid="home-upgrade-title">
        {plan ? `Upgrade to ${plan.name}` : 'Choose a plan'}
      </h3>
      {plan ? (
        <p className="mt-0.5 text-xs text-nk-muted" data-testid="home-upgrade-price">
          From <span className="text-base font-extrabold text-nk-ink">{formatPrice(plan.priceInPaise)}</span> for{' '}
          {durationLabel(plan.durationDays)}
          {off !== null && plan.originalPriceInPaise !== null && (
            <>
              {' '}
              <span className="text-nk-subtle line-through">{formatPrice(plan.originalPriceInPaise)}</span>{' '}
              <span className="font-bold text-[#2E7D5B]">{off}% OFF</span>
            </>
          )}
        </p>
      ) : (
        <p className="mt-0.5 text-xs text-nk-muted">A plan lets you view profiles, search and connect with members.</p>
      )}

      {limit !== null && (
        <div className="mt-4 border-t border-nk-line-soft pt-4">
          <div className="flex justify-between text-xs">
            <span className="text-nk-muted">Interests this month</span>
            <span className="font-semibold text-nk-ink">
              {used} of {limit}
            </span>
          </div>
          <div
            className="mt-2 h-1.5 w-full overflow-hidden rounded-sm bg-[#F3EDE6]"
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={limit}
            aria-valuenow={used}
            aria-label="Interests used this month"
          >
            <div
              className={`h-full rounded-sm ${used >= limit ? 'bg-[#B91C1C]' : 'bg-[#15803D]'}`}
              style={{ width: `${percent}%` }}
            />
          </div>
          {me.resetsAt && <p className="mt-1.5 text-[11px] text-nk-subtle">Resets on {formatPlanDate(me.resetsAt)}</p>}
        </div>
      )}

      <p className="mt-4 text-[11px] font-semibold uppercase tracking-wider text-nk-subtle">{plan ? `With ${plan.name}` : 'With a plan'}</p>
      <ul className="mt-2 space-y-1.5 text-xs text-[#4A3B33]">
        {benefits.map((b) => (
          <li key={b} className="flex items-start gap-1.5">
            <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-nk-gold" />
            {b}
          </li>
        ))}
      </ul>

      <Link
        href="/membership"
        className="mt-5 block w-full rounded-lg bg-nk-maroon py-2.5 text-center text-xs font-semibold text-white transition-colors hover:bg-nk-maroon-deep"
        data-testid="home-upgrade-cta"
      >
        {plan ? `Upgrade to ${plan.name}` : 'Choose a plan'}
      </Link>
      <Link href="/membership" className="mt-2 block text-center text-[11px] font-semibold text-nk-maroon underline-offset-2 hover:underline">
        Compare all plans
      </Link>
    </>
  );
}
