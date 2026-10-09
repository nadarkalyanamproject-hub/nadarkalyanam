'use client';

import { useState } from 'react';
import type { PhoneVisibility, ProfileResponse, ProfileVisibility } from '@nadar-kalyanam/schemas';
import { useRegistration } from '../../app/providers/registration-provider';
import { ApiError, updatePhoneVisibility, updateProfileVisibility } from '../../lib/api-client';

// The stored profile visibility values. PUBLIC and MEMBERS_ONLY behave the
// same: there is no guest (signed-out) view of profiles, so "Everyone" still
// means signed-in members with an active account (the API's single
// visibility rule, visibleProfilesWhere).
const VISIBILITY_OPTIONS: { value: ProfileVisibility; label: string }[] = [
  { value: 'PUBLIC', label: 'Everyone' },
  { value: 'MEMBERS_ONLY', label: 'Registered members only' },
  { value: 'HIDDEN', label: 'Hidden from browse, search & matches' },
];

// Shown as facts, not settings: there is no stored preference behind these,
// so they describe what the app actually does today.
const FIXED_RULES = [
  { label: 'Email', value: 'Never shown to other members' },
  { label: 'Photos', value: 'Visible to signed-in members once approved by our team' },
  { label: 'Online status', value: 'Not shown to anyone' },
];

type SaveState = { kind: 'idle' } | { kind: 'saving' } | { kind: 'saved' } | { kind: 'error'; message: string };

export function PrivacySettingsCard({
  profile,
  onSaved,
}: {
  profile: ProfileResponse;
  onSaved: (updated: ProfileResponse) => void;
}) {
  const { data } = useRegistration();
  const [save, setSave] = useState<SaveState>({ kind: 'idle' });
  const [pendingPhone, setPendingPhone] = useState<PhoneVisibility | null>(null);

  // Consent for phone unlocks. Off (NEVER) by default; takes effect at once,
  // including for anyone who unlocked the number earlier.
  async function handlePhoneVisibilityChange(phoneVisibility: PhoneVisibility) {
    if (!data.accessToken || phoneVisibility === profile.phoneVisibility) return;
    // The switch moves at once; it goes back if the save fails.
    setPendingPhone(phoneVisibility);
    setSave({ kind: 'saving' });
    try {
      const updated = await updatePhoneVisibility(data.accessToken, phoneVisibility);
      onSaved(updated);
      setSave({ kind: 'saved' });
    } catch (err) {
      setSave({ kind: 'error', message: err instanceof ApiError ? err.message : 'Could not save. Please try again.' });
    } finally {
      setPendingPhone(null);
    }
  }
  const phoneAllowed = (pendingPhone ?? profile.phoneVisibility) === 'CONNECTED';

  async function handleVisibilityChange(visibility: ProfileVisibility) {
    if (!data.accessToken || visibility === profile.visibility) return;
    setSave({ kind: 'saving' });
    try {
      const updated = await updateProfileVisibility(data.accessToken, visibility);
      onSaved(updated);
      setSave({ kind: 'saved' });
    } catch (err) {
      setSave({ kind: 'error', message: err instanceof ApiError ? err.message : 'Could not save. Please try again.' });
    }
  }

  return (
    <div className="rounded-2xl border border-nk-line bg-[#FFFFFF] p-6 shadow-sm">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} className="h-5 w-5 text-nk-maroon">
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
              <path d="M7 11V7a5 5 0 0 1 10 0v4" />
            </svg>
            <h2 className="font-[family-name:var(--font-body)] text-lg sm:text-xl font-bold tracking-tight text-nk-maroon">
              Privacy & Visibility
            </h2>
          </div>
          <p className="mt-1 text-xs text-nk-muted">You control who can find your profile.</p>
        </div>

        <span aria-live="polite" className="text-xs font-semibold" data-testid="privacy-save-status">
          {save.kind === 'saving' && <span className="text-nk-muted">Saving…</span>}
          {save.kind === 'saved' && <span className="text-emerald-700">✓ Saved</span>}
        </span>
      </div>

      {save.kind === 'error' && (
        <p role="alert" className="mb-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs font-medium text-nk-maroon">
          {save.message}
        </p>
      )}

      <div className="divide-y divide-nk-line-soft text-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between py-3 gap-2">
          <div>
            <label htmlFor="privacy-profile-visibility" className="font-semibold text-nk-ink">
              Profile visibility
            </label>
            <p className="text-xs text-nk-muted">
              Who can discover your profile. &ldquo;Everyone&rdquo; and &ldquo;Registered members only&rdquo; work the same:
              there is no public (signed-out) view of profiles yet, so either way only signed-in members with an
              active account can find you. &ldquo;Hidden&rdquo; keeps you out of every list; members you&apos;re already
              connected with can still message you.
            </p>
          </div>
          <select
            id="privacy-profile-visibility"
            value={profile.visibility}
            disabled={save.kind === 'saving'}
            onChange={(e) => void handleVisibilityChange(e.target.value as ProfileVisibility)}
            className="rounded-lg border border-nk-line bg-nk-ivory px-3 py-1.5 text-xs font-semibold text-nk-ink focus:border-nk-maroon focus:outline-none disabled:opacity-60"
          >
            {VISIBILITY_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-start justify-between py-3 gap-2" data-testid="phone-privacy">
          <div className="max-w-md">
            <label htmlFor="privacy-phone-visibility" className="font-semibold text-nk-ink">
              Phone number
            </label>
            <p className="text-xs text-nk-muted">
              Connected members with a paid plan can unlock and keep your phone number. If you turn this off later,
              we stop showing it in the app, but a member who already unlocked it may still have a copy.
            </p>
          </div>
          <label className="flex shrink-0 cursor-pointer items-center gap-2 text-xs font-semibold text-nk-ink">
            <input
              id="privacy-phone-visibility"
              type="checkbox"
              role="switch"
              checked={phoneAllowed}
              disabled={save.kind === 'saving'}
              onChange={(e) => void handlePhoneVisibilityChange(e.target.checked ? 'CONNECTED' : 'NEVER')}
              className="h-4 w-4 accent-nk-maroon"
            />
            {phoneAllowed ? 'Allowed' : 'Off'}
          </label>
        </div>

        {FIXED_RULES.map((rule) => (
          <div key={rule.label} className="flex flex-col sm:flex-row sm:items-center justify-between py-3 gap-1">
            <p className="font-semibold text-nk-ink">{rule.label}</p>
            <p className="text-xs font-medium text-nk-muted" data-testid="privacy-fixed-rule">
              {rule.value} <span className="text-nk-subtle">· no setting yet</span>
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
