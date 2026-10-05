'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { MembershipPlanResponse, MyMembershipResponse, OrderResponse, PlanFeature } from '@nadar-kalyanam/schemas';
import { Card } from '@/components/ui/card';
import { ContactInfoCard } from '@/components/ui/contact-info-card';
import { ComingSoonPill } from '@/components/ui/coming-soon-note';
import { AppHeader } from '../../components/app-header';
import { ApiError, createOrder, getMyMembership, listMembershipPlans } from '../../lib/api-client';
import { durationLabel, formatPlanDate, formatPrice, whatsappHref } from '../../lib/membership';
import { useRegistration } from '../providers/registration-provider';
import { Check, Crown, Lock, MessageCircle, ShieldCheck, Sparkles } from 'lucide-react';

const VIP_WHATSAPP = whatsappHref(
  process.env.NEXT_PUBLIC_WHATSAPP_NUMBER,
  'Hi, I am interested in the Nadar Kalyanam VIP Assisted service',
);

type PlansState = { kind: 'loading' } | { kind: 'error'; message: string } | { kind: 'loaded'; plans: MembershipPlanResponse[] };
type OrderState =
  | { kind: 'idle' }
  | { kind: 'creating'; planId: string }
  | { kind: 'created'; order: OrderResponse; planName: string }
  | { kind: 'unavailable' }
  | { kind: 'error'; message: string };

