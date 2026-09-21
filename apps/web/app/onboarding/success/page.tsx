'use client';

import Link from 'next/link';
import { Button, Card } from '@nadar-kalyanam/ui';
import { useRequireAuth } from '../../../lib/use-require-auth';

export default function OnboardingSuccessPage() {
  const { ready } = useRequireAuth();

  if (!ready) return null;

  return (
    <main
      className="relative flex min-h-screen items-center justify-center bg-cover bg-center bg-fixed bg-no-repeat px-4 py-12"
      style={{
        backgroundImage: "url('/assets/onboarding_bg.png')",
      }}
    >
      <div className="fixed inset-0 bg-[#FFFDF8]/75 backdrop-blur-[0.5px] pointer-events-none" />

      <Card className="relative z-10 w-full max-w-md rounded-2xl border border-[#FFE082]/70 bg-white/95 p-8 text-center shadow-xl backdrop-blur-sm">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-tr from-[#8E1B24] to-[#C93B47] text-2xl font-bold text-white shadow-md">
          &#10003;
        </div>
        <h1 className="text-2xl font-bold text-[#8E1B24]">Profile Created!</h1>
        <p className="mt-2 text-sm text-[#5E3D3D]">
          Your profile has been created successfully. Our team will review it shortly and you can
          start exploring matches soon.
        </p>
        <Link href="/" className="mt-6 block">
          <Button type="button" size="lg" className="w-full bg-gradient-to-r from-[#8E1B24] to-[#6C1118] text-white hover:opacity-95">
            Go to Homepage
          </Button>
        </Link>
      </Card>
    </main>
  );
}
