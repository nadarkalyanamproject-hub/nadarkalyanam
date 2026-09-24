"use client";

import * as React from "react";
import { motion, type Variants } from "motion/react";

export interface TimelineContentProps extends React.HTMLAttributes<HTMLElement> {
  as?: string | React.ElementType;
  animationNum?: number;
  timelineRef?: React.RefObject<HTMLElement | null>;
  customVariants?: Variants;
  children?: React.ReactNode;
  className?: string;
}

export function TimelineContent({
  as: Component = "div",
  animationNum = 0,
  timelineRef: _timelineRef,
  customVariants,
  children,
  className,
  ...props
}: TimelineContentProps) {
  const MotionComponent = (
    typeof Component === "string" && Component in motion
      ? (motion as Record<string, any>)[Component]
      : motion.create(typeof Component === "string" ? Component : "div")
  ) as React.ComponentType<any>;

  const defaultVariants: Variants = {
    visible: (i: number) => ({
      y: 0,
      opacity: 1,
      filter: "blur(0px)",
      transition: {
        delay: i * 0.2,
        duration: 0.5,
      },
    }),
    hidden: {
      filter: "blur(10px)",
      y: -20,
      opacity: 0,
    },
  };

  return (
    <MotionComponent
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, margin: "-50px" }}
      custom={animationNum}
      variants={customVariants || defaultVariants}
      className={className}
      {...props}
    >
      {children}
    </MotionComponent>
  );
}
