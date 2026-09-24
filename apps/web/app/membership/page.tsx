'use client';

import { useEffect, useState, type SVGProps } from 'react';
import type { MembershipPlanResponse, OrderResponse } from '@nadar-kalyanam/schemas';
import { Card } from '@/components/ui/card';
import { AppHeader } from '../../components/app-header';
import { ApiError, createOrder, listMembershipPlans } from '../../lib/api-client';
import { useRegistration } from '../providers/registration-provider';
import { useRequireAuth } from '../../lib/use-require-auth';
import {
  Check,
  ShieldCheck,
  Lock,
  EyeOff,
  Sparkles,
  Phone,
  MessageSquare,
  Compass,
  Crown,
  UserCheck,
  Headphones,
  CheckCircle2,
} from 'lucide-react';

interface PlanDetail {
  id: string;
  name: string;
  durationLabel: string;
  price: number;
  strikethroughPrice?: number;
  discountBadge?: string;
  popular?: boolean;
  features: string[];
}

const MEMBERSHIP_TIERS: PlanDetail[] = [
  {
    id: 'plan-gold-3m',
    name: 'GOLD',
    durationLabel: '3 MONTHS',
    price: 1499,
    strikethroughPrice: 2300,
    discountBadge: 'Save 35%',
    features: [
      '50 Verified Phone Numbers',
      'Send unlimited messages',
      'Unlimited horoscope views',
      'View verified profiles with photos',
    ],
  },
  {
    id: 'plan-gold-plus-3m',
    name: 'GOLD PLUS',
    durationLabel: '3 MONTHS',
    price: 2299,
    strikethroughPrice: 3700,
    discountBadge: 'Save 38%',
    features: [
      'Unlimited Phone Numbers*',
      'Send unlimited messages',
      'Unlimited horoscope views',
      'Priority profile listing in search',
    ],
  },
  {
    id: 'plan-gold-premium-12m',
    name: 'GOLD PREMIUM',
    durationLabel: '12 MONTHS',
    price: 5999,
    strikethroughPrice: 14999,
    discountBadge: 'Save 60%',
    popular: true,
    features: [
      'Unlimited Phone Numbers*',
      'Send unlimited messages',
      'Unlimited horoscope views',
      'Dedicated Relationship Manager',
      'Top priority profile spotlight',
    ],
  },
];

const COMPARISON_ROWS = [
  {
    feature: 'Plan Duration',
    gold: '3 Months',
    goldPlus: '3 Months',
    goldPremium: '12 Months',
    highlight: true,
  },
  {
    feature: 'Verified Phone Numbers',
    gold: '50 Contacts',
    goldPlus: 'Unlimited*',
    goldPremium: 'Unlimited*',
  },
  {
    feature: 'Direct Messaging & Chat',
    gold: 'Unlimited',
    goldPlus: 'Unlimited',
    goldPremium: 'Unlimited',
  },
  {
    feature: 'Horoscope & Porutham Views',
    gold: 'Unlimited',
    goldPlus: 'Unlimited',
    goldPremium: 'Unlimited',
  },
  {
    feature: 'Profile Search Priority',
    gold: 'Standard',
    goldPlus: 'Priority Placement',
    goldPremium: 'Top Spot Spotlight',
  },
  {
    feature: 'Dedicated Relationship Manager',
    gold: '—',
    goldPlus: '—',
    goldPremium: 'Dedicated Assistant',
  },
  {
    feature: 'WhatsApp Direct Connect',
    gold: '—',
    goldPlus: 'Included',
    goldPremium: 'Priority Assistance',
  },
  {
    feature: 'Horoscope Compatibility Matchmaker',
    gold: 'Standard',
    goldPlus: 'Detailed Report',
    goldPremium: 'Handpicked Weekly',
  },
];

