'use client';

import { useEffect, useState, type ReactNode } from 'react';
import type { MyHoroscope, ProfileResponse, SavedPartnerPreferences } from '@nadar-kalyanam/schemas';
import { AppHeader } from '../../components/app-header';
import { AdditionalDetailsEditSection } from '../../components/profile-edit/additional-details-edit-section';
import { BasicDetailsEditSection } from '../../components/profile-edit/basic-details-edit-section';
import { LocationProfessionalEditSection } from '../../components/profile-edit/location-professional-edit-section';
import { PersonalReligiousEditSection } from '../../components/profile-edit/personal-religious-edit-section';
import { PartnerPreferencesEditor, PartnerPreferencesView } from '../../components/profile-edit/partner-preferences-section';
import { HoroscopeEditor, HoroscopeOwnerView } from '../../components/profile-edit/horoscope-section';
import { ApiError, getMyHoroscope, getPartnerPreferences } from '../../lib/api-client';
import { useRegistration } from '../providers/registration-provider';
import { ProfileHeader } from '../../components/profile/profile-header';
import { PhotoGalleryCard } from '../../components/profile/photo-gallery-card';
import { TrustVerificationCard } from '../../components/profile/trust-verification-card';
import { CompletionChecklistCard } from '../../components/profile/completion-checklist-card';
import { PrivacySettingsCard } from '../../components/profile/privacy-settings-card';
import { BlockedMembersCard } from '../../components/profile/blocked-members-card';
import { MyPlanNote } from '../../components/profile/my-plan-note';
import { ComingSoonNote, ComingSoonPill } from '../../components/ui/coming-soon-note';
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
  YES: 'Yes',
  DONT_KNOW: "Don't Know",
};

// Which counted completion fields (see the API's profile-completion.ts) each
// real section holds.
const SECTION_FIELDS = {
  basic: ['fullName', 'gender', 'dateOfBirth', 'motherTongue', 'email'],
  personal: ['height', 'physicalStatus', 'maritalStatus', 'religion', 'casteCommunity', 'dosham'],
  education: ['educationLevel', 'educationDetail', 'profession', 'employedIn', 'annualIncomeRange'],
  location: ['city', 'state'],
  family: ['familyType', 'about'],
} as const;

// Display label for a stored enum value; blank stays blank (shown as '—').
function labelFor(labels: Record<string, string>, value: string | undefined): string | undefined {
  return value ? (labels[value] ?? value) : undefined;
}

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
  // Real sections show a completion badge and an Edit button; a comingSoon
  // section (no data exists for it yet) shows neither.
  statusBadge?: {
    label: string;
    variant: 'complete' | 'progress' | 'pending';
  };
  comingSoon?: boolean;
  isOpen: boolean;
  isEditing: boolean;
  onToggle: () => void;
  onEdit?: () => void;
  children: ReactNode;
  editView?: ReactNode;
}

