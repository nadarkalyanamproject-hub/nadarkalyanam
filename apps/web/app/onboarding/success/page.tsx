'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useRequireAuth } from '../../../lib/use-require-auth';

// How long the welcome animation plays before the member lands on Home.
const REDIRECT_MS = 2600;
// With reduced motion the animation is skipped, so don't make them wait.
const REDUCED_MOTION_REDIRECT_MS = 900;

// Eight marigold petals bursting out of the check mark (angle in degrees).
const PETALS = [0, 45, 90, 135, 180, 225, 270, 315];

// Shown for a moment right after sign-up: a check mark draws itself, petals
// burst out, then the member goes straight to Home. `replace`, so Back from
// Home never lands on this screen again.
export default function OnboardingSuccessPage() {
  const { ready } = useRequireAuth();
  const router = useRouter();

  useEffect(() => {
    if (!ready) return;
    router.prefetch('/');
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const timer = window.setTimeout(() => router.replace('/'), reduced ? REDUCED_MOTION_REDIRECT_MS : REDIRECT_MS);
    return () => window.clearTimeout(timer);
  }, [ready, router]);

  if (!ready) return null;

  return (
    <main
      className="relative flex min-h-dvh items-center justify-center overflow-hidden bg-nk-ivory px-4"
      role="status"
      aria-live="polite"
      data-testid="signup-welcome"
    >
      {/* Soft warm glow behind the mark */}
      <div className="pointer-events-none absolute h-[520px] w-[520px] rounded-full bg-[radial-gradient(circle,rgba(233,181,63,0.22)_0%,rgba(255,253,249,0)_65%)] motion-safe:animate-nk-glow" />

      <div className="relative flex flex-col items-center text-center">
        <div className="relative h-28 w-28">
          {PETALS.map((angle, i) => (
            <span
              key={angle}
              aria-hidden="true"
              className="nk-petal absolute left-1/2 top-1/2 h-3.5 w-2.5 rounded-[50%_50%_50%_50%/60%_60%_40%_40%] motion-reduce:hidden"
              style={
                {
                  '--nk-angle': `${angle}deg`,
                  background: i % 2 ? '#E9B53F' : '#E07B24',
                  animationDelay: `${520 + (i % 4) * 30}ms`,
                } as React.CSSProperties
              }
            />
          ))}

          <svg viewBox="0 0 112 112" className="relative h-28 w-28 motion-safe:animate-nk-pop-in" aria-hidden="true">
            <circle cx="56" cy="56" r="52" fill="var(--color-nk-maroon)" />
            <circle cx="56" cy="56" r="47" fill="none" stroke="var(--color-nk-gold-light)" strokeOpacity="0.55" strokeWidth="1.5" />
            <path
              d="M34 58 L50 73 L79 41"
              fill="none"
              stroke="#FFFDF9"
              strokeWidth="7"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="nk-check"
            />
          </svg>
        </div>

        <h1 className="mt-8 font-[family-name:var(--font-heading,serif)] text-2xl font-bold text-nk-ink motion-safe:animate-nk-fade-up sm:text-3xl">
          Welcome to Nadar Kalyanam
        </h1>
        <p className="mt-2 text-sm text-nk-muted motion-safe:animate-nk-fade-up [animation-delay:150ms] sm:text-base">
          Your profile is ready. Taking you to your matches…
        </p>
      </div>
    </main>
  );
}
