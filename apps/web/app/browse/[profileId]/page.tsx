'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import type { PublicProfileDetail } from '@nadar-kalyanam/schemas';
import { Button, Card } from '@nadar-kalyanam/ui';
import { AppHeader, UserIcon } from '../../../components/app-header';
import { ApiError, getProfile, sendInterest } from '../../../lib/api-client';
import { useRegistration } from '../../providers/registration-provider';
import { useRequireAuth } from '../../../lib/use-require-auth';

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
      <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{itemLabel}</dt>
      <dd className="mt-1 text-sm text-foreground">{value || '—'}</dd>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Card className="rounded-2xl p-8 shadow-sm">
      <h2 className="mb-6 text-lg font-bold text-primary">{title}</h2>
      {children}
    </Card>
  );
}

export default function ViewProfilePage() {
  const { ready } = useRequireAuth();
  const params = useParams<{ profileId: string }>();
  const { data } = useRegistration();
  const [profile, setProfile] = useState<PublicProfileDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<string | undefined>();

  useEffect(() => {
    if (!ready || !data.accessToken) return;
    let cancelled = false;
    getProfile(data.accessToken, params.profileId)
      .then((result) => {
        if (!cancelled) {
          setProfile(result);
          setSent(result.hasSentInterest);
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setError(err instanceof ApiError ? err.message : 'Could not load this profile.');
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [ready, data.accessToken, params.profileId]);

  async function handleSendInterest() {
    if (!profile) return;
    setSending(true);
    setSendError(undefined);
    try {
      await sendInterest(data.accessToken!, { targetProfileId: profile.id });
      setSent(true);
    } catch (err) {
      setSendError(err instanceof ApiError ? err.message : 'Could not send interest. Please try again.');
    } finally {
      setSending(false);
    }
  }

  if (!ready) return null;

  return (
    <>
      <AppHeader />
      <main className="min-h-screen bg-secondary px-4 py-12">
        <div className="mx-auto flex max-w-2xl flex-col gap-6">
          {loading && (
            <Card className="rounded-2xl p-8 text-center text-sm text-muted-foreground">
              Loading profile…
            </Card>
          )}

          {error && (
            <Card className="rounded-2xl p-8 text-center text-sm text-destructive">{error}</Card>
          )}

          {profile && (
            <>
              <Card className="rounded-2xl p-8 shadow-sm">
                <div className="flex items-center gap-5">
                  <div className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-full border border-border bg-muted text-muted-foreground">
                    {profile.primaryPhotoUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={profile.primaryPhotoUrl} alt="" className="h-full w-full object-cover" />
                    ) : (
                      <UserIcon className="h-9 w-9" />
                    )}
                  </div>
                  <div>
                    <h1 className="text-2xl font-bold text-foreground">
                      {profile.fullName}, {profile.age}
                    </h1>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {profile.location.city}, {profile.location.state}
                    </p>
                  </div>
                </div>

                <div className="mt-6">
                  <Button
                    type="button"
                    disabled={sent || sending}
                    onClick={() => void handleSendInterest()}
                  >
                    {sent ? 'Interest Sent' : sending ? 'Sending...' : 'Send Interest'}
                  </Button>
                  {sendError ? <p className="mt-2 text-xs text-destructive">{sendError}</p> : null}
                </div>
              </Card>

              {profile.photos.length > 0 && (
                <Section title="Photos">
                  <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
                    {profile.photos.map((photo) => (
                      <div
                        key={photo.id}
                        className="aspect-square overflow-hidden rounded-lg border border-border bg-background"
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={photo.url} alt="" className="h-full w-full object-cover" />
                      </div>
                    ))}
                  </div>
                </Section>
              )}

              <Section title="Personal & Religious Details">
                <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <DetailItem label="Height" value={profile.height} />
                  <DetailItem
                    label="Physical status"
                    value={label(PHYSICAL_STATUS_LABELS, profile.physicalStatus)}
                  />
                  <DetailItem
                    label="Marital status"
                    value={label(MARITAL_STATUS_LABELS, profile.maritalStatus)}
                  />
                  <DetailItem label="Religion" value={profile.religion} />
                  <DetailItem label="Caste / Community" value={profile.casteCommunity} />
                  <DetailItem label="Dosham" value={label(DOSHAM_LABELS, profile.dosham)} />
                  <DetailItem label="Mother tongue" value={profile.motherTongue} />
                </dl>
              </Section>

              <Section title="Location & Professional Details">
                <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <DetailItem label="City" value={profile.location.city} />
                  <DetailItem label="State" value={profile.location.state} />
                  <DetailItem label="Education level" value={profile.education.educationLevel} />
                  <DetailItem label="Education detail" value={profile.education.educationDetail} />
                  <DetailItem label="Profession" value={profile.education.profession} />
                  <DetailItem label="Employed in" value={profile.education.employedIn} />
                  <DetailItem
                    label="Annual income"
                    value={[profile.education.annualIncomeRange, profile.education.annualIncomeCurrency]
                      .filter(Boolean)
                      .join(' ')}
                  />
                </dl>
              </Section>

              <Section title="Additional Details">
                <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <DetailItem label="Family type" value={profile.additional.familyType} />
                  <div className="sm:col-span-2">
                    <DetailItem label="About" value={profile.additional.about} />
                  </div>
                </dl>
              </Section>
            </>
          )}
        </div>
      </main>
    </>
  );
}
