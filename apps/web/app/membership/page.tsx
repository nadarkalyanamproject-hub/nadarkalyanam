'use client';

import { useEffect, useState } from 'react';
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
  CheckCircle2,
} from 'lucide-react';

interface PlanDetail {
  id: string;
  name: string;
  durationLabel: string;
  price: number;
  popular?: boolean;
  features: string[];
}

const MEMBERSHIP_TIERS: PlanDetail[] = [
  {
    id: 'plan-gold-3m',
    name: 'GOLD',
    durationLabel: '3 MONTHS',
    price: 1499,
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
    feature: 'Horoscope Compatibility Views',
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

      <main className="flex-1 w-full max-w-6xl mx-auto px-4 py-10 sm:px-6 lg:px-8 space-y-12">
        {/* Top Header Section */}
        <div className="text-center space-y-2 max-w-2xl mx-auto">
          <p className="text-xs font-bold tracking-[0.2em] text-[#680A0E] uppercase">
            MEMBERSHIP
          </p>
          <h1 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold text-[#2B1515] tracking-tight font-[family-name:var(--font-heading,serif)]">
            Your Journey to Finding the Right Match
          </h1>
          <p className="text-xs sm:text-sm text-[#73645C]">
            Choose a membership that fits your search.
          </p>
        </div>

        {/* Pricing Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5 lg:gap-6 items-stretch">
          {MEMBERSHIP_TIERS.map((tier) => {
            const isProcessing = orderingPlanId === tier.id;

            return (
              <div
                key={tier.id}
                className={`relative flex flex-col justify-between rounded-2xl bg-white transition-all duration-200 shadow-sm hover:shadow-md ${
                  tier.popular
                    ? 'border-2 border-[#C89B3C] ring-1 ring-[#C89B3C]/25 shadow-sm'
                    : 'border border-[#E8DCCF] hover:border-[#D6A33A]'
                }`}
              >
                {/* Subtle Muted Gold Badge for Premium */}
                {tier.popular && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 z-10">
                    <span className="rounded-full bg-[#C89B3C] px-3.5 py-0.5 text-[11px] font-bold uppercase tracking-wider text-white shadow-xs">
                      Popular
                    </span>
                  </div>
                )}

                <div className="p-5 sm:p-6 flex-1 flex flex-col justify-between">
                  <div>
                    {/* Tier Name & Duration */}
                    <div className="text-center pb-3 border-b border-[#F4ECE3]">
                      <h2 className="text-lg sm:text-xl font-bold text-[#2B1515] tracking-wide">
                        {tier.name}
                      </h2>
                      <p className="text-[11px] font-bold text-[#8C7B73] tracking-wider mt-0.5 uppercase">
                        {tier.durationLabel}
                      </p>
                    </div>

                    {/* Price Block */}
                    <div className="text-center py-4">
                      <div className="flex items-baseline justify-center">
                        <span className="text-3xl sm:text-4xl font-extrabold text-[#2B1515] tracking-tight">
                          ₹{tier.price.toLocaleString('en-IN')}
                        </span>
                      </div>
                    </div>

                    {/* Feature Checkpoints */}
                    <div className="pt-1 pb-4">
                      <ul className="space-y-2.5">
                        {tier.features.map((feat, idx) => (
                          <li
                            key={idx}
                            className="flex items-start gap-2.5 text-xs sm:text-sm text-[#443833]"
                          >
                            <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-[#FAF5EC] text-[#C89B3C] mt-0.5">
                              <Check className="h-3 w-3 stroke-[2.5]" />
                            </span>
                            <span>{feat}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>

                  {/* Choose Plan CTA */}
                  <div className="pt-3 border-t border-[#F4ECE3]">
                    <button
                      type="button"
                      disabled={isProcessing}
                      onClick={() => void handlePayNow(tier)}
                      className={`w-full py-2.5 px-4 rounded-xl font-bold text-xs sm:text-sm transition-all duration-150 cursor-pointer shadow-xs ${
                        tier.popular
                          ? 'bg-[#680A0E] hover:bg-[#52070A] text-white shadow-[#680A0E]/20'
                          : 'bg-[#FDF9F3] hover:bg-[#F7EBDC] text-[#680A0E] border border-[#DFC392]'
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
          <Card className="rounded-xl border border-red-200 bg-red-50 p-4 text-xs sm:text-sm text-[#94151C] max-w-2xl mx-auto">
            {orderError}
          </Card>
        )}

        {order && (
          <Card className="rounded-xl border border-[#EADBBD] bg-[#FFFBF0] p-5 text-xs sm:text-sm shadow-xs max-w-2xl mx-auto">
            <h4 className="font-bold text-[#680A0E] text-sm mb-1">
              Order Created Successfully
            </h4>
            <p className="text-xs text-[#73645C]">
              Order ID: <code className="font-mono">{order.id}</code> · Amount:{' '}
              <strong>₹{(order.amountInPaise / 100).toLocaleString('en-IN')}</strong> · Status:{' '}
              <span className="uppercase font-semibold">{order.status}</span>
            </p>
            <p className="mt-1.5 text-xs text-[#8C7B73]">
              Payment gateway connected. Your membership will activate automatically once settled.
            </p>
          </Card>
        )}

        {/* Section: Membership Benefits */}
        <div className="pt-2">
          <div className="text-center space-y-1 mb-6">
            <h2 className="text-xl sm:text-2xl font-bold text-[#2B1515] tracking-tight">
              Membership Benefits
            </h2>
            <p className="text-xs text-[#73645C]">
              Designed to help Nadar families find compatible matches safely and comfortably
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white border border-[#E8DCCF] rounded-xl p-4 shadow-xs flex items-start gap-3">
              <div className="h-9 w-9 rounded-lg bg-[#FAF5EC] border border-[#EEDFCD] flex items-center justify-center text-[#C89B3C] shrink-0">
                <ShieldCheck className="h-5 w-5" />
              </div>
              <div>
                <h3 className="font-bold text-xs sm:text-sm text-[#2B1515]">Verified Profiles</h3>
                <p className="text-xs text-[#73645C] mt-0.5 leading-relaxed">
                  Mobile OTP & ID verified members within the community.
                </p>
              </div>
            </div>

            <div className="bg-white border border-[#E8DCCF] rounded-xl p-4 shadow-xs flex items-start gap-3">
              <div className="h-9 w-9 rounded-lg bg-[#FAF5EC] border border-[#EEDFCD] flex items-center justify-center text-[#C89B3C] shrink-0">
                <Lock className="h-5 w-5" />
              </div>
              <div>
                <h3 className="font-bold text-xs sm:text-sm text-[#2B1515]">Secure Messaging</h3>
                <p className="text-xs text-[#73645C] mt-0.5 leading-relaxed">
                  Direct chat and interest requests with contact privacy.
                </p>
              </div>
            </div>

            <div className="bg-white border border-[#E8DCCF] rounded-xl p-4 shadow-xs flex items-start gap-3">
              <div className="h-9 w-9 rounded-lg bg-[#FAF5EC] border border-[#EEDFCD] flex items-center justify-center text-[#C89B3C] shrink-0">
                <EyeOff className="h-5 w-5" />
              </div>
              <div>
                <h3 className="font-bold text-xs sm:text-sm text-[#2B1515]">Privacy Controls</h3>
                <p className="text-xs text-[#73645C] mt-0.5 leading-relaxed">
                  Decide who sees your photos, phone number, and horoscope.
                </p>
              </div>
            </div>

            <div className="bg-white border border-[#E8DCCF] rounded-xl p-4 shadow-xs flex items-start gap-3">
              <div className="h-9 w-9 rounded-lg bg-[#FAF5EC] border border-[#EEDFCD] flex items-center justify-center text-[#C89B3C] shrink-0">
                <Sparkles className="h-5 w-5" />
              </div>
              <div>
                <h3 className="font-bold text-xs sm:text-sm text-[#2B1515]">Horoscope Matching</h3>
                <p className="text-xs text-[#73645C] mt-0.5 leading-relaxed">
                  In-depth Porutham calculation and astrological reports.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Section: Compare Plans */}
        <div className="pt-2">
          <div className="text-center space-y-1 mb-6">
            <h2 className="text-xl sm:text-2xl font-bold text-[#2B1515] tracking-tight">
              Compare Plans
            </h2>
            <p className="text-xs text-[#73645C]">
              Detailed feature breakdown for each membership tier
            </p>
          </div>

          <div className="rounded-xl border border-[#E8DCCF] bg-white shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs sm:text-sm">
                <thead>
                  <tr className="border-b border-[#F4ECE3] bg-[#FAF5EC] text-[#443833]">
                    <th className="py-3 px-5 font-bold">Features</th>
                    <th className="py-3 px-4 font-bold text-center">
                      GOLD
                      <div className="text-xs font-semibold text-[#8C7B73]">₹1,499</div>
                    </th>
                    <th className="py-3 px-4 font-bold text-center">
                      GOLD PLUS
                      <div className="text-xs font-semibold text-[#8C7B73]">₹2,299</div>
                    </th>
                    <th className="py-3 px-4 font-bold text-center text-[#680A0E] bg-[#FDF9F2]">
                      GOLD PREMIUM
                      <div className="text-xs font-bold text-[#680A0E]">₹5,999</div>
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#F6EFE9] text-[#2B1515]">
                  {COMPARISON_ROWS.map((row, idx) => (
                    <tr key={idx} className="hover:bg-[#FFFDFB] transition-colors">
                      <td className="py-3 px-5 font-medium text-[#382E2B]">
                        {row.feature}
                      </td>
                      <td className="py-3 px-4 text-center text-[#554741]">
                        {row.gold}
                      </td>
                      <td className="py-3 px-4 text-center font-medium text-[#2B1515]">
                        {row.goldPlus}
                      </td>
                      <td className="py-3 px-4 text-center font-bold text-[#680A0E] bg-[#FDF9F2]/60">
                        {row.goldPremium}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Section: Your Privacy Matters (Small & Tasteful) */}
        <div className="rounded-2xl bg-[#FAF5EC] border border-[#E8DCCF] p-6 sm:p-7">
          <div className="max-w-2xl mx-auto text-center space-y-3">
            <div className="inline-flex h-9 w-9 rounded-full bg-white items-center justify-center text-[#680A0E] shadow-xs">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <h2 className="text-lg sm:text-xl font-bold text-[#2B1515] tracking-tight">
              Your Privacy Matters
            </h2>
            <p className="text-xs text-[#73645C] leading-relaxed">
              Your family and contact information is guarded with strict privacy controls.
              Phone numbers and horoscope charts are only visible to verified profiles with your consent.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-3 text-left">
              <div className="bg-white rounded-lg p-3 border border-[#EEDBCA]">
                <h4 className="font-bold text-xs text-[#2B1515] flex items-center gap-1.5 mb-0.5">
                  <CheckCircle2 className="h-3.5 w-3.5 text-[#C89B3C]" /> Verified Profiles
                </h4>
                <p className="text-[11px] text-[#73645C]">
                  Mobile OTP & ID verification.
                </p>
              </div>

              <div className="bg-white rounded-lg p-3 border border-[#EEDBCA]">
                <h4 className="font-bold text-xs text-[#2B1515] flex items-center gap-1.5 mb-0.5">
                  <CheckCircle2 className="h-3.5 w-3.5 text-[#C89B3C]" /> Contact Privacy
                </h4>
                <p className="text-[11px] text-[#73645C]">
                  Full control over phone visibility.
                </p>
              </div>

              <div className="bg-white rounded-lg p-3 border border-[#EEDBCA]">
                <h4 className="font-bold text-xs text-[#2B1515] flex items-center gap-1.5 mb-0.5">
                  <CheckCircle2 className="h-3.5 w-3.5 text-[#C89B3C]" /> Secure Payments
                </h4>
                <p className="text-[11px] text-[#73645C]">
                  Encrypted transactions with instant activation.
                </p>
              </div>
            </div>

            <div className="pt-3 border-t border-[#E8DCCF] flex items-center justify-center gap-3 text-xs text-[#73645C]">
              <span>Need help?</span>
              <a
                href="https://wa.me/919876543210"
                target="_blank"
                rel="noopener noreferrer"
                className="font-bold text-[#680A0E] hover:underline"
              >
                WhatsApp Support
              </a>
              <span>·</span>
              <a
                href="tel:18004190123"
                className="hover:underline"
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
