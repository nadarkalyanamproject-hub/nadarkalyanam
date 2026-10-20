'use client';

import type { ReactNode } from 'react';
import Link from 'next/link';
import { MotionConfig, motion, type Transition, type Variants } from 'motion/react';

// Shared motion presets (Framer Motion, published as `motion`). Keep every
// animation on the site built from these so the feel stays consistent:
// short, soft springs, small distances, nothing that bounces for long.

export const SPRING: Transition = { type: 'spring', stiffness: 400, damping: 28, mass: 0.6 };
const EASE_OUT: Transition['ease'] = [0.22, 1, 0.36, 1];

// Buttons: lift a little on hover, press in on tap.
export const BUTTON_MOTION = {
  whileHover: { y: -2, scale: 1.02 },
  whileTap: { y: 0, scale: 0.97 },
  transition: SPRING,
} as const;

// Cards: a gentler lift than buttons.
export const CARD_MOTION = {
  whileHover: { y: -4 },
  transition: SPRING,
} as const;

// Honour the OS "reduce motion" setting everywhere: transforms are skipped,
// opacity fades still run.
export function MotionProvider({ children }: { children: ReactNode }) {
  return <MotionConfig reducedMotion="user">{children}</MotionConfig>;
}

export const MotionLink = motion.create(Link);

// Fades and rises into place the first time it scrolls into view.
export function Reveal({
  children,
  className,
  delay = 0,
  y = 16,
  as = 'div',
  ...rest
}: {
  children: ReactNode;
  className?: string;
  delay?: number;
  y?: number;
  as?: 'div' | 'section';
  // data-testid, data-plan-code etc. pass through to the element.
  [dataAttr: `data-${string}`]: string | undefined;
}) {
  const Tag = as === 'section' ? motion.section : motion.div;
  return (
    <Tag
      className={className}
      initial={{ opacity: 0, y }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '0px 0px -60px 0px' }}
      transition={{ duration: 0.5, ease: EASE_OUT, delay }}
      {...rest}
    >
      {children}
    </Tag>
  );
}

const STAGGER_PARENT: Variants = {
  hidden: {},
  shown: { transition: { staggerChildren: 0.06, delayChildren: 0.05 } },
};
const STAGGER_CHILD: Variants = {
  hidden: { opacity: 0, y: 14 },
  shown: { opacity: 1, y: 0, transition: { duration: 0.42, ease: EASE_OUT } },
};

// A grid whose items appear one after another when it scrolls into view.
export function StaggerGroup({ children, className, id }: { children: ReactNode; className?: string; id?: string }) {
  return (
    <motion.div
      id={id}
      className={className}
      variants={STAGGER_PARENT}
      initial="hidden"
      whileInView="shown"
      viewport={{ once: true, margin: '0px 0px -40px 0px' }}
    >
      {children}
    </motion.div>
  );
}

export function StaggerItem({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <motion.div className={className} variants={STAGGER_CHILD}>
      {children}
    </motion.div>
  );
}
