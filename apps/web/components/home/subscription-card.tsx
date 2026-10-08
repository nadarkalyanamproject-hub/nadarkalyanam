'use client';

import Link from 'next/link';
import type { MyMembershipResponse } from '@nadar-kalyanam/schemas';
import { Crown } from 'lucide-react';
import { daysLeft, daysLeftLabel, formatPlanDate } from '../../lib/membership';

// Home page sidebar: the member's own plan at a glance, from
// GET /me/membership (loaded by the home page, which also uses it to decide
// whether to show the "Become a paid member" section).
export function SubscriptionCard({ me, error }: { me: MyMembershipResponse | null; error: string | null }) {
  return (
    <div className="rounded-2xl border border-[#E8DCCF] bg-white p-5 shadow-xs" data-testid="home-subscription">
      <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-[#8A7A70]">
        <Crown className="h-3.5 w-3.5 text-[#C89B3C]" />
        Subscription
      </div>

      {error ? (
        <p role="alert" className="mt-3 text-sm text-[#7B1118]">
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
      <h3 className="mt-2 text-lg font-bold text-[#2B1515]">{plan.name}</h3>
      {me.expiresAt && left !== null && (
        <p className="mt-0.5 text-xs text-[#73645C]">
          Active until {formatPlanDate(me.expiresAt)}{' '}
          <span className={left <= 7 ? 'font-semibold text-[#B45309]' : ''}>({daysLeftLabel(left)})</span>
        </p>
      )}

      <dl className="mt-4 space-y-2 border-t border-[#F3EBDD] pt-4 text-xs">
        <div className="flex justify-between gap-2">
          <dt className="text-[#73645C]">Interests</dt>
          <dd className="font-semibold text-[#2B1515]">Unlimited</dd>
        </div>
        <div className="flex justify-between gap-2">
          <dt className="text-[#73645C]">Phone unlocks left</dt>
          <dd className="font-semibold text-[#2B1515]">
            {me.phoneUnlocksRemaining === null ? 'Unlimited' : me.phoneUnlocksRemaining}
          </dd>
        </div>
      </dl>

      <Link
        href="/membership"
        className="mt-5 block w-full rounded-lg border border-[#E7CDAF] py-2 text-center text-xs font-semibold text-[#7B1118] transition-colors hover:bg-[#FFF8F0]"
      >
        Manage membership
      </Link>
    </>
  );
}

function FreePlan({ me }: { me: MyMembershipResponse }) {
  const used = me.interestsUsedThisMonth ?? 0;
  const limit = me.interestsLimit;
  const percent = limit ? Math.min(100, Math.round((used / limit) * 100)) : 0;

  return (
    <>
      <h3 className="mt-2 text-lg font-bold text-[#2B1515]">No active plan</h3>
      <p className="mt-0.5 text-xs text-[#73645C]">A plan lets you view profiles, search and connect with members.</p>

      {limit !== null && (
        <div className="mt-4 border-t border-[#F3EBDD] pt-4">
          <div className="flex justify-between text-xs">
            <span className="text-[#73645C]">Interests this month</span>
            <span className="font-semibold text-[#2B1515]">
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
          {me.resetsAt && <p className="mt-1.5 text-[11px] text-[#8A7A70]">Resets on {formatPlanDate(me.resetsAt)}</p>}
        </div>
      )}

      <p className="mt-4 text-[11px] font-semibold uppercase tracking-wider text-[#8A7A70]">With a plan</p>
      <ul className="mt-2 space-y-1.5 text-xs text-[#4A3B33]">
        <li>Unlimited interests</li>
        <li>View phone numbers of your connections</li>
        <li>Priority placement in search</li>
      </ul>

      <Link
        href="/membership"
        className="mt-5 block w-full rounded-lg bg-[#7B1118] py-2 text-center text-xs font-semibold text-white transition-colors hover:bg-[#650B11]"
      >
        Choose a plan
      </Link>
    </>
  );
}
