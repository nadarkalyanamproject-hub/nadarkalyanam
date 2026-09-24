"use client";

import * as React from "react";
import { useRef, useState } from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { TimelineContent } from "@/components/ui/timeline-animation";
import NumberFlow from "@number-flow/react";
import {
  Calendar,
  CheckCheck,
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
  description: string;
  price: number;
  yearlyPrice: number;
  buttonText: string;
  buttonVariant?: "default" | "outline";
  popular?: boolean;
  features: { text: string; icon: React.ReactNode }[];
  includes: string[];
}

export const defaultNadarPlans: PricingPlan[] = [
  {
    id: "plan-gold-3m",
    name: "Gold",
    description: "Ideal for individuals starting their journey to find a compatible Nadar match",
    price: 1499,
    yearlyPrice: 4499,
    buttonText: "Choose Gold",
    buttonVariant: "outline",
    features: [
      { text: "Valid for 3 months", icon: <Calendar size={20} /> },
      { text: "View 50 Phone Numbers", icon: <Phone size={20} /> },
      { text: "Send unlimited messages", icon: <MessageSquare size={20} /> },
    ],
    includes: [
      "Gold plan includes:",
      "Unlimited horoscope views",
      "View verified profiles with photos",
      "Standard profile listing",
      "Express interest to any profile",
    ],
  },
  {
    id: "plan-gold-plus-3m",
    name: "Gold +",
    description: "Best value for families who want direct contacts and prominent profile visibility",
    price: 2299,
    yearlyPrice: 6899,
    buttonText: "Choose Gold +",
    buttonVariant: "outline",
    features: [
      { text: "Valid for 3 months", icon: <Calendar size={20} /> },
      { text: "Unlimited Phone Numbers*", icon: <Phone size={20} /> },
      { text: "Priority profile listing", icon: <Sparkles size={20} /> },
    ],
    includes: [
      "Everything in Gold, plus:",
      "Fair usage unlimited phone views",
      "Priority search placement in matches",
      "Direct WhatsApp contact sharing",
      "Profile verification highlight badge",
    ],
  },
  {
    id: "plan-gold-premium-12m",
    name: "Gold Premium",
    description: "Top-tier 12-month complete matrimony assistance with personalized matchmaking",
    price: 5999,
    yearlyPrice: 5999,
    buttonText: "Choose Gold Premium",
    buttonVariant: "default",
    popular: true,
    features: [
      { text: "Full 12 Months Validity", icon: <Calendar size={20} /> },
      { text: "Unlimited Phone & Horoscope Views", icon: <Crown size={20} /> },
      { text: "Dedicated Relationship Manager", icon: <UserCheck size={20} /> },
    ],
    includes: [
      "Everything in Gold +, plus:",
      "Personal Relationship Manager support",
      "Top spot spotlight to all matching brides/grooms",
      "Handpicked weekly profile recommendations",
      "Priority customer care on call & WhatsApp",
    ],
  },
];

export interface PricingSwitchProps {
  onSwitch: (value: string) => void;
  monthlyLabel?: string;
  yearlyLabel?: string;
  discountBadge?: string;
}

export const PricingSwitch = ({
  onSwitch,
  monthlyLabel = "Quarterly (3M)",
  yearlyLabel = "Annual (12M)",
  discountBadge = "Save 40%",
}: PricingSwitchProps) => {
  const [selected, setSelected] = useState("0");

  const handleSwitch = (value: string) => {
    setSelected(value);
    onSwitch(value);
  };

  return (
    <div className="flex justify-center">
      <div className="relative z-20 mx-auto flex w-fit rounded-full bg-white/90 border border-neutral-200 p-1 shadow-sm backdrop-blur-sm">
        <button
          type="button"
          onClick={() => handleSwitch("0")}
          className={`relative z-10 w-fit sm:h-12 h-10 rounded-full sm:px-6 px-4 sm:py-2 py-1 text-sm font-semibold transition-colors ${
            selected === "0"
              ? "text-white"
              : "text-neutral-600 hover:text-neutral-900"
          }`}
        >
          {selected === "0" && (
            <motion.span
              layoutId="pricing-switch-pill"
              className="absolute inset-0 rounded-full border border-[#8B1A22] bg-gradient-to-r from-[#A81B24] to-[#7B1118] shadow-md shadow-[#A81B24]/30"
              transition={{ type: "spring", stiffness: 500, damping: 32 }}
            />
          )}
          <span className="relative">{monthlyLabel}</span>
        </button>

        <button
          type="button"
          onClick={() => handleSwitch("1")}
          className={`relative z-10 w-fit sm:h-12 h-10 flex-shrink-0 rounded-full sm:px-6 px-4 sm:py-2 py-1 text-sm font-semibold transition-colors ${
            selected === "1"
              ? "text-white"
              : "text-neutral-600 hover:text-neutral-900"
          }`}
        >
          {selected === "1" && (
            <motion.span
              layoutId="pricing-switch-pill"
              className="absolute inset-0 rounded-full border border-[#8B1A22] bg-gradient-to-r from-[#A81B24] to-[#7B1118] shadow-md shadow-[#A81B24]/30"
              transition={{ type: "spring", stiffness: 500, damping: 32 }}
            />
          )}
          <span className="relative flex items-center gap-2">
            {yearlyLabel}
            {discountBadge && (
              <span className="rounded-full bg-[#FFF1F2] px-2 py-0.5 text-xs font-bold text-[#A81B24] border border-[#FECDD3]">
                {discountBadge}
              </span>
            )}
          </span>
        </button>
      </div>
    </div>
  );
};

