'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import type { InterestResponse, InterestStatus, ListInterestsResponse } from '@nadar-kalyanam/schemas';
import { AppHeader, UserIcon } from '../../components/app-header';
import {
  ApiError,
  acceptInterest,
  declineInterest,
  listInterests,
  markInterestsViewed,
} from '../../lib/api-client';
import { announceInterestsChanged, announceNotificationsChanged } from '../../lib/notifications';
import { useRegistration } from '../providers/registration-provider';
import { useRequireAuth } from '../../lib/use-require-auth';
import { BotanicalSprig } from '../../components/search/partner-search-bar';
import {
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Clock,
  GraduationCap,
  Heart,
  MapPin,
  MessageSquare,
  MoreHorizontal,
  Send,
  User,
  UserCheck,
  X,
  XCircle,
} from 'lucide-react';
import { PlanGate } from '../../components/plan/plan-gate';

export interface DisplayInterest {
  id: string;
  profileId: string;
  fullName: string;
  age: number;
  location: string | null;
  education: string | null;
  primaryPhotoUrl: string | null;
  status: InterestStatus;
  createdAt: string;
}

type StatusFilter = 'ALL' | 'PENDING' | 'ACCEPTED' | 'DECLINED';

export function formatInterestDate(dateStr: string): string {
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    const day = String(d.getDate()).padStart(2, '0');
    const month = d.toLocaleString('en-US', { month: 'short' });
    const year = d.getFullYear();
    return `${day} ${month} ${year}`;
  } catch {
    return dateStr;
  }
}

// The interest party summary carries no location or education, so those stay
// null and render as the app's '—' placeholder rather than an invented value.
export function mapApiInterestToDisplay(interest: InterestResponse, isReceived: boolean): DisplayInterest {
  const party = isReceived ? interest.sender : interest.target;
  return {
    id: interest.id,
    profileId: party.profileId,
    fullName: party.fullName.split(' ')[0] || party.fullName,
    age: party.age,
    location: null,
    education: null,
    primaryPhotoUrl: party.primaryPhotoUrl,
    status: interest.status,
    createdAt: interest.createdAt,
  };
}

