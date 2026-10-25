'use client';

import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { formatDisplayDate, type MyHoroscope, type ProfileResponse, type SavedPartnerPreferences } from '@nadar-kalyanam/schemas';
import { AppHeader } from '../../components/app-header';
import { AdditionalDetailsEditSection } from '../../components/profile-edit/additional-details-edit-section';
import { BasicDetailsEditSection } from '../../components/profile-edit/basic-details-edit-section';
import { LocationProfessionalEditSection } from '../../components/profile-edit/location-professional-edit-section';
import { PersonalReligiousEditSection } from '../../components/profile-edit/personal-religious-edit-section';
import { PartnerPreferencesEditor, PartnerPreferencesView } from '../../components/profile-edit/partner-preferences-section';
import { HoroscopeEditor, HoroscopeOwnerView } from '../../components/profile-edit/horoscope-section';
import { LifestyleEditSection } from '../../components/profile-edit/lifestyle-edit-section';
import { hasLifestyle } from '../../lib/lifestyle';
import { ApiError, getMyHoroscope, getPartnerPreferences } from '../../lib/api-client';
import { useRegistration } from '../providers/registration-provider';
import { ProfileHeader } from '../../components/profile/profile-header';
import { PhotoGalleryCard } from '../../components/profile/photo-gallery-card';
import { TrustVerificationCard } from '../../components/profile/trust-verification-card';
import { ProfileForProvider } from '../../components/profile-form-fields/profile-for';
import { CompletionChecklistCard } from '../../components/profile/completion-checklist-card';
import { PrivacySettingsCard } from '../../components/profile/privacy-settings-card';
import { BlockedMembersCard } from '../../components/profile/blocked-members-card';
import { SignedInDevicesCard } from '../../components/profile/signed-in-devices-card';
import { MyPlanNote } from '../../components/profile/my-plan-note';
import { ComingSoonNote, ComingSoonPill } from '../../components/ui/coming-soon-note';
import { CulturalDivider } from '../../components/profile/cultural-divider';
import {
  BookIcon,
  CoffeeIcon,
  CoupleIcon,
  FamilyIcon,
  HomeKolamIcon,
  LampIcon,
  PortraitIcon,
  RasiChartIcon,
} from '../../components/profile/section-icons';
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
  basic: ['fullName', 'gender', 'dateOfBirth', 'religion', 'casteCommunity', 'email'],
  personal: ['height', 'physicalStatus', 'maritalStatus', 'dosham'],
  education: ['educationLevel', 'educationDetail', 'profession', 'employedIn', 'annualIncomeRange'],
  location: ['city', 'state'],
  family: ['familyType', 'about'],
} as const;

// Display label for a stored enum value; blank stays blank (shown as "+ Add").
function labelFor(labels: Record<string, string>, value: string | undefined): string | undefined {
  return value ? (labels[value] ?? value) : undefined;
}


// The enclosing section's "open the edit form" action, so an empty field
// can offer "+ Add" without every field being wired up by hand.
const SectionEditContext = createContext<(() => void) | undefined>(undefined);

