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
import { motion } from 'motion/react';
import { BUTTON_MOTION, CARD_MOTION, Reveal, StaggerGroup, StaggerItem } from '@/components/motion/motion';
import { CountDownPrice, SAVING_DELAY, StrikeIn } from '@/components/motion/price-animation';

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

// Card colour schemes: 'light' plan cards (dark text on white), the
// maroon Popular card ('dark', white text), the emerald VIP card ('gold',
// its feature list) and the VIP card's price panel ('vip').
// `save` is the green of the offer line and the lighter green its shine
// sweeps through.
type Tone = 'light' | 'dark' | 'gold' | 'vip';
const TONE = {
  light: {
    text: 'text-black font-medium',
    muted: 'text-[#6E6E73]',
    strike: 'text-[#86868B]',
    price: 'text-[#1D1D1F]',
    check: 'text-[#1D1D1F]',
    lock: 'bg-[#F2F2F2] text-[#86868B]',
    unavailable: 'text-[#6E6E73]',
    save: ['#1E7B4F', '#ffffff'],
  },
  dark: {
    text: 'text-white font-medium',
    muted: 'text-[#E2CFC6]',
    strike: 'text-[#D4B9AE]',
    price: 'text-white',
    check: 'text-white',
    lock: 'bg-white/10 text-[#E2CFC6]',
    unavailable: 'text-[#E2CFC6]',
    save: ['#8FE3B6', '#ffffff'],
  },
  gold: {
    text: 'text-[#F4ECD8]',
    muted: 'text-[#C9D8CF]',
    strike: 'text-[#9FB5A9]',
    price: 'text-[#F1D278]',
    check: 'bg-[#E3C26B] text-[#062A20]',
    lock: 'bg-white/10 text-[#9FB5A9]',
    unavailable: 'text-[#B7C8BE]',
    save: ['#1E7B4F', '#ffffff'],
  },
  vip: {
    text: 'text-[#E2D2C8]',
    muted: 'text-[#C9D8CF]',
    strike: 'text-[#9FB5A9]',
    price: 'text-[#FDE59C]',
    check: 'bg-[#FAF5EC] text-nk-gold',
    lock: 'bg-white/10 text-[#E2D2C8]/60',
    unavailable: 'text-[#E2D2C8]/75',
    save: ['#8FE3B6', '#ffffff'],
  },
} as const;

