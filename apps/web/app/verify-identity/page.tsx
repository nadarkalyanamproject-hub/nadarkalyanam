'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Lock } from 'lucide-react';
import { VerifyShell } from '../../components/identity/verify-shell';
import { ApiError, initiateVerification } from '../../lib/api-client';
import { useIdentityStatus } from '../../lib/identity-status';
import { useRegistration } from '../providers/registration-provider';

const STEPS = [
  'Sign in to DigiLocker with your Aadhaar-linked mobile number.',
  'Allow Nadar Kalyanam to read your name and date of birth.',
  'Come straight back here to create your profile.',
];

// Right after OTP sign-up, before registration: the member confirms who they
// are with DigiLocker. Name and date of birth on the profile then come from
// the ID and can't be changed.
export default function VerifyIdentityPage() {
  const router = useRouter();
  const { data, hydrated } = useRegistration();
  const token = data.accessToken;
  const status = useIdentityStatus(token);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (hydrated && !token) router.replace('/');
  }, [hydrated, token, router]);

  // Nothing to do here once verified (or for a grandfathered account).
  useEffect(() => {
    if (status && !status.required) router.replace(data.hasProfile ? '/' : '/onboarding/basic-details');
  }, [status, data.hasProfile, router]);

  async function start() {
    if (!token) return;
    setStarting(true);
    setError(null);
    try {
      const { redirectUrl } = await initiateVerification(token);
      window.location.assign(redirectUrl);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not reach DigiLocker. Please try again.');
      setStarting(false);
    }
  }

  if (!hydrated || !token || status === undefined) return null;

  return (
    <VerifyShell>
      <p className="mt-5 text-xs font-bold uppercase tracking-[0.16em] text-nk-maroon">Before you register</p>
      <h1 className="mt-2 font-[family-name:var(--font-heading,serif)] text-2xl font-bold text-nk-ink">
        Verify your identity with DigiLocker
      </h1>
      <p className="mt-3 text-sm leading-relaxed text-nk-ink-soft">
        Every member of Nadar Kalyanam is verified with a government ID, so families know the person they&apos;re
        talking to is real. It takes about a minute.
      </p>

      <ol className="mt-6 space-y-3 text-left">
        {STEPS.map((step, i) => (
          <li key={step} className="flex items-start gap-3 text-sm text-nk-ink">
            <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-nk-cream text-[11px] font-bold text-nk-maroon">
              {i + 1}
            </span>
            {step}
          </li>
        ))}
      </ol>

      <div className="mt-6 flex items-start gap-2.5 rounded-xl border border-nk-sky/25 bg-nk-sky-soft p-3.5 text-left text-xs leading-relaxed text-nk-sky-text">
        <Lock className="mt-0.5 h-4 w-4 shrink-0 text-nk-sky" />
        <span>
          We keep only your name and date of birth. We never see or store your Aadhaar number or documents, and other
          members only see a &ldquo;Verified&rdquo; badge.
        </span>
      </div>

      {error && (
        <p className="mt-4 text-sm text-nk-maroon-bright" role="alert">
          {error}
        </p>
      )}

      <button
        type="button"
        onClick={() => void start()}
        disabled={starting}
        data-testid="start-digilocker"
        className="mt-6 inline-flex w-full items-center justify-center rounded-full bg-nk-maroon-deep px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-[#550809] disabled:opacity-60"
      >
        {starting ? 'Opening DigiLocker…' : 'Continue with DigiLocker'}
      </button>
    </VerifyShell>
  );
}
