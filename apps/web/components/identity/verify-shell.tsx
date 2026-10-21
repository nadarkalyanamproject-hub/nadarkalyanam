import type { ReactNode } from 'react';
import { ShieldCheck } from 'lucide-react';

// The page around the DigiLocker steps: the onboarding background and one
// card, without the 4-step progress bar (this comes before step 1).
export function VerifyShell({ children }: { children: ReactNode }) {
  return (
    <main
      className="relative min-h-screen bg-cover bg-center bg-fixed bg-no-repeat px-4 py-10 md:py-16"
      style={{ backgroundImage: "url('/assets/onboarding_bg.jpg')" }}
      data-testid="verify-identity"
    >
      <div className="pointer-events-none fixed inset-0 bg-[#FFFDF8]/80" />
      <div className="relative z-10 mx-auto max-w-lg rounded-2xl border border-[#FFE082]/70 bg-white/95 p-7 text-center shadow-xl md:p-9">
        <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-nk-maroon-deep text-[#F6E3A8] shadow-md">
          <ShieldCheck className="h-7 w-7" />
        </span>
        {children}
      </div>
    </main>
  );
}
