'use client';

import Link from 'next/link';
import { Button, Card } from '@nadar-kalyanam/ui';
import { useRequireAuth } from '../../../lib/use-require-auth';

export default function OnboardingSuccessPage() {
  const { ready } = useRequireAuth();

  if (!ready) return null;

  return (
    <main className="flex min-h-screen items-center justify-center bg-secondary px-4 py-12">
      <Card className="w-full max-w-md p-8 text-center">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-primary text-2xl text-primary-foreground">
          &#10003;
        </div>
        <h1 className="text-2xl font-semibold text-foreground">Profile Created!</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Your profile has been created successfully. Our team will review it shortly and you can
          start exploring matches soon.
        </p>
        <Link href="/" className="mt-6 block">
          <Button type="button" size="lg" className="w-full">
            Go to Homepage
          </Button>
        </Link>
      </Card>
    </main>
  );
}