// One feature line. Features the product can't deliver yet are shown as
// Coming Soon, never with a checkmark.
function FeatureLine({ feature, plan, dark = false }: { feature: PlanFeature; plan: MembershipPlanResponse; dark?: boolean }) {
  return (
    <li className={`flex items-start gap-2.5 text-xs sm:text-sm ${dark ? 'text-[#E2D2C8]' : 'text-[#443833]'}`} data-testid="plan-feature" data-available={feature.available}>
      <span
        className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full ${
          feature.available ? 'bg-[#FAF5EC] text-[#C89B3C]' : dark ? 'bg-white/10 text-[#E2D2C8]/60' : 'bg-[#F4F0EA] text-[#A89B90]'
        }`}
      >
        {feature.available ? <Check className="h-3 w-3 stroke-[2.5]" /> : <Lock className="h-2.5 w-2.5" />}
      </span>
      <span className="flex flex-wrap items-center gap-1.5">
        <span className={feature.available ? '' : dark ? 'text-[#E2D2C8]/75' : 'text-[#73645C]'}>{feature.label}</span>
        {!feature.available && <ComingSoonPill />}
        {feature.key === 'phoneNumbers' && <ContactInfoCard phoneUnlockLimit={plan.phoneUnlockLimit} position="top" align="left" />}
      </span>
    </li>
  );
}

export default function MembershipPage() {
  const router = useRouter();
  const { data, hydrated } = useRegistration();
  const [plansState, setPlansState] = useState<PlansState>({ kind: 'loading' });
  const [membership, setMembership] = useState<MyMembershipResponse | null>(null);
  const [orderState, setOrderState] = useState<OrderState>({ kind: 'idle' });
  const accessToken = data.accessToken;

  // State is only set once the request settles (the initial state is
  // already "loading"; Try again sets it itself).
  const fetchPlans = useCallback(() => {
    listMembershipPlans()
      .then((result) => setPlansState({ kind: 'loaded', plans: [...result.items].sort((a, b) => a.sortOrder - b.sortOrder) }))
      .catch((err: unknown) =>
        setPlansState({ kind: 'error', message: err instanceof ApiError ? err.message : 'Could not load membership plans.' }),
      );
  }, []);

  useEffect(() => {
    fetchPlans();
  }, [fetchPlans]);

  function loadPlans() {
    setPlansState({ kind: 'loading' });
    fetchPlans();
  }

  useEffect(() => {
    if (!hydrated || !accessToken) return;
    let cancelled = false;
    getMyMembership(accessToken)
      .then((result) => {
        if (!cancelled) setMembership(result);
      })
      .catch(() => {
        // The plans still show; only the "your plan" line is missing.
      });
    return () => {
      cancelled = true;
    };
  }, [hydrated, accessToken]);

  async function handleChoose(plan: MembershipPlanResponse) {
    if (!accessToken) {
      // Not signed in: open the login modal, then come back here.
      router.push('/?login=true&returnTo=%2Fmembership');
      return;
    }
    setOrderState({ kind: 'creating', planId: plan.id });
    try {
      const order = await createOrder(accessToken, { planId: plan.id });
      setOrderState({ kind: 'created', order, planName: plan.name });
    } catch (err) {
      if (err instanceof ApiError && err.status === 503) setOrderState({ kind: 'unavailable' });
      else setOrderState({ kind: 'error', message: err instanceof ApiError ? err.message : 'Could not start your order. Please try again.' });
    }
  }

  if (!hydrated) return null;

  const paymentsUnavailable = orderState.kind === 'unavailable';
  const plans = plansState.kind === 'loaded' ? plansState.plans : [];
  const selfServe = plans.filter((plan) => !plan.isAssisted);
  const assisted = plans.filter((plan) => plan.isAssisted);

  function chooseLabel(plan: MembershipPlanResponse, base: string) {
    if (paymentsUnavailable) return 'Online payment opening soon';
    if (orderState.kind === 'creating' && orderState.planId === plan.id) return 'Processing…';
    return base;
  }

  return (
    <div className="min-h-screen bg-[#FFFDF9] text-[#2B1515] flex flex-col">
      <AppHeader />

      <main className="flex-1 w-full max-w-6xl mx-auto px-4 py-10 sm:px-6 lg:px-8 space-y-10">
        <div className="text-center space-y-2 max-w-2xl mx-auto">
          <p className="text-xs font-bold tracking-[0.2em] text-[#680A0E] uppercase">MEMBERSHIP</p>
          <h1 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold text-[#2B1515] tracking-tight font-[family-name:var(--font-heading,serif)]">
            Your Journey to Finding the Right Match
          </h1>
          <p className="text-xs sm:text-sm text-[#73645C]">
            Choose a membership that fits your search. Features marked Coming Soon aren&apos;t available yet on any plan.
          </p>
        </div>

        {/* The member's own plan, from GET /me/membership. */}
        {accessToken && membership && (
          <Card className="mx-auto max-w-2xl rounded-2xl border border-[#EADBBD] bg-[#FFFBF0] p-4 text-center text-sm" data-testid="my-membership">
            {membership.plan && membership.expiresAt ? (
              <>
                <p className="font-bold text-[#680A0E]">
                  Your plan: {membership.plan.name}
                </p>
                <p className="mt-0.5 text-xs text-[#73645C]">
                  Active until {formatPlanDate(membership.expiresAt)}
                  {membership.paidThroughAt && membership.paidThroughAt !== membership.expiresAt
                    ? ` · renewal already paid through ${formatPlanDate(membership.paidThroughAt)}`
                    : ''}
                  . A plan bought now starts when this one ends.
                </p>
              </>
            ) : (
              <p className="text-[#73645C]">
                You&apos;re on the <span className="font-semibold text-[#2B1515]">free membership</span>.
              </p>
            )}
          </Card>
        )}

        {plansState.kind === 'loading' && <p className="text-center text-sm text-[#73645C]">Loading plans…</p>}
        {plansState.kind === 'error' && (
          <Card className="mx-auto max-w-xl rounded-xl border border-red-200 bg-red-50 p-4 text-center text-sm text-[#94151C]" role="alert">
            {plansState.message}{' '}
            <button type="button" onClick={loadPlans} className="font-semibold underline">
              Try again
            </button>
          </Card>
        )}

        {/* Order feedback. No payment gateway exists yet, so nothing is ever
            charged, and the page says so. */}
        {paymentsUnavailable && (
          <Card className="mx-auto max-w-2xl rounded-xl border border-[#EADBBD] bg-[#FFFBF0] p-4 text-center text-xs sm:text-sm text-[#5A493E]" data-testid="payments-unavailable" role="status">
            Online payment is opening soon. You haven&apos;t been charged, and no plan was started.
          </Card>
        )}
        {orderState.kind === 'error' && (
          <Card className="mx-auto max-w-2xl rounded-xl border border-red-200 bg-red-50 p-4 text-xs sm:text-sm text-[#94151C]" role="alert">
            {orderState.message}
          </Card>
        )}
        {orderState.kind === 'created' && (
          <Card className="mx-auto max-w-2xl rounded-xl border border-[#EADBBD] bg-[#FFFBF0] p-5 text-xs sm:text-sm" data-testid="order-created" role="status">
            <p className="font-bold text-[#680A0E]">Order recorded for {orderState.planName}</p>
            <p className="mt-1 text-[#73645C]">
              Order <code className="font-mono">{orderState.order.id}</code> · {formatPrice(orderState.order.amountInPaise)} · {orderState.order.status}
            </p>
            <p className="mt-1.5 text-[#8C7B73]">
              Online payment isn&apos;t connected yet, so you haven&apos;t been charged and your plan hasn&apos;t started.
            </p>
          </Card>
        )}

        {selfServe.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5 lg:gap-6 items-stretch">
            {selfServe.map((plan) => (
              <div
                key={plan.id}
                data-testid="plan-card"
                data-plan-code={plan.code}
                className="relative flex flex-col justify-between rounded-2xl border border-[#E8DCCF] bg-white shadow-sm transition-all duration-200 hover:border-[#D6A33A] hover:shadow-md"
              >
                <div className="flex flex-1 flex-col justify-between p-5 sm:p-6">
                  <div>
                    <div className="border-b border-[#F4ECE3] pb-3 text-center">
                      <h2 className="text-lg sm:text-xl font-bold uppercase tracking-wide text-[#2B1515]">{plan.name}</h2>
                      <p className="mt-0.5 text-[11px] font-bold uppercase tracking-wider text-[#8C7B73]">{durationLabel(plan.durationDays)}</p>
                    </div>
                    <div className="py-4 text-center">
                      <span className="text-3xl sm:text-4xl font-extrabold tracking-tight text-[#2B1515]" data-testid="plan-price">
                        {formatPrice(plan.priceInPaise)}
                      </span>
                    </div>
                    <ul className="space-y-2.5 pb-4 pt-1">
                      {plan.features.map((feature) => (
                        <FeatureLine key={feature.key} feature={feature} plan={plan} />
                      ))}
                    </ul>
                  </div>
                  <div className="border-t border-[#F4ECE3] pt-3">
                    <button
                      type="button"
                      data-testid="choose-plan"
                      disabled={paymentsUnavailable || orderState.kind === 'creating'}
                      onClick={() => void handleChoose(plan)}
                      className="w-full cursor-pointer rounded-xl border border-[#DFC392] bg-[#FDF9F3] px-4 py-2.5 text-xs sm:text-sm font-bold text-[#680A0E] shadow-xs transition-all duration-150 hover:bg-[#F7EBDC] disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {chooseLabel(plan, 'Choose Plan')}
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {assisted.map((plan) => (
          <section
            key={plan.id}
            data-testid="plan-card"
            data-plan-code={plan.code}
            className="relative overflow-hidden rounded-3xl border-2 border-[#D4AF37]/50 bg-gradient-to-br from-[#2D0D12] via-[#3E1118] to-[#24080C] p-6 sm:p-8 lg:p-10 text-white shadow-xl"
          >
            <div className="relative z-10 flex flex-col items-stretch justify-between gap-8 lg:flex-row">
              <div className="max-w-2xl flex-1 space-y-4">
                <div className="inline-flex items-center gap-2 rounded-full border border-[#D4AF37]/40 bg-[#D4AF37]/20 px-3.5 py-1 text-xs font-bold uppercase tracking-widest text-[#FDE59C]">
                  <Crown className="h-4 w-4 text-[#D4AF37]" />
                  <span>Assisted service</span>
                </div>
                <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight font-[family-name:var(--font-heading,serif)]">{plan.name}</h2>
                <p className="text-xs sm:text-sm leading-relaxed text-[#E2D2C8]">
                  A staff-assisted plan. The assisted services below aren&apos;t running yet, so they&apos;re marked Coming Soon.
                </p>
                <ul className="space-y-2.5 pt-1">
                  {plan.features.map((feature) => (
                    <FeatureLine key={feature.key} feature={feature} plan={plan} dark />
                  ))}
                </ul>
              </div>

              <div className="flex w-full shrink-0 flex-col justify-between space-y-4 rounded-2xl border border-[#D4AF37]/40 bg-white/10 p-6 text-center backdrop-blur-md lg:w-80">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-[#E2D2C8]/80">{durationLabel(plan.durationDays)}</p>
                  <div className="my-3 border-y border-white/15 py-4 text-3xl sm:text-4xl font-extrabold tracking-tight text-[#FDE59C]" data-testid="plan-price">
                    {formatPrice(plan.priceInPaise)}
                  </div>
                </div>
                <div className="space-y-2.5">
                  <button
                    type="button"
                    data-testid="choose-plan"
                    disabled={paymentsUnavailable || orderState.kind === 'creating'}
                    onClick={() => void handleChoose(plan)}
                    className="w-full cursor-pointer rounded-xl bg-gradient-to-r from-[#D4AF37] to-[#F1D278] px-4 py-2.5 text-xs sm:text-sm font-bold text-[#2D0D12] shadow-md transition-all hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {chooseLabel(plan, `Choose ${plan.name}`)}
                  </button>
                  {VIP_WHATSAPP && (
                    <a
                      href={VIP_WHATSAPP}
                      target="_blank"
                      rel="noopener noreferrer"
                      data-testid="vip-whatsapp"
                      className="flex w-full items-center justify-center gap-1.5 rounded-xl border border-white/20 bg-white/5 px-3 py-2 text-xs font-semibold text-white/90 transition-colors hover:border-white/40 hover:text-white"
                    >
                      <MessageCircle className="h-3.5 w-3.5 text-[#25D366]" />
                      <span>Enquire via WhatsApp</span>
                    </a>
                  )}
                </div>
              </div>
            </div>
          </section>
        ))}

        {/* What every member already has, today — free. */}
        <div className="pt-2">
          <div className="mb-6 space-y-1 text-center">
            <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-[#2B1515]">Included for every member today</h2>
            <p className="text-xs text-[#73645C]">These work now, with or without a paid plan.</p>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            {[
              { icon: ShieldCheck, title: 'OTP-confirmed mobile numbers', text: 'Every account signs in with a one-time code sent to its mobile number.' },
              { icon: MessageCircle, title: 'Messaging your connections', text: 'Once an interest is accepted you can message each other, with no limit.' },
              { icon: Sparkles, title: 'Privacy & blocking', text: 'Hide your profile from lists, and block anyone. Your phone number is never shown to other members.' },
            ].map(({ icon: Icon, title, text }) => (
              <div key={title} className="flex items-start gap-3 rounded-xl border border-[#E8DCCF] bg-white p-4 shadow-xs">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-[#EEDFCD] bg-[#FAF5EC] text-[#C89B3C]">
                  <Icon className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-xs sm:text-sm font-bold text-[#2B1515]">{title}</h3>
                  <p className="mt-0.5 text-xs leading-relaxed text-[#73645C]">{text}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </main>
    </div>
  );
}
