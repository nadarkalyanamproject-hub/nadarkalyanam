'use client';

import { useState } from 'react';
import type { ProfileResponse, ProfileVisibility } from '@nadar-kalyanam/schemas';
import { useRegistration } from '../../app/providers/registration-provider';
import { ApiError, updateProfileVisibility } from '../../lib/api-client';

// The stored profile visibility values. PUBLIC and MEMBERS_ONLY behave the
// same today because only signed-in members can browse profiles.
const VISIBILITY_OPTIONS: { value: ProfileVisibility; label: string }[] = [
  { value: 'PUBLIC', label: 'Everyone' },
  { value: 'MEMBERS_ONLY', label: 'Registered members only' },
  { value: 'HIDDEN', label: 'Hidden from browse, search & matches' },
];

// Shown as facts, not settings: there is no stored preference behind these,
// so they describe what the app actually does today.
const FIXED_RULES = [
  { label: 'Phone number', value: 'Never shown to other members' },
  { label: 'Email', value: 'Never shown to other members' },
  { label: 'Photos', value: 'Visible to signed-in members' },
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
    <div className="rounded-2xl border border-[#E8DCC8] bg-[#FFFFFF] p-6 shadow-sm">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} className="h-5 w-5 text-[#7A0710]">
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
              <path d="M7 11V7a5 5 0 0 1 10 0v4" />
            </svg>
            <h2 className="font-[family-name:var(--font-body)] text-lg sm:text-xl font-bold tracking-tight text-[#7A0710]">
              Privacy & Visibility
            </h2>
          </div>
          <p className="mt-1 text-xs text-[#776B62]">You control who can find your profile.</p>
        </div>

        <span aria-live="polite" className="text-xs font-semibold" data-testid="privacy-save-status">
          {save.kind === 'saving' && <span className="text-[#776B62]">Saving…</span>}
          {save.kind === 'saved' && <span className="text-emerald-700">✓ Saved</span>}
        </span>
      </div>

      {save.kind === 'error' && (
        <p role="alert" className="mb-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs font-medium text-[#7A0710]">
          {save.message}
        </p>
      )}

      <div className="divide-y divide-[#F3EBDD] text-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between py-3 gap-2">
          <div>
            <label htmlFor="privacy-profile-visibility" className="font-semibold text-[#2B211C]">
              Profile visibility
            </label>
            <p className="text-xs text-[#776B62]">
              Who can discover your profile. &ldquo;Everyone&rdquo; and &ldquo;Registered members only&rdquo; work the same
              today: only signed-in members can browse.
            </p>
          </div>
          <select
            id="privacy-profile-visibility"
            value={profile.visibility}
            disabled={save.kind === 'saving'}
            onChange={(e) => void handleVisibilityChange(e.target.value as ProfileVisibility)}
            className="rounded-lg border border-[#E8DCC8] bg-[#FFFDF9] px-3 py-1.5 text-xs font-semibold text-[#2B211C] focus:border-[#7A0710] focus:outline-none disabled:opacity-60"
          >
            {VISIBILITY_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>

        {FIXED_RULES.map((rule) => (
          <div key={rule.label} className="flex flex-col sm:flex-row sm:items-center justify-between py-3 gap-1">
            <p className="font-semibold text-[#2B211C]">{rule.label}</p>
            <p className="text-xs font-medium text-[#776B62]" data-testid="privacy-fixed-rule">
              {rule.value} <span className="text-[#A89B90]">· no setting yet</span>
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
