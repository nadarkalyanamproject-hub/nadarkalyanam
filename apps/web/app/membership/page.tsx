'use client';

import { useEffect, useState, type SVGProps } from 'react';
import type { MembershipPlanResponse, OrderResponse } from '@nadar-kalyanam/schemas';
import { Card } from '@nadar-kalyanam/ui';
import { AppHeader } from '../../components/app-header';
import { ApiError, createOrder, listMembershipPlans } from '../../lib/api-client';
import { useRegistration } from '../providers/registration-provider';
import { useRequireAuth } from '../../lib/use-require-auth';

interface PlanDetail {
  id: string;
  name: string;
  durationLabel: string;
  discountBadge: string;
  strikethroughPrice: number;
  price: number;
  priceInPaise: number;
  perMonthText: string;
  isBestSeller?: boolean;
  features: { text: string; hasInfo?: boolean; note?: string }[];
}

const MEMBERSHIP_TIERS: PlanDetail[] = [
  {
    id: 'plan-gold-3m',
    name: 'Gold - 3 months',
    durationLabel: '3 months',
    discountBadge: '35% OFF! Valid for today',
    strikethroughPrice: 2300,
    price: 1499,
    priceInPaise: 149900,
    perMonthText: '₹500 per month',
    features: [
      { text: 'Valid for 3 months' },
      { text: 'View 50 Phone Nos' },
      { text: 'Send unlimited messages' },
      { text: 'Unlimited horoscope views' },
      { text: 'View verified profiles with photos' },
    ],
  },
  {
    id: 'plan-gold-plus-3m',
    name: 'Gold + - 3 months',
    durationLabel: '3 months',
    discountBadge: '38% OFF! Valid for today',
    strikethroughPrice: 3700,
    price: 2299,
    priceInPaise: 229900,
    perMonthText: '₹766 per month',
    features: [
      { text: 'Valid for 3 months' },
      { text: 'View unlimited Phone Nos*', hasInfo: true, note: 'Fair usage policy applies' },
      { text: 'Send unlimited messages' },
      { text: 'Unlimited horoscope views' },
      { text: 'View verified profiles with photos' },
      { text: 'Priority profile listing' },
    ],
  },
  {
    id: 'plan-gold-premium-12m',
    name: 'Gold Premium - 12 months',
    durationLabel: '12 months',
    discountBadge: '60% OFF! Valid for today',
    strikethroughPrice: 14999,
    price: 5999,
    priceInPaise: 599900,
    perMonthText: '₹500 per month',
    isBestSeller: true,
    features: [
      { text: 'Longest validity plan (12 months)' },
      { text: 'View unlimited Phone Nos*', hasInfo: true, note: 'Fair usage policy applies' },
      { text: 'Send unlimited messages' },
      { text: 'Unlimited horoscope views' },
      { text: 'View verified profiles with photos' },
      { text: 'Dedicated Relationship Manager assistance' },
      { text: 'Top priority profile spotlight' },
    ],
  },
];

function CheckIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" {...props}>
      <path
        fillRule="evenodd"
        d="M16.704 4.153a.75.75 0 0 1 .143 1.052l-8 10.5a.75.75 0 0 1-1.127.075l-4.5-4.5a.75.75 0 0 1 1.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 0 1 1.05-.143Z"
        clipRule="evenodd"
      />
    </svg>
  );
}

function InfoCircleIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} {...props}>
      <circle cx="12" cy="12" r="10" />
      <path d="M12 16v-4" />
      <path d="M12 8h.01" />
    </svg>
  );
}

