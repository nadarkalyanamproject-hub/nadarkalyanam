'use client';

import type { ProfileResponse } from '@nadar-kalyanam/schemas';

const GENDER_LABELS: Record<string, string> = {
  MALE: 'Male',
  FEMALE: 'Female',
  OTHER: 'Other',
};

function calculateAge(dateOfBirth?: string): number {
  if (!dateOfBirth) return 31;
  const dob = new Date(dateOfBirth);
  if (isNaN(dob.getTime())) return 31;
  const diffMs = Date.now() - dob.getTime();
  const ageDate = new Date(diffMs);
  return Math.abs(ageDate.getUTCFullYear() - 1970);
}

export function ProfileHeader({
  profile,
  completionPercent = 68,
}: {
  profile?: ProfileResponse | null;
  completionPercent?: number;
}) {
  const fullName = profile?.fullName || 'Arjun R';
  const gender = profile?.gender ? GENDER_LABELS[profile.gender] || 'Male' : 'Male';
  const age = calculateAge(profile?.dateOfBirth);
  const motherTongue = profile?.details?.motherTongue || 'Telugu';
  const city = profile?.details?.location?.city || 'Chennai';

  const summary = `${gender} · ${age} · ${motherTongue} · ${city}`;

  return (
    <div className="mb-8 flex flex-col justify-between gap-6 border-b border-[#E8DCC8] pb-6 md:flex-row md:items-end">
      {/* Left side */}
      <div className="flex flex-col gap-2">
        <div>
          <h1 className="font-[family-name:var(--font-body)] text-2xl sm:text-3xl font-bold tracking-tight text-[#7A0710]">
            My Profile
          </h1>
          <p className="mt-1 text-sm font-medium text-[#776B62]">
            Manage your profile and keep your information up to date.
          </p>
        </div>

        {/* User Summary Pill & Badges */}
        <div className="mt-2 flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="font-[family-name:var(--font-body)] text-xl sm:text-2xl font-bold tracking-tight text-[#2B211C]">
              {fullName}
            </span>
          </div>

          <span className="hidden text-xs text-[#E8DCC8] sm:inline">|</span>

          <span className="text-sm font-medium text-[#776B62]">
            {summary}
          </span>

          <div className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#7A0710]">
            <svg viewBox="0 0 16 16" fill="currentColor" className="h-4 w-4 text-[#D6A33A]">
              <path
                fillRule="evenodd"
                d="M8 1.5a6.5 6.5 0 1 0 0 13 6.5 6.5 0 0 0 0-13ZM0 8a8 8 0 1 1 16 0A8 8 0 0 1 0 8Zm11.78-1.72a.75.75 0 0 0-1.06-1.06L7 8.94 5.28 7.22a.75.75 0 0 0-1.06 1.06l2.25 2.25a.75.75 0 0 0 1.06 0l4.25-4.25Z"
                clipRule="evenodd"
              />
            </svg>
            <span>Verified Profile</span>
          </div>
        </div>
      </div>

      {/* Right side: Compact, professional profile completion */}
      <div className="w-full max-w-xs rounded-xl border border-[#E8DCC8] bg-[#FFFFFF] p-4 shadow-sm md:w-72">
        <div className="mb-2 flex items-center justify-between">
          <span className="text-xs font-semibold uppercase tracking-wider text-[#776B62]">
            Profile Completion
          </span>
          <span className="text-sm font-bold text-[#7A0710]">
            {completionPercent}%
          </span>
        </div>

        {/* Small horizontal progress bar */}
        <div className="h-2 w-full overflow-hidden rounded-full bg-[#F2E8DC]">
          <div
            className="h-full rounded-full bg-gradient-to-r from-[#7A0710] via-[#94151C] to-[#D6A33A] transition-all duration-700 ease-out"
            style={{ width: `${Math.min(100, Math.max(10, completionPercent))}%` }}
          />
        </div>

        <p className="mt-2 text-xs font-medium text-[#776B62]">
          Complete your profile to get better matches.
        </p>
      </div>
    </div>
  );
}
