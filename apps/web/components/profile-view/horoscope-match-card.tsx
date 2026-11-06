'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { type HoroscopeMatchResponse, nakshatraLabel, rasiLabel } from '@nadar-kalyanam/schemas';
import { Check, Sparkles, X } from 'lucide-react';
import { useRegistration } from '../../app/providers/registration-provider';
import { ApiError, completeTestPayment, createHoroscopeMatchOrder, getHoroscopeMatch } from '../../lib/api-client';
import { TEST_PAYMENTS, openRazorpayCheckout, waitForPaid } from '../../lib/checkout';
import { formatPrice } from '../../lib/membership';

const VERDICT: Record<Extract<HoroscopeMatchResponse, { status: 'READY' }>['verdict'], { label: string; tone: string }> = {
  GOOD: { label: 'Good match', tone: 'bg-[#EAF5EC] text-[#1F6B33]' },
  AVERAGE: { label: 'Average match', tone: 'bg-nk-saffron-soft text-nk-saffron-text' },
  NOT_RECOMMENDED: { label: 'Not recommended', tone: 'bg-[#FBEAEA] text-nk-maroon' },
};

type Pay = { kind: 'idle' } | { kind: 'busy' } | { kind: 'error'; message: string };

// Horoscope matching (the ten poruthams) with this member, ₹99 per pair for
// everyone. Bought once, the report stays on this profile.
export function HoroscopeMatchCard({ profileId, memberName }: { profileId: string; memberName: string }) {
  const { data } = useRegistration();
  const token = data.accessToken;
  const [match, setMatch] = useState<HoroscopeMatchResponse | null>(null);
  const [pay, setPay] = useState<Pay>({ kind: 'idle' });
  // Bumped after a purchase to load the report.
  const [version, setVersion] = useState(0);

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    getHoroscopeMatch(token, profileId)
      .then((result) => !cancelled && setMatch(result))
      .catch(() => !cancelled && setMatch(null));
    return () => {
      cancelled = true;
    };
  }, [token, profileId, version]);

  async function buy() {
    if (!token) return;
    setPay({ kind: 'busy' });
    try {
      const order = await createHoroscopeMatchOrder(token, profileId);
      if (order.checkoutParams) {
        if ((await openRazorpayCheckout(order.checkoutParams)) === 'dismissed') return setPay({ kind: 'idle' });
      } else if (TEST_PAYMENTS) {
        await completeTestPayment(token, order.id);
      } else {
        return setPay({ kind: 'error', message: 'Online payment is opening soon.' });
      }
      if (!(await waitForPaid(token, order.id))) {
        return setPay({ kind: 'error', message: 'Your payment is being confirmed. Open this profile again in a minute.' });
      }
      setPay({ kind: 'idle' });
      setVersion((v) => v + 1);
    } catch (err) {
      setPay({ kind: 'error', message: err instanceof ApiError ? err.message : 'Could not start the payment. Please try again.' });
    }
  }

  if (!match) return null;
  return (
    <div className="rounded-3xl border border-nk-line-soft bg-white p-6 sm:p-7 shadow-[0_4px_24px_rgba(0,0,0,0.02)]" data-testid="horoscope-match-card">
      <div className="flex items-center gap-2.5 border-b border-nk-line-soft pb-4">
        <Sparkles className="h-5 w-5 text-nk-gold" aria-hidden="true" />
        <div>
          <h2 className="font-[family-name:var(--font-playfair)] font-serif text-lg sm:text-xl font-bold text-[#1E293B]">Horoscope match</h2>
          <p className="text-xs text-nk-muted">The ten poruthams between you and {memberName}</p>
        </div>
      </div>

      {match.status === 'UNAVAILABLE' && (
        <div className="mt-4 text-sm text-nk-ink-soft" data-testid="match-unavailable">
          <p>{match.message}</p>
          {match.reason === 'ADD_YOUR_HOROSCOPE' && (
            <Link href="/profile#horoscope" className="mt-2 inline-block font-semibold text-nk-maroon underline">
              Add my horoscope
            </Link>
          )}
        </div>
      )}

      {match.status === 'LOCKED' && (
        <div className="mt-4" data-testid="match-locked">
          <p className="text-sm text-nk-ink-soft">
            See all ten poruthams (Dinam, Ganam, Rajju, Vedhai and more), the score out of 10 and whether the match is
            recommended.
          </p>
          <button
            type="button"
            onClick={() => void buy()}
            disabled={pay.kind === 'busy'}
            className="mt-4 rounded-lg bg-nk-maroon px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-nk-maroon-deep disabled:opacity-60"
          >
            {pay.kind === 'busy' ? 'Please wait…' : `Check match for ${formatPrice(match.priceInPaise)}`}
          </button>
          {TEST_PAYMENTS && <p className="mt-2 text-[11px] text-nk-muted">Development: no real payment is taken.</p>}
          {pay.kind === 'error' && <p className="mt-2 text-sm text-nk-maroon">{pay.message}</p>}
        </div>
      )}

      {match.status === 'READY' && (
        <div className="mt-4" data-testid="match-ready">
          <div className="flex flex-wrap items-center gap-3">
            <span className="font-[family-name:var(--font-heading,serif)] text-3xl font-bold text-nk-maroon">{match.score}/10</span>
            <span className={`rounded-md px-2.5 py-1 text-xs font-bold ${VERDICT[match.verdict].tone}`}>{VERDICT[match.verdict].label}</span>
          </div>
          <dl className="mt-3 grid grid-cols-1 gap-2 text-xs text-nk-ink-soft sm:grid-cols-2">
            {([['Bride', match.bride], ['Groom', match.groom]] as const).map(([role, side]) => (
              <div key={role} className="rounded-xl border border-nk-line-soft bg-[#FDFBF7] p-3">
                <dt className="font-semibold uppercase tracking-wider text-nk-muted">
                  {role}: {side.name}
                </dt>
                <dd className="mt-0.5 text-sm font-semibold text-nk-ink">
                  {nakshatraLabel(side.nakshatra)}, {rasiLabel(side.rasi)}
                </dd>
              </div>
            ))}
          </dl>
          <ul className="mt-4 divide-y divide-nk-line-soft">
            {match.results.map((r) => (
              <li key={r.key} className="flex items-start gap-3 py-2.5">
                {r.matched ? (
                  <Check className="mt-0.5 h-4 w-4 shrink-0 text-[#1F6B33]" aria-label="Matches" />
                ) : (
                  <X className="mt-0.5 h-4 w-4 shrink-0 text-nk-maroon" aria-label="Doesn't match" />
                )}
                <div>
                  <p className="text-sm font-semibold text-nk-ink">
                    {r.label} <span className="font-normal text-nk-muted">- {r.about}</span>
                  </p>
                  <p className="text-xs text-nk-ink-soft">{r.note}</p>
                </div>
              </li>
            ))}
          </ul>
          <p className="mt-3 text-[11px] leading-relaxed text-nk-muted">
            Worked out from both birth stars and rasis. Rajju and Vedhai are treated as essential. Please also consult
            your family astrologer before deciding.
          </p>
        </div>
      )}
    </div>
  );
}