export default function MembershipPage() {
  const { ready } = useRequireAuth();
  const { data } = useRegistration();
  const [plans, setPlans] = useState<MembershipPlanResponse[] | null>(null);
  const [orderingPlanId, setOrderingPlanId] = useState<string | null>(null);
  const [order, setOrder] = useState<OrderResponse | null>(null);
  const [orderError, setOrderError] = useState<string | null>(null);

  useEffect(() => {
    listMembershipPlans()
      .then((result) => setPlans(result.items))
      .catch(() => {
        // Fallback gracefully
      });
  }, []);

  async function handlePayNow(plan: PlanDetail) {
    if (!data.accessToken) return;
    setOrderingPlanId(plan.id);
    setOrderError(null);
    setOrder(null);

    const backendPlan = plans?.find(
      (p) =>
        p.name.toLowerCase().includes(plan.name.split(' ')[0]!.toLowerCase()) ||
        p.id === plan.id,
    );
    const targetPlanId = backendPlan ? backendPlan.id : plan.id;

    try {
      const created = await createOrder(data.accessToken, { planId: targetPlanId });
      setOrder(created);
    } catch (err) {
      setOrderError(
        err instanceof ApiError
          ? err.message
          : 'Could not create order. Please try again or chat with our support team.',
      );
    } finally {
      setOrderingPlanId(null);
    }
  }

  if (!ready) return null;

  return (
    <div className="min-h-screen bg-[#FFFDF9] text-[#2B1515] flex flex-col">
      <AppHeader />

      <main className="flex-1 w-full max-w-7xl mx-auto px-4 py-10 sm:px-6 lg:px-8 space-y-16">
        {/* Top Header Section */}
        <div className="text-center space-y-3 max-w-3xl mx-auto">
          <p className="text-xs sm:text-sm font-bold tracking-[0.25em] text-[#A81B24] uppercase">
            MEMBERSHIP
          </p>
          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-[#2B1515] tracking-tight font-[family-name:var(--font-heading,serif)]">
            Your Journey to Finding the Right Match
          </h1>
          <p className="text-sm sm:text-base text-[#6B5A53] max-w-xl mx-auto">
            Choose a membership that fits your search.
          </p>
        </div>

        {/* Pricing Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 lg:gap-8 items-stretch">
          {MEMBERSHIP_TIERS.map((tier) => {
            const isProcessing = orderingPlanId === tier.id;

            return (
              <div
                key={tier.id}
                className={`relative flex flex-col justify-between rounded-2xl bg-white transition-all duration-300 shadow-sm hover:shadow-xl ${
                  tier.popular
                    ? 'border-2 border-[#A81B24] ring-4 ring-[#A81B24]/10 shadow-md'
                    : 'border border-[#EADFD5] hover:border-[#D6A33A]'
                }`}
              >
                {/* Popular / Best Seller Badge */}
                {tier.popular && (
                  <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 z-10">
                    <span className="rounded-full bg-gradient-to-r from-[#A81B24] to-[#7B1118] px-4 py-1 text-xs font-extrabold uppercase tracking-wider text-white shadow-sm flex items-center gap-1">
                      <Sparkles className="h-3 w-3" /> Popular
                    </span>
                  </div>
                )}

                <div className="p-6 sm:p-8 flex-1 flex flex-col justify-between">
                  <div>
                    {/* Tier Name & Duration */}
                    <div className="text-center pb-4 border-b border-[#F2EAE0]">
                      <h2 className="text-xl sm:text-2xl font-black text-[#2B1515] tracking-wide">
                        {tier.name}
                      </h2>
                      <p className="text-xs font-bold text-[#8C7B73] tracking-widest mt-1 uppercase">
                        {tier.durationLabel}
                      </p>
                    </div>

                    {/* Price Block */}
                    <div className="text-center py-6">
                      <div className="flex items-baseline justify-center gap-2">
                        {tier.strikethroughPrice && (
                          <span className="text-sm sm:text-base font-semibold text-[#A8988F] line-through">
                            ₹{tier.strikethroughPrice.toLocaleString('en-IN')}
                          </span>
                        )}
                        <span className="text-4xl sm:text-5xl font-extrabold text-[#2B1515] tracking-tight">
                          ₹{tier.price.toLocaleString('en-IN')}
                        </span>
                      </div>
                      {tier.discountBadge && (
                        <div className="mt-2 inline-block">
                          <span className="text-[11px] font-bold text-[#059669] bg-[#ECFDF5] border border-[#A7F3D0] px-2.5 py-0.5 rounded-full">
                            {tier.discountBadge}
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Feature Checkpoints */}
                    <div className="pt-2 pb-6">
                      <ul className="space-y-3.5">
                        {tier.features.map((feat, idx) => (
                          <li
                            key={idx}
                            className="flex items-start gap-3 text-xs sm:text-sm font-medium text-[#443833]"
                          >
                            <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#ECFDF5] text-[#059669] mt-0.5">
                              <Check className="h-3.5 w-3.5 stroke-[2.5]" />
                            </span>
                            <span>{feat}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>

                  {/* Choose Plan CTA */}
                  <div className="pt-4 border-t border-[#F2EAE0]">
                    <button
                      type="button"
                      disabled={isProcessing}
                      onClick={() => void handlePayNow(tier)}
                      className={`w-full py-3.5 px-4 rounded-xl font-bold text-sm sm:text-base transition-all duration-200 cursor-pointer shadow-sm ${
                        tier.popular
                          ? 'bg-gradient-to-r from-[#A81B24] to-[#7B1118] hover:from-[#B91C27] hover:to-[#8E131C] text-white shadow-[#A81B24]/20 hover:shadow-md'
                          : 'bg-[#FFF8F0] hover:bg-[#FCEFD8] text-[#800F17] border border-[#E7CDAF]'
                      } disabled:opacity-50 disabled:cursor-not-allowed`}
                    >
                      {isProcessing ? 'Processing…' : 'Choose Plan'}
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Order Feedback & Error Messages */}
        {orderError && (
          <Card className="rounded-2xl border border-red-200 bg-red-50 p-5 text-sm text-[#94151C] max-w-3xl mx-auto">
            {orderError}
          </Card>
        )}

        {order && (
          <Card className="rounded-2xl border border-[#FDE68A] bg-[#FEF3C7] p-6 text-sm shadow-sm max-w-3xl mx-auto">
            <h4 className="font-bold text-[#92400E] text-base mb-1">
              Order Created Successfully
            </h4>
            <p className="text-xs text-[#78350F]">
              Order ID: <code className="font-mono">{order.id}</code> · Amount:{' '}
              <strong>₹{(order.amountInPaise / 100).toLocaleString('en-IN')}</strong> · Status:{' '}
              <span className="uppercase font-semibold">{order.status}</span>
            </p>
            <p className="mt-2 text-xs text-[#92400E]/80">
              Payment gateway connected. Once verified, your membership will activate instantly.
            </p>
          </Card>
        )}

        {/* Section: Membership Benefits */}
        <div className="pt-4">
          <div className="text-center space-y-2 mb-8">
            <h2 className="text-2xl sm:text-3xl font-extrabold text-[#2B1515] tracking-tight">
              Membership Benefits
            </h2>
            <p className="text-xs sm:text-sm text-[#6B5A53]">
              Every paid membership includes our core family-first safety features
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            <div className="bg-white border border-[#EADFD5] rounded-2xl p-5 shadow-sm hover:shadow-md transition-all flex items-start gap-4">
              <div className="h-11 w-11 rounded-xl bg-[#FEF2F2] border border-[#FECDD3] flex items-center justify-center text-[#A81B24] shrink-0">
                <ShieldCheck className="h-6 w-6" />
              </div>
              <div>
                <h3 className="font-bold text-sm text-[#2B1515]">Verified profiles</h3>
                <p className="text-xs text-[#6B5A53] mt-1 leading-relaxed">
                  100% government ID & mobile verified Nadar profiles.
                </p>
              </div>
            </div>

            <div className="bg-white border border-[#EADFD5] rounded-2xl p-5 shadow-sm hover:shadow-md transition-all flex items-start gap-4">
              <div className="h-11 w-11 rounded-xl bg-[#FEF2F2] border border-[#FECDD3] flex items-center justify-center text-[#A81B24] shrink-0">
                <Lock className="h-6 w-6" />
              </div>
              <div>
                <h3 className="font-bold text-sm text-[#2B1515]">Secure messaging</h3>
                <p className="text-xs text-[#6B5A53] mt-1 leading-relaxed">
                  End-to-end protected chat and direct express interest.
                </p>
              </div>
            </div>

            <div className="bg-white border border-[#EADFD5] rounded-2xl p-5 shadow-sm hover:shadow-md transition-all flex items-start gap-4">
              <div className="h-11 w-11 rounded-xl bg-[#FEF2F2] border border-[#FECDD3] flex items-center justify-center text-[#A81B24] shrink-0">
                <EyeOff className="h-6 w-6" />
              </div>
              <div>
                <h3 className="font-bold text-sm text-[#2B1515]">Privacy controls</h3>
                <p className="text-xs text-[#6B5A53] mt-1 leading-relaxed">
                  Control who views your phone numbers, photos, and horoscope.
                </p>
              </div>
            </div>

            <div className="bg-white border border-[#EADFD5] rounded-2xl p-5 shadow-sm hover:shadow-md transition-all flex items-start gap-4">
              <div className="h-11 w-11 rounded-xl bg-[#FEF2F2] border border-[#FECDD3] flex items-center justify-center text-[#A81B24] shrink-0">
                <Sparkles className="h-6 w-6" />
              </div>
              <div>
                <h3 className="font-bold text-sm text-[#2B1515]">Horoscope Matching</h3>
                <p className="text-xs text-[#6B5A53] mt-1 leading-relaxed">
                  Automated Porutham calculation and astrological checks.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Section: Compare Plans */}
        <div className="pt-4">
          <div className="text-center space-y-2 mb-8">
            <h2 className="text-2xl sm:text-3xl font-extrabold text-[#2B1515] tracking-tight">
              Compare Plans
            </h2>
            <p className="text-xs sm:text-sm text-[#6B5A53]">
              Full breakdown of feature limits across each tier
            </p>
          </div>

          <div className="rounded-2xl border border-[#EADFD5] bg-white shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs sm:text-sm">
                <thead>
                  <tr className="border-b border-[#F2EAE0] bg-[#FFF9F2] text-[#443833]">
                    <th className="py-4 px-6 font-bold">Features</th>
                    <th className="py-4 px-5 font-bold text-center">
                      GOLD
                      <div className="text-xs font-semibold text-[#8C7B73]">₹1,499</div>
                    </th>
                    <th className="py-4 px-5 font-bold text-center">
                      GOLD PLUS
                      <div className="text-xs font-semibold text-[#8C7B73]">₹2,299</div>
                    </th>
                    <th className="py-4 px-5 font-bold text-center text-[#A81B24] bg-[#FFF1F2]">
                      GOLD PREMIUM
                      <div className="text-xs font-bold text-[#A81B24]">₹5,999</div>
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#F6EFE9] text-[#2B1515]">
                  {COMPARISON_ROWS.map((row, idx) => (
                    <tr key={idx} className="hover:bg-[#FFFDFB] transition-colors">
                      <td className="py-3.5 px-6 font-medium text-[#382E2B]">
                        {row.feature}
                      </td>
                      <td className="py-3.5 px-5 text-center text-[#554741]">
                        {row.gold}
                      </td>
                      <td className="py-3.5 px-5 text-center font-medium text-[#2B1515]">
                        {row.goldPlus}
                      </td>
                      <td className="py-3.5 px-5 text-center font-bold text-[#A81B24] bg-[#FFF1F2]/40">
                        {row.goldPremium}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Section: Your Privacy Matters */}
        <div className="rounded-3xl bg-gradient-to-br from-[#FFF8EE] to-[#FFF1F2] border border-[#F3DFC9] p-8 sm:p-10 shadow-sm">
          <div className="max-w-3xl mx-auto text-center space-y-4">
            <div className="inline-flex h-12 w-12 rounded-full bg-white items-center justify-center text-[#A81B24] shadow-sm">
              <ShieldCheck className="h-6 w-6" />
            </div>
            <h2 className="text-2xl sm:text-3xl font-extrabold text-[#2B1515] tracking-tight">
              Your Privacy Matters
            </h2>
            <p className="text-xs sm:text-sm text-[#6B5A53] leading-relaxed max-w-xl mx-auto">
              We understand the sensitive nature of matrimonial searches. Your phone number, photos,
              and family details are kept under strict privacy controls and only shared with verified matches upon your consent.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-4 text-left">
              <div className="bg-white/90 rounded-xl p-4 border border-[#EED7C0]">
                <h4 className="font-bold text-xs text-[#2B1515] flex items-center gap-1.5 mb-1">
                  <CheckCircle2 className="h-4 w-4 text-[#059669]" /> 100% Verified Profiles
                </h4>
                <p className="text-[11px] text-[#6B5A53]">
                  All accounts undergo mandatory mobile OTP and profile checks.
                </p>
              </div>

              <div className="bg-white/90 rounded-xl p-4 border border-[#EED7C0]">
                <h4 className="font-bold text-xs text-[#2B1515] flex items-center gap-1.5 mb-1">
                  <CheckCircle2 className="h-4 w-4 text-[#059669]" /> Contact Protection
                </h4>
                <p className="text-[11px] text-[#6B5A53]">
                  View contact history and hide phone number anytime from public view.
                </p>
              </div>

              <div className="bg-white/90 rounded-xl p-4 border border-[#EED7C0]">
                <h4 className="font-bold text-xs text-[#2B1515] flex items-center gap-1.5 mb-1">
                  <CheckCircle2 className="h-4 w-4 text-[#059669]" /> Bank-Grade Security
                </h4>
                <p className="text-[11px] text-[#6B5A53]">
                  256-bit SSL encrypted payments with instant online activation.
                </p>
              </div>
            </div>

            {/* Assistance Bar */}
            <div className="pt-6 border-t border-[#E8D4C0] flex flex-wrap items-center justify-center gap-4 text-xs font-semibold text-[#443833]">
              <span>Need help choosing a plan?</span>
              <a
                href="https://wa.me/919876543210"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 rounded-full bg-[#059669] hover:bg-[#047857] text-white px-4 py-1.5 text-xs font-bold transition-colors shadow-sm"
              >
                <span>💬 WhatsApp Support</span>
              </a>
              <a
                href="tel:18004190123"
                className="text-[#A81B24] hover:underline transition-colors"
              >
                Toll Free: 1800-419-0123
              </a>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
