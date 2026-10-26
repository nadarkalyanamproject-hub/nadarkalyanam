'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import type { InterestResponse, InterestStatus, ListInterestsResponse } from '@nadar-kalyanam/schemas';
import { AppHeader } from '../../components/app-header';
import {
  ApiError,
  acceptInterest,
  declineInterest,
  listInterests,
  markInterestsViewed,
  withdrawInterest,
} from '../../lib/api-client';
import { announceInterestsChanged, announceNotificationsChanged } from '../../lib/notifications';
import { useRegistration } from '../providers/registration-provider';
import { useRequireAuth } from '../../lib/use-require-auth';
import { BotanicalSprig } from '../../components/search/partner-search-bar';
import {
  Check,
  Clock,
  Download,
  GraduationCap,
  Heart,
  MapPin,
  MessageSquare,
  MoreHorizontal,
  Undo2,
  Upload,
  User,
  X,
} from 'lucide-react';
import { PlanGate } from '../../components/plan/plan-gate';

export interface DisplayInterest {
  id: string;
  profileId: string;
  fullName: string;
  age: number;
  city: string | null;
  state: string | null;
  // The member's profession, or their education level when no profession.
  occupation: string | null;
  primaryPhotoUrl: string | null;
  status: InterestStatus;
  createdAt: string;
}

type Side = 'received' | 'sent';
type StatusFilter = 'ALL' | 'PENDING' | 'ACCEPTED' | 'DECLINED';

const FILTERS: { key: StatusFilter; label: string }[] = [
  { key: 'ALL', label: 'All' },
  { key: 'PENDING', label: 'Pending' },
  { key: 'ACCEPTED', label: 'Accepted' },
  { key: 'DECLINED', label: 'Declined' },
];

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

// Only real profile fields; anything the member hasn't filled in stays null
// and its line is hidden rather than shown as a placeholder.
export function mapApiInterestToDisplay(interest: InterestResponse, isReceived: boolean): DisplayInterest {
  const party = isReceived ? interest.sender : interest.target;
  return {
    id: interest.id,
    profileId: party.profileId,
    fullName: party.fullName.split(' ')[0] || party.fullName,
    age: party.age,
    city: party.city || null,
    state: party.state || null,
    occupation: party.profession || party.educationLevel || null,
    primaryPhotoUrl: party.primaryPhotoUrl,
    status: interest.status,
    createdAt: interest.createdAt,
  };
}

// "27 · Madurai", or just "27" without a city (null when neither is known).
export function ageAndCity(item: Pick<DisplayInterest, 'age' | 'city'>): string | null {
  const parts = [item.age > 0 ? String(item.age) : null, item.city].filter(Boolean);
  return parts.length ? parts.join(' · ') : null;
}

// "Madurai, Tamil Nadu", whichever parts are known (null when neither).
export function placeLine(item: Pick<DisplayInterest, 'city' | 'state'>): string | null {
  const parts = [item.city, item.state].filter(Boolean);
  return parts.length ? parts.join(', ') : null;
}

function filterItems(items: DisplayInterest[], filter: StatusFilter): DisplayInterest[] {
  if (filter === 'ALL') return items;
  return items.filter((item) => item.status === filter);
}

function Avatar({ item }: { item: DisplayInterest }) {
  return (
    <div className="h-11 w-11 shrink-0 overflow-hidden rounded-full bg-stone-200">
      {item.primaryPhotoUrl ? (
        // eslint-disable-next-line @next/next/no-img-element -- signed photo URLs, same as the rest of the app
        <img src={item.primaryPhotoUrl} alt={item.fullName} className="h-full w-full object-cover" />
      ) : (
        <div className="flex h-full w-full items-center justify-center text-base font-semibold text-stone-600" aria-hidden="true">
          {item.fullName.charAt(0).toUpperCase()}
        </div>
      )}
    </div>
  );
}

function ProfileCell({ item }: { item: DisplayInterest }) {
  const subline = ageAndCity(item);
  return (
    <div className="flex min-w-0 items-center gap-3">
      <Avatar item={item} />
      <div className="min-w-0">
        <p className="truncate text-sm font-bold text-nk-ink">{item.fullName}</p>
        {subline && <p className="truncate text-xs text-nk-muted">{subline}</p>}
      </div>
    </div>
  );
}