function InterestsPageContent() {
  const { ready } = useRequireAuth();
  const { data } = useRegistration();

  // null until GET /interests resolves; never seeded with placeholder people.
  const [receivedList, setReceivedList] = useState<DisplayInterest[] | null>(null);
  const [sentList, setSentList] = useState<DisplayInterest[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [filterReceived, setFilterReceived] = useState<StatusFilter>('ALL');
  const [filterSent, setFilterSent] = useState<StatusFilter>('ALL');

  const [receivedOpen, setReceivedOpen] = useState(true);
  const [sentOpen, setSentOpen] = useState(true);

  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [actingOn, setActingOn] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const menuContainerRef = useRef<HTMLDivElement>(null);

  // Close more menu when clicking outside
  useEffect(() => {
    function handleDocumentClick(e: MouseEvent) {
      if (menuContainerRef.current && !menuContainerRef.current.contains(e.target as Node)) {
        setOpenMenuId(null);
      }
    }
    document.addEventListener('click', handleDocumentClick);
    return () => document.removeEventListener('click', handleDocumentClick);
  }, []);

  useEffect(() => {
    if (!ready || !data.accessToken) return;
    let cancelled = false;

    listInterests(data.accessToken)
      .then((result: ListInterestsResponse) => {
        if (cancelled) return;
        setReceivedList(result.received.map((i) => mapApiInterestToDisplay(i, true)));
        setSentList(result.sent.map((i) => mapApiInterestToDisplay(i, false)));
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setLoadError(err instanceof ApiError ? err.message : 'Could not load interests. Please try again.');
      });

    markInterestsViewed(data.accessToken)
      .then(() => announceInterestsChanged())
      .catch(() => {
        // Best effort
      });

    return () => {
      cancelled = true;
    };
  }, [ready, data.accessToken]);

  async function handleAccept(interest: DisplayInterest) {
    setActingOn(interest.id);
    setOpenMenuId(null);
    setSuccessMessage(null);
    setErrorMessage(null);

    try {
      if (!data.accessToken) throw new Error('Your session has expired. Please sign in again.');
      await acceptInterest(data.accessToken, interest.id);
      announceNotificationsChanged();
      announceInterestsChanged();

      setReceivedList((prev) =>
        prev && prev.map((item) => (item.id === interest.id ? { ...item, status: 'ACCEPTED' } : item)),
      );
      setSuccessMessage(`Interest from ${interest.fullName} accepted! You are now connected.`);
    } catch (err) {
      setErrorMessage(
        err instanceof ApiError ? err.message : 'Could not accept this interest. Please try again.',
      );
    } finally {
      setActingOn(null);
    }
  }

  async function handleDecline(interest: DisplayInterest) {
    setActingOn(interest.id);
    setOpenMenuId(null);
    setSuccessMessage(null);
    setErrorMessage(null);

    try {
      if (!data.accessToken) throw new Error('Your session has expired. Please sign in again.');
      await declineInterest(data.accessToken, interest.id);
      announceInterestsChanged();

      setReceivedList((prev) =>
        prev && prev.map((item) => (item.id === interest.id ? { ...item, status: 'DECLINED' } : item)),
      );
      setSuccessMessage(`Interest from ${interest.fullName} declined.`);
    } catch (err) {
      setErrorMessage(
        err instanceof ApiError ? err.message : 'Could not decline this interest. Please try again.',
      );
    } finally {
      setActingOn(null);
    }
  }

  if (!ready) return null;

  function filterItems(items: DisplayInterest[], filter: StatusFilter): DisplayInterest[] {
    if (filter === 'ALL') return items;
    return items.filter((item) => item.status === filter);
  }

  const displayedReceived = receivedList ? filterItems(receivedList, filterReceived) : [];
  const displayedSent = sentList ? filterItems(sentList, filterSent) : [];

  // Loading / error / empty copy for a card; null means there are rows to render.
  function listStatus(list: DisplayInterest[] | null, filter: StatusFilter, emptyText: string): string | null {
    if (loadError) return loadError;
    if (!list) return 'Loading interests…';
    if (list.length === 0) return emptyText;
    if (filterItems(list, filter).length === 0) return 'No interests match this filter.';
    return null;
  }

  const receivedStatus = listStatus(
    receivedList,
    filterReceived,
    'No interests received yet. When someone shows interest in your profile, they will appear here.',
  );
  const sentStatus = listStatus(
    sentList,
    filterSent,
    "You haven't sent any interests yet. Browse matches and send an interest to someone you like.",
  );

  return (
    <>
      <AppHeader />
      <main className="relative min-h-screen bg-[#FAF7F2] text-[#241C1A] overflow-hidden px-4 py-6 sm:px-6 sm:py-8 lg:px-8 xl:px-12 2xl:px-16">
        {/* Decorative corner foliage flourishes matching design theme */}
        <BotanicalSprig className="pointer-events-none absolute -top-4 -right-4 w-44 h-44 sm:w-64 sm:h-64 text-[#C4A882] opacity-40 z-0" />
        <BotanicalSprig className="pointer-events-none absolute -bottom-4 -left-4 w-44 h-44 sm:w-64 sm:h-64 text-[#C4A882] opacity-35 rotate-180 z-0" />

        <div className="relative z-10 w-full max-w-7xl mx-auto flex flex-col gap-6" ref={menuContainerRef}>
          {/* Header Title with Maroon Heart Icon */}
          <div className="space-y-1">
            <div className="flex items-center gap-2.5">
              <Heart className="h-6 w-6 text-[#7A1118]" />
              <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-[#241C1A] tracking-tight font-[family-name:var(--font-heading,serif)]">
                Interests
              </h1>
            </div>
            <p className="text-xs sm:text-sm text-[#73645C]">
              People you have shown interest in and those who have shown interest in you.
            </p>
          </div>

          {/* Feedback Toasts / Banners */}
          {successMessage && (
            <div className="rounded-2xl border border-emerald-200 bg-emerald-50/90 p-4 text-xs sm:text-sm font-medium text-emerald-800 flex items-center justify-between">
              <span>{successMessage}</span>
              <button
                type="button"
                onClick={() => setSuccessMessage(null)}
                className="text-emerald-700 hover:text-emerald-900 cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          )}

          {errorMessage && (
            <div className="rounded-2xl border border-red-200 bg-red-50/90 p-4 text-xs sm:text-sm font-medium text-[#7A1118] flex items-center justify-between">
              <span>{errorMessage}</span>
              <button
                type="button"
                onClick={() => setErrorMessage(null)}
                className="text-[#7A1118] hover:text-[#5A0D12] cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          )}

          {/* =========================================================================
              1. INTERESTS RECEIVED CARD
              ========================================================================= */}
          <div className="bg-white rounded-2xl sm:rounded-3xl border border-[#EADBBD]/80 p-5 sm:p-7 shadow-[0_4px_24px_-4px_rgba(43,21,21,0.05)] transition-all">
            {/* Card Header: Icon + Title + Filter Pills + Accordion Toggle */}
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4">
              {/* Left Title Group */}
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 sm:h-11 sm:w-11 rounded-full bg-[#FAF7F2] border border-[#DECDBB] flex items-center justify-center text-[#7A1118] shrink-0">
                  <UserCheck className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="text-base sm:text-lg font-bold text-[#241C1A] font-[family-name:var(--font-heading,serif)]">
                    Interests Received
                  </h2>
                  <p className="text-xs text-[#73645C]">
                    People who have shown interest in your profile.
                  </p>
                </div>
              </div>

              {/* Right Filter Pills & Chevron */}
              <div className="flex items-center gap-3 self-end sm:self-auto flex-wrap">
                <div className="flex items-center gap-1 sm:gap-1.5 p-1 bg-[#FAF7F2] rounded-lg border border-[#EADBBD]/70">
                  {(
                    [
                      { key: 'ALL', label: 'All' },
                      { key: 'PENDING', label: 'Pending' },
                      { key: 'ACCEPTED', label: 'Accepted/Replied' },
                      { key: 'DECLINED', label: 'Declined' },
                    ] as const
                  ).map(({ key, label }) => {
                    const isActive = filterReceived === key;
                    return (
                      <button
                        key={key}
                        type="button"
                        onClick={() => setFilterReceived(key)}
                        className={`px-3 sm:px-4 py-1.5 rounded-md text-xs font-medium transition-all cursor-pointer ${
                          isActive
                            ? 'bg-[#7A1118] text-white shadow-2xs'
                            : 'bg-transparent text-[#73645C] hover:text-[#241C1A]'
                        }`}
                      >
                        {label}
                      </button>
                    );
                  })}
                </div>

                <button
                  type="button"
                  onClick={() => setReceivedOpen((v) => !v)}
                  className="p-1 text-[#4A3D36] hover:text-[#7A1118] transition-colors cursor-pointer"
                  aria-label={receivedOpen ? 'Collapse Interests Received' : 'Expand Interests Received'}
                >
                  {receivedOpen ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
                </button>
              </div>
            </div>

            {/* Card Content / List of Received Interests */}
            {receivedOpen && (
              <div className="flex flex-col gap-3 pt-2">
                {receivedStatus ? (
                  <div
                    role={loadError ? 'alert' : undefined}
                    className={`py-8 text-center text-xs sm:text-sm ${loadError ? 'text-[#7A1118] font-medium' : 'text-[#8C7B73]'}`}
                  >
                    {receivedStatus}
                  </div>
                ) : (
                  displayedReceived.map((item) => (
                    <div
                      key={item.id}
                      className="bg-white rounded-2xl border border-[#F0E8DD] hover:border-[#DECDBB] p-3.5 sm:p-4 flex flex-col md:flex-row md:items-center justify-between gap-4 transition-all shadow-2xs hover:shadow-xs"
                    >
                      {/* Left Profile Info */}
                      <div className="flex items-center gap-3.5 min-w-0">
                        <div className="h-13 w-13 sm:h-14 sm:w-14 rounded-full overflow-hidden border border-[#EADBBD] shrink-0 bg-[#FAF7F2]">
                          {item.primaryPhotoUrl ? (
                            <img
                              src={item.primaryPhotoUrl}
                              alt={item.fullName}
                              className="h-full w-full object-cover"
                            />
                          ) : (
                            <div className="h-full w-full flex items-center justify-center text-[#A88C78]">
                              <UserIcon className="h-7 w-7" />
                            </div>
                          )}
                        </div>

                        <div className="min-w-0">
                          <h3 className="text-sm sm:text-base font-bold text-[#241C1A] truncate">
                            {item.fullName}, {item.age}
                          </h3>
                          <div className="flex items-center gap-2 mt-1 text-xs text-[#73645C] flex-wrap">
                            <span className="flex items-center gap-1">
                              <MapPin className="h-3.5 w-3.5 text-[#A88C78] shrink-0" />
                              <span>{item.location || '—'}</span>
                            </span>
                            <span className="text-[#D6C7B2] font-light">|</span>
                            <span className="flex items-center gap-1">
                              <GraduationCap className="h-3.5 w-3.5 text-[#A88C78] shrink-0" />
                              <span>{item.education || '—'}</span>
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Right Side: Status Badge, Date, View Profile, More Menu */}
                      <div className="flex items-center justify-between md:justify-end gap-3 sm:gap-4 shrink-0 border-t md:border-t-0 pt-3 md:pt-0 border-[#F0E8DD]">
                        {/* Status Badge */}
                        <div className="flex items-center gap-2 sm:gap-3">
                          {item.status === 'PENDING' && (
                            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-semibold bg-[#FDF2F2] border border-[#F8D7DA] text-[#C53030]">
                              <Clock className="h-3.5 w-3.5" />
                              <span>Pending</span>
                            </span>
                          )}
                          {item.status === 'ACCEPTED' && (
                            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-semibold bg-[#F0FDF4] border border-[#DCFCE7] text-[#16A34A]">
                              <CheckCircle2 className="h-3.5 w-3.5" />
                              <span>Accepted</span>
                            </span>
                          )}
                          {item.status === 'DECLINED' && (
                            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-semibold bg-[#FEF2F2] border border-[#FEE2E2] text-[#DC2626]">
                              <XCircle className="h-3.5 w-3.5" />
                              <span>Declined</span>
                            </span>
                          )}
                          {item.status === 'WITHDRAWN' && (
                            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-semibold bg-gray-50 border border-gray-200 text-gray-600">
                              <span>Withdrawn</span>
                            </span>
                          )}

                          {/* Date String */}
                          <span className="text-xs text-[#8C7B73] font-medium min-w-[76px]">
                            {formatInterestDate(item.createdAt)}
                          </span>
                        </div>

                        {/* Action Buttons */}
                        <div className="flex items-center gap-2 relative">
                          <Link
                            href={`/browse/${item.profileId}`}
                            className="px-4 sm:px-5 py-1.5 sm:py-2 rounded-md text-xs font-semibold tracking-wide border border-[#C49746] text-[#C49746] hover:bg-[#C49746]/10 active:scale-[0.98] transition-colors whitespace-nowrap"
                          >
                            View Profile
                          </Link>

                          <button
                            type="button"
                            onClick={() =>
                              setOpenMenuId(openMenuId === item.id ? null : item.id)
                            }
                            className="h-8 w-8 sm:h-9 sm:w-9 rounded-full border border-[#EADBBD] hover:border-[#C4B2A0] text-[#8C7B73] hover:text-[#241C1A] hover:bg-[#FAF7F2] flex items-center justify-center transition-colors cursor-pointer shrink-0"
                            aria-label="More options"
                          >
                            <MoreHorizontal className="h-4 w-4" />
                          </button>

                          {/* More Options Popover */}
                          {openMenuId === item.id && (
                            <div className="absolute right-0 top-full mt-1.5 w-44 bg-white rounded-xl shadow-lg border border-[#EADBBD] py-1.5 z-20">
                              {item.status === 'PENDING' && (
                                <>
                                  <button
                                    type="button"
                                    disabled={actingOn === item.id}
                                    onClick={() => void handleAccept(item)}
                                    className="w-full px-3.5 py-2 text-left text-xs font-medium text-emerald-700 hover:bg-emerald-50 flex items-center gap-2 cursor-pointer transition-colors"
                                  >
                                    <Check className="h-3.5 w-3.5 text-emerald-600" />
                                    <span>Accept Interest</span>
                                  </button>
                                  <button
                                    type="button"
                                    disabled={actingOn === item.id}
                                    onClick={() => void handleDecline(item)}
                                    className="w-full px-3.5 py-2 text-left text-xs font-medium text-rose-700 hover:bg-rose-50 flex items-center gap-2 cursor-pointer transition-colors"
                                  >
                                    <X className="h-3.5 w-3.5 text-rose-600" />
                                    <span>Decline Interest</span>
                                  </button>
                                </>
                              )}

                              {item.status === 'ACCEPTED' && (
                                <Link
                                  href="/messages"
                                  className="w-full px-3.5 py-2 text-left text-xs font-medium text-[#7A1118] hover:bg-[#FAF7F2] flex items-center gap-2 transition-colors block"
                                >
                                  <MessageSquare className="h-3.5 w-3.5 text-[#7A1118]" />
                                  <span>Send Message</span>
                                </Link>
                              )}

                              <Link
                                href={`/browse/${item.profileId}`}
                                className="w-full px-3.5 py-2 text-left text-xs font-medium text-[#4A3D36] hover:bg-[#FAF7F2] flex items-center gap-2 transition-colors block"
                              >
                                <User className="h-3.5 w-3.5 text-[#8C7B73]" />
                                <span>Full Profile</span>
                              </Link>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>

          {/* =========================================================================
              2. INTERESTS SENT CARD
              ========================================================================= */}
          <div className="bg-white rounded-2xl sm:rounded-3xl border border-[#EADBBD]/80 p-5 sm:p-7 shadow-[0_4px_24px_-4px_rgba(43,21,21,0.05)] transition-all">
            {/* Card Header: Icon + Title + Filter Pills + Accordion Toggle */}
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4">
              {/* Left Title Group */}
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 sm:h-11 sm:w-11 rounded-full bg-[#FAF7F2] border border-[#DECDBB] flex items-center justify-center text-[#7A1118] shrink-0">
                  <Send className="h-4 w-4 -ml-0.5" />
                </div>
                <div>
                  <h2 className="text-base sm:text-lg font-bold text-[#241C1A] font-[family-name:var(--font-heading,serif)]">
                    Interests Sent
                  </h2>
                  <p className="text-xs text-[#73645C]">People you have shown interest in.</p>
                </div>
              </div>

              {/* Right Filter Pills & Chevron */}
              <div className="flex items-center gap-3 self-end sm:self-auto flex-wrap">
                <div className="flex items-center gap-1 sm:gap-1.5 p-1 bg-[#FAF7F2] rounded-lg border border-[#EADBBD]/70">
                  {(
                    [
                      { key: 'ALL', label: 'All' },
                      { key: 'PENDING', label: 'Pending' },
                      { key: 'ACCEPTED', label: 'Accepted/Replied' },
                      { key: 'DECLINED', label: 'Declined' },
                    ] as const
                  ).map(({ key, label }) => {
                    const isActive = filterSent === key;
                    return (
                      <button
                        key={key}
                        type="button"
                        onClick={() => setFilterSent(key)}
                        className={`px-3 sm:px-4 py-1.5 rounded-md text-xs font-medium transition-all cursor-pointer ${
                          isActive
                            ? 'bg-[#7A1118] text-white shadow-2xs'
                            : 'bg-transparent text-[#73645C] hover:text-[#241C1A]'
                        }`}
                      >
                        {label}
                      </button>
                    );
                  })}
                </div>

                <button
                  type="button"
                  onClick={() => setSentOpen((v) => !v)}
                  className="p-1 text-[#4A3D36] hover:text-[#7A1118] transition-colors cursor-pointer"
                  aria-label={sentOpen ? 'Collapse Interests Sent' : 'Expand Interests Sent'}
                >
                  {sentOpen ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
                </button>
              </div>
            </div>

            {/* Card Content / List of Sent Interests */}
            {sentOpen && (
              <div className="flex flex-col gap-3 pt-2">
                {sentStatus ? (
                  <div
                    role={loadError ? 'alert' : undefined}
                    className={`py-8 text-center text-xs sm:text-sm ${loadError ? 'text-[#7A1118] font-medium' : 'text-[#8C7B73]'}`}
                  >
                    {sentStatus}
                  </div>
                ) : (
                  displayedSent.map((item) => (
                    <div
                      key={item.id}
                      className="bg-white rounded-2xl border border-[#F0E8DD] hover:border-[#DECDBB] p-3.5 sm:p-4 flex flex-col md:flex-row md:items-center justify-between gap-4 transition-all shadow-2xs hover:shadow-xs"
                    >
                      {/* Left Profile Info */}
                      <div className="flex items-center gap-3.5 min-w-0">
                        <div className="h-13 w-13 sm:h-14 sm:w-14 rounded-full overflow-hidden border border-[#EADBBD] shrink-0 bg-[#FAF7F2]">
                          {item.primaryPhotoUrl ? (
                            <img
                              src={item.primaryPhotoUrl}
                              alt={item.fullName}
                              className="h-full w-full object-cover"
                            />
                          ) : (
                            <div className="h-full w-full flex items-center justify-center text-[#A88C78]">
                              <UserIcon className="h-7 w-7" />
                            </div>
                          )}
                        </div>

                        <div className="min-w-0">
                          <h3 className="text-sm sm:text-base font-bold text-[#241C1A] truncate">
                            {item.fullName}, {item.age}
                          </h3>
                          <div className="flex items-center gap-2 mt-1 text-xs text-[#73645C] flex-wrap">
                            <span className="flex items-center gap-1">
                              <MapPin className="h-3.5 w-3.5 text-[#A88C78] shrink-0" />
                              <span>{item.location || '—'}</span>
                            </span>
                            <span className="text-[#D6C7B2] font-light">|</span>
                            <span className="flex items-center gap-1">
                              <GraduationCap className="h-3.5 w-3.5 text-[#A88C78] shrink-0" />
                              <span>{item.education || '—'}</span>
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Right Side: Status Badge, Date, View Profile, More Menu */}
                      <div className="flex items-center justify-between md:justify-end gap-3 sm:gap-4 shrink-0 border-t md:border-t-0 pt-3 md:pt-0 border-[#F0E8DD]">
                        {/* Status Badge */}
                        <div className="flex items-center gap-2 sm:gap-3">
                          {item.status === 'PENDING' && (
                            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-semibold bg-[#FDF2F2] border border-[#F8D7DA] text-[#C53030]">
                              <Clock className="h-3.5 w-3.5" />
                              <span>Pending</span>
                            </span>
                          )}
                          {item.status === 'ACCEPTED' && (
                            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-semibold bg-[#F0FDF4] border border-[#DCFCE7] text-[#16A34A]">
                              <CheckCircle2 className="h-3.5 w-3.5" />
                              <span>Accepted</span>
                            </span>
                          )}
                          {item.status === 'DECLINED' && (
                            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-semibold bg-[#FEF2F2] border border-[#FEE2E2] text-[#DC2626]">
                              <XCircle className="h-3.5 w-3.5" />
                              <span>Declined</span>
                            </span>
                          )}
                          {item.status === 'WITHDRAWN' && (
                            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-semibold bg-gray-50 border border-gray-200 text-gray-600">
                              <span>Withdrawn</span>
                            </span>
                          )}

                          {/* Date String */}
                          <span className="text-xs text-[#8C7B73] font-medium min-w-[76px]">
                            {formatInterestDate(item.createdAt)}
                          </span>
                        </div>

                        {/* Action Buttons */}
                        <div className="flex items-center gap-2 relative">
                          <Link
                            href={`/browse/${item.profileId}`}
                            className="px-4 sm:px-5 py-1.5 sm:py-2 rounded-md text-xs font-semibold tracking-wide border border-[#C49746] text-[#C49746] hover:bg-[#C49746]/10 active:scale-[0.98] transition-colors whitespace-nowrap"
                          >
                            View Profile
                          </Link>

                          <button
                            type="button"
                            onClick={() =>
                              setOpenMenuId(openMenuId === item.id ? null : item.id)
                            }
                            className="h-8 w-8 sm:h-9 sm:w-9 rounded-full border border-[#EADBBD] hover:border-[#C4B2A0] text-[#8C7B73] hover:text-[#241C1A] hover:bg-[#FAF7F2] flex items-center justify-center transition-colors cursor-pointer shrink-0"
                            aria-label="More options"
                          >
                            <MoreHorizontal className="h-4 w-4" />
                          </button>

                          {/* More Options Popover */}
                          {openMenuId === item.id && (
                            <div className="absolute right-0 top-full mt-1.5 w-44 bg-white rounded-xl shadow-lg border border-[#EADBBD] py-1.5 z-20">
                              {item.status === 'ACCEPTED' && (
                                <Link
                                  href="/messages"
                                  className="w-full px-3.5 py-2 text-left text-xs font-medium text-[#7A1118] hover:bg-[#FAF7F2] flex items-center gap-2 transition-colors block"
                                >
                                  <MessageSquare className="h-3.5 w-3.5 text-[#7A1118]" />
                                  <span>Send Message</span>
                                </Link>
                              )}

                              <Link
                                href={`/browse/${item.profileId}`}
                                className="w-full px-3.5 py-2 text-left text-xs font-medium text-[#4A3D36] hover:bg-[#FAF7F2] flex items-center gap-2 transition-colors block"
                              >
                                <User className="h-3.5 w-3.5 text-[#8C7B73]" />
                                <span>Full Profile</span>
                              </Link>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        </div>
      </main>
    </>
  );
}

// Needs a membership plan when the server requires one (see PlanGate).
export default function InterestsPage() {
  return (
    <PlanGate>
      <InterestsPageContent />
    </PlanGate>
  );
}
