"use client";

import * as React from "react";
import { useRef, useState } from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { TimelineContent } from "@/components/ui/timeline-animation";
import NumberFlow from "@number-flow/react";
import {
  Calendar,
  Check,
  Crown,
  MessageSquare,
  Phone,
  Sparkles,
  UserCheck,
} from "lucide-react";
import { motion } from "motion/react";

export interface PricingPlan {
  id?: string;
  name: string;
  durationLabel: string;
  description: string;
  price: number;
  yearlyPrice: number;
  buttonText: string;
  popular?: boolean;
  features: { text: string; icon: React.ReactNode }[];
  includes: string[];
}

export const defaultNadarPlans: PricingPlan[] = [
  {
    id: "plan-gold-3m",
    name: "Gold",
    durationLabel: "3 MONTHS",
    description: "Ideal for individuals beginning their search for a compatible life partner",
    price: 1499,
    yearlyPrice: 1499,
    buttonText: "Choose Plan",
    features: [
      { text: "50 Verified Phone Numbers", icon: <Phone size={18} /> },
      { text: "Send unlimited messages", icon: <MessageSquare size={18} /> },
      { text: "Unlimited horoscope views", icon: <Calendar size={18} /> },
      { text: "View verified profiles with photos", icon: <Sparkles size={18} /> },
    ],
    includes: [
      "Plan includes:",
      "Express interest to any profile",
      "Standard profile search listing",
      "Daily matched recommendations",
    ],
  },
  {
    id: "plan-gold-plus-3m",
    name: "Gold Plus",
    durationLabel: "3 MONTHS",
    description: "Best for families seeking direct contacts and prominent profile visibility",
    price: 2299,
    yearlyPrice: 2299,
    buttonText: "Choose Plan",
    features: [
      { text: "Unlimited Phone Numbers*", icon: <Phone size={18} /> },
      { text: "Send unlimited messages", icon: <MessageSquare size={18} /> },
      { text: "Unlimited horoscope views", icon: <Calendar size={18} /> },
      { text: "Priority profile listing in search", icon: <Sparkles size={18} /> },
    ],
    includes: [
      "Everything in Gold, plus:",
      "Direct WhatsApp contact sharing",
      "Priority search placement in matches",
      "Fair usage unlimited phone views",
    ],
  },
  {
    id: "plan-gold-premium-12m",
    name: "Gold Premium",
    durationLabel: "12 MONTHS",
    description: "Complete 1-year matrimony assistance with personalized matchmaking",
    price: 5999,
    yearlyPrice: 5999,
    buttonText: "Choose Plan",
    popular: true,
    features: [
      { text: "Unlimited Phone Numbers*", icon: <Phone size={18} /> },
      { text: "Send unlimited messages", icon: <MessageSquare size={18} /> },
      { text: "Unlimited horoscope views", icon: <Calendar size={18} /> },
      { text: "Dedicated Relationship Manager", icon: <UserCheck size={18} /> },
      { text: "Top priority profile spotlight", icon: <Crown size={18} /> },
    ],
    includes: [
      "Everything in Gold Plus, plus:",
      "Personal Relationship Manager support",
      "Top spot spotlight to all matching profiles",
      "Handpicked weekly profile recommendations",
    ],
  },
];

export interface PricingSectionProps {
  title?: React.ReactNode;
  subtitle?: string;
  badge?: string;
  currencySymbol?: string;
  plans?: PricingPlan[];
  onSelectPlan?: (plan: PricingPlan) => void;
  className?: string;
}