function DetailsLines({ item }: { item: DisplayInterest }) {
  const place = placeLine(item);
  if (!item.occupation && !place) return null;
  return (
    <div className="min-w-0 space-y-1 text-xs text-nk-ink-soft">
      {item.occupation && (
        <p className="flex min-w-0 items-center gap-1.5">
          <GraduationCap className="h-3.5 w-3.5 shrink-0 text-nk-subtle" aria-hidden="true" />
          <span className="truncate">{item.occupation}</span>
        </p>
      )}
      {place && (
        <p className="flex min-w-0 items-center gap-1.5">
          <MapPin className="h-3.5 w-3.5 shrink-0 text-nk-subtle" aria-hidden="true" />
          <span className="truncate">{place}</span>
        </p>
      )}
    </div>
  );
}

function StatusPill({ status }: { status: InterestStatus }) {
  const base = 'inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold whitespace-nowrap';
  switch (status) {
    case 'PENDING':
      return (
        <span className={`${base} border-stone-200 bg-stone-100 text-stone-600`}>
          <Clock className="h-3.5 w-3.5" aria-hidden="true" />
          Pending
        </span>
      );
    case 'ACCEPTED':
      return (
        <span className={`${base} border-emerald-200 bg-emerald-50 text-emerald-700`}>
          <Check className="h-3.5 w-3.5" aria-hidden="true" />
          Accepted
        </span>
      );
    case 'DECLINED':
      return (
        <span className={`${base} border-red-200 bg-red-50 text-red-700`}>
          <X className="h-3.5 w-3.5" aria-hidden="true" />
          Declined
        </span>
      );
    case 'WITHDRAWN':
      return <span className={`${base} border-nk-line bg-white text-nk-muted`}>Withdrawn</span>;
  }
}

interface RowActionsProps {
  item: DisplayInterest;
  side: Side;
  menuOpen: boolean;
  busy: boolean;
  onToggleMenu: () => void;
  onAccept: () => void;
  onDecline: () => void;
  onWithdraw: () => void;
}

