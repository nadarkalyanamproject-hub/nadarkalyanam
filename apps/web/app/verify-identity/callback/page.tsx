'use client';

import { Suspense, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { VerifyShell } from '../../../components/identity/verify-shell';
import { ApiError, completeVerification } from '../../../lib/api-client';
import { setIdentityStatus } from '../../../lib/identity-status';
import { useRegistration } from '../../providers/registration-provider';

// Where DigiLocker sends the member back. The API checks the result with the
// provider directly; the reference in the URL alone proves nothing.
function CallbackContent() {
  const router = useRouter();
  const params = useSearchParams();
  const reference = params.get('reference');
  const { data, hydrated } = useRegistration();
  const token = data.accessToken;
  const [state, setState] = useState<'checking' | 'failed' | 'error'>('checking');
  const [message, setMessage] = useState<string | null>(null);
  const sent = useRef(false);

  useEffect(() => {
    if (!hydrated) return;
    if (!token) {
      router.replace('/');
      return;
    }
    if (!reference || sent.current) return;
    sent.current = true;
    completeVerification(token, reference)
      .then((result) => {
        setIdentityStatus(token, result);
        if (result.status === 'SUCCEEDED') router.replace(data.hasProfile ? '/' : '/onboarding/basic-details');
        else setState('failed');
      })
      .catch((err: unknown) => {
        setMessage(err instanceof ApiError ? err.message : null);
        setState('error');
      });
  }, [hydrated, token, reference, data.hasProfile, router]);

  // No reference in the URL: nothing to confirm.
  const shown = reference ? state : 'error';

  if (shown === 'checking') {
    return (
      <VerifyShell>
        <h1 className="mt-5 font-[family-name:var(--font-heading,serif)] text-2xl font-bold text-nk-ink">
          Confirming with DigiLocker…
        </h1>
        <p className="mt-3 text-sm text-nk-ink-soft">This only takes a moment.</p>
      </VerifyShell>
    );
  }

  return (
    <VerifyShell>
      <h1 className="mt-5 font-[family-name:var(--font-heading,serif)] text-2xl font-bold text-nk-ink">
        {shown === 'failed' ? 'We couldn’t verify you' : 'Something went wrong'}
      </h1>
      <p className="mt-3 text-sm text-nk-ink-soft" role="alert">
        {shown === 'failed'
          ? 'DigiLocker didn’t confirm your identity. Please try again, and allow access to your name and date of birth.'
          : (message ?? 'We couldn’t confirm the result. Please try again.')}
      </p>
      <Link
        href="/verify-identity"
        className="mt-6 inline-flex w-full items-center justify-center rounded-full bg-nk-maroon-deep px-5 py-3 text-sm font-semibold text-white hover:bg-[#550809]"
      >
        Try again
      </Link>
    </VerifyShell>
  );
}

export default function VerifyIdentityCallbackPage() {
  return (
    <Suspense fallback={null}>
      <CallbackContent />
    </Suspense>
  );
}
