'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import type { PublicProfileDetail } from '@nadar-kalyanam/schemas';
import {
  Activity,
  AlertTriangle,
  ArrowLeft,
  Briefcase,
  Building2,
  Camera,
  Check,
  Coins,
  GraduationCap,
  Heart,
  Home,
  Info,
  Languages,
  MapPin,
  Maximize2,
  Quote,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Users,
} from 'lucide-react';
import { Card } from '@nadar-kalyanam/ui';
import { AppHeader, UserIcon } from '../../../components/app-header';
import { PhotoLightbox } from '../../../components/photo-lightbox';
import { ApiError, getProfile, reportProfile } from '../../../lib/api-client';
import { ConnectedBadge, RelationshipAction } from '../../../components/relationship/relationship-action';
import { useRegistration } from '../../providers/registration-provider';
import { useRequireAuth } from '../../../lib/use-require-auth';
import { ShortlistButton } from '../../../components/shortlist/shortlist-button';

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

function DataTile({
  icon,
  label: itemLabel,
  value,
  subvalue,
  highlight = false,
}: {
  icon: React.ReactNode;
  label: string;
  value: React.ReactNode;
  subvalue?: string;
  highlight?: boolean;
}) {
  return (
    <div
      className={`group flex items-start gap-3.5 rounded-xl border p-3.5 transition-all duration-200 ${
        highlight
          ? 'border-[#F1DFBA] bg-gradient-to-br from-[#FFFDF9] to-[#FFF8EE] shadow-2xs'
          : 'border-[#F0EAE1] bg-[#FCFAF6]/60 hover:border-[#E5DDD0] hover:bg-white hover:shadow-2xs'
      }`}
    >
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white border border-[#EBE3D5] text-[#7A1C32] shadow-2xs transition-colors group-hover:border-[#DECDBB]">
        {icon}
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-[11px] font-bold uppercase tracking-wider text-[#7E6F65]">{itemLabel}</p>
        <div className="mt-0.5 text-sm font-semibold text-[#241C1A] break-words">{value || '—'}</div>
        {subvalue ? <p className="mt-0.5 text-xs text-[#8A796E]">{subvalue}</p> : null}
      </div>
    </div>
  );
}

export default function ViewProfilePage() {
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
  const [enlargedPhotoUrl, setEnlargedPhotoUrl] = useState<string | null>(null);
  const [activePhotoIndex, setActivePhotoIndex] = useState(0);

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
      <main className="min-h-screen bg-[#FAF7F2] px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
        <div className="mx-auto flex w-full max-w-5xl flex-col gap-6">
          {/* Back Navigation Breadcrumb */}
          <div className="flex items-center justify-between">
            <Link
              href="/browse"
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#7E6F65] hover:text-[#7A1C32] transition-colors"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              <span>Back to Browse</span>
            </Link>
          </div>

          {loading && (
            <div className="rounded-2xl border border-[#EDE6DB] bg-white p-12 text-center shadow-xs">
              <div className="mx-auto flex h-10 w-10 animate-spin items-center justify-center rounded-full border-2 border-[#7A1C32] border-t-transparent" />
              <p className="mt-4 text-sm font-medium text-[#7E6F65]">Loading profile details…</p>
            </div>
          )}

          {error && (
            <Card role="alert" className="rounded-2xl p-8 text-center text-sm text-destructive" data-testid="profile-error">
              {error}
            </Card>
          )}

          {profile && (
            <>
              {/* HERO PROFILE CARD - Matching Reference Mockup */}
              <div className="overflow-hidden rounded-3xl border border-[#EFEAE2] bg-white p-6 sm:p-8 shadow-[0_4px_24px_rgba(0,0,0,0.03)]">
                <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
                  {/* Avatar with Heart Badge */}
                  <div className="relative self-start sm:self-center shrink-0">
                    <div className="flex h-20 w-20 sm:h-24 sm:w-24 shrink-0 items-center justify-center overflow-hidden rounded-full border-2 border-white ring-2 ring-[#EADBBD]/80 bg-[#FAF7F2] text-[#8A796E] shadow-xs">
                      {profile.primaryPhotoUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={profile.primaryPhotoUrl} alt={profile.fullName} className="h-full w-full object-cover" />
                      ) : (
                        <UserIcon className="h-10 w-10 sm:h-12 sm:w-12 text-[#A8988C]" />
                      )}
                    </div>
                    {/* Floating Heart Badge */}
                    <div className="absolute -bottom-1 -right-1 flex h-7 w-7 sm:h-8 sm:w-8 items-center justify-center rounded-full border border-[#F2D6DC] bg-[#FFF8F8] text-[#7A1C32] shadow-xs">
                      <Heart className="h-3.5 w-3.5 sm:h-4 sm:w-4 fill-[#7A1C32]/20 stroke-[2] text-[#7A1C32]" />
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
                    {profile.relationshipStatus === 'CONNECTED' && (
                      <div className="mt-2">
                        <ConnectedBadge />
                      </div>
                    )}
                  </div>
                </div>

                {/* Hairline Divider */}
                <hr className="my-5 border-t border-[#F1EBE1]" />

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
                      className="inline-flex items-center justify-center gap-2 rounded-full border border-[#E2E8F0] bg-white px-5 py-2.5 text-sm font-semibold text-[#64748B] hover:bg-[#FAF8F5] hover:border-[#CBD5E1] hover:text-[#475569] transition-all active:scale-[0.98]"
                    >
                      <AlertTriangle className="h-4 w-4 text-[#8C6B6B]" />
                      <span>Report</span>
                    </button>
                  )}
                  {reportSubmitted && (
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-[#F0FDF4] border border-[#86EFAC] px-4 py-2 text-xs font-semibold text-[#16A34A]">
                      <Check className="h-3.5 w-3.5" /> Report submitted — thank you
                    </span>
                  )}
                </div>

                {/* Inline Report Form */}
                {showReportForm && (
                  <div className="mt-5 rounded-2xl border border-[#F2D6DC] bg-[#FFF8F8] p-5">
                    <div className="flex items-center gap-2 text-[#7A1C32]">
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
                      className="mt-3 w-full rounded-xl border border-[#EADBD5] bg-white px-3.5 py-2.5 text-sm text-[#241C1A] placeholder:text-[#A8988C] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7A1C32]"
                      placeholder="Please share any details that help us understand the concern…"
                    />
                    {reportError ? <p className="mt-2 text-xs font-semibold text-destructive">{reportError}</p> : null}
                    <div className="mt-3 flex items-center gap-2">
                      <button
                        type="button"
                        disabled={!reportReason.trim() || reporting}
                        onClick={() => void handleSubmitReport()}
                        className="rounded-full bg-[#7A1C32] hover:bg-[#681427] active:scale-[0.98] px-5 py-2 text-xs font-semibold text-white shadow-xs transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {reporting ? 'Submitting…' : 'Submit Report'}
                      </button>
                      <button
                        type="button"
                        onClick={() => setShowReportForm(false)}
                        className="rounded-full border border-[#E2E8F0] bg-white px-4 py-2 text-xs font-semibold text-[#64748B] hover:bg-[#FAF8F5]"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* QUICK SNAPSHOT CHIPS BAR */}
              <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-[#EDE6DB] bg-white/80 p-3.5 shadow-2xs backdrop-blur-xs">
                {/* Chips show only values the member actually entered — no fallbacks. */}
                <span className="inline-flex items-center gap-1.5 rounded-full bg-[#FAF7F2] border border-[#EADBBD] px-3 py-1 text-xs font-semibold text-[#5A493E]">
                  <span>🎂</span> {profile.age} yrs{profile.height ? ` • ${profile.height}` : ''}
                </span>
                {profile.education?.profession && (
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-[#FAF7F2] border border-[#EADBBD] px-3 py-1 text-xs font-semibold text-[#5A493E]">
                    <Briefcase className="h-3 w-3 text-[#7A1C32]" /> {profile.education.profession}
                  </span>
                )}
                {profile.education?.educationLevel && (
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-[#FAF7F2] border border-[#EADBBD] px-3 py-1 text-xs font-semibold text-[#5A493E]">
                    <GraduationCap className="h-3 w-3 text-[#7A1C32]" /> {profile.education.educationLevel}
                  </span>
                )}
                {profile.location?.city && (
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-[#FAF7F2] border border-[#EADBBD] px-3 py-1 text-xs font-semibold text-[#5A493E]">
                    <MapPin className="h-3 w-3 text-[#7A1C32]" /> {profile.location.city}
                  </span>
                )}
                {(profile.casteCommunity || profile.religion) && (
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-[#FAF7F2] border border-[#EADBBD] px-3 py-1 text-xs font-semibold text-[#5A493E]">
                    <Sparkles className="h-3 w-3 text-[#C49746]" />{' '}
                    {[profile.casteCommunity, profile.religion].filter(Boolean).join(', ')}
                  </span>
                )}
                {profile.maritalStatus && (
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-[#FAF7F2] border border-[#EADBBD] px-3 py-1 text-xs font-semibold text-[#5A493E]">
                    <span>💍</span> {MARITAL_STATUS_LABELS[profile.maritalStatus] ?? profile.maritalStatus}
                  </span>
                )}
                {profile.motherTongue && (
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-[#FAF7F2] border border-[#EADBBD] px-3 py-1 text-xs font-semibold text-[#5A493E]">
                    <Languages className="h-3 w-3 text-[#7A1C32]" /> {profile.motherTongue}
                  </span>
                )}
                {profile.dosham === 'NO' && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 border border-emerald-200 px-3 py-1 text-xs font-semibold text-emerald-800">
                    <Check className="h-3 w-3 text-emerald-600" /> No Dosham
                  </span>
                )}
              </div>

              {/* MAIN CONTENT 2-COLUMN GRID */}
              <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
                {/* LEFT SIDEBAR: Photos & Trust */}
                <div className="flex flex-col gap-6 lg:col-span-4">
                  {/* Photo Gallery Card */}
                  {profile.photos.length > 0 && (
                    <div className="overflow-hidden rounded-3xl border border-[#EFEAE2] bg-white p-5 shadow-[0_4px_24px_rgba(0,0,0,0.02)]">
                      <div className="mb-4 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Camera className="h-4 w-4 text-[#7A1C32]" />
                          <h2 className="text-sm font-bold text-[#241C1A]">Photos</h2>
                        </div>
                        <span className="rounded-full bg-[#FAF7F2] border border-[#EADBBD] px-2.5 py-0.5 text-[11px] font-bold text-[#7E6F65]">
                          {profile.photos.length} {profile.photos.length === 1 ? 'Photo' : 'Photos'}
                        </span>
                      </div>

                      {/* Featured Main Photo */}
                      {profile.photos[activePhotoIndex] && (
                        <div
                          onClick={() => setEnlargedPhotoUrl(profile.photos[activePhotoIndex].url)}
                          className="group relative aspect-[4/5] w-full cursor-pointer overflow-hidden rounded-2xl border border-[#EDE6DB] bg-[#FAF7F2]"
                        >
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={profile.photos[activePhotoIndex].url}
                            alt={`${profile.fullName}`}
                            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                          />
                          <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent opacity-0 transition-opacity group-hover:opacity-100 flex items-end p-3">
                            <span className="inline-flex items-center gap-1.5 rounded-full bg-black/60 backdrop-blur-xs px-3 py-1 text-xs font-semibold text-white">
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
                                  ? 'border-[#7A1C32] shadow-xs scale-95'
                                  : 'border-[#EDE6DB] hover:border-[#DECDBB] opacity-80 hover:opacity-100'
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
                  <div className="rounded-3xl border border-[#EFEAE2] bg-white p-5 shadow-[0_4px_24px_rgba(0,0,0,0.02)]">
                    <div className="flex items-center gap-2.5 pb-3 border-b border-[#F1EBE1]">
                      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#FEF3C7] text-[#92400E]">
                        <ShieldCheck className="h-4 w-4" />
                      </div>
                      <div>
                        <h3 className="text-sm font-bold text-[#241C1A]">Trust & Verification</h3>
                        <p className="text-[11px] text-[#7E6F65]">Platform member safety</p>
                      </div>
                    </div>

                    {/* Only facts that are true for this member. There is no photo or
                        profile screening yet, and community isn't verified. */}
                    <ul className="mt-4 space-y-2.5 text-xs text-[#5A493E]">
                      <li className="flex items-center gap-2">
                        <span className="flex h-4 w-4 items-center justify-center rounded-full bg-emerald-100 text-emerald-700 text-[10px]">✓</span>
                        <span>Mobile number confirmed with OTP</span>
                      </li>
                      <li className="flex items-center gap-2">
                        <span className="flex h-4 w-4 items-center justify-center rounded-full bg-emerald-100 text-emerald-700 text-[10px]">✓</span>
                        <span>Phone and email are never shown to other members</span>
                      </li>
                    </ul>

                    <div className="mt-4 rounded-xl bg-[#FAF7F2] p-3 text-[11px] leading-relaxed text-[#7E6F65] border border-[#EADBBD]/70">
                      <div className="flex items-center gap-1 font-semibold text-[#5A493E]">
                        <Info className="h-3.5 w-3.5 text-[#7A1C32]" />
                        <span>Safety Tip</span>
                      </div>
                      <p className="mt-1">
                        Always converse politely and verify mutual horoscope and family details with elder guidance.
                      </p>
                    </div>
                  </div>
                </div>

                {/* RIGHT MAIN DETAILS SECTION */}
                <div className="flex flex-col gap-6 lg:col-span-8">
                  {/* "About Me" Editorial Card */}
                  <div className="overflow-hidden rounded-3xl border border-[#EFEAE2] bg-white p-6 sm:p-7 shadow-[0_4px_24px_rgba(0,0,0,0.02)]">
                    <div className="flex items-center justify-between gap-3 border-b border-[#F1EBE1] pb-4">
                      <div className="flex items-center gap-2.5">
                        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#FAF5F6] text-[#7A1C32] border border-[#F2D6DC]">
                          <Quote className="h-4 w-4" />
                        </div>
                        <h2 className="font-[family-name:var(--font-playfair)] font-serif text-lg sm:text-xl font-bold text-[#1E293B]">
                          About {profile.fullName.split(' ')[0]}
                        </h2>
                      </div>
                      {profile.additional?.familyType && (
                        <span className="rounded-full bg-[#FAF7F2] border border-[#EADBBD] px-3 py-1 text-xs font-semibold text-[#7A1C32]">
                          {profile.additional.familyType}
                        </span>
                      )}
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
                  <div className="rounded-3xl border border-[#EFEAE2] bg-white p-6 sm:p-7 shadow-[0_4px_24px_rgba(0,0,0,0.02)]">
                    <div className="flex items-center gap-2.5 border-b border-[#F1EBE1] pb-4">
                      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#FFF9ED] text-[#C49746] border border-[#F1DFBA]">
                        <Sparkles className="h-4 w-4" />
                      </div>
                      <div>
                        <h2 className="font-[family-name:var(--font-playfair)] font-serif text-lg sm:text-xl font-bold text-[#1E293B]">
                          Personal & Cultural Details
                        </h2>
                        <p className="text-xs text-[#7E6F65]">Community, traditions, and physical attributes</p>
                      </div>
                    </div>

                    <div className="mt-5 grid grid-cols-1 gap-3.5 sm:grid-cols-2">
                      <DataTile
                        icon={<span className="text-sm">📏</span>}
                        label="Height"
                        value={profile.height}
                      />
                      <DataTile
                        icon={<Activity className="h-4 w-4" />}
                        label="Physical Status"
                        value={label(PHYSICAL_STATUS_LABELS, profile.physicalStatus)}
                      />
                      <DataTile
                        icon={<span className="text-sm">💍</span>}
                        label="Marital Status"
                        value={label(MARITAL_STATUS_LABELS, profile.maritalStatus)}
                      />
                      <DataTile
                        icon={<Languages className="h-4 w-4" />}
                        label="Mother Tongue"
                        value={profile.motherTongue}
                      />
                      <DataTile
                        icon={<span className="text-sm">🕉️</span>}
                        label="Religion"
                        value={profile.religion}
                      />
                      <DataTile
                        icon={<Users className="h-4 w-4" />}
                        label="Caste / Community"
                        value={profile.casteCommunity}
                      />
                      <div className="sm:col-span-2">
                        <DataTile
                          icon={<Sparkles className="h-4 w-4 text-[#C49746]" />}
                          label="Dosham"
                          value={
                            profile.dosham === 'NO' ? (
                              <span className="inline-flex items-center gap-1 text-emerald-700 font-bold">
                                <Check className="h-4 w-4" /> No Dosham
                              </span>
                            ) : profile.dosham === 'YES' ? (
                              <span className="inline-flex items-center gap-1 text-amber-800 font-bold">
                                ⚠️ Yes
                              </span>
                            ) : (
                              label(DOSHAM_LABELS, profile.dosham)
                            )
                          }
                          highlight={profile.dosham === 'NO'}
                        />
                      </div>
                    </div>
                  </div>

                  {/* Education & Career Details */}
                  <div className="rounded-3xl border border-[#EFEAE2] bg-white p-6 sm:p-7 shadow-[0_4px_24px_rgba(0,0,0,0.02)]">
                    <div className="flex items-center gap-2.5 border-b border-[#F1EBE1] pb-4">
                      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#FAF5F6] text-[#7A1C32] border border-[#F2D6DC]">
                        <GraduationCap className="h-4 w-4" />
                      </div>
                      <div>
                        <h2 className="font-[family-name:var(--font-playfair)] font-serif text-lg sm:text-xl font-bold text-[#1E293B]">
                          Education & Career
                        </h2>
                        <p className="text-xs text-[#7E6F65]">Professional background and qualifications</p>
                      </div>
                    </div>

                    {/* Prominent Profession Banner */}
                    <div className="mt-5 rounded-2xl bg-gradient-to-r from-[#FFFDF9] via-[#FAF7F2] to-[#FFF9ED] border border-[#EADBBD] p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                      <div className="flex items-center gap-3.5">
                        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-white border border-[#EADBBD] text-[#7A1C32] shadow-xs">
                          <Briefcase className="h-6 w-6" />
                        </div>
                        <div>
                          <p className="text-xs font-bold uppercase tracking-wider text-[#8A796E]">Designation</p>
                          <h3 className="text-base sm:text-lg font-bold text-[#241C1A]">
                            {profile.education?.profession || '—'}
                          </h3>
                          {profile.education.employedIn && (
                            <p className="text-xs text-[#7E6F65]">{profile.education.employedIn}</p>
                          )}
                        </div>
                      </div>

                      {/* Annual Income Badge */}
                      {profile.education.annualIncomeRange && (
                        <div className="rounded-xl bg-white/90 border border-[#EADBBD] px-4 py-2.5 sm:text-right shadow-2xs">
                          <p className="text-[11px] font-bold uppercase tracking-wider text-[#7E6F65]">Annual Income</p>
                          <p className="text-sm font-bold text-[#7A1C32]">
                            {profile.education.annualIncomeCurrency || 'INR'} {profile.education.annualIncomeRange}
                          </p>
                        </div>
                      )}
                    </div>

                    <div className="mt-4 grid grid-cols-1 gap-3.5 sm:grid-cols-2">
                      <DataTile
                        icon={<GraduationCap className="h-4 w-4" />}
                        label="Highest Education"
                        value={profile.education.educationLevel}
                      />
                      <DataTile
                        icon={<span className="text-sm">🎓</span>}
                        label="Education Detail"
                        value={profile.education.educationDetail}
                      />
                      <DataTile
                        icon={<Building2 className="h-4 w-4" />}
                        label="Employed In"
                        value={profile.education.employedIn}
                      />
                      <DataTile
                        icon={<Coins className="h-4 w-4" />}
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
                  <div className="rounded-3xl border border-[#EFEAE2] bg-white p-6 sm:p-7 shadow-[0_4px_24px_rgba(0,0,0,0.02)]">
                    <div className="flex items-center gap-2.5 border-b border-[#F1EBE1] pb-4">
                      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#FAF5F6] text-[#7A1C32] border border-[#F2D6DC]">
                        <Home className="h-4 w-4" />
                      </div>
                      <div>
                        <h2 className="font-[family-name:var(--font-playfair)] font-serif text-lg sm:text-xl font-bold text-[#1E293B]">
                          Location & Family Background
                        </h2>
                        <p className="text-xs text-[#7E6F65]">Current residence and family background</p>
                      </div>
                    </div>

                    <div className="mt-5 grid grid-cols-1 gap-3.5 sm:grid-cols-2">
                      <DataTile
                        icon={<MapPin className="h-4 w-4" />}
                        label="Current City"
                        value={profile.location.city}
                      />
                      <DataTile
                        icon={<span className="text-sm">📍</span>}
                        label="State"
                        value={profile.location.state}
                      />
                      <DataTile
                        icon={<Home className="h-4 w-4" />}
                        label="Family Status / Type"
                        value={profile.additional?.familyType}
                      />

                    </div>
                  </div>
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
