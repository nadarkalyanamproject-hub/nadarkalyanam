'use client';

import type { MembershipPlanResponse } from '@nadar-kalyanam/schemas';
import { ArrowRight, Crown, HeartHandshake, PhoneCall, UserCheck } from 'lucide-react';
import { discountPercent, durationLabel, formatPrice } from '../../lib/membership';
import { motion } from 'motion/react';
import { CountDownPrice, SAVING_DELAY, StrikeIn } from '../motion/price-animation';
import { BUTTON_MOTION, MotionLink, Reveal } from '../motion/motion';

// The assisted services the promo describes. They aren't running yet, so the
// promo says "starting soon" rather than claiming a manager is assigned.
const SERVICES = [
  { icon: UserCheck, text: 'Handpicked, pre-screened matches' },
  { icon: HeartHandshake, text: 'Follow-ups with interested families' },
  { icon: PhoneCall, text: 'Help arranging family meetings' },
];

// A compact VIP strip: plain deep maroon, one serif line, the services as
// text, and the price with a single gold button. No photo or decoration.
export function VipPromo({ plan }: { plan: MembershipPlanResponse }) {
  const percentOff = discountPercent(plan.priceInPaise, plan.originalPriceInPaise);
  const hasDiscount = percentOff !== null && plan.originalPriceInPaise !== null;

  return (
    <Reveal
      as="section"
      className="relative overflow-hidden rounded-2xl border border-[#5A1A24] bg-[#3A0E15]"
      data-testid="home-vip-promo"
    >
      <Crown
        className="pointer-events-none absolute -right-6 -bottom-8 hidden h-48 w-48 text-nk-gold-light/[0.06] lg:block"
        strokeWidth={1}
        aria-hidden="true"
      />
      <div className="h-px bg-gradient-to-r from-transparent via-nk-gold-light/60 to-transparent" aria-hidden="true" />
      <div className="relative flex flex-col gap-8 px-6 py-10 sm:px-12 sm:py-14 md:flex-row md:items-center md:justify-between md:gap-10">
        <div className="min-w-0">
          <p className="flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.2em] text-nk-gold-light">
            <Crown className="h-4 w-4" aria-hidden="true" />
            VIP Gold Plus · Assisted service
          </p>
          <h2 className="mt-3 font-serif text-2xl font-semibold leading-snug text-[#F0D58C] sm:text-3xl">
            Find your match with a dedicated Relationship Manager
          </h2>
          <ul className="mt-4 space-y-2 text-base text-[#CDB3A6]">
            {SERVICES.map(({ icon: Icon, text }) => (
              <li key={text} className="flex items-center gap-3">
                <Icon className="h-4 w-4 shrink-0 text-nk-gold-light" strokeWidth={1.75} aria-hidden="true" />
                {text}
              </li>
            ))}
          </ul>
        </div>

        <div className="flex shrink-0 items-center gap-10 border-t border-white/10 pt-6 md:border-l md:border-t-0 md:pl-12 md:pt-0">
          <div>
            <p className="flex items-center gap-1.5 text-sm uppercase tracking-wider text-[#B99A8C]">
              <Crown className="h-3.5 w-3.5 text-nk-gold-light" aria-hidden="true" />
              {durationLabel(plan.durationDays)} VIP plan
            </p>
            <p className="mt-0.5 flex items-baseline gap-2">
              <CountDownPrice
                from={hasDiscount ? plan.originalPriceInPaise! : plan.priceInPaise}
                to={plan.priceInPaise}
                className="text-4xl font-bold tabular-nums text-[#F0D58C]"
                testId="vip-promo-price"
              />
              {hasDiscount && (
                <StrikeIn className="text-lg text-[#9C7F73]">{formatPrice(plan.originalPriceInPaise!)}</StrikeIn>
              )}
            </p>
            {hasDiscount && (
              <motion.p
                className="text-sm font-semibold text-nk-gold-light"
                data-testid="vip-promo-discount"
                initial={{ opacity: 0, y: 6 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ type: 'spring', stiffness: 380, damping: 18, delay: SAVING_DELAY }}
              >
                Save {percentOff}%
              </motion.p>
            )}
          </div>
          <div className="flex flex-col items-start gap-2">
            <MotionLink
              {...BUTTON_MOTION}
              href="/membership"
              className="inline-flex items-center gap-2 rounded-lg bg-[#D9B45A] px-7 py-3.5 text-base font-semibold text-[#2A0A0F] transition-colors hover:bg-[#E6C36B]"
              data-testid="vip-promo-cta"
            >
              <Crown className="h-4 w-4" aria-hidden="true" />
              Get VIP Gold Plus
              <ArrowRight className="h-4 w-4" />
            </MotionLink>
            <p className="text-sm text-[#B99A8C]" data-testid="vip-promo-note">
              Assisted services are starting soon.
            </p>
          </div>
        </div>
      </div>
    </Reveal>
  );
}
