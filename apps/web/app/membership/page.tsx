'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import type { MembershipPlanResponse, MyMembershipResponse, OrderResponse, PlanFeature } from '@nadar-kalyanam/schemas';
import { Card } from '@/components/ui/card';
import { ContactInfoCard } from '@/components/ui/contact-info-card';
import { VipEnquiry } from '@/components/membership/vip-enquiry';
import { MyMembershipPanel } from '@/components/membership/my-membership-panel';
import { ComingSoonPill } from '@/components/ui/coming-soon-note';
import { AppHeader } from '../../components/app-header';
import { ApiError, createOrder, getMyMembership, listMembershipPlans } from '../../lib/api-client';
import { discountPercent, durationLabel, formatPrice, whatsappHref } from '../../lib/membership';
import { useRegistration } from '../providers/registration-provider';
import { Check, Crown, EyeOff, Lock, MessageCircle, ShieldCheck, Sparkles } from 'lucide-react';

const VIP_WHATSAPP = whatsappHref(
  process.env.NEXT_PUBLIC_WHATSAPP_NUMBER,
  'Hi, I am interested in the Nadar Kalyanam VIP Assisted service',
);

type PlansState =
  | { kind: 'loading' }
  | { kind: 'error'; message: string }
  | { kind: 'loaded'; plans: MembershipPlanResponse[]; requirePaidPlan: boolean };
type OrderState =
  | { kind: 'idle' }
  | { kind: 'creating'; planId: string }
  | { kind: 'created'; order: OrderResponse; planName: string }
  | { kind: 'unavailable' }
  | { kind: 'error'; message: string };

// The highlighted ("Popular") plan. Keyed on the stable plan code, never the
// display name, which admins can edit.
const POPULAR_PLAN_CODE = 'GOLD_PREMIUM';

