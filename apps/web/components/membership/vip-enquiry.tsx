'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { VipEnquiryResponse, VipEnquiryStatus } from '@nadar-kalyanam/schemas';
import { useRegistration } from '../../app/providers/registration-provider';
import { ApiError, createVipEnquiry, getMyVipEnquiry } from '../../lib/api-client';

const STATUS_TEXT: Record<VipEnquiryStatus, string> = {
  NEW: 'Received — our team will call you.',
  CONTACTED: 'Our team has contacted you.',
  ONBOARDED: 'You’re onboarded to VIP Assisted.',
  CLOSED: 'Closed.',
};

// "Enquire" on the VIP Assisted card: asks the team to call the member back
// on their registered number. Name and phone come from their account.
export function VipEnquiry() {
  const router = useRouter();
  const { data } = useRegistration();
  const accessToken = data.accessToken;
  const [enquiry, setEnquiry] = useState<VipEnquiryResponse | null>(null);
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [justSent, setJustSent] = useState(false);

  useEffect(() => {
    if (!accessToken) return;
    let cancelled = false;
    getMyVipEnquiry(accessToken)
      .then((result) => {
        if (!cancelled) setEnquiry(result.enquiry);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [accessToken]);

  async function submit() {
    if (!accessToken) return;
    setSending(true);
    setError(null);
    try {
      const result = await createVipEnquiry(accessToken, message.trim() ? { message: message.trim() } : {});
      setEnquiry(result);
      setJustSent(true);
      setOpen(false);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not send your enquiry. Please try again.');
    } finally {
      setSending(false);
    }
  }

  const isOpenEnquiry = enquiry && (enquiry.status === 'NEW' || enquiry.status === 'CONTACTED');

  if (isOpenEnquiry || (enquiry && justSent)) {
    return (
      <div className="rounded-xl border border-white/20 bg-white/5 px-3 py-2 text-left text-xs text-white/90" data-testid="vip-enquiry-status" role="status">
        {justSent && <p className="font-semibold text-[#FDE59C]">We received your enquiry.</p>}
        <p>Status: {STATUS_TEXT[enquiry!.status]}</p>
        <p className="text-white/70">Last updated {new Date(enquiry!.updatedAt).toLocaleString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit', timeZone: 'Asia/Kolkata' })}</p>
      </div>
    );
  }

  return (
    <>
      <button
        type="button"
        data-testid="vip-enquire"
        onClick={() => (accessToken ? setOpen(true) : router.push('/?login=true&returnTo=%2Fmembership'))}
        className="w-full rounded-xl border border-white/30 bg-white/10 px-3 py-2 text-xs font-semibold text-white hover:bg-white/15"
      >
        Enquire
      </button>
      {enquiry && !isOpenEnquiry && (
        <p className="text-[11px] text-white/70" data-testid="vip-last-enquiry">
          Your last enquiry: {STATUS_TEXT[enquiry.status]} (updated {new Date(enquiry.updatedAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Asia/Kolkata' })})
        </p>
      )}

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4" data-testid="vip-enquiry-form">
          <div role="dialog" aria-modal="true" aria-labelledby="vip-enquiry-title" className="w-full max-w-sm rounded-2xl bg-white p-5 text-left text-[#2B1515] shadow-xl">
            <h2 id="vip-enquiry-title" className="text-base font-bold">
              VIP Assisted enquiry
            </h2>
            <p className="mt-1 text-sm text-[#5A493E]">We will contact you on your registered phone number.</p>
            <label htmlFor="vip-message" className="mt-3 block text-xs font-semibold text-[#5A493E]">
              Message (optional)
            </label>
            <textarea
              id="vip-message"
              rows={3}
              maxLength={1000}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="A good time to call, or anything you'd like us to know"
              className="mt-1 w-full rounded-xl border border-[#EADBD5] px-3 py-2 text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-[#680A0E]"
            />
            {error && (
              <p role="alert" className="mt-2 text-xs font-semibold text-destructive">
                {error}
              </p>
            )}
            <div className="mt-4 flex justify-end gap-2">
              <button type="button" onClick={() => setOpen(false)} disabled={sending} className="rounded-full border border-[#E2E8F0] px-4 py-2 text-xs font-semibold text-[#64748B]">
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void submit()}
                disabled={sending}
                className="rounded-full bg-[#680A0E] px-5 py-2 text-xs font-semibold text-white disabled:opacity-50"
              >
                {sending ? 'Sending…' : 'Send enquiry'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