// One feature line. Features the product can't deliver yet are shown as
// Coming Soon, never with a checkmark.
function FeatureLine({ feature, plan, tone = 'light' }: { feature: PlanFeature; plan: MembershipPlanResponse; tone?: Tone }) {
  const t = TONE[tone];
  return (
    <li className={`flex items-start gap-2.5 text-sm ${t.text}`} data-testid="plan-feature" data-available={feature.available}>
      <span
        className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full ${feature.available ? t.check : t.lock}`}
      >
        {feature.available ? <Check className="h-3.5 w-3.5 stroke-[2.5]" /> : <Lock className="h-2.5 w-2.5" />}
      </span>
      {/* Inline, so the info icon and Coming Soon tag follow the text
          instead of wrapping onto a line of their own. */}
      <span className="min-w-0">
        <span className={feature.available ? '' : t.unavailable}>{feature.label}</span>
        {!feature.available && (
          <span className="ml-1.5 inline-block align-middle">
            <ComingSoonPill />
          </span>
        )}
        {feature.key === 'phoneNumbers' && (
          <ContactInfoCard phoneUnlockLimit={plan.phoneUnlockLimit} position="top" align="center" className="ml-1 align-middle" />
        )}
      </span>
    </li>
  );
}

// The price, with the struck-out original price and the saving only when
// the plan has a real original price (set in admin). Members are always
// charged the price. The saving is a quiet line that fades in once the
// count-down ends.
function PriceBlock({ plan, tone = 'light' }: { plan: MembershipPlanResponse; tone?: Tone }) {
  const t = TONE[tone];
  const percent = discountPercent(plan.priceInPaise, plan.originalPriceInPaise);
  return (
    <div className="text-center">
      <div className="flex items-baseline justify-center gap-2.5">
        {percent !== null && plan.originalPriceInPaise !== null && (
          <StrikeIn className={`text-base sm:text-lg font-medium ${t.strike}`} testId="plan-original-price">
            {formatPrice(plan.originalPriceInPaise)}
          </StrikeIn>
        )}
        <CountDownPrice
          from={percent !== null && plan.originalPriceInPaise !== null ? plan.originalPriceInPaise : plan.priceInPaise}
          to={plan.priceInPaise}
          className={`text-3xl sm:text-4xl font-bold tabular-nums tracking-tight ${t.price}`}
          testId="plan-price"
        />
      </div>
      {percent !== null && plan.originalPriceInPaise !== null && (
        <motion.p
          initial={{ opacity: 0, y: 4 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, ease: [0.25, 0.1, 0.25, 1], delay: SAVING_DELAY }}
          className="mt-1.5 text-sm font-semibold tracking-[-0.01em]"
          data-testid="plan-discount"
        >
          {/* Text with white shine passing through it. */}
          <motion.span
            className="inline-block bg-clip-text text-transparent"
            style={{
              backgroundImage: `linear-gradient(100deg, ${t.save[0]} 0%, ${t.save[0]} 38%, ${t.save[1]} 50%, ${t.save[0]} 62%, ${t.save[0]} 100%)`,
              backgroundSize: '300% 100%',
            }}
            initial={{ backgroundPosition: '100% 0%' }}
            animate={{ backgroundPosition: ['100% 0%', '0% 0%'] }}
            transition={{ duration: 1.5, ease: 'easeInOut', delay: SAVING_DELAY + 0.4, repeat: Infinity, repeatDelay: 3 }}
          >
            Save {percent}%
          </motion.span>
        </motion.p>
      )}
    </div>
  );
}

// A plan card shows at most this many lines: only what the plan includes
// today (Coming Soon items are listed in Membership Benefits instead).
const CARD_FEATURE_LIMIT = 6;

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
  // The Popular plan is the one deep-maroon card, so it stands out.
  const popular = plan.code === POPULAR_PLAN_CODE;
  const tone: Tone = popular ? 'dark' : 'light';
  const t = TONE[tone];
  const rule = popular ? 'border-white/15' : 'border-black/8';
  return (
    <motion.div
      {...CARD_MOTION}
      data-testid="plan-card"
      data-plan-code={plan.code}
      data-popular={popular || undefined}
      // Gold is the highlight: a gold border and glow around the Popular card,
      // and a soft gold border on the others when hovered.
      className={`relative flex h-full flex-col rounded-3xl transition-[box-shadow,border-color] duration-300 ${
        popular
          ? 'border-2 border-[#E3C26B] bg-gradient-to-b from-[#6B1420] to-[#3E0B12] shadow-[0_0_0_4px_rgba(227,194,107,0.18),0_20px_50px_-20px_rgba(62,11,18,0.6)] hover:shadow-[0_0_0_6px_rgba(227,194,107,0.28),0_28px_60px_-20px_rgba(62,11,18,0.65)]'
          : 'border border-black/8 bg-white shadow-[0_1px_2px_rgba(0,0,0,0.04)] hover:border-[#E3C26B] hover:shadow-[0_0_0_3px_rgba(227,194,107,0.2),0_12px_32px_-12px_rgba(0,0,0,0.18)]'
      }`}
    >
      {popular && (
        <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-nk-gold-light px-3 py-0.5 text-[10px] font-bold uppercase tracking-wider text-[#3E0B12]" data-testid="plan-popular">
          Popular
        </span>
      )}
      <div className="flex flex-1 flex-col p-6 sm:p-7">
        <div className={`border-b pb-4 text-center ${rule}`}>
          <h2 className={`text-2xl sm:text-[1.7rem] font-bold tracking-tight ${popular ? 'text-white' : 'text-black'}`}>{plan.name}</h2>
          {/* Plan name and duration stand out: a short gold rule, then the period in bold. */}
          <span aria-hidden="true" className="mx-auto mt-2 block h-[3px] w-10 rounded-full bg-[#E3C26B]" />
          <p className={`mt-2 text-sm font-bold uppercase tracking-[0.14em] ${popular ? 'text-[#F1D278]' : 'text-nk-maroon'}`} data-testid="plan-duration">
            {durationLabel(plan.durationDays)}
          </p>
          {plan.description && (
            <p className={`mt-1.5 text-xs ${t.muted}`} data-testid="plan-description">
              {plan.description}
            </p>
          )}
        </div>
        <div className="py-5">
          <PriceBlock plan={plan} tone={tone} />
        </div>
        <div className="flex-1 pb-5">
          <ul className="space-y-3">
            {plan.features
              .filter((feature) => feature.available)
              .slice(0, CARD_FEATURE_LIMIT)
              .map((feature) => (
                <FeatureLine key={feature.key} feature={feature} plan={plan} tone={tone} />
              ))}
          </ul>
        </div>
        <div>
          <motion.button
            {...BUTTON_MOTION}
            type="button"
            data-testid="choose-plan"
            disabled={disabled}
            onClick={onChoose}
            className={`w-full cursor-pointer rounded-full px-4 py-3 text-sm font-semibold transition-colors duration-150 disabled:cursor-not-allowed disabled:opacity-60 ${
              popular ? 'bg-white text-nk-maroon-deep hover:bg-[#F7EBDC]' : 'bg-nk-maroon-deep text-white hover:bg-[#550809]'
            }`}
          >
            {buttonLabel}
          </motion.button>
        </div>
      </div>
    </motion.div>
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
        {accessToken && membership && <MyMembershipPanel me={membership} plans={plansState.kind === 'loaded' ? plansState.plans : null} />}

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
          <StaggerGroup id="plans" className="grid scroll-mt-24 grid-cols-1 md:grid-cols-3 gap-5 lg:gap-6 items-stretch">
            {selfServe.map((plan) => (
              // Each animated card is its own stacking context, so a card with
              // its phone-info popup open is lifted above the cards beside it.
              <StaggerItem key={plan.id} className="relative has-[[role=dialog]]:z-20">
                <SelfServeCard
                  plan={plan}
                  buttonLabel={chooseLabel(plan, 'Choose Plan')}
                  disabled={paymentsUnavailable || orderState.kind === 'creating'}
                  onChoose={() => void handleChoose(plan)}
                />
              </StaggerItem>
            ))}
          </StaggerGroup>
        )}

        {assisted.map((plan) => (
          <Reveal
            as="section"
            key={plan.id}
            data-testid="plan-card"
            data-plan-code={plan.code}
            className="relative overflow-hidden rounded-3xl border border-[#C9A24A]/70 bg-gradient-to-br from-[#0F4535] via-[#0A3528] to-[#062419] p-6 sm:p-8 lg:p-10 text-[#F4ECD8] shadow-[0_24px_60px_-24px_rgba(6,36,25,0.7)]"
          >
            {/* The top tier: champagne gold, with a slow sheen passing over it. */}
            <motion.div
              aria-hidden="true"
              className="pointer-events-none absolute inset-y-0 -left-1/3 w-1/3 -skew-x-12 bg-gradient-to-r from-transparent via-[#F1D278]/15 to-transparent"
              initial={{ x: '0%' }}
              whileInView={{ x: '450%' }}
              viewport={{ once: true }}
              transition={{ duration: 2.2, ease: 'easeInOut', delay: 0.4, repeat: Infinity, repeatDelay: 6 }}
            />
            <div className="relative z-10 flex flex-col items-stretch justify-between gap-8 lg:flex-row">
              <div className="max-w-2xl flex-1 space-y-4">
                <div className="inline-flex items-center gap-2 rounded-full border border-[#E3C26B]/60 px-3.5 py-1 text-xs font-bold uppercase tracking-widest text-[#F1D278]">
                  <Crown className="h-4 w-4 text-[#F1D278]" />
                  <span>Assisted service</span>
                </div>
                <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight font-[family-name:var(--font-heading,serif)]">{plan.name}</h2>
                {plan.description && (
                  <p className="text-sm font-semibold text-[#F1D278]" data-testid="plan-description">
                    {plan.description}
                  </p>
                )}
                <p className="text-xs sm:text-sm leading-relaxed text-[#C9D8CF]">
                  A staff-assisted plan. The assisted services below aren&apos;t running yet, so they&apos;re marked Coming Soon.
                </p>
                <ul className="space-y-2.5 pt-1">
                  {plan.features.map((feature) => (
                    <FeatureLine key={feature.key} feature={feature} plan={plan} tone="gold" />
                  ))}
                </ul>
              </div>

              <div className="flex w-full shrink-0 flex-col justify-between space-y-4 rounded-2xl border border-[#E3C26B]/35 bg-white/[0.06] p-6 text-center text-white shadow-lg backdrop-blur-sm lg:w-80">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-[#E2D2C8]/80">{durationLabel(plan.durationDays)}</p>
                  <div className="my-3 border-y border-white/15 py-4">
                    <PriceBlock plan={plan} tone="vip" />
                  </div>
                </div>
                <div className="space-y-2.5">
                  <motion.button
                    {...BUTTON_MOTION}
                    type="button"
                    data-testid="choose-plan"
                    disabled={paymentsUnavailable || orderState.kind === 'creating'}
                    onClick={() => void handleChoose(plan)}
                    className="w-full cursor-pointer rounded-xl bg-gradient-to-r from-nk-gold-light to-[#F1D278] px-4 py-2.5 text-xs sm:text-sm font-bold text-[#2D0D12] shadow-md transition-[opacity,box-shadow] hover:shadow-lg hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {chooseLabel(plan, `Choose ${plan.name}`)}
                  </motion.button>
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
          </Reveal>
        ))}

        <div className="pt-2" data-testid="membership-benefits">
          <div className="mb-6 space-y-1 text-center">
            <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-nk-ink">Membership Benefits</h2>
            <p className="text-xs text-nk-muted">Designed to help Nadar families find compatible matches safely and comfortably</p>
          </div>
          <StaggerGroup className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {BENEFITS.map(({ icon: Icon, title, text, comingSoon }) => (
              <StaggerItem key={title} className="flex items-start gap-3 rounded-xl border border-nk-line bg-white p-4 shadow-xs transition-shadow hover:shadow-md">
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
              </StaggerItem>
            ))}
          </StaggerGroup>
        </div>
      </main>
    </div>
  );
}
