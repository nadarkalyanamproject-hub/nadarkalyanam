'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import type { PhoneStatusResponse } from '@nadar-kalyanam/schemas';
import { Check, Copy, Phone } from 'lucide-react';
import { useRegistration } from '../../app/providers/registration-provider';
import { ApiError, getPhoneStatus, unlockPhone } from '../../lib/api-client';
import { phoneUnlockView } from '../../lib/phone-unlock';

// The phone number section on another member's profile. Shows what the API
// says the viewer can do; the number itself only ever comes from the unlock
// call, after a confirmation when it uses one of the plan's unlocks.
export function PhoneUnlockCard({ profileId, memberName }: { profileId: string; memberName: string }) {
  const { data } = useRegistration();
  const accessToken = data.accessToken;
  const [status, setStatus] = useState<PhoneStatusResponse | null>(null);
  const [phoneNumber, setPhoneNumber] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!accessToken) return;
    let cancelled = false;
    getPhoneStatus(accessToken, profileId)
      .then((result) => {
        if (!cancelled) setStatus(result);
      })
      .catch(() => {
        // The profile page shows its own error; nothing to add here.
      });
    return () => {
      cancelled = true;
    };
  }, [accessToken, profileId]);

  async function reveal() {
    if (!accessToken) return;
    setWorking(true);
    setError(null);
    try {
      const result = await unlockPhone(accessToken, profileId);
      setPhoneNumber(result.phoneNumber);
      setStatus({ state: 'UNLOCKED', limit: result.limit, remaining: result.remaining });
      setConfirming(false);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not unlock the phone number. Please try again.');
      setConfirming(false);
      // The rules may have changed (e.g. the member turned sharing off).
      getPhoneStatus(accessToken, profileId).then(setStatus).catch(() => {});
    } finally {
      setWorking(false);
    }
  }

  async function copy() {
    if (!phoneNumber) return;
    try {
      await navigator.clipboard.writeText(phoneNumber);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard blocked: the number is on screen to copy by hand.
    }
  }

  if (!status) return null;
  const view = phoneUnlockView(status);

  return (
    <div className="mt-5 rounded-2xl border border-[#EDE6DB] bg-[#FCFAF6] p-4" data-testid="phone-unlock" data-state={status.state}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg border border-[#EBE3D5] bg-white text-[#7A1C32]">
            <Phone className="h-4 w-4" />
          </span>
          <div>
            <p className="text-sm font-semibold text-[#241C1A]">Phone number</p>
            {phoneNumber ? (
              <p className="font-mono text-sm text-[#241C1A]" data-testid="phone-number">
                {phoneNumber}
              </p>
            ) : (
              <p className="text-xs text-[#7E6F65]" data-testid="phone-message">
                {view.message}
              </p>
            )}
          </div>
        </div>

        {phoneNumber ? (
          <button
            type="button"
            onClick={() => void copy()}
            className="inline-flex items-center gap-1.5 rounded-full border border-[#E2E8F0] bg-white px-4 py-2 text-xs font-semibold text-[#64748B] hover:bg-[#FAF8F5]"
          >
            {copied ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5" />}
            {copied ? 'Copied' : 'Copy'}
          </button>
        ) : view.action === 'unlock' ? (
          <button
            type="button"
            data-testid="phone-unlock-button"
            disabled={working}
            onClick={() => (view.confirm ? setConfirming(true) : void reveal())}
            className="rounded-full bg-[#7A1C32] px-5 py-2 text-xs font-semibold text-white hover:bg-[#681427] disabled:opacity-50"
          >
            {working ? 'Unlocking…' : view.buttonLabel}
          </button>
        ) : view.action === 'upgrade' ? (
          <Link
            href="/membership"
            data-testid="phone-upgrade"
            className="rounded-full border border-[#DFC392] bg-[#FDF9F3] px-5 py-2 text-xs font-semibold text-[#680A0E] hover:bg-[#F7EBDC]"
          >
            See plans
          </Link>
        ) : null}
      </div>
      {view.allowance && !phoneNumber && <p className="mt-2 text-[11px] text-[#8A796E]">{view.allowance}</p>}
      {error && (
        <p role="alert" className="mt-2 text-xs font-semibold text-destructive">
          {error}
        </p>
      )}

      {confirming && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4" data-testid="phone-unlock-confirm">
          <div role="dialog" aria-modal="true" aria-labelledby="phone-unlock-title" className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-xl">
            <h2 id="phone-unlock-title" className="text-base font-bold text-[#241C1A]">
              Unlock {memberName}&apos;s phone number?
            </h2>
            <p className="mt-2 text-sm text-[#5A493E]">{view.confirm}</p>
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setConfirming(false)}
                disabled={working}
                className="rounded-full border border-[#E2E8F0] bg-white px-4 py-2 text-xs font-semibold text-[#64748B] hover:bg-[#FAF8F5]"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void reveal()}
                disabled={working}
                className="rounded-full bg-[#7A1C32] px-5 py-2 text-xs font-semibold text-white hover:bg-[#681427] disabled:opacity-50"
              >
                {working ? 'Unlocking…' : 'Unlock'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
