import type { ReactNode } from 'react';
import { ArrowLeft } from 'lucide-react';
import { Card } from '@nadar-kalyanam/ui';
import { OnboardingStepper } from './onboarding-stepper';

export function OnboardingShell({
  step,
  activePercent,
  title,
  subtitle,
  onBack,
  backDisabled = false,
  children,
}: {
  step: number;
  activePercent: number;
  title: string;
  subtitle: string;
  // Steps 2-4 pass their Back handler (it saves the step's raw input, then
  // goes to the previous step); step 1 passes none, so no Back is shown.
  onBack?: () => void;
  backDisabled?: boolean;
  children: ReactNode;
}) {
  return (
    <main
      className="relative min-h-screen bg-cover bg-center bg-fixed bg-no-repeat px-4 py-8 md:py-12"
      style={{
        backgroundImage: "url('/assets/onboarding_bg.png')",
      }}
    >
      {/* Soft warm overlay to ensure high contrast and legibility */}
      <div className="fixed inset-0 bg-[#FFFDF8]/75 backdrop-blur-[0.5px] pointer-events-none" />

      <div className="relative z-10 mx-auto flex max-w-2xl flex-col gap-6">
        <OnboardingStepper step={step} activePercent={activePercent} />
        <Card className="rounded-2xl border border-[#FFE082]/70 bg-white/95 p-6 md:p-8 shadow-xl backdrop-blur-sm">
          <div className="mb-6">
            {onBack && (
              <button
                type="button"
                onClick={onBack}
                disabled={backDisabled}
                data-testid="onboarding-back"
                className="-ml-1.5 mb-3 inline-flex items-center gap-1 rounded-md px-1.5 py-1 text-sm font-semibold text-[#8E1B24] transition-colors hover:bg-[#8E1B24]/5 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <ArrowLeft className="h-4 w-4" aria-hidden="true" />
                Back
              </button>
            )}
            <h1 className="text-2xl font-bold text-[#8E1B24]">{title}</h1>
            <p className="mt-1 text-sm text-[#5E3D3D]">{subtitle}</p>
          </div>
          {children}
        </Card>
      </div>
    </main>
  );
}
