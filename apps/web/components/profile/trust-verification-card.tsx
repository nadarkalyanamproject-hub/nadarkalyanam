'use client';

import Link from 'next/link';
import { useIdentityStatus } from '../../lib/identity-status';
import { useRegistration } from '../../app/providers/registration-provider';
import { VerifiedBadge } from '../ui/verified-badge';

// Mobile is genuinely verified: every account signs in with an OTP to that
// number. Email is never verified anywhere in this app, so it's shown as
// plain contact information with no status claim.
export function TrustVerificationCard({ email }: { email?: string }) {
  const { data } = useRegistration();
  const status = useIdentityStatus(data.accessToken);
  const identityVerified = Boolean(status?.verified);

  return (
    <div className="rounded-2xl border border-nk-line bg-[#FFFFFF] p-5 sm:p-6 shadow-sm">
      <h2 className="font-[family-name:var(--font-body)] text-lg sm:text-xl font-bold tracking-tight text-nk-maroon">
        Verification
      </h2>

      <dl className="mt-3 divide-y divide-nk-line-soft text-sm">
        <div className="flex items-baseline justify-between gap-4 py-3">
          <dt className="text-nk-muted">Mobile</dt>
          <dd className="font-semibold text-nk-ink">Verified by OTP</dd>
        </div>

        {/* Email: contact info only, no verification exists for it */}
        <div className="flex items-baseline justify-between gap-4 py-3" data-testid="trust-email">
          <dt className="shrink-0 text-nk-muted">Email</dt>
          <dd className="min-w-0 truncate text-nk-ink">{email?.trim() ? email : 'Not added'}</dd>
        </div>

        <div className="py-3">
          <div className="flex items-baseline justify-between gap-4">
            <dt className="text-nk-muted">Identity</dt>
            <dd className={identityVerified ? 'inline-flex items-center gap-1.5 font-semibold text-nk-ink' : 'text-nk-ink'}>
              {identityVerified ? (
                <>
                  <VerifiedBadge className="h-4 w-4" />
                  Verified
                </>
              ) : (
                'Not verified'
              )}
            </dd>
          </div>
          {!identityVerified && (
            <p className="mt-1.5 text-xs leading-relaxed text-nk-muted">
              Verified members get a badge on their profile.{' '}
              <Link href="/verify-identity" className="font-semibold text-nk-maroon underline underline-offset-2 hover:text-nk-maroon-deep">
                Verify with DigiLocker
              </Link>
            </p>
          )}
        </div>
      </dl>
    </div>
  );
}
