'use client';

import { useState, type ReactNode } from 'react';
import type { ProfileResponse } from '@nadar-kalyanam/schemas';
import { Button, Card } from '@nadar-kalyanam/ui';
import { AppHeader } from '../../components/app-header';
import { AdditionalDetailsEditSection } from '../../components/profile-edit/additional-details-edit-section';
import { BasicDetailsEditSection } from '../../components/profile-edit/basic-details-edit-section';
import { LocationProfessionalEditSection } from '../../components/profile-edit/location-professional-edit-section';
import { PersonalReligiousEditSection } from '../../components/profile-edit/personal-religious-edit-section';
import { PhotosSection } from '../../components/profile-photos/photos-section';
import { useProfile } from '../../lib/use-profile';
import { useRequireAuth } from '../../lib/use-require-auth';

type SectionKey = 'basic' | 'personal' | 'location' | 'additional';

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
  NO: 'No',
  YES: 'Yes',
  DONT_KNOW: "Don't Know",
};

function label(map: Record<string, string>, value: string | undefined): string {
  if (!value) return '—';
  return map[value] ?? value;
}

function DetailItem({ label: itemLabel, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {itemLabel}
      </dt>
      <dd className="mt-1 text-sm text-foreground">{value || '—'}</dd>
    </div>
  );
}

function Section({
  title,
  onEdit,
  children,
}: {
  title: string;
  onEdit?: () => void;
  children: ReactNode;
}) {
  return (
    <Card className="rounded-2xl p-8 shadow-sm">
      <div className="mb-6 flex items-center justify-between">
        <h2 className="text-lg font-bold text-primary">{title}</h2>
        {onEdit && (
          <Button type="button" variant="outline" size="sm" onClick={onEdit}>
            Edit
          </Button>
        )}
      </div>
      {children}
    </Card>
  );
}

export default function ProfilePage() {
  const { ready } = useRequireAuth();
  const { profile, loading, error, setProfile, refetch } = useProfile();
  const [editingSection, setEditingSection] = useState<SectionKey | null>(null);

  if (!ready) return null;

  function handleSaved(updated: ProfileResponse) {
    setProfile(updated);
    setEditingSection(null);
  }

  return (
    <>
      <AppHeader />
      <main className="min-h-screen bg-secondary px-4 py-12">
        <div className="mx-auto flex max-w-2xl flex-col gap-6">
          <div>
            <h1 className="text-2xl font-bold text-foreground">My Profile</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              View and edit the details you submitted during registration.
            </p>
          </div>

          {loading && (
            <Card className="rounded-2xl p-8 text-center text-sm text-muted-foreground">
              Loading your profile…
            </Card>
          )}

          {error && (
            <Card className="rounded-2xl p-8 text-center text-sm text-destructive">{error}</Card>
          )}

          {profile && (
            <>
              <PhotosSection profile={profile} onChanged={() => void refetch()} />

              <Section
                title="Basic Details"
                onEdit={editingSection ? undefined : () => setEditingSection('basic')}
              >
                {editingSection === 'basic' ? (
                  <BasicDetailsEditSection
                    profile={profile}
                    onCancel={() => setEditingSection(null)}
                    onSaved={handleSaved}
                  />
                ) : (
                  <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <DetailItem label="Full name" value={profile.fullName} />
                    <DetailItem label="Gender" value={label(GENDER_LABELS, profile.gender)} />
                    <DetailItem label="Date of birth" value={profile.dateOfBirth} />
                    <DetailItem label="Mother tongue" value={profile.details?.motherTongue ?? ''} />
                    <DetailItem label="Email" value={profile.details?.email ?? ''} />
                  </dl>
                )}
              </Section>

              <Section
                title="Personal & Religious Details"
                onEdit={editingSection ? undefined : () => setEditingSection('personal')}
              >
                {editingSection === 'personal' ? (
                  <PersonalReligiousEditSection
                    profile={profile}
                    onCancel={() => setEditingSection(null)}
                    onSaved={handleSaved}
                  />
                ) : (
                  <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <DetailItem label="Height" value={profile.details?.height ?? ''} />
                    <DetailItem
                      label="Physical status"
                      value={label(PHYSICAL_STATUS_LABELS, profile.details?.physicalStatus)}
                    />
                    <DetailItem
                      label="Marital status"
                      value={label(MARITAL_STATUS_LABELS, profile.details?.maritalStatus)}
                    />
                    <DetailItem label="Religion" value={profile.details?.religion ?? ''} />
                    <DetailItem label="Caste / Community" value={profile.details?.casteCommunity ?? ''} />
                    <DetailItem label="Dosham" value={label(DOSHAM_LABELS, profile.details?.dosham)} />
                  </dl>
                )}
              </Section>

              <Section
                title="Location & Professional Details"
                onEdit={editingSection ? undefined : () => setEditingSection('location')}
              >
                {editingSection === 'location' ? (
                  <LocationProfessionalEditSection
                    profile={profile}
                    onCancel={() => setEditingSection(null)}
                    onSaved={handleSaved}
                  />
                ) : (
                  <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    {profile.details?.location ? (
                      <>
                        <DetailItem label="City" value={profile.details.location.city} />
                        <DetailItem label="State" value={profile.details.location.state} />
                        <DetailItem label="Country" value={profile.details.location.country} />
                      </>
                    ) : (
                      <div className="sm:col-span-2">
                        <DetailItem label="Location" value="" />
                      </div>
                    )}
                    {profile.details?.education ? (
                      <>
                        <DetailItem
                          label="Education level"
                          value={profile.details.education.educationLevel}
                        />
                        <DetailItem
                          label="Education detail"
                          value={profile.details.education.educationDetail}
                        />
                        <DetailItem label="Profession" value={profile.details.education.profession} />
                        <DetailItem label="Employed in" value={profile.details.education.employedIn} />
                        <DetailItem
                          label="Annual income"
                          value={[
                            profile.details.education.annualIncomeRange,
                            profile.details.education.annualIncomeCurrency,
                          ]
                            .filter(Boolean)
                            .join(' ')}
                        />
                      </>
                    ) : (
                      <div className="sm:col-span-2">
                        <DetailItem label="Education" value="" />
                      </div>
                    )}
                  </dl>
                )}
              </Section>

              <Section
                title="Additional Details"
                onEdit={editingSection ? undefined : () => setEditingSection('additional')}
              >
                {editingSection === 'additional' ? (
                  <AdditionalDetailsEditSection
                    profile={profile}
                    onCancel={() => setEditingSection(null)}
                    onSaved={handleSaved}
                  />
                ) : (
                  <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    {profile.details?.additional ? (
                      <>
                        <DetailItem label="Family type" value={profile.details.additional.familyType} />
                        <div className="sm:col-span-2">
                          <DetailItem label="About" value={profile.details.additional.about} />
                        </div>
                      </>
                    ) : (
                      <div className="sm:col-span-2">
                        <DetailItem label="Additional details" value="" />
                      </div>
                    )}
                  </dl>
                )}
              </Section>
            </>
          )}
        </div>
      </main>
    </>
  );
}
