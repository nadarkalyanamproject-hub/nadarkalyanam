'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import type { PublicProfileDetail } from '@nadar-kalyanam/schemas';
import { Button, Card } from '@nadar-kalyanam/ui';
import { AppHeader, UserIcon } from '../../../components/app-header';
import { ApiError, getProfile, reportProfile, sendInterest } from '../../../lib/api-client';
import { useRegistration } from '../../providers/registration-provider';
import { useRequireAuth } from '../../../lib/use-require-auth';
import { DUMMY_PROFILES } from '../../../lib/mock-profiles';

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
  const [showReportForm, setShowReportForm] = useState(false);
  const [reportReason, setReportReason] = useState('');
  const [reporting, setReporting] = useState(false);
  const [reportSubmitted, setReportSubmitted] = useState(false);
  const [reportError, setReportError] = useState<string | undefined>();
 
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
          const fallback = DUMMY_PROFILES.find((p) => p.id === params.profileId);
          if (fallback) {
            setProfile(fallback);
            setSent(fallback.hasSentInterest);
            setError(null);
          } else {
            setError(err instanceof ApiError ? err.message : 'Could not load this profile.');
          }
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

  async function handleSubmitReport() {
    if (!profile || !reportReason.trim()) return;
    setReporting(true);
    setReportError(undefined);
    try {
      await reportProfile(data.accessToken!, {
        targetType: 'PROFILE',
        targetId: profile.id,
        reason: reportReason.trim(),
      });
      setReportSubmitted(true);
      setShowReportForm(false);
    } catch (err) {
      setReportError(err instanceof ApiError ? err.message : 'Could not submit report. Please try again.');
    } finally {
      setReporting(false);
    }
  }

  if (!ready) return null;

  return (
    <>
      <AppHeader />
      <main className="min-h-screen bg-secondary px-4 py-6 sm:px-6 sm:py-10 lg:px-8">
        <div className="mx-auto flex w-full max-w-4xl lg:max-w-5xl flex-col gap-6">
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

                <div className="mt-6 flex flex-wrap items-center gap-3">
                  <Button
                    type="button"
                    disabled={sent || sending}
                    onClick={() => void handleSendInterest()}
                  >
                    {sent ? 'Interest Sent' : sending ? 'Sending...' : 'Send Interest'}
                  </Button>
                  {!reportSubmitted && (
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setShowReportForm((open) => !open)}
                    >
                      Report
                    </Button>
                  )}
                  {reportSubmitted && (
                    <p className="text-xs text-muted-foreground">Report submitted — thank you.</p>
                  )}
                </div>
                {sendError ? <p className="mt-2 text-xs text-destructive">{sendError}</p> : null}

                {showReportForm && (
                  <div className="mt-4 rounded-xl border border-border bg-muted/40 p-4">
                    <label htmlFor="report-reason" className="text-sm font-semibold text-foreground">
                      Why are you reporting this profile?
                    </label>
                    <textarea
                      id="report-reason"
                      value={reportReason}
                      onChange={(e) => setReportReason(e.target.value)}
                      rows={3}
                      className="mt-2 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      placeholder="Describe the issue…"
                    />
                    {reportError ? <p className="mt-2 text-xs text-destructive">{reportError}</p> : null}
                    <div className="mt-3 flex gap-2">
                      <Button
                        type="button"
                        size="sm"
                        disabled={!reportReason.trim() || reporting}
                        onClick={() => void handleSubmitReport()}
                      >
                        {reporting ? 'Submitting…' : 'Submit report'}
                      </Button>
                      <Button type="button" size="sm" variant="outline" onClick={() => setShowReportForm(false)}>
                        Cancel
                      </Button>
                    </div>
                  </div>
                )}
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
