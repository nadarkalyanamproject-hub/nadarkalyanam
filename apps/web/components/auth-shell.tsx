import type { ReactNode } from 'react';
import { Card } from '@nadar-kalyanam/ui';

export function AuthShell({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children: ReactNode;
}) {
  return (
    <main
      className="relative flex min-h-screen items-center justify-center bg-cover bg-center bg-fixed bg-no-repeat px-4 py-12"
      style={{
        backgroundImage: "url('/assets/onboarding_bg.png')",
      }}
    >
      {/* Soft warm overlay */}
      <div className="fixed inset-0 bg-[#FFFDF8]/75 backdrop-blur-[0.5px] pointer-events-none" />

      <Card className="relative z-10 w-full max-w-md rounded-2xl border border-[#FFE082]/70 bg-white/95 p-8 shadow-xl backdrop-blur-sm">
        <div className="mb-6 text-center">
          <h1 className="text-2xl font-bold text-[#8E1B24]">{title}</h1>
          <p className="mt-1 text-sm text-[#5E3D3D]">{subtitle}</p>
        </div>
        {children}
      </Card>
    </main>
  );
}
