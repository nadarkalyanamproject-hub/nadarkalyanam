'use client';

import { useState, type ReactNode } from 'react';
import type { ProfileResponse } from '@nadar-kalyanam/schemas';
import { AppHeader } from '../../components/app-header';
import { AdditionalDetailsEditSection } from '../../components/profile-edit/additional-details-edit-section';
import { BasicDetailsEditSection } from '../../components/profile-edit/basic-details-edit-section';
import { LocationProfessionalEditSection } from '../../components/profile-edit/location-professional-edit-section';
import { PersonalReligiousEditSection } from '../../components/profile-edit/personal-religious-edit-section';
import { ProfileHeader } from '../../components/profile/profile-header';
import { PhotoGalleryCard } from '../../components/profile/photo-gallery-card';
import { TrustVerificationCard } from '../../components/profile/trust-verification-card';
import { CompletionChecklistCard } from '../../components/profile/completion-checklist-card';
import { PrivacySettingsCard } from '../../components/profile/privacy-settings-card';
import { CulturalDivider, LotusOrnament } from '../../components/profile/cultural-divider';
import { useProfile } from '../../lib/use-profile';
import { useRequireAuth } from '../../lib/use-require-auth';
import './profile.css';

type SectionKey =
  | 'basic'
  | 'personal'
  | 'education'
  | 'location'
  | 'family'
  | 'lifestyle'
  | 'horoscope'
  | 'preferences'
  | 'privacy';

const GENDER_LABELS: Record<string, string> = {
  MALE: 'Male',
  FEMALE: 'Female',
  OTHER: 'Other',
};

const MARITAL_STATUS_LABELS: Record<string, string> = {
  NEVER_MARRIED: 'Never Married',
  DIVORCED: 'Divorced',
  WIDOWED: 'Widowed',
  AWAITING_DIVORCE: 'Awaiting Divorce',
};

const PHYSICAL_STATUS_LABELS: Record<string, string> = {
  NORMAL: 'Normal',
  PHYSICALLY_CHALLENGED: 'Physically Challenged',
};

const DOSHAM_LABELS: Record<string, string> = {
  NO: 'No Dosham',
  YES: 'Chevvai / Sevvai Dosham',
  DONT_KNOW: "Don't Know",
};

function formatDisplayDate(dateStr?: string): string {
  if (!dateStr) return '—';
  try {
    const [year, month, day] = dateStr.split('-');
    if (!year || !month || !day) return dateStr;
    const date = new Date(Number(year), Number(month) - 1, Number(day));
    return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
  } catch {
    return dateStr;
  }
}

function DetailItem({
  label: itemLabel,
  value,
  className = '',
}: {
  label: string;
  value: string | undefined;
  className?: string;
}) {
  return (
    <div className={`space-y-1 ${className}`}>
      <dt className="text-[11px] font-bold uppercase tracking-wider text-[#776B62]">
        {itemLabel}
      </dt>
      <dd className="text-sm font-semibold text-[#2B211C] break-words">
        {value && value.trim().length > 0 ? value : '—'}
      </dd>
    </div>
  );
}

interface AccordionSectionProps {
  id: string;
  icon: ReactNode;
  title: string;
  statusBadge: {
    label: string;
    variant: 'complete' | 'progress' | 'pending';
  };
  isOpen: boolean;
  isEditing: boolean;
  onToggle: () => void;
  onEdit: () => void;
  children: ReactNode;
  editView?: ReactNode;
}

