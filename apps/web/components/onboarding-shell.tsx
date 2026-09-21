import type { ReactNode } from 'react';
import { Card } from '@nadar-kalyanam/ui';
import { OnboardingStepper } from './onboarding-stepper';

export function OnboardingShell({
  step,
  activePercent,
  title,
  subtitle,
  children,
}: {
  step: number;
  activePercent: number;
  title: string;
  subtitle: string;
  children: ReactNode;
}) {
  return (
    <main className="min-h-screen bg-secondary px-4 py-12">
      <div className="mx-auto flex max-w-2xl flex-col gap-6">
        <OnboardingStepper step={step} activePercent={activePercent} />
        <Card className="rounded-2xl p-8 shadow-sm">
          <div className="mb-6">
            <h1 className="text-xl font-bold text-primary">{title}</h1>
            <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>
          </div>
          {children}
        </Card>
      </div>
    </main>
  );
}