export default function MembershipPage() {
  const { ready } = useRequireAuth();
  const { data } = useRegistration();
  const [plans, setPlans] = useState<MembershipPlanResponse[] | null>(null);
  const [orderingPlanId, setOrderingPlanId] = useState<string | null>(null);
  const [order, setOrder] = useState<OrderResponse | null>(null);
  const [orderError, setOrderError] = useState<string | null>(null);
  const [showAllPackages, setShowAllPackages] = useState(false);
  const [activeTooltip, setActiveTooltip] = useState<string | null>(null);

  useEffect(() => {
    listMembershipPlans()
      .then((result) => setPlans(result.items))
      .catch(() => {
        // Fallback gracefully to predefined membership tiers
      });
  }, []);

  async function handlePayNow(plan: PlanDetail) {
    if (!data.accessToken) return;
    setOrderingPlanId(plan.id);
    setOrderError(null);
    setOrder(null);

    // If backend already has this plan ID from the API list, use it; otherwise use the tier id
    const backendPlan = plans?.find(
      (p) => p.name.toLowerCase().includes(plan.name.split(' ')[0]!.toLowerCase()) || p.id === plan.id,
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
    <>
      <AppHeader />
      <main className="min-h-screen bg-[#FFF9F2] text-[#2B1515] px-4 py-8 sm:px-6 sm:py-10 lg:px-8 xl:px-12 2xl:px-16">
        <div className="w-full max-w-6xl mx-auto flex flex-col gap-8">
          {/* Header Banner */}
          <div className="text-center space-y-2">
            <div className="inline-flex items-center gap-1.5 rounded-full bg-[#FFE6E6] border border-[#FFCCD0] px-3.5 py-1 text-xs font-bold text-[#A81B24] tracking-wide">
              <span>🔥 Offer ends today</span>
            </div>
            <h1 className="font-[family-name:var(--font-heading,serif)] text-2xl sm:text-3xl lg:text-4xl font-bold text-[#680A0E] tracking-tight">
              Upgrade Your Membership
            </h1>
            <p className="max-w-xl mx-auto text-xs sm:text-sm text-[#776B62]">
              Choose the plan that suits your matrimony search to connect directly with verified Nadar families.
            </p>
          </div>

          {/* Pricing Cards Grid */}
          <div className="grid grid-cols-1 gap-6 md:grid-cols-3 items-stretch pt-2">
            {MEMBERSHIP_TIERS.map((tier) => {
              const isProcessing = orderingPlanId === tier.id;

              return (
                <div
                  key={tier.id}
                  className={`relative flex flex-col justify-between rounded-3xl bg-white transition-all duration-300 hover:shadow-xl ${
                    tier.isBestSeller
                      ? 'border-2 border-[#A81B24] shadow-lg ring-1 ring-[#A81B24]/20'
                      : 'border border-[#E8DCC8] shadow-sm hover:border-[#D6A33A]'
                  }`}
                >
                  {/* Best Seller Ribbon Tag */}
                  {tier.isBestSeller && (
                    <div className="absolute -top-3.5 right-6 z-10">
                      <span className="rounded-full bg-[#A81B24] px-3 py-1 text-[11px] font-bold tracking-wider text-white shadow-sm uppercase">
                        Best Seller
                      </span>
                    </div>
                  )}

                  <div className="p-6 sm:p-7 flex-1 flex flex-col">
                    {/* Plan Title */}
                    <div className="text-center pb-3">
                      <h2 className="text-base sm:text-lg font-bold text-[#2B1515]">
                        {tier.name}
                      </h2>
                    </div>

                    {/* Discount Tag */}
                    <div className="text-center mb-3">
                      <span className="inline-block text-xs font-bold text-[#0D9488] bg-[#F0FDFA] border border-[#CCFBF1] px-2.5 py-0.5 rounded-md">
                        {tier.discountBadge}
                      </span>
                    </div>

                    {/* Pricing Block */}
                    <div className="text-center mb-3">
                      <div className="flex items-baseline justify-center gap-2">
                        <span className="text-sm sm:text-base font-semibold text-[#968A82] line-through">
                          ₹{tier.strikethroughPrice.toLocaleString('en-IN')}
                        </span>
                        <span className="text-3xl sm:text-4xl font-extrabold text-[#2B1515] tracking-tight">
                          ₹{tier.price.toLocaleString('en-IN')}
                        </span>
                      </div>

                      {/* Per Month Sub-pill */}
                      <div className="mt-2 flex justify-center">
                        <span className="text-xs font-semibold text-[#8E5311] bg-[#FFF8EB] border border-[#FED7AA] px-3 py-0.5 rounded-full">
                          {tier.perMonthText}
                        </span>
                      </div>
                    </div>

                    {/* Feature Checkpoints */}
                    <div className="my-5 border-t border-[#F2EAE0] pt-5 flex-1">
                      <ul className="space-y-3 text-xs sm:text-sm text-[#443833]">
                        {tier.features.map((feat, idx) => (
                          <li key={idx} className="flex items-start gap-2.5 leading-snug">
                            <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-[#ECFDF5] text-[#059669] mt-0.5">
                              <CheckIcon className="h-3 w-3" />
                            </span>
                            <div className="flex-1 flex items-center gap-1.5">
                              <span>{feat.text}</span>
                              {feat.hasInfo && (
                                <button
                                  type="button"
                                  onClick={() =>
                                    setActiveTooltip(activeTooltip === feat.text ? null : feat.text)
                                  }
                                  className="text-[#968A82] hover:text-[#2B1515] transition-colors"
                                  title={feat.note}
                                >
                                  <InfoCircleIcon className="h-3.5 w-3.5" />
                                </button>
                              )}
                            </div>
                          </li>
                        ))}
                      </ul>

                      {/* Optional Know More link on Premium */}
                      {tier.isBestSeller && (
                        <div className="mt-4 text-center">
                          <button
                            type="button"
                            onClick={() => setShowAllPackages(true)}
                            className="text-xs font-semibold text-[#D95A00] hover:text-[#B44700] transition-colors inline-flex items-center gap-1"
                          >
                            Know More &gt;
                          </button>
                        </div>
                      )}
                    </div>

                    {/* Pay Now Button */}
                    <div className="pt-2">
                      <button
                        type="button"
                        disabled={isProcessing}
                        onClick={() => void handlePayNow(tier)}
                        className="w-full flex items-center justify-center py-3 px-4 rounded-xl text-white font-bold text-sm sm:text-base shadow-md transition-all duration-200 bg-gradient-to-r from-[#E66700] via-[#E85D04] to-[#DC2F02] hover:brightness-105 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {isProcessing ? 'Processing…' : 'Pay Now'}
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* View All Packages Link */}
          <div className="text-center pt-2">
            <button
              type="button"
              onClick={() => setShowAllPackages((v) => !v)}
              className="text-sm font-semibold text-[#D95A00] hover:text-[#B44700] transition-colors"
            >
              {showAllPackages ? 'Hide Packages Details ∧' : 'View All Packages >'}
            </button>
          </div>

          {/* Detailed Comparison Table when opened */}
          {showAllPackages && (
            <div className="rounded-2xl border border-[#E8DCC8] bg-white p-6 shadow-sm overflow-x-auto">
              <h3 className="text-lg font-bold text-[#680A0E] mb-4">Package Comparison</h3>
              <table className="w-full text-left text-xs sm:text-sm">
                <thead>
                  <tr className="border-b border-[#F2EAE0] text-[#776B62]">
                    <th className="py-2.5 pr-4 font-semibold">Features</th>
                    <th className="py-2.5 px-3 font-semibold text-center">Gold (₹1,499)</th>
                    <th className="py-2.5 px-3 font-semibold text-center">Gold + (₹2,299)</th>
                    <th className="py-2.5 px-3 font-semibold text-center font-bold text-[#A81B24]">Gold Premium (₹5,999)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#F9F5EF] text-[#2B1515]">
                  <tr>
                    <td className="py-3 pr-4 font-medium">Validity</td>
                    <td className="py-3 px-3 text-center">3 Months</td>
                    <td className="py-3 px-3 text-center">3 Months</td>
                    <td className="py-3 px-3 text-center font-bold text-[#A81B24]">12 Months</td>
                  </tr>
                  <tr>
                    <td className="py-3 pr-4 font-medium">Verified Phone Numbers</td>
                    <td className="py-3 px-3 text-center">50</td>
                    <td className="py-3 px-3 text-center">Unlimited*</td>
                    <td className="py-3 px-3 text-center font-bold">Unlimited*</td>
                  </tr>
                  <tr>
                    <td className="py-3 pr-4 font-medium">Chat &amp; Direct Messaging</td>
                    <td className="py-3 px-3 text-center">Unlimited</td>
                    <td className="py-3 px-3 text-center">Unlimited</td>
                    <td className="py-3 px-3 text-center font-bold">Unlimited</td>
                  </tr>
                  <tr>
                    <td className="py-3 pr-4 font-medium">Horoscope Compatibility Views</td>
                    <td className="py-3 px-3 text-center">Unlimited</td>
                    <td className="py-3 px-3 text-center">Unlimited</td>
                    <td className="py-3 px-3 text-center font-bold">Unlimited</td>
                  </tr>
                  <tr>
                    <td className="py-3 pr-4 font-medium">Profile Priority Listing</td>
                    <td className="py-3 px-3 text-center text-[#968A82]">—</td>
                    <td className="py-3 px-3 text-center">Included</td>
                    <td className="py-3 px-3 text-center font-bold text-[#059669]">Top Spotlight</td>
                  </tr>
                  <tr>
                    <td className="py-3 pr-4 font-medium">Dedicated Relationship Manager</td>
                    <td className="py-3 px-3 text-center text-[#968A82]">—</td>
                    <td className="py-3 px-3 text-center text-[#968A82]">—</td>
                    <td className="py-3 px-3 text-center font-bold text-[#059669]">Dedicated Assistant</td>
                  </tr>
                </tbody>
              </table>
            </div>
          )}

          {/* Feedback & Error Cards */}
          {orderError && (
            <Card className="rounded-2xl border border-red-200 bg-red-50 p-5 text-sm text-[#94151C]">
              {orderError}
            </Card>
          )}

          {order && (
            <Card className="rounded-2xl border border-[#FDE68A] bg-[#FEF3C7] p-6 text-sm shadow-sm">
              <h4 className="font-bold text-[#92400E] text-base mb-1">
                Order Created Successfully
              </h4>
              <p className="text-xs text-[#78350F]">
                Order ID: <code className="font-mono">{order.id}</code> · Amount:{' '}
                <strong>₹{(order.amountInPaise / 100).toLocaleString('en-IN')}</strong> · Status:{' '}
                <span className="uppercase font-semibold">{order.status}</span>
              </p>
              <p className="mt-2 text-xs text-[#92400E]/80">
                Payment gateway connection in sandbox mode. Once payment gateway settles, your membership activates automatically.
              </p>
            </Card>
          )}

          {/* Dashed Support Divider and Chat Bar */}
          <div className="pt-4 border-t border-dashed border-[#D6C7B2] text-center space-y-3">
            <p className="text-sm font-semibold text-[#2B1515]">
              Need any help in making payment?
            </p>
            <div className="flex items-center justify-center gap-3">
              <a
                href="https://wa.me/919876543210"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 rounded-full border border-[#059669]/30 bg-white px-5 py-2 text-xs font-bold text-[#059669] shadow-sm transition-all hover:bg-[#ECFDF5] hover:border-[#059669]"
              >
                <span>💬 Chat with us</span>
              </a>
              <a
                href="tel:18004190123"
                className="inline-flex items-center gap-1.5 text-xs font-medium text-[#776B62] hover:text-[#2B1515] transition-colors"
              >
                <span>📞 Toll Free: 1800-419-0123</span>
              </a>
            </div>
          </div>
        </div>
      </main>
    </>
  );
}