function AccordionSection({
  id,
  icon,
  title,
  statusBadge,
  isOpen,
  isEditing,
  onToggle,
  onEdit,
  children,
  editView,
}: AccordionSectionProps) {
  return (
    <div
      id={`section-${id}`}
      className={`rounded-2xl border transition-all duration-200 bg-[#FFFFFF] ${
        isEditing
          ? 'border-[#7A0710] shadow-md ring-1 ring-[#7A0710]/20'
          : isOpen
          ? 'border-[#E8DCC8] shadow-sm'
          : 'border-[#E8DCC8] hover:border-[#D9C8B0]'
      }`}
    >
      {/* Section Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-5 sm:p-6 border-b border-[#F3EBDD]/70">
        <button
          type="button"
          onClick={onToggle}
          className="flex flex-1 items-center gap-3 text-left focus:outline-none"
        >
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#FFF9ED] text-[#7A0710] border border-[#E8DCC8]">
            {icon}
          </div>
          <div>
            <h2 className="font-[family-name:var(--font-body)] text-lg sm:text-xl font-bold tracking-tight text-[#7A0710]">
              {title}
            </h2>
            <p
              className={`mt-0.5 flex items-center gap-1 text-xs font-medium ${
                statusBadge.variant === 'complete'
                  ? 'text-emerald-700 font-semibold'
                  : statusBadge.variant === 'progress'
                  ? 'text-[#8C6110] font-semibold'
                  : 'text-[#776B62]'
              }`}
            >
              {statusBadge.variant === 'complete' && <span>✓</span>}
              <span>{statusBadge.label}</span>
            </p>
          </div>
        </button>

        {/* Action button */}
        <div className="flex items-center gap-2 self-end sm:self-auto">
          {!isEditing && (
            <button
              type="button"
              onClick={onEdit}
              className="inline-flex items-center gap-1 rounded-lg border border-[#E8DCC8] bg-[#FFFDF9] px-3 py-1.5 text-xs font-semibold text-[#7A0710] shadow-2xs transition-all hover:border-[#D6A33A] hover:bg-[#FFF9ED] hover:text-[#94151C]"
            >
              <span>Edit</span>
              <span className="text-[#D6A33A]">→</span>
            </button>
          )}

          <button
            type="button"
            onClick={onToggle}
            aria-label={isOpen ? 'Collapse section' : 'Expand section'}
            className="flex h-7 w-7 items-center justify-center rounded-md text-[#776B62] hover:bg-[#FAF6EF]"
          >
            <svg
              viewBox="0 0 20 20"
              fill="currentColor"
              className={`h-4 w-4 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
            >
              <path
                fillRule="evenodd"
                d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z"
                clipRule="evenodd"
              />
            </svg>
          </button>
        </div>
      </div>

      {/* Section Content */}
      {isOpen && (
        <div className="p-5 sm:p-6 animate-in fade-in duration-200">
          {isEditing && editView ? editView : children}
        </div>
      )}
    </div>
  );
}

export default function ProfilePage() {
  const { ready } = useRequireAuth();
  const { profile, loading, error, setProfile, refetch } = useProfile();
  const [editingSection, setEditingSection] = useState<SectionKey | null>(null);

  // Accordion open/close state (all open by default for rich discoverability)
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({
    basic: true,
    personal: true,
    education: true,
    location: false,
    family: false,
    lifestyle: false,
    horoscope: false,
    preferences: false,
    privacy: false,
  });

  if (!ready) return null;

  function toggleSection(key: string) {
    setOpenSections((prev) => ({ ...prev, [key]: !prev[key] }));
  }

  function handleStartEditing(sectionKey: SectionKey) {
    setOpenSections((prev) => ({ ...prev, [sectionKey]: true }));
    setEditingSection(sectionKey);
  }

  function handleSaved(updated: ProfileResponse) {
    setProfile(updated);
    setEditingSection(null);
  }

  function handleChecklistClick(sectionId: string) {
    setOpenSections((prev) => ({ ...prev, [sectionId]: true }));
    const element = document.getElementById(`section-${sectionId}`);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }

  // Completion calculation based on real fields
  const hasBasic = Boolean(profile?.fullName && profile?.gender && profile?.dateOfBirth);
  const hasPersonal = Boolean(profile?.details?.religion && profile?.details?.casteCommunity);
  const hasEducation = Boolean(profile?.details?.education?.profession);
  const hasFamily = Boolean(profile?.details?.additional?.familyType);
  const hasPreferences = false; // default incomplete

  const checklistItems = [
    { id: 'basic', label: 'Basic Details', completed: hasBasic },
    { id: 'personal', label: 'Personal & Religious', completed: hasPersonal },
    { id: 'education', label: 'Education & Career', completed: hasEducation },
    { id: 'preferences', label: 'Partner Preferences', completed: hasPreferences },
    { id: 'family', label: 'Family Details', completed: hasFamily },
  ];

  const completionPercent = profile?.completionScore || 68;

  return (
    <div className="profile-page-root min-h-screen bg-[#FFF8E8] text-[#2B211C]">
      <AppHeader />

      <main className="w-full px-4 py-6 sm:px-6 sm:py-8 lg:px-8 xl:px-12 2xl:px-16">
        {/* Profile Header */}
        <ProfileHeader profile={profile} completionPercent={completionPercent} />

        {loading && (
          <div className="rounded-2xl border border-[#E8DCC8] bg-[#FFFFFF] p-12 text-center shadow-sm">
            <div className="mx-auto flex h-10 w-10 animate-spin items-center justify-center rounded-full border-2 border-[#7A0710] border-t-transparent" />
            <p className="mt-4 text-sm font-medium text-[#776B62]">
              Loading your matrimonial profile…
            </p>
          </div>
        )}

        {error && (
          <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-center text-sm font-medium text-[#94151C] shadow-sm">
            {error}
          </div>
        )}

        {profile && (
          <div className="grid grid-cols-1 gap-8 lg:grid-cols-12">
            {/* LEFT COLUMN: Photo Gallery, Verification, Completion Checklist */}
            <div className="space-y-6 lg:col-span-5 xl:col-span-4 2xl:col-span-3">
              {/* Photo Gallery Card */}
              <PhotoGalleryCard profile={profile} onChanged={() => void refetch()} />

              {/* Trust & Verification Card */}
              <TrustVerificationCard
                mobileVerified={true}
                emailVerified={Boolean(profile.details?.email)}
              />

              {/* Profile Completion Checklist Card */}
              <CompletionChecklistCard
                percentage={completionPercent}
                items={checklistItems}
                onCompleteClick={handleChecklistClick}
              />
            </div>

            {/* RIGHT COLUMN: Expandable Profile Sections */}
            <div className="space-y-5 lg:col-span-7 xl:col-span-8 2xl:col-span-9">
              {/* 1. Basic Details */}
              <AccordionSection
                id="basic"
                title="Basic Details"
                icon={
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} className="h-5 w-5">
                    <circle cx="12" cy="8" r="4" />
                    <path d="M6 21v-2a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v2" />
                  </svg>
                }
                statusBadge={{ label: 'Complete', variant: 'complete' }}
                isOpen={openSections.basic}
                isEditing={editingSection === 'basic'}
                onToggle={() => toggleSection('basic')}
                onEdit={() => handleStartEditing('basic')}
                editView={
                  <BasicDetailsEditSection
                    profile={profile}
                    onCancel={() => setEditingSection(null)}
                    onSaved={handleSaved}
                  />
                }
              >
                <dl className="grid grid-cols-1 gap-x-6 gap-y-5 sm:grid-cols-2">
                  <DetailItem label="Full Name" value={profile.fullName} />
                  <DetailItem label="Gender" value={GENDER_LABELS[profile.gender] ?? profile.gender} />
                  <DetailItem label="Date of Birth" value={formatDisplayDate(profile.dateOfBirth)} />
                  <DetailItem label="Mother Tongue" value={profile.details?.motherTongue || 'Telugu'} />
                  <DetailItem label="Email" value={profile.details?.email} className="sm:col-span-2" />
                </dl>
              </AccordionSection>

              {/* 2. Personal & Religious */}
              <AccordionSection
                id="personal"
                title="Personal & Religious"
                icon={
                  <LotusOrnament className="h-5 w-5" />
                }
                statusBadge={{ label: 'Complete', variant: 'complete' }}
                isOpen={openSections.personal}
                isEditing={editingSection === 'personal'}
                onToggle={() => toggleSection('personal')}
                onEdit={() => handleStartEditing('personal')}
                editView={
                  <PersonalReligiousEditSection
                    profile={profile}
                    onCancel={() => setEditingSection(null)}
                    onSaved={handleSaved}
                  />
                }
              >
                <dl className="grid grid-cols-1 gap-x-6 gap-y-5 sm:grid-cols-2">
                  <DetailItem label="Height" value={profile.details?.height || '5 ft 10 in (178 cm)'} />
                  <DetailItem
                    label="Physical Status"
                    value={PHYSICAL_STATUS_LABELS[profile.details?.physicalStatus || 'NORMAL'] || 'Normal'}
                  />
                  <DetailItem
                    label="Marital Status"
                    value={MARITAL_STATUS_LABELS[profile.details?.maritalStatus || 'NEVER_MARRIED'] || 'Never Married'}
                  />
                  <DetailItem label="Religion" value={profile.details?.religion || 'Hindu'} />
                  <DetailItem label="Caste / Community" value={profile.details?.casteCommunity || 'Nadar'} />
                  <DetailItem
                    label="Dosham"
                    value={DOSHAM_LABELS[profile.details?.dosham || 'NO'] || 'No Dosham'}
                  />
                </dl>
              </AccordionSection>

              {/* 3. Education & Career */}
              <AccordionSection
                id="education"
                title="Education & Career"
                icon={
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} className="h-5 w-5">
                    <path d="M22 10v6M2 10l10-5 10 5-10 5z" />
                    <path d="M6 12v5c3 3 9 3 12 0v-5" />
                  </svg>
                }
                statusBadge={{ label: '80% Complete', variant: 'progress' }}
                isOpen={openSections.education}
                isEditing={editingSection === 'education'}
                onToggle={() => toggleSection('education')}
                onEdit={() => handleStartEditing('education')}
                editView={
                  <LocationProfessionalEditSection
                    profile={profile}
                    onCancel={() => setEditingSection(null)}
                    onSaved={handleSaved}
                  />
                }
              >
                <dl className="grid grid-cols-1 gap-x-6 gap-y-5 sm:grid-cols-2">
                  <DetailItem
                    label="Education Level"
                    value={profile.details?.education?.educationLevel || 'B.Tech / B.E. - Computers'}
                  />
                  <DetailItem
                    label="Education Detail"
                    value={profile.details?.education?.educationDetail || 'Anna University, Chennai'}
                  />
                  <DetailItem
                    label="Profession"
                    value={profile.details?.education?.profession || 'Software Architect'}
                  />
                  <DetailItem
                    label="Employed In"
                    value={profile.details?.education?.employedIn || 'Private Sector (MNC)'}
                  />
                  <DetailItem
                    label="Annual Income"
                    value={
                      [
                        profile.details?.education?.annualIncomeRange || '25 - 35 Lakhs',
                        profile.details?.education?.annualIncomeCurrency || 'INR',
                      ]
                        .filter(Boolean)
                        .join(' ')
                    }
                    className="sm:col-span-2"
                  />
                </dl>
              </AccordionSection>

              {/* 4. Location */}
              <AccordionSection
                id="location"
                title="Location Details"
                icon={
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} className="h-5 w-5">
                    <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" />
                    <circle cx="12" cy="10" r="3" />
                  </svg>
                }
                statusBadge={{ label: 'Complete', variant: 'complete' }}
                isOpen={openSections.location}
                isEditing={editingSection === 'location'}
                onToggle={() => toggleSection('location')}
                onEdit={() => handleStartEditing('location')}
                editView={
                  <LocationProfessionalEditSection
                    profile={profile}
                    onCancel={() => setEditingSection(null)}
                    onSaved={handleSaved}
                  />
                }
              >
                <dl className="grid grid-cols-1 gap-x-6 gap-y-5 sm:grid-cols-2">
                  <DetailItem label="City" value={profile.details?.location?.city || 'Chennai'} />
                  <DetailItem label="State" value={profile.details?.location?.state || 'Tamil Nadu'} />
                  <DetailItem label="Country" value={profile.details?.location?.country || 'India'} />
                  <DetailItem label="Citizenship / Residence" value="Indian Citizen (Resident)" />
                </dl>
              </AccordionSection>

              {/* 5. Family Details */}
              <AccordionSection
                id="family"
                title="Family Details"
                icon={
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} className="h-5 w-5">
                    <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
                    <circle cx="9" cy="7" r="4" />
                    <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
                    <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                  </svg>
                }
                statusBadge={{ label: 'Complete', variant: 'complete' }}
                isOpen={openSections.family}
                isEditing={editingSection === 'family'}
                onToggle={() => toggleSection('family')}
                onEdit={() => handleStartEditing('family')}
                editView={
                  <AdditionalDetailsEditSection
                    profile={profile}
                    onCancel={() => setEditingSection(null)}
                    onSaved={handleSaved}
                  />
                }
              >
                <dl className="grid grid-cols-1 gap-x-6 gap-y-5 sm:grid-cols-2">
                  <DetailItem
                    label="Family Status / Type"
                    value={profile.details?.additional?.familyType || 'Upper Middle Class'}
                  />
                  <DetailItem label="Family Values" value="Traditional with modern outlook" />
                  <DetailItem
                    label="About Family"
                    value={
                      profile.details?.additional?.about ||
                      'We belong to a respected Nadar family originally hailing from Tirunelveli district, settled in Chennai for three decades. Parents are retired professionals with strong values of respect, education, and cultural heritage.'
                    }
                    className="sm:col-span-2"
                  />
                </dl>
              </AccordionSection>

              {/* 6. Lifestyle */}
              <AccordionSection
                id="lifestyle"
                title="Lifestyle & Habits"
                icon={
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} className="h-5 w-5">
                    <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
                  </svg>
                }
                statusBadge={{ label: 'Complete', variant: 'complete' }}
                isOpen={openSections.lifestyle}
                isEditing={false}
                onToggle={() => toggleSection('lifestyle')}
                onEdit={() => toggleSection('lifestyle')}
              >
                <dl className="grid grid-cols-1 gap-x-6 gap-y-5 sm:grid-cols-2">
                  <DetailItem label="Diet" value="Non-Vegetarian" />
                  <DetailItem label="Smoking" value="No" />
                  <DetailItem label="Drinking" value="No" />
                  <DetailItem label="Languages Known" value="Tamil, Telugu, English" />
                  <DetailItem
                    label="Hobbies & Interests"
                    value="Classical music, Badminton, Travel, Reading technology journals"
                    className="sm:col-span-2"
                  />
                </dl>
              </AccordionSection>

              {/* 7. Horoscope */}
              <AccordionSection
                id="horoscope"
                title="Horoscope Details"
                icon={
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} className="h-5 w-5">
                    <circle cx="12" cy="12" r="9" />
                    <path d="M12 3v18" />
                    <path d="M3 12h18" />
                  </svg>
                }
                statusBadge={{ label: 'Complete', variant: 'complete' }}
                isOpen={openSections.horoscope}
                isEditing={false}
                onToggle={() => toggleSection('horoscope')}
                onEdit={() => toggleSection('horoscope')}
              >
                <dl className="grid grid-cols-1 gap-x-6 gap-y-5 sm:grid-cols-2">
                  <DetailItem label="Rasi / Moon Sign" value="Mesham (Aries)" />
                  <DetailItem label="Nakshatram / Star" value="Bharani" />
                  <DetailItem label="Chevvai Dosham" value="No" />
                  <DetailItem label="Time of Birth" value="06:45 AM" />
                  <DetailItem label="Place of Birth" value="Chennai, Tamil Nadu" />
                  <DetailItem label="Horoscope Match Requirement" value="Must Match" />
                </dl>
              </AccordionSection>

              {/* 8. Partner Preferences */}
              <AccordionSection
                id="preferences"
                title="Partner Preferences"
                icon={
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} className="h-5 w-5">
                    <path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z" />
                  </svg>
                }
                statusBadge={{ label: '40% Complete', variant: 'progress' }}
                isOpen={openSections.preferences}
                isEditing={false}
                onToggle={() => toggleSection('preferences')}
                onEdit={() => toggleSection('preferences')}
              >
                <dl className="grid grid-cols-1 gap-x-6 gap-y-5 sm:grid-cols-2">
                  <DetailItem label="Age Range" value="25 - 29 Years" />
                  <DetailItem label="Height Range" value="5 ft 2 in - 5 ft 7 in" />
                  <DetailItem label="Marital Status" value="Never Married" />
                  <DetailItem label="Community" value="Nadar (All Sub-sects welcome)" />
                  <DetailItem label="Education" value="Graduate / Post-Graduate" />
                  <DetailItem label="Preferred Location" value="Chennai, Coimbatore, Bangalore" />
                </dl>
              </AccordionSection>

              <CulturalDivider className="my-6" />

              {/* 9. Privacy & Visibility */}
              <PrivacySettingsCard />
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