// One feature line. Features the product can't deliver yet are shown as
// Coming Soon, never with a checkmark.
function FeatureLine({ feature, plan, dark = false }: { feature: PlanFeature; plan: MembershipPlanResponse; dark?: boolean }) {
  return (
    <li className={`flex items-start gap-2.5 text-xs sm:text-sm ${dark ? 'text-[#E2D2C8]' : 'text-[#443833]'}`} data-testid="plan-feature" data-available={feature.available}>
      <span
        className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full ${
          feature.available ? 'bg-[#FAF5EC] text-nk-gold' : dark ? 'bg-white/10 text-[#E2D2C8]/60' : 'bg-[#F4F0EA] text-nk-subtle'
        }`}
      >
        {feature.available ? <Check className="h-3 w-3 stroke-[2.5]" /> : <Lock className="h-2.5 w-2.5" />}
      </span>
      {/* Inline, so the info icon and Coming Soon tag follow the text
          instead of wrapping onto a line of their own. */}
      <span className="min-w-0">
        <span className={feature.available ? '' : dark ? 'text-[#E2D2C8]/75' : 'text-nk-muted'}>{feature.label}</span>
        {!feature.available && (
          <span className="ml-1.5 inline-block align-middle">
            <ComingSoonPill />
          </span>
        )}
        {feature.key === 'phoneNumbers' && (
          <ContactInfoCard phoneUnlockLimit={plan.phoneUnlockLimit} position="top" align="left" className="ml-1 align-middle" />
        )}
      </span>
    </li>
  );
}

// The price, with the struck-out original price and % off only when the
// plan has a real original price (set in admin). Members are always charged
// the price.
function PriceBlock({ plan, dark = false }: { plan: MembershipPlanResponse; dark?: boolean }) {
  const percent = discountPercent(plan.priceInPaise, plan.originalPriceInPaise);
  return (
    <div className="text-center">
      {percent !== null && (
        <p className={`text-xs font-bold ${dark ? 'text-[#8EE0B4]' : 'text-[#2E7D5B]'}`} data-testid="plan-discount">
          {percent}% OFF
        </p>
      )}
      <div className="flex items-baseline justify-center gap-2.5">
        {percent !== null && plan.originalPriceInPaise !== null && (
          <span className={`text-base sm:text-lg font-medium line-through ${dark ? 'text-[#E2D2C8]/60' : 'text-nk-subtle'}`} data-testid="plan-original-price">
            {formatPrice(plan.originalPriceInPaise)}
          </span>
        )}
        <span className={`text-3xl sm:text-4xl font-extrabold tracking-tight ${dark ? 'text-[#FDE59C]' : 'text-nk-ink'}`} data-testid="plan-price">
          {formatPrice(plan.priceInPaise)}
        </span>
      </div>
    </div>
  );
}

function SelfServeCard({
  plan,
  buttonLabel,
  disabled,
  onChoose,
}: {
  plan: MembershipPlanResponse;
  buttonLabel: string;
  disabled: boolean;
  onChoose: () => void;
}) {
  const popular = plan.code === POPULAR_PLAN_CODE;
  return (
    <div
      data-testid="plan-card"
      data-plan-code={plan.code}
      data-popular={popular || undefined}
      className={`relative flex flex-col rounded-2xl bg-white shadow-sm transition-shadow duration-200 hover:shadow-md ${
        popular ? 'border-2 border-nk-gold' : 'border border-nk-line'
      }`}
    >
      {popular && (
        <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-md bg-nk-gold-text px-3 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white" data-testid="plan-popular">
          Popular
        </span>
      )}
      <div className="flex flex-1 flex-col p-5 sm:p-6">
        <div className="border-b border-nk-line-soft pb-3 text-center">
          <h2 className="text-lg sm:text-xl font-bold uppercase tracking-wide text-nk-ink">{plan.name}</h2>
          <p className="mt-0.5 text-[11px] font-bold uppercase tracking-wider text-nk-subtle">{durationLabel(plan.durationDays)}</p>
          {plan.description && (
            <p className="mt-1.5 text-xs text-nk-muted" data-testid="plan-description">
              {plan.description}
            </p>
          )}
        </div>
        <div className="py-4">
          <PriceBlock plan={plan} />
        </div>
        <ul className="flex-1 space-y-2.5 pb-4">
          {plan.features.map((feature) => (
            <FeatureLine key={feature.key} feature={feature} plan={plan} />
          ))}
        </ul>
        <div className="border-t border-nk-line-soft pt-3">
          <button
            type="button"
            data-testid="choose-plan"
            disabled={disabled}
            onClick={onChoose}
            className={`w-full cursor-pointer rounded-xl px-4 py-2.5 text-xs sm:text-sm font-bold shadow-xs transition-colors duration-150 disabled:cursor-not-allowed disabled:opacity-60 ${
              popular
                ? 'bg-nk-maroon-deep text-white hover:bg-[#550809]'
                : 'border border-[#DFC392] bg-[#FDF9F3] text-nk-maroon-deep hover:bg-[#F7EBDC]'
            }`}
          >
            {buttonLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

// "Membership Benefits": only things the product does today. Porutham
// matching isn't built, so that card says Coming Soon.
const BENEFITS = [
  { icon: ShieldCheck, title: 'Verified Mobile Numbers', text: 'Every member signs in with a one-time code sent to their mobile number.', comingSoon: false },
  { icon: Lock, title: 'Secure Messaging', text: 'Send interests, and chat directly once one is accepted.', comingSoon: false },
  { icon: EyeOff, title: 'Privacy Controls', text: 'Decide who sees your phone number and horoscope, hide your profile, or block anyone.', comingSoon: false },
  { icon: Sparkles, title: 'Horoscope Matching', text: 'Add your horoscope and choose who can see it. Porutham matching is on the way.', comingSoon: true },
];

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
      .then((result) =>
        setPlansState({
          kind: 'loaded',
          plans: [...result.items].sort((a, b) => a.sortOrder - b.sortOrder),
          requirePaidPlan: result.requirePaidPlan,
        }),
      )
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
  // Server setting (REQUIRE_PAID_PLAN): when on there's no free tier, so the
  // page mustn't describe one.
  const planRequired = plansState.kind === 'loaded' && plansState.requirePaidPlan;

  function chooseLabel(plan: MembershipPlanResponse, base: string) {
    if (paymentsUnavailable) return 'Online payment opening soon';
    if (orderState.kind === 'creating' && orderState.planId === plan.id) return 'Processing…';
    return base;
  }

  return (
    <div className="min-h-screen bg-nk-ivory text-nk-ink flex flex-col">
      <AppHeader />

      <main className="flex-1 w-full max-w-6xl mx-auto px-4 py-10 sm:px-6 lg:px-8 space-y-10">
        <div className="text-center space-y-2 max-w-2xl mx-auto">
          <p className="text-xs font-bold tracking-[0.2em] text-nk-maroon-deep uppercase">MEMBERSHIP</p>
          <h1 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold text-nk-ink tracking-tight font-[family-name:var(--font-heading,serif)]">
            Your Journey to Finding the Right Match
          </h1>
          <p className="text-xs sm:text-sm text-nk-muted">
            Choose a membership that fits your search. Features marked Coming Soon aren&apos;t available yet on any plan.
          </p>
          {planRequired && (
            <p className="text-xs sm:text-sm font-semibold text-nk-maroon-deep" data-testid="plan-required-note">
              A plan is needed to view member profiles, search, send interests and chat.
            </p>
          )}
          <p className="text-[11px] text-nk-subtle" data-testid="tax-note">
            Prices include applicable taxes.
          </p>
        </div>

        {/* The member's own plan, from GET /me/membership. */}
        {accessToken && membership && <MyMembershipPanel me={membership} />}

        {plansState.kind === 'loading' && <p className="text-center text-sm text-nk-muted">Loading plans…</p>}
        {plansState.kind === 'error' && (
          <Card className="mx-auto max-w-xl rounded-xl border border-red-200 bg-red-50 p-4 text-center text-sm text-nk-maroon-bright" role="alert">
            {plansState.message}{' '}
            <button type="button" onClick={loadPlans} className="font-semibold underline">
              Try again
            </button>
          </Card>
        )}

        {/* Order feedback. No payment gateway exists yet, so nothing is ever
            charged, and the page says so. */}
        {paymentsUnavailable && (
          <Card className="mx-auto max-w-2xl rounded-xl border border-nk-line-gold bg-[#FFFBF0] p-4 text-center text-xs sm:text-sm text-nk-ink-soft" data-testid="payments-unavailable" role="status">
            Online payment is opening soon. You haven&apos;t been charged, and no plan was started.
          </Card>
        )}
        {orderState.kind === 'error' && (
          <Card className="mx-auto max-w-2xl rounded-xl border border-red-200 bg-red-50 p-4 text-xs sm:text-sm text-nk-maroon-bright" role="alert">
            {orderState.message}
          </Card>
        )}
        {orderState.kind === 'created' && (
          <Card className="mx-auto max-w-2xl rounded-xl border border-nk-line-gold bg-[#FFFBF0] p-5 text-xs sm:text-sm" data-testid="order-created" role="status">
            <p className="font-bold text-nk-maroon-deep">Order recorded for {orderState.planName}</p>
            <p className="mt-1 text-nk-muted">
              Order <code className="font-mono">{orderState.order.id}</code> · {formatPrice(orderState.order.amountInPaise)} · {orderState.order.status}
            </p>
            <p className="mt-1.5 text-nk-subtle">
              Online payment isn&apos;t connected yet, so you haven&apos;t been charged and your plan hasn&apos;t started.
            </p>
          </Card>
        )}

        {selfServe.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5 lg:gap-6 items-stretch">
            {selfServe.map((plan) => (
              <SelfServeCard
                key={plan.id}
                plan={plan}
                buttonLabel={chooseLabel(plan, 'Choose Plan')}
                disabled={paymentsUnavailable || orderState.kind === 'creating'}
                onChoose={() => void handleChoose(plan)}
              />
            ))}
          </div>
        )}

        {assisted.map((plan) => (
          <section
            key={plan.id}
            data-testid="plan-card"
            data-plan-code={plan.code}
            className="relative overflow-hidden rounded-3xl border-2 border-nk-gold-light/50 bg-gradient-to-br from-[#2D0D12] via-[#3E1118] to-[#24080C] p-6 sm:p-8 lg:p-10 text-white shadow-xl"
          >
            <div className="relative z-10 flex flex-col items-stretch justify-between gap-8 lg:flex-row">
              <div className="max-w-2xl flex-1 space-y-4">
                <div className="inline-flex items-center gap-2 rounded-md border border-nk-gold-light/40 bg-nk-gold-light/20 px-3.5 py-1 text-xs font-bold uppercase tracking-widest text-[#FDE59C]">
                  <Crown className="h-4 w-4 text-nk-gold-light" />
                  <span>Assisted service</span>
                </div>
                <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight font-[family-name:var(--font-heading,serif)]">{plan.name}</h2>
                {plan.description && (
                  <p className="text-sm font-semibold text-[#FDE59C]" data-testid="plan-description">
                    {plan.description}
                  </p>
                )}
                <p className="text-xs sm:text-sm leading-relaxed text-[#E2D2C8]">
                  A staff-assisted plan. The assisted services below aren&apos;t running yet, so they&apos;re marked Coming Soon.
                </p>
                <ul className="space-y-2.5 pt-1">
                  {plan.features.map((feature) => (
                    <FeatureLine key={feature.key} feature={feature} plan={plan} dark />
                  ))}
                </ul>
              </div>

              <div className="flex w-full shrink-0 flex-col justify-between space-y-4 rounded-2xl border border-nk-gold-light/40 bg-white/10 p-6 text-center backdrop-blur-md lg:w-80">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-[#E2D2C8]/80">{durationLabel(plan.durationDays)}</p>
                  <div className="my-3 border-y border-white/15 py-4">
                    <PriceBlock plan={plan} dark />
                  </div>
                </div>
                <div className="space-y-2.5">
                  <button
                    type="button"
                    data-testid="choose-plan"
                    disabled={paymentsUnavailable || orderState.kind === 'creating'}
                    onClick={() => void handleChoose(plan)}
                    className="w-full cursor-pointer rounded-xl bg-gradient-to-r from-nk-gold-light to-[#F1D278] px-4 py-2.5 text-xs sm:text-sm font-bold text-[#2D0D12] shadow-md transition-all hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {chooseLabel(plan, `Choose ${plan.name}`)}
                  </button>
                  <VipEnquiry />
                  <Link href="/contact" className="block text-[11px] font-semibold text-white/80 underline-offset-2 hover:text-white hover:underline" data-testid="vip-contact-link">
                    Questions? Contact us
                  </Link>
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

        <div className="pt-2" data-testid="membership-benefits">
          <div className="mb-6 space-y-1 text-center">
            <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-nk-ink">Membership Benefits</h2>
            <p className="text-xs text-nk-muted">Designed to help Nadar families find compatible matches safely and comfortably</p>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {BENEFITS.map(({ icon: Icon, title, text, comingSoon }) => (
              <div key={title} className="flex items-start gap-3 rounded-xl border border-nk-line bg-white p-4 shadow-xs">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-[#EEDFCD] bg-[#FAF5EC] text-nk-gold">
                  <Icon className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="flex flex-wrap items-center gap-1.5 text-xs sm:text-sm font-bold text-nk-ink">
                    {title}
                    {comingSoon && <ComingSoonPill />}
                  </h3>
                  <p className="mt-0.5 text-xs leading-relaxed text-nk-muted">{text}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </main>
    </div>
  );
}
