'use client';

import { useEffect, useState } from 'react';
import { ApiError, getVerificationStatus, initiateVerification } from '../../lib/api-client';
import { useRegistration } from '../../app/providers/registration-provider';

export function TrustVerificationCard({
  mobileVerified = true,
  emailVerified = true,
}: {
  mobileVerified?: boolean;
  emailVerified?: boolean;
}) {
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
    <div className="rounded-2xl border border-[#E8DCC8] bg-[#FFFFFF] p-5 sm:p-6 shadow-sm">
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5 text-[#7A0710]">
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
          <h2 className="font-[family-name:var(--font-body)] text-lg sm:text-xl font-bold tracking-tight text-[#7A0710]">
            Trust & Verification
          </h2>
        </div>
      </div>

      <div className="space-y-3 text-sm">
        {/* Mobile Verification */}
        <div className="flex items-center justify-between rounded-xl border border-[#F3EBDD] bg-[#FFFDF9] p-3">
          <div className="flex items-center gap-2.5">
            <div className="flex h-7 w-7 items-center justify-center rounded-full bg-[#FFF9ED] text-[#7A0710]">
              <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4 text-[#D6A33A]">
                <path
                  fillRule="evenodd"
                  d="M16.704 4.153a.75.75 0 0 1 .143 1.052l-8 10.5a.75.75 0 0 1-1.127.075l-4.5-4.5a.75.75 0 0 1 1.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 0 1 1.05-.143Z"
                  clipRule="evenodd"
                />
              </svg>
            </div>
            <div>
              <p className="font-semibold text-[#2B211C]">Mobile Verified</p>
              <p className="text-[11px] text-[#776B62]">Primary number confirmed with OTP</p>
            </div>
          </div>
          <span className="text-xs font-semibold text-emerald-700">
            Active
          </span>
        </div>

        {/* Email Verification */}
        <div className="flex items-center justify-between rounded-xl border border-[#F3EBDD] bg-[#FFFDF9] p-3">
          <div className="flex items-center gap-2.5">
            <div className="flex h-7 w-7 items-center justify-center rounded-full bg-[#FFF9ED] text-[#7A0710]">
              <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4 text-[#D6A33A]">
                <path
                  fillRule="evenodd"
                  d="M16.704 4.153a.75.75 0 0 1 .143 1.052l-8 10.5a.75.75 0 0 1-1.127.075l-4.5-4.5a.75.75 0 0 1 1.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 0 1 1.05-.143Z"
                  clipRule="evenodd"
                />
              </svg>
            </div>
            <div>
              <p className="font-semibold text-[#2B211C]">Email Verified</p>
              <p className="text-[11px] text-[#776B62]">Official communication channel</p>
            </div>
          </div>
          <span className="text-xs font-semibold text-emerald-700">
            Active
          </span>
        </div>

        {/* Identity Verification */}
        {identityPending ? (
          <div className="rounded-xl border border-[#FDE68A] bg-[#FFFBEB] p-3.5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-semibold text-[#7A0710]">Identity Verification</p>
                <p className="mt-0.5 text-xs text-[#776B62]">
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
          <div className="flex items-center justify-between rounded-xl border border-[#F3EBDD] bg-[#FFFDF9] p-3">
            <div className="flex items-center gap-2.5">
              <div className="flex h-7 w-7 items-center justify-center rounded-full bg-[#FFF9ED] text-[#7A0710]">
                <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4 text-[#D6A33A]">
                  <path
                    fillRule="evenodd"
                    d="M16.704 4.153a.75.75 0 0 1 .143 1.052l-8 10.5a.75.75 0 0 1-1.127.075l-4.5-4.5a.75.75 0 0 1 1.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 0 1 1.05-.143Z"
                    clipRule="evenodd"
                  />
                </svg>
              </div>
              <div>
                <p className="font-semibold text-[#2B211C]">Identity Verified</p>
                <p className="text-[11px] text-[#776B62]">Government ID confirmed</p>
              </div>
            </div>
            <span className="text-xs font-semibold text-[#7A0710]">
              Verified
            </span>
          </div>
        )}
      </div>

      {/* Identity Verification Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl border border-[#E8DCC8] bg-[#FFFFFF] p-6 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="font-[family-name:var(--font-body)] text-xl font-bold tracking-tight text-[#7A0710]">
                Identity Verification
              </h3>
              <button
                type="button"
                onClick={() => setShowModal(false)}
                className="text-[#776B62] hover:text-[#2B211C]"
              >
                ✕
              </button>
            </div>
            <p className="text-xs text-[#776B62] leading-relaxed">
              To maintain the highest authenticity on Nadar Kalyanam, all profiles undergo standard government ID verification (Aadhaar, Passport, or Voter ID).
            </p>
            <div className="my-4 rounded-xl bg-[#FFF9ED] border border-[#E8DCC8] p-3 text-xs text-[#7A0710]">
              🔒 Your document details are encrypted and never displayed publicly to other members.
            </div>
            {submitError && (
              <p className="mb-3 text-xs text-[#94151C]" role="alert">
                {submitError}
              </p>
            )}
            <div className="flex gap-3">
              <button
                type="button"
                disabled={submitting}
                onClick={() => void handleSubmitVerification()}
                className="flex-1 rounded-lg bg-[#7A0710] py-2.5 text-xs font-semibold text-white shadow hover:bg-[#94151C] transition-colors disabled:opacity-60"
              >
                {submitting ? 'Submitting…' : 'Submit ID Verification'}
              </button>
              <button
                type="button"
                onClick={() => setShowModal(false)}
                className="rounded-lg border border-[#E8DCC8] px-4 py-2.5 text-xs font-medium text-[#776B62] hover:bg-[#F9F3E7]"
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
