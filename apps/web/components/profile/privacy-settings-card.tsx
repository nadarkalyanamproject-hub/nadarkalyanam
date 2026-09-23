'use client';

import { useState } from 'react';

interface PrivacySettings {
  profileVisibility: string;
  phoneNumber: string;
  email: string;
  photoVisibility: string;
  onlineStatus: string;
}

export function PrivacySettingsCard() {
  const [settings, setSettings] = useState<PrivacySettings>({
    profileVisibility: 'Everyone',
    phoneNumber: 'Hidden',
    email: 'Hidden',
    photoVisibility: 'Members only',
    onlineStatus: 'Visible',
  });
  const [savedNotice, setSavedNotice] = useState(false);

  function update<K extends keyof PrivacySettings>(key: K, value: string) {
    setSettings((prev) => ({ ...prev, [key]: value }));
    setSavedNotice(true);
    setTimeout(() => setSavedNotice(false), 2000);
  }

  return (
    <div className="rounded-2xl border border-[#E8DCC8] bg-[#FFFFFF] p-6 shadow-sm">
      <div className="mb-4 flex items-center justify-between">
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
          <p className="mt-1 text-xs text-[#776B62]">
            You control what other members can see.
          </p>
        </div>

        {savedNotice && (
          <span className="text-xs font-semibold text-emerald-700 animate-in fade-in">
            ✓ Preferences Saved
          </span>
        )}
      </div>

      <div className="divide-y divide-[#F3EBDD] text-sm">
        {/* Profile visibility */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between py-3 gap-2">
          <div>
            <p className="font-semibold text-[#2B211C]">Profile visibility</p>
            <p className="text-xs text-[#776B62]">Who can discover and view your profile card</p>
          </div>
          <select
            value={settings.profileVisibility}
            onChange={(e) => update('profileVisibility', e.target.value)}
            className="rounded-lg border border-[#E8DCC8] bg-[#FFFDF9] px-3 py-1.5 text-xs font-semibold text-[#2B211C] focus:border-[#7A0710] focus:outline-none"
          >
            <option value="Everyone">Everyone</option>
            <option value="Registered members only">Registered members only</option>
            <option value="Premium members only">Premium members only</option>
          </select>
        </div>

        {/* Phone number */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between py-3 gap-2">
          <div>
            <p className="font-semibold text-[#2B211C]">Phone number</p>
            <p className="text-xs text-[#776B62]">Protect contact number from public view</p>
          </div>
          <select
            value={settings.phoneNumber}
            onChange={(e) => update('phoneNumber', e.target.value)}
            className="rounded-lg border border-[#E8DCC8] bg-[#FFFDF9] px-3 py-1.5 text-xs font-semibold text-[#2B211C] focus:border-[#7A0710] focus:outline-none"
          >
            <option value="Hidden">Hidden</option>
            <option value="Visible to accepted matches">Visible to accepted matches</option>
            <option value="Visible to all members">Visible to all members</option>
          </select>
        </div>

        {/* Email */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between py-3 gap-2">
          <div>
            <p className="font-semibold text-[#2B211C]">Email</p>
            <p className="text-xs text-[#776B62]">Show or hide email address</p>
          </div>
          <select
            value={settings.email}
            onChange={(e) => update('email', e.target.value)}
            className="rounded-lg border border-[#E8DCC8] bg-[#FFFDF9] px-3 py-1.5 text-xs font-semibold text-[#2B211C] focus:border-[#7A0710] focus:outline-none"
          >
            <option value="Hidden">Hidden</option>
            <option value="Visible to accepted matches">Visible to accepted matches</option>
          </select>
        </div>

        {/* Photo visibility */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between py-3 gap-2">
          <div>
            <p className="font-semibold text-[#2B211C]">Photo visibility</p>
            <p className="text-xs text-[#776B62]">Choose who can see your profile photos</p>
          </div>
          <select
            value={settings.photoVisibility}
            onChange={(e) => update('photoVisibility', e.target.value)}
            className="rounded-lg border border-[#E8DCC8] bg-[#FFFDF9] px-3 py-1.5 text-xs font-semibold text-[#2B211C] focus:border-[#7A0710] focus:outline-none"
          >
            <option value="Members only">Members only</option>
            <option value="All visitors">All visitors</option>
            <option value="Hidden until accepted">Hidden until accepted</option>
          </select>
        </div>

        {/* Online status */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between py-3 gap-2">
          <div>
            <p className="font-semibold text-[#2B211C]">Online status</p>
            <p className="text-xs text-[#776B62]">Let other members see when you are active</p>
          </div>
          <select
            value={settings.onlineStatus}
            onChange={(e) => update('onlineStatus', e.target.value)}
            className="rounded-lg border border-[#E8DCC8] bg-[#FFFDF9] px-3 py-1.5 text-xs font-semibold text-[#2B211C] focus:border-[#7A0710] focus:outline-none"
          >
            <option value="Visible">Visible</option>
            <option value="Hidden">Hidden</option>
          </select>
        </div>
      </div>
    </div>
  );
}
