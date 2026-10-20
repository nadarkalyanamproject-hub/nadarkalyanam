'use client';

import { useEffect, useRef, type ReactNode } from 'react';
import { animate, motion, useInView, useReducedMotion } from 'motion/react';
import { formatPrice } from '../../lib/membership';

// The "discount being applied" sequence shared by the VIP banner and the
// Membership page: the original price is struck through, then the offer
// price counts down to its value, then the saving appears.
export const STRIKE_DELAY = 0.35;
export const COUNT_DELAY = 0.75;
export const COUNT_SECONDS = 1.3;
export const SAVING_DELAY = COUNT_DELAY + COUNT_SECONDS - 0.2;

// Counts down from `from` to `to` once it scrolls into view (straight to
// `to` with reduced motion, or when there's nothing to count).
export function CountDownPrice({
  from,
  to,
  className,
  testId,
}: {
  from: number;
  to: number;
  className?: string;
  testId?: string;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true, margin: '0px 0px -60px 0px' });
  const reduced = useReducedMotion();

  useEffect(() => {
    const el = ref.current;
    if (!el || !inView) return;
    if (reduced || from <= to) {
      el.textContent = formatPrice(to);
      return;
    }
    const controls = animate(from, to, {
      duration: COUNT_SECONDS,
      delay: COUNT_DELAY,
      ease: [0.16, 1, 0.3, 1],
      // Whole rupees only while counting.
      onUpdate: (v) => (el.textContent = formatPrice(Math.round(v / 100) * 100)),
    });
    return () => controls.stop();
  }, [inView, reduced, from, to]);

  return (
    <span ref={ref} className={className} data-testid={testId} aria-label={formatPrice(to)}>
      {formatPrice(from > to ? from : to)}
    </span>
  );
}

// The original price, with its strike drawn across from left to right.
export function StrikeIn({ children, className = '', lineClassName = '', testId }: { children: ReactNode; className?: string; lineClassName?: string; testId?: string }) {
  return (
    <span className={`relative ${className}`} data-testid={testId}>
      {children}
      <motion.span
        className={`absolute left-0 right-0 top-1/2 h-px origin-left bg-current ${lineClassName}`}
        initial={{ scaleX: 0 }}
        whileInView={{ scaleX: 1 }}
        viewport={{ once: true }}
        transition={{ duration: 0.4, delay: STRIKE_DELAY, ease: 'easeOut' }}
        aria-hidden="true"
      />
      <span className="sr-only"> (original price)</span>
    </span>
  );
}
