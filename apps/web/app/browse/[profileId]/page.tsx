'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import type { PublicProfileDetail } from '@nadar-kalyanam/schemas';
import {
  AlertTriangle,
  ArrowLeft,
  Check,
  Heart,
  MapPin,
  Maximize2,
  ShieldAlert,
} from 'lucide-react';
import { Card } from '@nadar-kalyanam/ui';
import { AppHeader, UserIcon } from '../../../components/app-header';
import { PhotoLightbox } from '../../../components/photo-lightbox';
import { ApiError, getProfile, reportProfile } from '../../../lib/api-client';
import { ConnectedBadge, RelationshipAction } from '../../../components/relationship/relationship-action';
import { useRegistration } from '../../providers/registration-provider';
import { useRequireAuth } from '../../../lib/use-require-auth';
import { ShortlistButton } from '../../../components/shortlist/shortlist-button';
import { BlockMemberButton } from '../../../components/block/block-member-button';
import { PhoneUnlockCard } from '../../../components/phone/phone-unlock-card';
import { useBackNavigation } from '../../../lib/navigation-history';
import { HoroscopeCard, PreferenceFitNote } from '../../../components/profile-view/horoscope-card';
import { TheirPreferencesCard } from '../../../components/profile-view/their-preferences-card';
import { PlanGate } from '../../../components/plan/plan-gate';

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

function label(map: Record<string, string>, value: string | undefined): string {
  if (!value) return '—';
  return map[value] ?? value;
}

// One detail: a small grey label over the value, divided by a hairline.
function DataTile({ label: itemLabel, value, subvalue }: { label: string; value: React.ReactNode; subvalue?: string }) {
  return (
    <div className="border-b border-nk-line-soft py-3">
      <p className="text-[11px] font-semibold uppercase tracking-wider text-nk-subtle">{itemLabel}</p>
      <div className="mt-0.5 text-sm font-semibold text-nk-ink break-words">{value || '—'}</div>
      {subvalue ? <p className="mt-0.5 text-xs text-nk-muted">{subvalue}</p> : null}
    </div>
  );
}

