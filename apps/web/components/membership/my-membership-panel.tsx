'use client';

import Link from 'next/link';
import type { MyMembershipResponse } from '@nadar-kalyanam/schemas';
import { Card } from '@/components/ui/card';
import { ComingSoonPill } from '@/components/ui/coming-soon-note';
import { daysLeft, daysLeftLabel, formatPlanDate, membershipBanner } from '../../lib/membership';

const STATUS_LABEL = { ACTIVE: 'Active', QUEUED: 'Starts later', EXPIRED: 'Ended', CANCELLED: 'Ended early' } as const;

// The signed-in member's own membership: everything here comes from
// GET /me/membership and is only ever shown to the member themselves.
export function MyMembershipPanel({ me }: { me: MyMembershipResponse }) {
  const banner = membershipBanner(me);

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-3" data-testid="my-membership">
      {banner?.kind === 'EXPIRING' && (
        <Card className="rounded-2xl border border-nk-line-gold bg-[#FFF6E3] p-4 text-sm" data-testid="banner-expiring" role="status">
          <p className="font-semibold text-nk-maroon-deep">
            Your plan ends on {formatPlanDate(banner.expiresAt)} ({daysLeftLabel(banner.daysLeft)}).
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-nk-muted">
            <button type="button" disabled className="cursor-not-allowed rounded-md border border-[#DFC392] bg-white px-4 py-1.5 font-semibold text-nk-subtle">
              Renew online soon
            </button>
            <span>Online payment is opening soon.</span>
          </div>
        </Card>
      )}
      {banner?.kind === 'EXPIRED' && (
        <Card className="rounded-2xl border border-nk-line bg-white p-4 text-sm" data-testid="banner-expired" role="status">
          <p className="font-semibold text-nk-ink">Your {banner.planName} plan ended on {formatPlanDate(banner.endedAt)}.</p>
          <p className="mt-1 text-xs text-nk-ink-soft">
            {me.accessLocked
              ? 'Renew to view member profiles, search, send interests and chat again.'
              : "You don't have a paid plan now, so the monthly interest limit applies again and you can't unlock new phone numbers. Numbers you already unlocked stay visible, unless their owner turns sharing off."}{' '}
            Questions?{' '}
            <Link href="/contact" className="font-semibold text-nk-maroon-deep underline" data-testid="banner-contact-link">
              Contact us
            </Link>
            .
          </p>
        </Card>
      )}
      {banner?.kind === 'CANCELLED' && (
        <Card className="rounded-2xl border border-nk-line bg-white p-4 text-sm" data-testid="banner-cancelled" role="status">
          <p className="font-semibold text-nk-ink">Your {banner.planName} plan was ended on {formatPlanDate(banner.endedAt)}.</p>
          <p className="mt-1 text-xs text-nk-ink-soft">
            {me.accessLocked
              ? 'Choose a plan to view member profiles, search, send interests and chat again.'
              : "You don't have a paid plan now. Numbers you already unlocked stay visible, unless their owner turns sharing off."}{' '}
            If you have questions about this, please{' '}
            <Link href="/contact" className="font-semibold text-nk-maroon-deep underline" data-testid="banner-contact-link">
              contact the Nadar Kalyanam team
            </Link>
            .
          </p>
        </Card>
      )}

      <Card className="rounded-2xl border border-nk-line-gold bg-[#FFFBF0] p-5 text-sm">
        {me.plan && me.expiresAt && me.startedAt ? (
          <>
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <p className="text-base font-bold text-nk-maroon-deep" data-testid="my-plan-name">
                Your plan: {me.plan.name}
              </p>
              <span className="rounded-md bg-emerald-100 px-2 py-0.5 text-[11px] font-semibold text-emerald-800">Active</span>
            </div>
            <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 text-xs sm:grid-cols-4" data-testid="my-plan-dates">
              <div>
                <dt className="text-nk-subtle">Started</dt>
                <dd className="font-semibold text-nk-ink">{formatPlanDate(me.startedAt)}</dd>
              </div>
              <div>
                <dt className="text-nk-subtle">Valid till</dt>
                <dd className="font-semibold text-nk-ink">{formatPlanDate(me.expiresAt)}</dd>
              </div>
              <div>
                <dt className="text-nk-subtle">Time left</dt>
                <dd className="font-semibold text-nk-ink" data-testid="my-days-left">{daysLeftLabel(daysLeft(me.expiresAt))}</dd>
              </div>
              <div>
                <dt className="text-nk-subtle">Phone unlocks</dt>
                <dd className="font-semibold text-nk-ink" data-testid="my-unlocks">
                  {me.phoneUnlocksRemaining === null
                    ? `Unlimited (${me.phoneUnlocksUsed ?? 0} used)`
                    : `${me.phoneUnlocksUsed} of ${me.plan.phoneUnlockLimit} used`}
                </dd>
              </div>
            </dl>
            <p className="mt-2 text-xs text-nk-ink-soft">Interests: unlimited.</p>
            {me.plan.features.length > 0 && (
              <ul className="mt-3 space-y-1.5 text-xs" data-testid="my-benefits">
                {me.plan.features.map((f) => (
                  <li key={f.key} className="flex flex-wrap items-center gap-1.5 text-[#443833]">
                    <span>{f.available ? '✓' : '·'}</span>
                    <span className={f.available ? '' : 'text-nk-muted'}>{f.label}</span>
                    {!f.available && <ComingSoonPill />}
                  </li>
                ))}
              </ul>
            )}
          </>
        ) : (
          <>
            <p className="text-nk-muted" data-testid="my-no-plan">
              {me.accessLocked ? (
                <>
                  You don&apos;t have an active plan. Choose one below to view member profiles, search, send interests and
                  chat.
                </>
              ) : (
                <>You don&apos;t have a paid plan right now.</>
              )}
            </p>
            {!me.accessLocked && me.interestsLimit !== null && me.resetsAt && (
              <p className="mt-1 text-xs text-nk-ink-soft" data-testid="my-interests">
                Interests this month: {me.interestsUsedThisMonth} of {me.interestsLimit} used · more on {formatPlanDate(me.resetsAt)}.
                Phone number unlocks need a paid plan.
              </p>
            )}
          </>
        )}
        <p className="mt-3 text-xs">
          <Link href="/membership/contacts" className="font-semibold text-nk-maroon-deep underline" data-testid="link-contacts">
            My unlocked contacts
          </Link>
        </p>
      </Card>

      {me.queued.length > 0 && (
        <Card className="rounded-2xl border border-nk-line bg-white p-4 text-sm" data-testid="my-queued">
          <p className="font-semibold text-nk-ink">Coming up</p>
          <ul className="mt-1 space-y-1 text-xs text-nk-ink-soft">
            {me.queued.map((q) => (
              <li key={`${q.planCode}-${q.startedAt}`}>
                {q.planName}: starts {formatPlanDate(q.startedAt)}, valid till {formatPlanDate(q.endsAt)}
              </li>
            ))}
          </ul>
        </Card>
      )}

      {me.history.length > 0 && (
        <Card className="rounded-2xl border border-nk-line bg-white p-4 text-sm" data-testid="my-history">
          <p className="font-semibold text-nk-ink">Plan history</p>
          <ul className="mt-2 divide-y divide-nk-line-soft text-xs">
            {me.history.map((h) => (
              <li key={`${h.planCode}-${h.startedAt}`} className="flex flex-wrap justify-between gap-2 py-1.5">
                <span className="font-medium text-nk-ink">{h.planName}</span>
                <span className="text-nk-muted">
                  {formatPlanDate(h.startedAt)} – {formatPlanDate(h.endsAt)} · {h.source === 'GRANTED' ? 'Granted by our team' : 'Purchased'} ·{' '}
                  {STATUS_LABEL[h.status]}
                </span>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}