function RowActions({ item, side, menuOpen, busy, onToggleMenu, onAccept, onDecline, onWithdraw }: RowActionsProps) {
  const canRespond = side === 'received' && item.status === 'PENDING';
  const canWithdraw = side === 'sent' && item.status === 'PENDING';
  const menuItem = 'flex w-full items-center gap-2 px-3.5 py-2 text-left text-xs font-medium transition-colors cursor-pointer disabled:cursor-not-allowed disabled:opacity-50';

  return (
    <div className="flex flex-wrap items-center justify-end gap-1.5 sm:gap-2">
      {/* Inline too, so a pending interest can be answered without the menu. */}
      {canRespond && (
        <>
          <button
            type="button"
            disabled={busy}
            onClick={onAccept}
            className="inline-flex items-center gap-1 rounded-lg bg-nk-maroon px-2.5 sm:px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-nk-maroon-deep disabled:opacity-50 cursor-pointer disabled:cursor-not-allowed"
          >
            <Check className="h-3.5 w-3.5" aria-hidden="true" />
            Accept
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={onDecline}
            className="inline-flex items-center gap-1 rounded-lg border border-nk-line bg-white px-2.5 sm:px-3 py-1.5 text-xs font-semibold text-nk-ink-soft transition-colors hover:bg-nk-sand disabled:opacity-50 cursor-pointer disabled:cursor-not-allowed"
          >
            <X className="h-3.5 w-3.5" aria-hidden="true" />
            Decline
          </button>
        </>
      )}

      <Link
        href={`/browse/${item.profileId}`}
        className="whitespace-nowrap rounded-lg border border-nk-maroon px-2.5 sm:px-3.5 py-1.5 text-xs font-semibold text-nk-maroon transition-colors hover:bg-nk-maroon hover:text-white"
      >
        View Profile
      </Link>

      <div className="relative" data-row-menu>
        <button
          type="button"
          onClick={onToggleMenu}
          aria-label={`More options for ${item.fullName}`}
          aria-haspopup="menu"
          aria-expanded={menuOpen}
          className="flex h-8 w-8 items-center justify-center rounded-full text-nk-subtle transition-colors hover:bg-nk-sand hover:text-nk-ink cursor-pointer"
        >
          <MoreHorizontal className="h-4 w-4" />
        </button>

        {menuOpen && (
          <div role="menu" className="absolute right-0 top-full z-20 mt-1 w-48 rounded-xl border border-nk-line bg-white py-1.5 shadow-lg">
            {canRespond && (
              <>
                <button type="button" role="menuitem" disabled={busy} onClick={onAccept} className={`${menuItem} text-emerald-700 hover:bg-emerald-50`}>
                  <Check className="h-3.5 w-3.5" aria-hidden="true" />
                  Accept Interest
                </button>
                <button type="button" role="menuitem" disabled={busy} onClick={onDecline} className={`${menuItem} text-red-700 hover:bg-red-50`}>
                  <X className="h-3.5 w-3.5" aria-hidden="true" />
                  Decline Interest
                </button>
              </>
            )}
            {canWithdraw && (
              <button type="button" role="menuitem" disabled={busy} onClick={onWithdraw} className={`${menuItem} text-nk-ink-soft hover:bg-nk-sand`}>
                <Undo2 className="h-3.5 w-3.5" aria-hidden="true" />
                Withdraw Interest
              </button>
            )}
            {item.status === 'ACCEPTED' && (
              <Link href="/messages" role="menuitem" className={`${menuItem} text-nk-maroon hover:bg-nk-sand`}>
                <MessageSquare className="h-3.5 w-3.5" aria-hidden="true" />
                Send Message
              </Link>
            )}
            <Link href={`/browse/${item.profileId}`} role="menuitem" className={`${menuItem} text-nk-ink-soft hover:bg-nk-sand`}>
              <User className="h-3.5 w-3.5" aria-hidden="true" />
              Full Profile
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}

function InterestsPageContent() {
  const { ready } = useRequireAuth();
  const { data } = useRegistration();

  // null until GET /interests resolves; never seeded with placeholder people.
  const [receivedList, setReceivedList] = useState<DisplayInterest[] | null>(null);
  const [sentList, setSentList] = useState<DisplayInterest[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [side, setSide] = useState<Side>('received');
  const [filters, setFilters] = useState<Record<Side, StatusFilter>>({ received: 'ALL', sent: 'ALL' });

  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [actingOn, setActingOn] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Close the "..." menu on a click outside it, or on Escape.
  useEffect(() => {
    function handleDocumentClick(e: MouseEvent) {
      if (!(e.target instanceof Element) || !e.target.closest('[data-row-menu]')) setOpenMenuId(null);
    }
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpenMenuId(null);
    }
    document.addEventListener('click', handleDocumentClick);
    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('click', handleDocumentClick);
      document.removeEventListener('keydown', handleKey);
    };
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

  function beginAction(interest: DisplayInterest) {
    setActingOn(interest.id);
    setOpenMenuId(null);
    setSuccessMessage(null);
    setErrorMessage(null);
  }

  function setStatus(list: Side, id: string, status: InterestStatus) {
    const update = (prev: DisplayInterest[] | null) =>
      prev && prev.map((item) => (item.id === id ? { ...item, status } : item));
    if (list === 'received') setReceivedList(update);
    else setSentList(update);
  }

  async function handleAccept(interest: DisplayInterest) {
    beginAction(interest);
    try {
      if (!data.accessToken) throw new Error('Your session has expired. Please sign in again.');
      await acceptInterest(data.accessToken, interest.id);
      announceNotificationsChanged();
      announceInterestsChanged();
      setStatus('received', interest.id, 'ACCEPTED');
      setSuccessMessage(`Interest from ${interest.fullName} accepted! You are now connected.`);
    } catch (err) {
      setErrorMessage(err instanceof ApiError ? err.message : 'Could not accept this interest. Please try again.');
    } finally {
      setActingOn(null);
    }
  }

  async function handleDecline(interest: DisplayInterest) {
    beginAction(interest);
    try {
      if (!data.accessToken) throw new Error('Your session has expired. Please sign in again.');
      await declineInterest(data.accessToken, interest.id);
      announceInterestsChanged();
      setStatus('received', interest.id, 'DECLINED');
      setSuccessMessage(`Interest from ${interest.fullName} declined.`);
    } catch (err) {
      setErrorMessage(err instanceof ApiError ? err.message : 'Could not decline this interest. Please try again.');
    } finally {
      setActingOn(null);
    }
  }

  async function handleWithdraw(interest: DisplayInterest) {
    beginAction(interest);
    try {
      if (!data.accessToken) throw new Error('Your session has expired. Please sign in again.');
      await withdrawInterest(data.accessToken, interest.id);
      announceInterestsChanged();
      setStatus('sent', interest.id, 'WITHDRAWN');
      setSuccessMessage(`Interest to ${interest.fullName} withdrawn.`);
    } catch (err) {
      setErrorMessage(err instanceof ApiError ? err.message : 'Could not withdraw this interest. Please try again.');
    } finally {
      setActingOn(null);
    }
  }

  if (!ready) return null;

  const list = side === 'received' ? receivedList : sentList;
  const filter = filters[side];
  const rows = list ? filterItems(list, filter) : [];
  const emptyText =
    side === 'received'
      ? 'No interests received yet. When someone shows interest in your profile, they will appear here.'
      : "You haven't sent any interests yet. Browse matches and send an interest to someone you like.";

  // Loading / error / empty copy for the card; null means there are rows to render.
  let listStatus: string | null = null;
  if (loadError) listStatus = loadError;
  else if (!list) listStatus = 'Loading interests…';
  else if (list.length === 0) listStatus = emptyText;
  else if (rows.length === 0) listStatus = 'No interests match this filter.';

  function actionsFor(item: DisplayInterest) {
    return (
      <RowActions
        item={item}
        side={side}
        menuOpen={openMenuId === item.id}
        busy={actingOn === item.id}
        onToggleMenu={() => setOpenMenuId(openMenuId === item.id ? null : item.id)}
        onAccept={() => void handleAccept(item)}
        onDecline={() => void handleDecline(item)}
        onWithdraw={() => void handleWithdraw(item)}
      />
    );
  }

  const sideButton = (key: Side, label: string, Icon: typeof Download) => {
    const active = side === key;
    return (
      <button
        type="button"
        aria-pressed={active}
        onClick={() => {
          setSide(key);
          setOpenMenuId(null);
        }}
        className={`inline-flex items-center gap-1.5 rounded-full px-4 py-1.5 text-sm font-semibold transition-colors cursor-pointer ${
          active ? 'bg-nk-maroon text-white shadow-2xs' : 'text-nk-muted hover:text-nk-ink'
        }`}
      >
        <Icon className="h-4 w-4" aria-hidden="true" />
        {label}
      </button>
    );
  };

  return (
    <>
      <AppHeader />
      <main className="relative min-h-screen bg-nk-paper text-nk-ink overflow-hidden px-4 py-6 sm:px-6 sm:py-8 lg:px-8 xl:px-12 2xl:px-16">
        {/* Decorative corner foliage flourishes matching design theme */}
        <BotanicalSprig className="pointer-events-none absolute -top-4 -right-4 w-44 h-44 sm:w-64 sm:h-64 text-[#C4A882] opacity-40 z-0" />
        <BotanicalSprig className="pointer-events-none absolute -bottom-4 -left-4 w-44 h-44 sm:w-64 sm:h-64 text-[#C4A882] opacity-35 rotate-180 z-0" />

        <div className="relative z-10 w-full max-w-7xl mx-auto flex flex-col gap-5">
          <div className="space-y-1">
            <div className="flex items-center gap-2.5">
              <Heart className="h-6 w-6 text-nk-maroon" />
              <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-nk-ink tracking-tight font-[family-name:var(--font-heading,serif)]">
                Interests
              </h1>
            </div>
            <p className="text-xs sm:text-sm text-nk-muted">
              People you have shown interest in and those who have shown interest in you.
            </p>
          </div>

          {successMessage && (
            <div className="rounded-2xl border border-emerald-200 bg-emerald-50/90 p-4 text-xs sm:text-sm font-medium text-emerald-800 flex items-center justify-between gap-3">
              <span>{successMessage}</span>
              <button
                type="button"
                onClick={() => setSuccessMessage(null)}
                aria-label="Dismiss"
                className="text-emerald-700 hover:text-emerald-900 cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          )}

          {errorMessage && (
            <div className="rounded-2xl border border-red-200 bg-red-50/90 p-4 text-xs sm:text-sm font-medium text-nk-maroon flex items-center justify-between gap-3">
              <span>{errorMessage}</span>
              <button
                type="button"
                onClick={() => setErrorMessage(null)}
                aria-label="Dismiss"
                className="text-nk-maroon hover:text-nk-maroon-deep cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          )}

          {/* Row 1: Received / Sent, then the status filters for that side */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="inline-flex rounded-full border border-nk-line bg-white p-1" role="group" aria-label="Received or sent">
              {sideButton('received', 'Received', Download)}
              {sideButton('sent', 'Sent', Upload)}
            </div>

            <div className="inline-flex flex-wrap gap-0.5 sm:gap-1 rounded-[1.25rem] border border-nk-line bg-white p-1" role="group" aria-label="Filter by status">
              {FILTERS.map(({ key, label }) => {
                const active = filter === key;
                // Counts only once the real list has loaded.
                const count = list ? filterItems(list, key).length : null;
                return (
                  <button
                    key={key}
                    type="button"
                    aria-pressed={active}
                    onClick={() => setFilters((prev) => ({ ...prev, [side]: key }))}
                    className={`rounded-full px-2.5 sm:px-3 py-1.5 text-xs font-semibold transition-colors cursor-pointer ${
                      active ? 'bg-nk-maroon text-white shadow-2xs' : 'text-nk-muted hover:text-nk-ink'
                    }`}
                  >
                    {label}
                    {count !== null && ` (${count})`}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="rounded-2xl border border-nk-line bg-white shadow-[0_4px_24px_-4px_rgba(43,21,21,0.06)]">
            {listStatus ? (
              <div
                role={loadError ? 'alert' : undefined}
                className={`px-4 py-12 text-center text-xs sm:text-sm ${loadError ? 'text-nk-maroon font-medium' : 'text-nk-subtle'}`}
              >
                {listStatus}
              </div>
            ) : (
              <>
                {/* Wide screens: the five-column table */}
                <table className="hidden w-full text-left lg:table">
                  <caption className="sr-only">{side === 'received' ? 'Interests received' : 'Interests sent'}</caption>
                  <thead>
                    <tr className="text-xs font-semibold text-nk-muted">
                      <th scope="col" className="rounded-tl-2xl bg-stone-100/80 px-5 py-3">Profile</th>
                      <th scope="col" className="bg-stone-100/80 px-4 py-3">Details</th>
                      <th scope="col" className="bg-stone-100/80 px-4 py-3">Interest Status</th>
                      <th scope="col" className="bg-stone-100/80 px-4 py-3">Date</th>
                      <th scope="col" className="rounded-tr-2xl bg-stone-100/80 px-5 py-3 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((item) => (
                      <tr key={item.id} className="border-t border-nk-line-soft align-middle">
                        <td className="max-w-[240px] px-5 py-4"><ProfileCell item={item} /></td>
                        <td className="max-w-[260px] px-4 py-4"><DetailsLines item={item} /></td>
                        <td className="px-4 py-4"><StatusPill status={item.status} /></td>
                        <td className="whitespace-nowrap px-4 py-4 text-xs text-nk-subtle">{formatInterestDate(item.createdAt)}</td>
                        <td className="px-5 py-4">{actionsFor(item)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                {/* Narrow screens: one stacked card per interest */}
                <ul className="divide-y divide-nk-line-soft lg:hidden">
                  {rows.map((item) => (
                    <li key={item.id} className="flex flex-col gap-3 p-4">
                      <div className="flex items-start justify-between gap-3">
                        <ProfileCell item={item} />
                        <StatusPill status={item.status} />
                      </div>
                      <DetailsLines item={item} />
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="text-xs text-nk-subtle">{formatInterestDate(item.createdAt)}</span>
                        {actionsFor(item)}
                      </div>
                    </li>
                  ))}
                </ul>
              </>
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
