'use client';

import Link from 'next/link';
import type { MembershipPlanResponse } from '@nadar-kalyanam/schemas';
import { PhoneCall, UserCheck, Users } from 'lucide-react';
import { VipEnquiry } from '../membership/vip-enquiry';
import { durationLabel, formatPrice } from '../../lib/membership';

// The assisted services the promo describes. They aren't running yet, so the
// promo says "starting soon" and its button asks the team to call back
// (a real VIP enquiry), never claims a manager is already assigned.
const SERVICES = [
  { icon: Users, text: 'Handpicked, pre-screened matches' },
  { icon: UserCheck, text: 'Regular follow-ups with interested families' },
  { icon: PhoneCall, text: 'Help arranging family calls and meetings' },
];

function GoldBadge() {
  return (
    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[#F1D278] to-[#B8892A] shadow-md">
      <svg viewBox="0 0 24 24" className="h-5 w-5 text-[#3E1118]" fill="currentColor" aria-hidden="true">
        <path d="M12 2.5l2.4 2 3.1-.3.7 3 2.6 1.8-1.2 2.9 1.2 2.9-2.6 1.8-.7 3-3.1-.3-2.4 2-2.4-2-3.1.3-.7-3-2.6-1.8L4.4 12 3.2 9.1l2.6-1.8.7-3 3.1.3L12 2.5Zm0 5.2-1.3 2.7-3 .4 2.2 2.1-.5 3L12 14.5l2.6 1.4-.5-3 2.2-2.1-3-.4L12 7.7Z" />
      </svg>
    </span>
  );
}

// Stock photo of a matchmaker (Avinash Narnaware on Unsplash, Unsplash
// License): illustrative only. Swap for a real team photo via `imageUrl`
// when the client provides one.
const DEFAULT_IMAGE = '/assets/vip-matchmaker.jpg';

export function VipPromo({ plan, imageUrl = DEFAULT_IMAGE }: { plan: MembershipPlanResponse; imageUrl?: string }) {
  return (
    <section
      className="relative overflow-hidden rounded-3xl border border-nk-gold-light/40 bg-gradient-to-br from-[#3A0E15] via-[#4A121B] to-[#2A0A0F] text-white shadow-xl"
      data-testid="home-vip-promo"
    >
      {/* Soft mandala corner, like the reference's leaf motif */}
      <svg viewBox="0 0 100 100" className="pointer-events-none absolute -right-6 -top-6 h-28 w-28 text-nk-gold-light/15" aria-hidden="true">
        <circle cx="50" cy="50" r="46" fill="none" stroke="currentColor" />
        <circle cx="50" cy="50" r="32" fill="none" stroke="currentColor" />
        <circle cx="50" cy="50" r="18" fill="none" stroke="currentColor" />
      </svg>

      {/* Matchmaker photo: fills the right side on wider screens, fading into
          the maroon on its left edge. */}
      <div className="pointer-events-none absolute inset-y-0 right-0 hidden w-[40%] md:block" aria-hidden="true">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={imageUrl}
          alt=""
          className="h-full w-full object-cover object-[50%_18%] opacity-95 [mask-image:linear-gradient(to_right,transparent_0%,black_45%)]"
        />
      </div>

      <div className="relative flex flex-col gap-6 p-6 sm:p-8 md:flex-row md:items-center lg:p-10">
        <div className="min-w-0 flex-1 md:max-w-[62%]">
          <div className="flex items-center gap-3">
            <GoldBadge />
            <h2 className="text-xl font-bold text-[#F6DE94] sm:text-2xl">VIP Gold Plus Service</h2>
          </div>
          <p className="mt-2 text-base font-semibold text-white sm:text-lg">
            Find your match with a <span className="text-[#F6DE94]">dedicated Relationship Manager</span>
          </p>

          <div className="mt-5 max-w-xl rounded-2xl border border-nk-gold-light/45 bg-black/15 p-5">
            <ul className="space-y-3.5">
              {SERVICES.map(({ icon: Icon, text }) => (
                <li key={text} className="flex items-center gap-3 text-sm text-[#F3E6DC] sm:text-[15px]">
                  <Icon className="h-5 w-5 shrink-0 text-[#E9C46A]" />
                  {text}
                </li>
              ))}
            </ul>

            <div className="mt-5 flex flex-wrap items-center gap-x-4 gap-y-2">
              <div className="w-full sm:w-auto">
                <VipEnquiry
                  label="Request a Relationship Manager"
                  returnTo="/"
                  buttonClassName="w-full cursor-pointer rounded-xl bg-gradient-to-r from-[#B8892A] via-[#E9C46A] to-[#B8892A] px-6 py-3 text-sm font-bold text-[#3A0E15] shadow-lg transition-opacity hover:opacity-95 sm:w-auto"
                />
              </div>
              <Link href="/membership" className="text-xs font-semibold text-[#F6DE94] underline-offset-2 hover:underline">
                VIP plan: {formatPrice(plan.priceInPaise)} for {durationLabel(plan.durationDays)}
              </Link>
            </div>
            <p className="mt-3 text-[11px] text-[#E2D2C8]/75" data-testid="vip-promo-note">
              Assisted services are starting soon. Send a request and our team will call you on your registered number.
            </p>
          </div>
        </div>

        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={imageUrl} alt="" className="mx-auto h-56 w-full max-w-xs rounded-2xl object-cover object-[50%_18%] md:hidden" />
      </div>
    </section>
  );
}
