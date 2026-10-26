'use client';

import { useEffect, useState } from 'react';
import { ApiError, getVerificationStatus, initiateVerification } from '../../lib/api-client';
import { useRegistration } from '../../app/providers/registration-provider';
import { VerifiedBadge } from '../ui/verified-badge';

// Mobile is genuinely verified: every account signs in with an OTP to that
// number. Email is never verified anywhere in this app, so it's shown as
// plain contact information with no status claim.
export function TrustVerificationCard({ email }: { email?: string }) {
  const { data } = useRegistration();
  const [status, setStatus] = useState<'PENDING' | 'SUCCEEDED' | 'FAILED' | 'EXPIRED' | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  useEffect(() => {
    if (!data.accessToken) return;
    getVerificationStatus(data.accessToken)
      .then((result) => setStatus(result.status))
      .catch(() => {
        // A failed status check just leaves the "Verify Now" prompt showing
        // — not worth its own error state on a card this secondary.
      });
  }, [data.accessToken]);

  const identityVerified = status === 'SUCCEEDED';
  const identityPending = !identityVerified;

  function handleVerifyIdentity() {
    setSubmitError(null);
    setShowModal(true);
  }

  async function handleSubmitVerification() {
    if (!data.accessToken) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      await initiateVerification(data.accessToken);
      // No real identity provider is configured yet (see
      // StubIdentityProviderAdapter) — initiate() only succeeds once one is,
      // so reaching here would mean a real redirect flow exists. Left as a
      // no-op close for now rather than pretending it verified.
      setShowModal(false);
    } catch (err) {
      setSubmitError(
        err instanceof ApiError
          ? err.message
          : 'Identity verification is not available yet. Please try again later.',
      );
    } finally {
      setSubmitting(false);
    }
  }

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
                  Verify your identity (Aadhaar / Government ID) to receive a verified profile badge.
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={handleVerifyIdentity}
              className="mt-3 inline-flex items-center gap-1.5 text-xs font-bold text-[#92400E] hover:text-[#78350F] transition-colors"
            >
              <span>Verify Now</span>
              <span>→</span>
            </button>
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

      {/* Identity Verification Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl border border-nk-line bg-[#FFFFFF] p-6 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="font-[family-name:var(--font-body)] text-xl font-bold tracking-tight text-nk-maroon">
                Identity Verification
              </h3>
              <button
                type="button"
                onClick={() => setShowModal(false)}
                className="text-nk-muted hover:text-nk-ink"
              >
                ✕
              </button>
            </div>
            <p className="text-xs text-nk-muted leading-relaxed">
              Submit a government ID (Aadhaar, Passport, or Voter ID) to request a Verified badge on your profile.
            </p>
            <div className="my-4 rounded-xl bg-nk-cream border border-nk-line p-3 text-xs text-nk-maroon">
              🔒 Your document details are encrypted and never displayed publicly to other members.
            </div>
            {submitError && (
              <p className="mb-3 text-xs text-nk-maroon-bright" role="alert">
                {submitError}
              </p>
            )}
            <div className="flex gap-3">
              <button
                type="button"
                disabled={submitting}
                onClick={() => void handleSubmitVerification()}
                className="flex-1 rounded-lg bg-nk-maroon py-2.5 text-xs font-semibold text-white shadow hover:bg-nk-maroon-bright transition-colors disabled:opacity-60"
              >
                {submitting ? 'Submitting…' : 'Submit ID Verification'}
              </button>
              <button
                type="button"
                onClick={() => setShowModal(false)}
                className="rounded-lg border border-nk-line px-4 py-2.5 text-xs font-medium text-nk-muted hover:bg-nk-sand"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