export default function PricingSection({
  title,
  subtitle = "Choose a membership that fits your search.",
  badge = "MEMBERSHIP",
  currencySymbol = "₹",
  plans = defaultNadarPlans,
  onSelectPlan,
  className = "",
}: PricingSectionProps) {
  const pricingRef = useRef<HTMLDivElement>(null);

  const revealVariants = {
    visible: (i: number) => ({
      y: 0,
      opacity: 1,
      transition: {
        delay: i * 0.1,
        duration: 0.35,
      },
    }),
    hidden: {
      y: -10,
      opacity: 0,
    },
  };

  return (
    <div
      className={`px-4 py-10 w-full max-w-6xl mx-auto bg-[#FFFDF9] ${className}`}
      ref={pricingRef}
    >
      <div className="text-center mb-8 max-w-2xl mx-auto space-y-2">
        {badge && (
          <p className="text-xs font-bold tracking-[0.2em] text-[#680A0E] uppercase">
            {badge}
          </p>
        )}

        <TimelineContent
          as="h1"
          animationNum={0}
          timelineRef={pricingRef}
          customVariants={revealVariants}
          className="text-2xl sm:text-3xl lg:text-4xl font-extrabold text-[#2B1515] tracking-tight font-[family-name:var(--font-heading,serif)]"
        >
          {title || "Your Journey to Finding the Right Match"}
        </TimelineContent>

        <TimelineContent
          as="p"
          animationNum={1}
          timelineRef={pricingRef}
          customVariants={revealVariants}
          className="text-xs sm:text-sm text-[#73645C]"
        >
          {subtitle}
        </TimelineContent>
      </div>

      <div className="grid md:grid-cols-3 gap-5 items-stretch">
        {plans.map((plan, index) => (
          <TimelineContent
            key={plan.name}
            as="div"
            animationNum={2 + index}
            timelineRef={pricingRef}
            customVariants={revealVariants}
            className="flex"
          >
            <Card
              className={`relative flex flex-col justify-between w-full rounded-2xl bg-white transition-all duration-200 shadow-sm hover:shadow-md ${
                plan.popular
                  ? "border-2 border-[#C89B3C] ring-1 ring-[#C89B3C]/25 shadow-sm"
                  : "border border-[#E8DCCF] hover:border-[#D6A33A]"
              }`}
            >
              {plan.popular && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 z-10">
                  <span className="rounded-full bg-[#C89B3C] px-3.5 py-0.5 text-[11px] font-bold uppercase tracking-wider text-white shadow-xs">
                    Popular
                  </span>
                </div>
              )}

              <CardHeader className="text-left p-5 sm:p-6 pb-2">
                <div className="text-center pb-3 border-b border-[#F4ECE3]">
                  <h3 className="text-lg sm:text-xl font-bold text-[#2B1515]">
                    {plan.name}
                  </h3>
                  <p className="text-[11px] font-bold text-[#8C7B73] tracking-wider mt-0.5 uppercase">
                    {plan.durationLabel}
                  </p>
                </div>

                <div className="text-center py-4">
                  <span className="text-3xl sm:text-4xl font-extrabold text-[#2B1515] tracking-tight">
                    {currencySymbol}
                    <NumberFlow
                      value={plan.price}
                      format={{ useGrouping: true }}
                      className="text-3xl sm:text-4xl font-extrabold"
                    />
                  </span>
                </div>
              </CardHeader>

              <CardContent className="p-5 sm:p-6 pt-0 flex flex-col flex-1 justify-between">
                <div>
                  <ul className="space-y-2.5 pb-5">
                    {plan.features.map((feature, featureIndex) => (
                      <li key={featureIndex} className="flex items-start text-left text-xs sm:text-sm text-[#443833]">
                        <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-[#FAF5EC] text-[#C89B3C] mr-2.5 mt-0.5">
                          <Check className="h-3 w-3 stroke-[2.5]" />
                        </span>
                        <span>{feature.text}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="pt-3 border-t border-[#F4ECE3]">
                  <button
                    type="button"
                    onClick={() => onSelectPlan?.(plan)}
                    className={`w-full py-2.5 px-4 rounded-xl font-bold text-xs sm:text-sm transition-all duration-150 cursor-pointer shadow-xs ${
                      plan.popular
                        ? "bg-[#680A0E] hover:bg-[#52070A] text-white shadow-[#680A0E]/20"
                        : "bg-[#FDF9F3] hover:bg-[#F7EBDC] text-[#680A0E] border border-[#DFC392]"
                    }`}
                  >
                    {plan.buttonText}
                  </button>
                </div>
              </CardContent>
            </Card>
          </TimelineContent>
        ))}
      </div>
    </div>
  );
}