function ViewProfilePageContent() {
  const { ready } = useRequireAuth();
  const params = useParams<{ profileId: string }>();
  const { data } = useRegistration();
  const [profile, setProfile] = useState<PublicProfileDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showReportForm, setShowReportForm] = useState(false);
  const [reportReason, setReportReason] = useState('');
  const [reporting, setReporting] = useState(false);
  const [reportSubmitted, setReportSubmitted] = useState(false);
  const [reportError, setReportError] = useState<string | undefined>();
  const [blockedName, setBlockedName] = useState<string | null>(null);
  const [enlargedPhotoUrl, setEnlargedPhotoUrl] = useState<string | null>(null);
  const [activePhotoIndex, setActivePhotoIndex] = useState(0);
  const { goBack, hasHistory } = useBackNavigation('/browse');

  useEffect(() => {
    if (!ready || !data.accessToken) return;
    let cancelled = false;
    getProfile(data.accessToken, params.profileId)
      .then((result) => {
        if (!cancelled) {
          setProfile(result);
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setError(
            err instanceof ApiError && err.status === 404
              ? 'This profile is no longer available.'
              : err instanceof ApiError
                ? err.message
                : 'Could not load this profile. Please try again.',
          );
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [ready, data.accessToken, params.profileId]);

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
      <main className="min-h-screen bg-nk-paper px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
        <div className="mx-auto flex w-full max-w-5xl flex-col gap-6">
          {/* Back Navigation Breadcrumb */}
          <div className="flex items-center justify-between">
            {/* Returns to wherever the user came from (Search, Matches,
                Interests, a notification…); Browse only when there's no
                in-app page to go back to, e.g. a shared link. */}
            <Link
              href="/browse"
              onClick={(e) => {
                e.preventDefault();
                goBack();
              }}
              data-testid="profile-back"
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-nk-muted hover:text-nk-maroon transition-colors"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              <span>{hasHistory ? 'Back' : 'Back to Browse'}</span>
            </Link>
          </div>

          {loading && (
            <div className="rounded-2xl border border-[#EDE6DB] bg-white p-12 text-center shadow-xs">
              <div className="mx-auto flex h-10 w-10 animate-spin items-center justify-center rounded-full border-2 border-nk-maroon border-t-transparent" />
              <p className="mt-4 text-sm font-medium text-nk-muted">Loading profile details…</p>
            </div>
          )}

          {error && (
            <Card role="alert" className="rounded-2xl p-8 text-center text-sm text-destructive" data-testid="profile-error">
              {error}
            </Card>
          )}

          {blockedName && (
            <Card className="rounded-2xl p-8 text-center" data-testid="profile-blocked">
              <p className="text-sm font-semibold text-nk-ink">You blocked {blockedName}.</p>
              <p className="mt-1 text-sm text-nk-muted">
                They no longer appear in your lists, and neither of you can message the other.
              </p>
              <Link href="/profile#blocked-members" className="mt-3 inline-block text-sm font-semibold text-nk-maroon hover:underline">
                Manage blocked members
              </Link>
            </Card>
          )}

          {profile && !blockedName && (
            <>
              {/* HERO PROFILE CARD - Matching Reference Mockup */}
              <div className="overflow-hidden rounded-3xl border border-nk-line-soft bg-white p-6 sm:p-8 shadow-[0_4px_24px_rgba(0,0,0,0.03)]">
                <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
                  {/* Avatar with Heart Badge */}
                  <div className="relative self-start sm:self-center shrink-0">
                    <div className="flex h-20 w-20 sm:h-24 sm:w-24 shrink-0 items-center justify-center overflow-hidden rounded-full border-2 border-white ring-2 ring-nk-line-gold/80 bg-nk-paper text-[#8A796E] shadow-xs">
                      {profile.primaryPhotoUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={profile.primaryPhotoUrl} alt={profile.fullName} className="h-full w-full object-cover" />
                      ) : (
                        <UserIcon className="h-10 w-10 sm:h-12 sm:w-12 text-[#A8988C]" />
                      )}
                    </div>
                    {/* Floating Heart Badge */}
                    <div className="absolute -bottom-1 -right-1 flex h-7 w-7 sm:h-8 sm:w-8 items-center justify-center rounded-full border border-[#F2D6DC] bg-[#FFF8F8] text-nk-maroon shadow-xs">
                      <Heart className="h-3.5 w-3.5 sm:h-4 sm:w-4 fill-nk-maroon/20 stroke-[2] text-nk-maroon" />
                    </div>
                  </div>

                  {/* Title & Location */}
                  <div className="min-w-0 flex-1">
                    <h1 className="font-[family-name:var(--font-playfair)] font-serif text-2xl sm:text-3xl font-semibold sm:font-bold tracking-tight text-[#1E293B]">
                      {profile.fullName}, {profile.age}
                    </h1>
                    <div className="mt-1 flex items-center gap-1.5 text-sm sm:text-base text-[#64748B]">
                      <MapPin className="h-4 w-4 text-[#A86B76] shrink-0 stroke-[1.75]" />
                      <span>{[profile.location?.city, profile.location?.state].filter(Boolean).join(', ') || '—'}</span>
                    </div>
                    {/* The essentials at a glance, as one line of text (name, age
                        and place are already above). Only values the member
                        actually entered. */}
                    <p className="mt-3 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-sm font-medium text-nk-ink" data-testid="profile-key-facts">
                      {[
                        profile.height,
                        profile.education?.profession,
                        profile.education?.educationLevel,
                        [profile.casteCommunity, profile.religion].filter(Boolean).join(', '),
                        profile.maritalStatus ? (MARITAL_STATUS_LABELS[profile.maritalStatus] ?? profile.maritalStatus) : null,
                        profile.motherTongue,
                        profile.dosham === 'NO' ? 'No dosham' : null,
                      ]
                        .filter((fact): fact is string => Boolean(fact))
                        .map((fact, i) => (
                          <span key={fact} className="inline-flex items-center gap-2.5">
                            {i > 0 && <span className="h-1 w-1 rounded-full bg-nk-subtle" aria-hidden="true" />}
                            {fact}
                          </span>
                        ))}
                    </p>
                    {profile.relationshipStatus === 'CONNECTED' && (
                      <div className="mt-2">
                        <ConnectedBadge />
                      </div>
                    )}
                  </div>
                </div>

                {/* Hairline Divider */}
                <hr className="my-5 border-t border-nk-line-soft" />

                {/* Action Buttons Row */}
                <div className="flex flex-wrap items-center gap-3">
                  <RelationshipAction
                    profileId={profile.id}
                    relationshipStatus={profile.relationshipStatus}
                    conversationId={profile.conversationId}
                    appearance="profile-hero"
                  />
                  <ShortlistButton profileId={profile.id} appearance="pill" />
                  {!reportSubmitted && (
                    <button
                      type="button"
                      onClick={() => setShowReportForm((open) => !open)}
                      className="inline-flex items-center justify-center gap-2 rounded-md border border-[#E2E8F0] bg-white px-5 py-2.5 text-sm font-semibold text-[#64748B] hover:bg-[#FAF8F5] hover:border-[#CBD5E1] hover:text-[#475569] transition-all active:scale-[0.98]"
                    >
                      <AlertTriangle className="h-4 w-4 text-[#8C6B6B]" />
                      <span>Report</span>
                    </button>
                  )}
                  {reportSubmitted && (
                    <span className="inline-flex items-center gap-1.5 rounded-md bg-[#F0FDF4] border border-[#86EFAC] px-4 py-2 text-xs font-semibold text-[#15803D]">
                      <Check className="h-3.5 w-3.5" /> Report submitted — thank you
                    </span>
                  )}
                  <BlockMemberButton
                    target={{ targetProfileId: profile.id }}
                    memberName={profile.fullName}
                    onBlocked={() => setBlockedName(profile.fullName)}
                  />
                </div>

                {/* Inline Report Form */}
                {showReportForm && (
                  <div className="mt-5 rounded-2xl border border-[#F2D6DC] bg-[#FFF8F8] p-5">
                    <div className="flex items-center gap-2 text-nk-maroon">
                      <ShieldAlert className="h-5 w-5" />
                      <h3 className="text-sm font-bold">Why are you reporting this profile?</h3>
                    </div>
                    <p className="mt-1 text-xs text-[#8A796E]">
                      Your report is anonymous. We review all member reports carefully to ensure community safety.
                    </p>
                    <textarea
                      id="report-reason"
                      value={reportReason}
                      onChange={(e) => setReportReason(e.target.value)}
                      rows={3}
                      className="mt-3 w-full rounded-xl border border-[#EADBD5] bg-white px-3.5 py-2.5 text-sm text-nk-ink placeholder:text-[#A8988C] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-nk-maroon"
                      placeholder="Please share any details that help us understand the concern…"
                    />
                    {reportError ? <p className="mt-2 text-xs font-semibold text-destructive">{reportError}</p> : null}
                    <div className="mt-3 flex items-center gap-2">
                      <button
                        type="button"
                        disabled={!reportReason.trim() || reporting}
                        onClick={() => void handleSubmitReport()}
                        className="rounded-md bg-nk-maroon hover:bg-[#681427] active:scale-[0.98] px-5 py-2 text-xs font-semibold text-white shadow-xs transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {reporting ? 'Submitting…' : 'Submit Report'}
                      </button>
                      <button
                        type="button"
                        onClick={() => setShowReportForm(false)}
                        className="rounded-md border border-[#E2E8F0] bg-white px-4 py-2 text-xs font-semibold text-[#64748B] hover:bg-[#FAF8F5]"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}

                <PhoneUnlockCard profileId={profile.id} memberName={profile.fullName} />
              </div>

              <PreferenceFitNote fit={profile.preferenceFit} />

              {/* MAIN CONTENT 2-COLUMN GRID */}
              <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
                {/* LEFT SIDEBAR: Photos & Trust */}
                <div className="flex flex-col gap-6 lg:col-span-4">
                  {/* Photo Gallery Card */}
                  {profile.photos.length > 0 && (
                    <div className="overflow-hidden rounded-3xl border border-nk-line-soft bg-white p-5 shadow-[0_4px_24px_rgba(0,0,0,0.02)]">
                      <div className="mb-4 flex items-center justify-between">
                        <h2 className="text-sm font-bold text-nk-ink">Photos</h2>
                        <span className="text-xs text-nk-muted">
                          {profile.photos.length} {profile.photos.length === 1 ? 'photo' : 'photos'}
                        </span>
                      </div>

                      {/* Featured Main Photo */}
                      {profile.photos[activePhotoIndex] && (
                        <div
                          onClick={() => setEnlargedPhotoUrl(profile.photos[activePhotoIndex].url)}
                          className="group relative aspect-[4/5] w-full cursor-pointer overflow-hidden rounded-2xl border border-[#EDE6DB] bg-nk-paper"
                        >
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={profile.photos[activePhotoIndex].url}
                            alt={`${profile.fullName}`}
                            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                          />
                          <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent opacity-0 transition-opacity group-hover:opacity-100 flex items-end p-3">
                            <span className="inline-flex items-center gap-1.5 rounded-md bg-black/60 backdrop-blur-xs px-3 py-1 text-xs font-semibold text-white">
                              <Maximize2 className="h-3 w-3" /> Click to enlarge
                            </span>
                          </div>
                        </div>
                      )}

                      {/* Thumbnails row if more than 1 photo */}
                      {profile.photos.length > 1 && (
                        <div className="mt-3 grid grid-cols-4 gap-2">
                          {profile.photos.map((photo, idx) => (
                            <button
                              key={photo.id}
                              type="button"
                              onClick={() => {
                                setActivePhotoIndex(idx);
                              }}
                              className={`aspect-square overflow-hidden rounded-xl border-2 transition-all ${
                                activePhotoIndex === idx
                                  ? 'border-nk-maroon shadow-xs scale-95'
                                  : 'border-[#EDE6DB] hover:border-nk-line-strong opacity-80 hover:opacity-100'
                              }`}
                            >
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img src={photo.url} alt="" className="h-full w-full object-cover" />
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Verification & Trust Badge Card */}
                  <div className="rounded-3xl border border-nk-line-soft bg-white p-5 shadow-[0_4px_24px_rgba(0,0,0,0.02)]">
                    <div className="flex items-center gap-2.5 pb-3 border-b border-nk-line-soft">
                      <div>
                        <h3 className="text-sm font-bold text-nk-ink">Trust & Verification</h3>
                        <p className="text-[11px] text-nk-muted">Platform member safety</p>
                      </div>
                    </div>

                    {/* Only facts that are true for this member. There is no photo or
                        profile screening yet, and community isn't verified. */}
                    <ul className="mt-4 space-y-2.5 text-xs text-nk-ink">
                      <li className="flex items-start gap-2">
                        <Check className="h-3.5 w-3.5 shrink-0 text-nk-ink" aria-hidden="true" />
                        <span>Mobile number confirmed with OTP</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <Check className="h-3.5 w-3.5 shrink-0 text-nk-ink" aria-hidden="true" />
                        <span>Email is never shown; a phone number only if its owner allows connected members with a paid plan to unlock it</span>
                      </li>
                    </ul>

                    <div className="mt-4 border-t border-nk-line-soft pt-3 text-[11px] leading-relaxed text-nk-muted">
                      <p className="font-semibold text-nk-ink">Safety tip</p>
                      <p className="mt-0.5">
                        Always converse politely and verify mutual horoscope and family details with elder guidance.
                      </p>
                    </div>
                  </div>
                </div>

                {/* RIGHT MAIN DETAILS SECTION */}
                <div className="flex flex-col gap-6 lg:col-span-8">
                  {/* "About Me" Editorial Card */}
                  <div className="overflow-hidden rounded-3xl border border-nk-line-soft bg-white p-6 sm:p-7 shadow-[0_4px_24px_rgba(0,0,0,0.02)]">
                    <div className="flex items-center justify-between gap-3 border-b border-nk-line-soft pb-4">
                      <div className="flex items-center gap-2.5">
                        <h2 className="font-[family-name:var(--font-playfair)] font-serif text-lg sm:text-xl font-bold text-nk-ink">
                          About {profile.fullName.split(' ')[0]}
                        </h2>
                      </div>
                    </div>

                    <div className="mt-4">
                      {profile.additional?.about ? (
                        <p className="text-sm sm:text-base leading-relaxed text-[#4A3E38] whitespace-pre-line font-normal">
                          {profile.additional.about}
                        </p>
                      ) : (
                        <p className="text-sm italic text-[#8A796E]">No detailed description added yet.</p>
                      )}
                    </div>
                  </div>

                  {/* Personal & Cultural Details */}
                  <div className="rounded-3xl border border-nk-line-soft bg-white p-6 sm:p-7 shadow-[0_4px_24px_rgba(0,0,0,0.02)]">
                    <div className="flex items-center gap-2.5 border-b border-nk-line-soft pb-4">
                      <div>
                        <h2 className="font-[family-name:var(--font-playfair)] font-serif text-lg sm:text-xl font-bold text-nk-ink">
                          Personal & Cultural Details
                        </h2>
                        <p className="text-xs text-nk-muted">Community, traditions, and physical attributes</p>
                      </div>
                    </div>

                    <div className="mt-2 grid grid-cols-1 gap-x-10 sm:grid-cols-2">
                      <DataTile
                        label="Height"
                        value={profile.height}
                      />
                      <DataTile
                        label="Physical Status"
                        value={label(PHYSICAL_STATUS_LABELS, profile.physicalStatus)}
                      />
                      <DataTile
                        label="Marital Status"
                        value={label(MARITAL_STATUS_LABELS, profile.maritalStatus)}
                      />
                      <DataTile
                        label="Mother Tongue"
                        value={profile.motherTongue}
                      />
                      <DataTile
                        label="Religion"
                        value={profile.religion}
                      />
                      <DataTile
                        label="Caste / Community"
                        value={profile.casteCommunity}
                      />
                      <div className="sm:col-span-2">
                        <DataTile
                          label="Dosham"
                          value={label(DOSHAM_LABELS, profile.dosham)}
                        />
                      </div>
                    </div>
                  </div>

                  {/* Horoscope: only what this member chose to share with this viewer */}
                  <HoroscopeCard view={profile.horoscope} />

                  {/* Education & Career Details */}
                  <div className="rounded-3xl border border-nk-line-soft bg-white p-6 sm:p-7 shadow-[0_4px_24px_rgba(0,0,0,0.02)]">
                    <div className="flex items-center gap-2.5 border-b border-nk-line-soft pb-4">
                      <div>
                        <h2 className="font-[family-name:var(--font-playfair)] font-serif text-lg sm:text-xl font-bold text-nk-ink">
                          Education & Career
                        </h2>
                        <p className="text-xs text-nk-muted">Professional background and qualifications</p>
                      </div>
                    </div>

                    {/* Prominent Profession Banner */}
                    <div className="mt-5 flex flex-col sm:flex-row sm:items-end justify-between gap-3">
                      <div>
                        <div>
                          <p className="text-xs font-bold uppercase tracking-wider text-[#8A796E]">Designation</p>
                          <h3 className="text-base sm:text-lg font-bold text-nk-ink">
                            {profile.education?.profession || '—'}
                          </h3>
                          {profile.education.employedIn && (
                            <p className="text-xs text-nk-muted">{profile.education.employedIn}</p>
                          )}
                        </div>
                      </div>

                      {/* Annual Income Badge */}
                      {profile.education.annualIncomeRange && (
                        <div className="sm:text-right">
                          <p className="text-xs font-bold uppercase tracking-wider text-[#8A796E]">Annual Income</p>
                          <p className="text-base font-bold text-nk-ink">
                            {profile.education.annualIncomeCurrency || 'INR'} {profile.education.annualIncomeRange}
                          </p>
                        </div>
                      )}
                    </div>

                    <div className="mt-2 grid grid-cols-1 gap-x-10 sm:grid-cols-2">
                      <DataTile
                        label="Highest Education"
                        value={profile.education.educationLevel}
                      />
                      <DataTile
                        label="Education Detail"
                        value={profile.education.educationDetail}
                      />
                      <DataTile
                        label="Employed In"
                        value={profile.education.employedIn}
                      />
                      <DataTile
                        label="Income Range"
                        value={
                          profile.education?.annualIncomeRange?.trim()
                            ? `${profile.education.annualIncomeRange} ${profile.education.annualIncomeCurrency || 'INR'}`
                            : '—'
                        }
                      />
                    </div>
                  </div>

                  {/* Location & Family Details */}
                  <div className="rounded-3xl border border-nk-line-soft bg-white p-6 sm:p-7 shadow-[0_4px_24px_rgba(0,0,0,0.02)]">
                    <div className="flex items-center gap-2.5 border-b border-nk-line-soft pb-4">
                      <div>
                        <h2 className="font-[family-name:var(--font-playfair)] font-serif text-lg sm:text-xl font-bold text-nk-ink">
                          Location & Family Background
                        </h2>
                        <p className="text-xs text-nk-muted">Current residence and family background</p>
                      </div>
                    </div>

                    <div className="mt-2 grid grid-cols-1 gap-x-10 sm:grid-cols-2">
                      <DataTile
                        label="Current City"
                        value={profile.location.city}
                      />
                      <DataTile
                        label="State"
                        value={profile.location.state}
                      />
                      <DataTile
                        label="Family Status / Type"
                        value={profile.additional?.familyType}
                      />

                    </div>
                  </div>

                  <TheirPreferencesCard profile={profile} />
                </div>
              </div>
            </>
          )}
        </div>
      </main>

      {enlargedPhotoUrl && (
        <PhotoLightbox url={enlargedPhotoUrl} onClose={() => setEnlargedPhotoUrl(null)} />
      )}
    </>
  );
}

// Needs a membership plan when the server requires one (see PlanGate).
export default function ViewProfilePage() {
  return (
    <PlanGate>
      <ViewProfilePageContent />
    </PlanGate>
  );
}
