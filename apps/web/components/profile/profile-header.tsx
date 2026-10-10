'use client';

import type { ProfileResponse } from '@nadar-kalyanam/schemas';
import { VerifiedBadge } from '../ui/verified-badge';

const GENDER_LABELS: Record<string, string> = {
  MALE: 'Male',
  FEMALE: 'Female',
  OTHER: 'Other',
};

function calculateAge(dateOfBirth?: string): number | undefined {
  if (!dateOfBirth) return undefined;
  const dob = new Date(dateOfBirth);
  if (isNaN(dob.getTime())) return undefined;
  const diffMs = Date.now() - dob.getTime();
  const ageDate = new Date(diffMs);
  return Math.abs(ageDate.getUTCFullYear() - 1970);
}

export function ProfileHeader({
  profile,
  completionPercent = 0,
}: {
  profile?: ProfileResponse | null;
  completionPercent?: number;
}) {
  // Only the signed-in user's own data, never placeholder values: while the
  // profile is loading (or missing) the name and summary are simply blank.
  const fullName = profile?.fullName ?? '';
  const age = calculateAge(profile?.dateOfBirth);
  const summary = [
    profile?.gender ? GENDER_LABELS[profile.gender] : undefined,
    age !== undefined ? String(age) : undefined,
    profile?.details?.motherTongue,
    profile?.details?.location?.city,
  ]
    .filter(Boolean)
    .join(' · ');

  return (
    <div className="mb-8 flex flex-col justify-between gap-6 border-b border-nk-line pb-6 md:flex-row md:items-end">
      {/* Left side */}
      <div className="flex flex-col gap-2">
        <div>
          <h1 className="font-[family-name:var(--font-body)] text-2xl sm:text-3xl font-bold tracking-tight text-nk-maroon">
            My Profile
          </h1>
          <p className="mt-1 text-sm font-medium text-nk-muted">
            Manage your profile and keep your information up to date.
          </p>
        </div>

        {/* User Summary Pill & Badges — only once the user's own profile is loaded */}
        {profile && (
          <div className="mt-2 flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2">
              <span className="font-[family-name:var(--font-body)] text-xl sm:text-2xl font-bold tracking-tight text-nk-ink">
                {fullName}
              </span>
            </div>

            <span className="hidden text-xs text-nk-line sm:inline">|</span>

            <span className="text-sm font-medium text-nk-muted">{summary}</span>

            {/* Only a completed identity verification earns this; unverified
                profiles show nothing here (the Trust card has the status). */}
            {profile.isVerified && (
              <div className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#0F6CBD]">
                <VerifiedBadge className="h-4 w-4" />
                <span>Verified Profile</span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Right side: Compact, professional profile completion */}
      <div className="w-full max-w-xs rounded-xl border border-[#FFE082] bg-gradient-to-br from-[#FFFFFF] to-[#FFFDF5] p-4 shadow-sm md:w-72">
        <div className="mb-2 flex items-center justify-between">
          <span className="text-xs font-semibold uppercase tracking-wider text-nk-muted">Profile Completion</span>
          <span className="text-sm font-bold text-[#92400E]">{completionPercent}%</span>
        </div>

        {/* Small horizontal progress bar */}
        <div className="h-2 w-full overflow-hidden rounded-sm bg-nk-line-soft">
          <div
            className="h-full rounded-sm bg-gradient-to-r from-nk-maroon via-[#D97706] to-[#F59E0B] transition-all duration-700 ease-out"
            style={{
              width: `${Math.min(100, Math.max(0, completionPercent))}%`,
            }}
          />
        </div>

        <p className="mt-2 text-xs font-medium text-nk-muted">Complete your profile to get better matches.</p>
      </div>
    </div>
  );
}