function AccordionSection({
  id,
  icon,
  title,
  statusBadge,
  comingSoon = false,
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
            {comingSoon && (
              <p className="mt-1">
                <ComingSoonPill />
              </p>
            )}
            {/* Only what still needs doing; a finished section shows no label. */}
            {statusBadge && statusBadge.variant !== 'complete' && (
              <p
                className={`mt-0.5 text-xs ${
                  statusBadge.variant === 'progress' ? 'font-semibold text-[#8C6110]' : 'font-medium text-[#776B62]'
                }`}
              >
                {statusBadge.label}
              </p>
            )}
          </div>
        </button>

        {/* Action button */}
        <div className="flex items-center gap-2 self-end sm:self-auto">
          {!isEditing && onEdit && !comingSoon && (
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
  const { data } = useRegistration();
  // Partner preferences and horoscope have their own endpoints (owner-only).
  // undefined = still loading.
  const [preferences, setPreferences] = useState<SavedPartnerPreferences | null | undefined>(undefined);
  const [horoscope, setHoroscope] = useState<MyHoroscope | null | undefined>(undefined);
  const [extrasError, setExtrasError] = useState<string | null>(null);
  const [extrasMessage, setExtrasMessage] = useState<{ section: 'preferences' | 'horoscope'; text: string } | null>(null);
  const profileId = profile?.id;

  useEffect(() => {
    if (!data.accessToken || !profileId) return;
    let cancelled = false;
    Promise.all([getPartnerPreferences(data.accessToken), getMyHoroscope(data.accessToken)])
      .then(([p, h]) => {
        if (cancelled) return;
        setPreferences(p.preferences);
        setHoroscope(h.horoscope);
      })
      .catch((err: unknown) => {
        if (!cancelled) setExtrasError(err instanceof ApiError ? err.message : 'Could not load your preferences and horoscope.');
      });
    return () => {
      cancelled = true;
    };
  }, [data.accessToken, profileId]);

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

  const checklistItems = [
    { id: 'basic', label: 'Basic Details', completed: hasBasic },
    { id: 'personal', label: 'Personal & Religious', completed: hasPersonal },
    { id: 'education', label: 'Education & Career', completed: hasEducation },
    { id: 'family', label: 'Family Details', completed: hasFamily },
    // Optional extras: not part of the percentage, so skipping them (or
    // keeping a horoscope hidden) never lowers it.
    { id: 'preferences', label: 'Partner Preferences', completed: Boolean(profile?.optionalCompletion.partnerPreferences), optional: true },
    { id: 'horoscope', label: 'Horoscope Details', completed: Boolean(profile?.optionalCompletion.horoscope), optional: true },
  ];

  function handleExtrasSaved(section: 'preferences' | 'horoscope', text: string) {
    setEditingSection(null);
    setExtrasMessage({ section, text });
    // Refresh the optional completion items.
    void refetch();
  }
  const sectionMessage = (section: 'preferences' | 'horoscope') =>
    extrasMessage?.section === section ? (
      <p className="mb-4 rounded-lg bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-800" role="status">
        {extrasMessage.text}
      </p>
    ) : null;
  const extrasBody = (section: 'preferences' | 'horoscope', body: ReactNode) =>
    extrasError ? (
      <p className="text-sm text-[#94151C]">{extrasError}</p>
    ) : (section === 'preferences' ? preferences : horoscope) === undefined ? (
      <p className="text-sm text-[#776B62]">Loading…</p>
    ) : (
      <>
        {sectionMessage(section)}
        {body}
      </>
    );

  // Real, computed by the API from the profile's filled fields and photos.
  const completionPercent = profile?.completionScore ?? 0;

  // Section badges from the API's list of still-empty counted fields.
  function sectionBadge(section: keyof typeof SECTION_FIELDS): { label: string; variant: 'complete' | 'progress' } {
    const missing = SECTION_FIELDS[section].filter((field) => profile?.completionMissing.includes(field)).length;
    return missing === 0
      ? { label: 'Complete', variant: 'complete' }
      : { label: `${missing} to fill`, variant: 'progress' };
  }

  return (
    <div className="profile-page-root min-h-screen bg-[#FFF8E8] text-[#2B211C]">
      <AppHeader />

      <main className="w-full px-4 py-6 sm:px-6 sm:py-8 lg:px-8 xl:px-12 2xl:px-16">
        {/* Profile Header */}
        <ProfileHeader profile={profile} completionPercent={completionPercent} />

        <div className="my-4">
          <MyPlanNote />
        </div>

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
              <TrustVerificationCard email={profile.details?.email} />

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
                statusBadge={sectionBadge('basic')}
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
                  <DetailItem label="Mother Tongue" value={profile.details?.motherTongue} />
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
                statusBadge={sectionBadge('personal')}
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
                  <DetailItem label="Height" value={profile.details?.height} />
                  <DetailItem
                    label="Physical Status"
                    value={labelFor(PHYSICAL_STATUS_LABELS, profile.details?.physicalStatus)}
                  />
                  <DetailItem
                    label="Marital Status"
                    value={labelFor(MARITAL_STATUS_LABELS, profile.details?.maritalStatus)}
                  />
                  <DetailItem label="Religion" value={profile.details?.religion} />
                  <DetailItem label="Caste / Community" value={profile.details?.casteCommunity} />
                  <DetailItem
                    label="Dosham"
                    value={labelFor(DOSHAM_LABELS, profile.details?.dosham)}
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
                statusBadge={sectionBadge('education')}
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
                    value={profile.details?.education?.educationLevel}
                  />
                  <DetailItem
                    label="Education Detail"
                    value={profile.details?.education?.educationDetail}
                  />
                  <DetailItem
                    label="Profession"
                    value={profile.details?.education?.profession}
                  />
                  <DetailItem
                    label="Employed In"
                    value={profile.details?.education?.employedIn}
                  />
                  <DetailItem
                    label="Annual Income"
                    value={
                      // Currency is fixed to INR at onboarding; only shown with an amount.
                      profile.details?.education?.annualIncomeRange?.trim()
                        ? `${profile.details.education.annualIncomeRange} ${profile.details.education.annualIncomeCurrency || 'INR'}`
                        : undefined
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
                statusBadge={sectionBadge('location')}
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
                  <DetailItem label="City" value={profile.details?.location?.city} />
                  <DetailItem label="State" value={profile.details?.location?.state} />
                  <DetailItem label="Country" value={profile.details?.location?.country} />
                  <div className="sm:col-span-2">
                    <ComingSoonNote feature="citizenship" />
                  </div>
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
                statusBadge={sectionBadge('family')}
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
                    value={profile.details?.additional?.familyType}
                  />
                  <div className="sm:col-span-2">
                    <ComingSoonNote feature="familyValue" />
                  </div>
                  {/* The onboarding "About you" text — about the member, not their family. */}
                  <DetailItem label="About You" value={profile.details?.additional?.about} className="sm:col-span-2" />
                </dl>
              </AccordionSection>

              {/* 6. Lifestyle & Habits: nothing is collected yet, so nothing to show or edit. */}
              <AccordionSection
                id="lifestyle"
                title="Lifestyle & Habits"
                icon={
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} className="h-5 w-5">
                    <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
                  </svg>
                }
                comingSoon
                isOpen={openSections.lifestyle}
                isEditing={false}
                onToggle={() => toggleSection('lifestyle')}
              >
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <ComingSoonNote feature="habits" />
                  <ComingSoonNote feature="hobbies" />
                </div>
              </AccordionSection>

              {/* 7. Horoscope Details (owner-only endpoint; others see it only as the visibility setting allows). */}
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
                statusBadge={
                  profile.optionalCompletion.horoscope ? { label: 'Added', variant: 'complete' } : { label: 'Optional', variant: 'pending' }
                }
                isOpen={openSections.horoscope}
                isEditing={editingSection === 'horoscope'}
                onToggle={() => toggleSection('horoscope')}
                onEdit={horoscope === undefined || extrasError ? undefined : () => handleStartEditing('horoscope')}
                editView={
                  <HoroscopeEditor
                    saved={horoscope ?? null}
                    onCancel={() => setEditingSection(null)}
                    onSaved={(h, text) => {
                      setHoroscope(h);
                      handleExtrasSaved('horoscope', text);
                    }}
                  />
                }
              >
                {extrasBody(
                  'horoscope',
                  <HoroscopeOwnerView
                    saved={horoscope ?? null}
                    onChanged={(h, text) => {
                      setHoroscope(h);
                      handleExtrasSaved('horoscope', text);
                    }}
                  />,
                )}
              </AccordionSection>

              {/* 8. Partner Preferences (owner-only; never shown to other members). */}
              <AccordionSection
                id="preferences"
                title="Partner Preferences"
                icon={
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} className="h-5 w-5">
                    <path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z" />
                  </svg>
                }
                statusBadge={
                  profile.optionalCompletion.partnerPreferences ? { label: 'Set', variant: 'complete' } : { label: 'Optional', variant: 'pending' }
                }
                isOpen={openSections.preferences}
                isEditing={editingSection === 'preferences'}
                onToggle={() => toggleSection('preferences')}
                onEdit={preferences === undefined || extrasError ? undefined : () => handleStartEditing('preferences')}
                editView={
                  <PartnerPreferencesEditor
                    saved={preferences ?? null}
                    onCancel={() => setEditingSection(null)}
                    onSaved={(p, text) => {
                      setPreferences(p);
                      handleExtrasSaved('preferences', text);
                    }}
                  />
                }
              >
                {extrasBody('preferences', <PartnerPreferencesView saved={preferences ?? null} />)}
              </AccordionSection>

              <CulturalDivider className="my-6" />

              {/* 9. Privacy & Visibility */}
              <PrivacySettingsCard profile={profile} onSaved={setProfile} />

              <div className="mt-6">
                <BlockedMembersCard />
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