export interface PricingSectionProps {
  title?: React.ReactNode;
  subtitle?: string;
  badge?: string;
  currencySymbol?: string;
  plans?: PricingPlan[];
  onSelectPlan?: (plan: PricingPlan, isYearly: boolean) => void;
  className?: string;
}

export default function PricingSection({
  title,
  subtitle = "Choose the right membership to connect directly with verified Nadar families and find your perfect life partner.",
  badge = "NADAR KALYANAM MEMBERSHIP",
  currencySymbol = "₹",
  plans = defaultNadarPlans,
  onSelectPlan,
  className = "",
}: PricingSectionProps) {
  const [isYearly, setIsYearly] = useState(false);
  const pricingRef = useRef<HTMLDivElement>(null);

  const revealVariants = {
    visible: (i: number) => ({
      y: 0,
      opacity: 1,
      filter: "blur(0px)",
      transition: {
        delay: i * 0.15,
        duration: 0.45,
      },
    }),
    hidden: {
      filter: "blur(8px)",
      y: -15,
      opacity: 0,
    },
  };

  const togglePricingPeriod = (value: string) =>
    setIsYearly(Number.parseInt(value) === 1);

  return (
    <div
      className={`px-4 pt-16 pb-20 min-h-screen mx-auto relative bg-[#FFFDF9] overflow-hidden ${className}`}
      ref={pricingRef}
    >
      {/* Background ambient radial aura */}
      <div
        className="absolute top-0 left-[10%] right-[10%] w-[80%] h-[550px] pointer-events-none z-0"
        style={{
          backgroundImage: `radial-gradient(circle at center, rgba(168, 27, 36, 0.12) 0%, rgba(214, 163, 58, 0.08) 45%, transparent 70%)`,
        }}
      />

      <div className="relative z-10 text-center mb-10 max-w-3xl mx-auto">
        {badge && (
          <TimelineContent
            as="div"
            animationNum={0}
            timelineRef={pricingRef}
            customVariants={revealVariants}
            className="inline-flex items-center gap-1.5 rounded-full bg-[#FFE6E6] border border-[#FFCCD0] px-3.5 py-1 text-xs font-bold text-[#A81B24] tracking-wider uppercase mb-4"
          >
            🔥 {badge}
          </TimelineContent>
        )}

        <TimelineContent
          as="h2"
          animationNum={1}
          timelineRef={pricingRef}
          customVariants={revealVariants}
          className="text-3xl sm:text-4xl md:text-5xl font-extrabold text-[#2B1515] tracking-tight mb-4"
        >
          {title || (
            <>
              Plans that work best for your{" "}
              <span className="border border-dashed border-[#A81B24] px-2.5 py-0.5 rounded-xl bg-[#FFF1F2] text-[#A81B24] inline-block">
                Matrimony Search
              </span>
            </>
          )}
        </TimelineContent>

        <TimelineContent
          as="p"
          animationNum={2}
          timelineRef={pricingRef}
          customVariants={revealVariants}
          className="text-sm sm:text-base text-[#6B5A53] sm:w-[85%] w-[95%] mx-auto leading-relaxed"
        >
          {subtitle}
        </TimelineContent>
      </div>

      <TimelineContent
        as="div"
        animationNum={3}
        timelineRef={pricingRef}
        customVariants={revealVariants}
      >
        <PricingSwitch
          onSwitch={togglePricingPeriod}
          monthlyLabel="Quarterly (3M)"
          yearlyLabel="Annual (12M)"
          discountBadge="Save up to 60%"
        />
      </TimelineContent>

      <div className="relative z-10 grid md:grid-cols-3 max-w-7xl gap-6 py-10 mx-auto items-stretch">
        {plans.map((plan, index) => {
          const currentPrice = isYearly ? plan.yearlyPrice : plan.price;
          const periodUnit = isYearly ? "year" : "3 months";

          return (
            <TimelineContent
              key={plan.name}
              as="div"
              animationNum={4 + index}
              timelineRef={pricingRef}
              customVariants={revealVariants}
              className="flex"
            >
              <Card
                className={`relative flex flex-col justify-between w-full rounded-2xl transition-all duration-300 hover:shadow-xl ${
                  plan.popular
                    ? "ring-2 ring-[#A81B24] bg-white shadow-lg border-[#A81B24]/40"
                    : "bg-white border-[#EADFD5] shadow-sm hover:border-[#D6A33A]"
                }`}
              >
                <CardHeader className="text-left pb-4">
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <h3 className="text-2xl font-bold text-[#2B1515]">
                      {plan.name}
                    </h3>
                    {plan.popular && (
                      <span className="bg-gradient-to-r from-[#A81B24] to-[#7B1118] text-white px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider shadow-sm">
                        Best Seller
                      </span>
                    )}
                  </div>
                  <p className="text-xs sm:text-sm text-[#73635B] min-h-[38px] mb-4">
                    {plan.description}
                  </p>
                  <div className="flex items-baseline gap-1 pt-1">
                    <span className="text-3xl sm:text-4xl font-extrabold text-[#2B1515]">
                      {currencySymbol}
                      <NumberFlow
                        value={currentPrice}
                        format={{ useGrouping: true }}
                        className="text-3xl sm:text-4xl font-extrabold"
                      />
                    </span>
                    <span className="text-xs sm:text-sm font-semibold text-[#8C7B73] ml-1">
                      /{periodUnit}
                    </span>
                  </div>
                </CardHeader>

                <CardContent className="pt-0 flex flex-col flex-1 justify-between">
                  <div>
                    <button
                      type="button"
                      onClick={() => onSelectPlan?.(plan, isYearly)}
                      className={`w-full mb-6 py-3.5 px-4 text-base font-bold rounded-xl transition-all duration-200 cursor-pointer ${
                        plan.popular
                          ? "bg-gradient-to-r from-[#A81B24] to-[#800F17] hover:from-[#B91C27] hover:to-[#91131B] text-white shadow-md shadow-[#A81B24]/30"
                          : plan.buttonVariant === "outline"
                            ? "bg-[#FFF9F2] hover:bg-[#FCEFD8] text-[#800F17] border border-[#E7CDAF]"
                            : "bg-[#2B1515] hover:bg-[#432323] text-white"
                      }`}
                    >
                      {plan.buttonText}
                    </button>

                    <ul className="space-y-3 pb-6">
                      {plan.features.map((feature, featureIndex) => (
                        <li key={featureIndex} className="flex items-center text-left">
                          <span className="text-[#A81B24] grid place-content-center mr-3 shrink-0">
                            {feature.icon}
                          </span>
                          <span className="text-xs sm:text-sm font-medium text-[#443833]">
                            {feature.text}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div className="space-y-3 pt-5 border-t border-[#F2EAE0]">
                    <h4 className="font-bold text-xs uppercase tracking-wider text-[#73635B] text-left">
                      {plan.includes[0]}
                    </h4>
                    <ul className="space-y-2.5">
                      {plan.includes.slice(1).map((item, featureIndex) => (
                        <li key={featureIndex} className="flex items-start text-left">
                          <span className="h-5 w-5 bg-[#F0FDF4] border border-[#86EFAC] rounded-full grid place-content-center mr-2.5 shrink-0 mt-0.5">
                            <CheckCheck className="h-3.5 w-3.5 text-[#16A34A]" />
                          </span>
                          <span className="text-xs sm:text-sm text-[#544640]">
                            {item}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </CardContent>
              </Card>
            </TimelineContent>
          );
        })}
      </div>
    </div>
  );
}
