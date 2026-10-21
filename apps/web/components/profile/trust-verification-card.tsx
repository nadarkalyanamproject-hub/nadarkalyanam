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
  const identityPending = !identityVerified;

  return (
    <div className="rounded-2xl border border-nk-line bg-[#FFFFFF] p-5 sm:p-6 shadow-sm">
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5 text-nk-maroon">
            <path
              d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"
              stroke="currentColor"
              strokeWidth={1.75}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <path
              d="m9 12 2 2 4-4"
              stroke="#D6A33A"
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          <h2 className="font-[family-name:var(--font-body)] text-lg sm:text-xl font-bold tracking-tight text-nk-maroon">
            Trust & Verification
          </h2>
        </div>
      </div>

      <div className="space-y-3 text-sm">
        {/* Mobile Verification */}
        <div className="flex items-center justify-between rounded-xl border border-nk-line-soft bg-nk-ivory p-3">
          <div className="flex items-center gap-2.5">
            <div className="flex h-7 w-7 items-center justify-center rounded-full bg-nk-cream text-nk-maroon">
              <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4 text-nk-gold-light">
                <path
                  fillRule="evenodd"
                  d="M16.704 4.153a.75.75 0 0 1 .143 1.052l-8 10.5a.75.75 0 0 1-1.127.075l-4.5-4.5a.75.75 0 0 1 1.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 0 1 1.05-.143Z"
                  clipRule="evenodd"
                />
              </svg>
            </div>
            <div>
              <p className="font-semibold text-nk-ink">Mobile Verified</p>
              <p className="text-[11px] text-nk-muted">Primary number confirmed with OTP</p>
            </div>
          </div>
        </div>

        {/* Email: contact info only — no verification exists for it */}
        <div className="flex items-center justify-between gap-3 rounded-xl border border-nk-line-soft bg-nk-ivory p-3" data-testid="trust-email">
          <div className="flex min-w-0 items-center gap-2.5">
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-nk-cream text-nk-maroon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} className="h-4 w-4 text-[#A88C78]">
                <rect x="3" y="5" width="18" height="14" rx="2" />
                <path d="m3 7 9 6 9-6" />
              </svg>
            </div>
            <div className="min-w-0">
              <p className="font-semibold text-nk-ink">Email</p>
              <p className="truncate text-[11px] text-nk-muted">{email?.trim() ? email : '—'}</p>
            </div>
          </div>
        </div>

        {/* Identity Verification */}
        {identityPending ? (
          <div className="rounded-xl border border-[#FDE68A] bg-[#FFFBEB] p-3.5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-semibold text-nk-maroon">Identity Verification</p>
                <p className="mt-0.5 text-xs text-nk-muted">
                  Verify your identity with DigiLocker to receive a verified profile badge.
                </p>
              </div>
            </div>

            <Link
              href="/verify-identity"
              className="mt-3 inline-flex items-center gap-1.5 text-xs font-bold text-[#92400E] hover:text-[#78350F] transition-colors"
            >
              <span>Verify with DigiLocker</span>
              <span>→</span>
            </Link>
          </div>
        ) : (
          <div className="flex items-center justify-between rounded-xl border border-nk-line-soft bg-nk-ivory p-3">
            <div className="flex items-center gap-2.5">
              <VerifiedBadge className="h-7 w-7 shrink-0" />
              <div>
                <p className="font-semibold text-nk-ink">Identity Verified</p>
                <p className="text-[11px] text-nk-muted">Government ID confirmed</p>
              </div>
            </div>
          </div>
        )}
      </div>

    </div>
  );
}