function DetailItem({
  label: itemLabel,
  value,
  className = '',
}: {
  label: string;
  value: string | undefined;
  className?: string;
}) {
  const onAdd = useContext(SectionEditContext);
  const filled = Boolean(value && value.trim().length > 0);
  return (
    <div className={`space-y-1 ${className}`}>
      <dt className="text-[11px] font-bold uppercase tracking-wider text-nk-muted">
        {itemLabel}
      </dt>
      <dd className="text-sm font-semibold text-nk-ink break-words">
        {filled ? (
          value
        ) : onAdd ? (
          <button
            type="button"
            onClick={onAdd}
            aria-label={`Add ${itemLabel}`}
            className="font-semibold text-nk-maroon underline-offset-2 hover:underline"
          >
            + Add
          </button>
        ) : (
          <span className="font-normal text-nk-subtle">Not added</span>
        )}
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
      style={{ scrollMarginTop: 96 }}
      className={`rounded-2xl border transition-all duration-200 bg-[#FFFFFF] ${
        isEditing
          ? 'border-nk-maroon shadow-md ring-1 ring-nk-maroon/20'
          : isOpen
          ? 'border-nk-line shadow-sm'
          : 'border-nk-line hover:border-[#D9C8B0]'
      }`}
    >
      {/* Section Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-5 sm:p-6 border-b border-nk-line-soft/70">
        <button
          type="button"
          onClick={onToggle}
          className="flex flex-1 items-center gap-3 text-left focus:outline-none"
        >
          <div className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-xl">
            {icon}
          </div>
          <div>
            <h2 className="font-[family-name:var(--font-body)] text-lg sm:text-xl font-bold tracking-tight text-nk-maroon">
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
                  statusBadge.variant === 'progress' ? 'font-semibold text-[#8C6110]' : 'font-medium text-nk-muted'
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
              aria-label={`Edit ${title}`}
              title="Edit"
              className="flex h-7 w-7 items-center justify-center rounded-md text-nk-maroon transition-colors hover:bg-[#FAF6EF] hover:text-nk-maroon-bright"
            >
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth={1.8}
                strokeLinecap="round"
                strokeLinejoin="round"
                className="h-4 w-4"
                aria-hidden="true"
              >
                <path d="M16.9 3.6a2.1 2.1 0 0 1 3 3L7.5 19 3.5 20.5 5 16.5Z" />
                <path d="m15 5.5 3.5 3.5" />
              </svg>
            </button>
          )}

          <button
            type="button"
            onClick={onToggle}
            aria-label={isOpen ? 'Collapse section' : 'Expand section'}
            className="flex h-7 w-7 items-center justify-center rounded-md text-nk-muted hover:bg-[#FAF6EF]"
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
          {isEditing && editView ? (
            editView
          ) : (
            <SectionEditContext.Provider value={comingSoon ? undefined : onEdit}>{children}</SectionEditContext.Provider>
          )}
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

  // A link to /profile#section-<id> (e.g. "Set your preferences" on Home,
  // Matches or Search) opens that section and scrolls to it once the profile
  // has rendered; the sections don't exist before that, so the browser's own
  // anchor jump can't reach them.
  const profileLoaded = Boolean(profile);
  useEffect(() => {
    if (!profileLoaded) return;
    function openFromHash() {
      const id = /^#section-([\w-]+)$/.exec(window.location.hash)?.[1];
      if (!id || !(id in openSections)) return;
      setOpenSections((prev) => ({ ...prev, [id]: true }));
      requestAnimationFrame(() => document.getElementById(`section-${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
    }
    openFromHash();
    window.addEventListener('hashchange', openFromHash);
    return () => window.removeEventListener('hashchange', openFromHash);
    // Only on load and on hash changes, not on every open/close.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profileLoaded]);

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
  const hasPersonal = Boolean(profile?.details?.height && profile?.details?.maritalStatus);
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
      <p className="text-sm text-nk-maroon-bright">{extrasError}</p>
    ) : (section === 'preferences' ? preferences : horoscope) === undefined ? (
      <p className="text-sm text-nk-muted">Loading…</p>
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
    <div className="profile-page-root min-h-screen bg-[#FFF8E8] text-nk-ink">
      <AppHeader />

      <main className="w-full px-4 py-6 sm:px-6 sm:py-8 lg:px-8 xl:px-12 2xl:px-16">
        {/* Profile Header */}
        <ProfileHeader profile={profile} completionPercent={completionPercent} />

        <div className="my-4">
          <MyPlanNote />
        </div>

        {loading && (
          <div className="rounded-2xl border border-nk-line bg-[#FFFFFF] p-12 text-center shadow-sm">
            <div className="mx-auto flex h-10 w-10 animate-spin items-center justify-center rounded-full border-2 border-nk-maroon border-t-transparent" />
            <p className="mt-4 text-sm font-medium text-nk-muted">
              Loading your matrimonial profile…
            </p>
          </div>
        )}

        {error && (
          <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-center text-sm font-medium text-nk-maroon-bright shadow-sm">
            {error}
          </div>
        )}

        {profile && (
          <ProfileForProvider value={profile.details?.profileFor ?? null}>
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
                  icon={<PortraitIcon className="h-11 w-11" />}
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
                    <DetailItem label="Religion" value={profile.details?.religion} />
                    <DetailItem label="Nadar Subcategory" value={profile.details?.casteCommunity} />
                    <DetailItem label="Email" value={profile.details?.email} className="sm:col-span-2" />
                  </dl>
                </AccordionSection>

                {/* 2. Personal & Religious */}
                <AccordionSection
                  id="personal"
                  title="Personal & Religious"
                  icon={<LampIcon className="h-11 w-11" />}
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
                    <DetailItem label="Complexion" value={profile.details?.complexion} />
                    <DetailItem
                      label="Marital Status"
                      value={labelFor(MARITAL_STATUS_LABELS, profile.details?.maritalStatus)}
                    />
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
                  icon={<BookIcon className="h-11 w-11" />}
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
                  icon={<HomeKolamIcon className="h-11 w-11" />}
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
                  icon={<FamilyIcon className="h-11 w-11" />}
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
                    <DetailItem label="Family Net Worth" value={profile.details?.additional?.netWorth} />
                    <div className="sm:col-span-2">
                      <ComingSoonNote feature="familyValue" />
                    </div>
                    {/* The onboarding "About you" text — about the member, not their family. */}
                    <DetailItem label="About You" value={profile.details?.additional?.about} className="sm:col-span-2" />
                  </dl>
                </AccordionSection>

                {/* 6. Lifestyle & Habits: optional, not counted in the completion score. */}
                <AccordionSection
                  id="lifestyle"
                  title="Lifestyle & Habits"
                  icon={<CoffeeIcon className="h-11 w-11" />}
                  statusBadge={
                    hasLifestyle(profile.details?.lifestyle) ? { label: 'Added', variant: 'complete' } : { label: 'Optional', variant: 'pending' }
                  }
                  isOpen={openSections.lifestyle}
                  isEditing={editingSection === 'lifestyle'}
                  onToggle={() => toggleSection('lifestyle')}
                  onEdit={() => handleStartEditing('lifestyle')}
                  editView={
                    <LifestyleEditSection
                      profile={profile}
                      onCancel={() => setEditingSection(null)}
                      onSaved={handleSaved}
                    />
                  }
                >
                  <dl className="grid grid-cols-1 gap-x-6 gap-y-5 sm:grid-cols-3">
                    <DetailItem label="Diet" value={profile.details?.lifestyle?.diet} />
                    <DetailItem label="Smoking" value={profile.details?.lifestyle?.smoking} />
                    <DetailItem label="Drinking" value={profile.details?.lifestyle?.drinking} />
                    <DetailItem
                      label="Hobbies & Interests"
                      value={profile.details?.lifestyle?.hobbies?.join(', ')}
                      className="sm:col-span-3"
                    />
                  </dl>
                </AccordionSection>

                {/* 7. Horoscope Details (owner-only endpoint; others see it only as the visibility setting allows). */}
                <AccordionSection
                  id="horoscope"
                  title="Horoscope Details"
                  icon={<RasiChartIcon className="h-11 w-11" />}
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
                  icon={<CoupleIcon className="h-11 w-11" />}
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

                <div className="mt-6">
                  <SignedInDevicesCard />
                </div>
              </div>
            </div>
          </ProfileForProvider>
        )}
      </main>
    </div>
  );
}
