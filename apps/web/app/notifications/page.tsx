'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { NotificationCategory, NotificationResponse } from '@nadar-kalyanam/schemas';
import { AppHeader, UserIcon } from '../../components/app-header';
import {
  ApiError,
  clearAllNotifications,
  listNotifications,
  markAllNotificationsRead,
  markNotificationRead,
} from '../../lib/api-client';
import { announceNotificationsChanged, formatRelativeTime, notificationDestination } from '../../lib/notifications';
import { useRegistration } from '../providers/registration-provider';
import { useRequireAuth } from '../../lib/use-require-auth';
import { BotanicalSprig } from '../../components/search/partner-search-bar';
import {
  Bell,
  Check,
  ChevronRight,
  Eye,
  Heart,
  LayoutGrid,
  Mail,
  MessageSquare,
  Star,
  Trash2,
  User,
} from 'lucide-react';

const TYPE_STYLE: Record<string, { icon: typeof Eye; className: string; label: string }> = {
  PROFILE_VIEWED: { icon: Eye, className: 'bg-[#FEF3C7] text-[#B45309]', label: 'Profile view' },
  INTEREST_RECEIVED: { icon: Star, className: 'bg-[#FDF2F2] text-nk-maroon', label: 'Interest received' },
  INTEREST_ACCEPTED: { icon: Heart, className: 'bg-[#F0FDF4] text-[#15803D]', label: 'Interest accepted' },
  NEW_MESSAGE: { icon: MessageSquare, className: 'bg-amber-50 text-[#92400E]', label: 'Message' },
};
const SYSTEM_STYLE = { icon: Bell, className: 'bg-nk-paper text-nk-muted', label: 'Account update' };

const PAGE_SIZE = 20;

interface ListState {
  items: NotificationResponse[];
  total: number;
  unreadCount: number;
  nextOffset: number | null;
}

function MessageText({ notification }: { notification: NotificationResponse }) {
  const { message, actor } = notification;
  if (actor.name && message.startsWith(actor.name)) {
    return (
      <>
        <span className="font-bold text-nk-ink">{actor.name}</span>
        {message.slice(actor.name.length)}
      </>
    );
  }
  return <>{message}</>;
}

export default function NotificationsPage() {
  const { ready } = useRequireAuth();
  const { data } = useRegistration();
  const router = useRouter();
  const [tab, setTab] = useState<NotificationCategory>('all');
  const [list, setList] = useState<ListState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [busy, setBusy] = useState<'mark' | 'clear' | null>(null);

  useEffect(() => {
    if (!ready || !data.accessToken) return;
    let cancelled = false;
    listNotifications(data.accessToken, { category: tab, limit: PAGE_SIZE })
      .then((result) => {
        if (!cancelled) {
          setList(result);
          setError(null);
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setError(err instanceof ApiError ? err.message : 'Could not load notifications. Please try again.');
        }
      });
    return () => {
      cancelled = true;
    };
  }, [ready, data.accessToken, tab]);

  function selectTab(next: NotificationCategory) {
    if (next === tab) return;
    setList(null);
    setNotice(null);
    setTab(next);
  }

  function markLocallyRead(id: string) {
    setList((prev) => {
      if (!prev) return prev;
      const target = prev.items.find((n) => n.id === id);
      if (!target || target.isRead) return prev;
      return {
        ...prev,
        unreadCount: Math.max(0, prev.unreadCount - 1),
        items: prev.items.map((n) => (n.id === id ? { ...n, isRead: true } : n)),
      };
    });
  }

  async function handleOpen(notification: NotificationResponse) {
    if (!data.accessToken) return;
    setNotice(null);
    setError(null);
    if (!notification.isRead) {
      // Shown as read only once the server has actually recorded it. On a
      // failure it stays unread, the error is shown and the user stays here
      // to retry, rather than seeing a read state the server doesn't have.
      try {
        await markNotificationRead(data.accessToken, notification.id);
      } catch (err) {
        setError(err instanceof ApiError ? err.message : 'Could not mark this notification as read. Please try again.');
        return;
      }
      markLocallyRead(notification.id);
      announceNotificationsChanged();
    }
    const destination = notificationDestination(notification);
    if (destination.kind === 'navigate') router.push(destination.href);
    else setNotice(destination.message);
  }

  async function handleMarkAll() {
    if (!data.accessToken || !list) return;
    setBusy('mark');
    try {
      await markAllNotificationsRead(data.accessToken);
      setList({
        ...list,
        unreadCount: 0,
        items: tab === 'unread' ? [] : list.items.map((n) => ({ ...n, isRead: true })),
      });
      announceNotificationsChanged();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not mark notifications as read.');
    } finally {
      setBusy(null);
    }
  }

  async function handleClearAll() {
    if (!data.accessToken) return;
    const ok = window.confirm(
      'Clear all notifications?\n\nThis permanently deletes every notification. It cannot be undone.',
    );
    if (!ok) return;
    setBusy('clear');
    try {
      await clearAllNotifications(data.accessToken);
      setList({ items: [], total: 0, unreadCount: 0, nextOffset: null });
      setNotice(null);
      announceNotificationsChanged();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not clear notifications.');
    } finally {
      setBusy(null);
    }
  }

  async function handleLoadMore() {
    if (!data.accessToken || !list || list.nextOffset === null) return;
    setLoadingMore(true);
    try {
      const more = await listNotifications(data.accessToken, {
        category: tab,
        offset: list.nextOffset,
        limit: PAGE_SIZE,
      });
      setList({ ...more, items: [...list.items, ...more.items] });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not load more notifications.');
    } finally {
      setLoadingMore(false);
    }
  }

  if (!ready) return null;

  const notifications = list?.items ?? null;
  const unread = list?.unreadCount ?? 0;

  const CATEGORY_TABS: { key: NotificationCategory; label: string; icon: typeof LayoutGrid }[] = [
    { key: 'all', label: 'All', icon: LayoutGrid },
    { key: 'unread', label: `Unread (${unread})`, icon: Mail },
    { key: 'profile', label: 'Profile', icon: User },
    { key: 'interests', label: 'Interests', icon: Heart },
  ];

  return (
    <>
      <AppHeader />
      <main className="relative min-h-screen bg-nk-paper text-nk-ink overflow-hidden px-4 py-6 sm:px-6 sm:py-8 lg:px-8 xl:px-12 2xl:px-16">
        {/* Decorative corner foliage flourishes matching design theme */}
        <BotanicalSprig className="pointer-events-none absolute -top-4 -right-4 w-44 h-44 sm:w-64 sm:h-64 text-[#C4A882] opacity-40 z-0" />
        <BotanicalSprig className="pointer-events-none absolute -bottom-4 -left-4 w-44 h-44 sm:w-64 sm:h-64 text-[#C4A882] opacity-35 rotate-180 z-0" />

        <div className="relative z-10 mx-auto flex w-full max-w-6xl flex-col gap-6">
          {/* Header row: Bell Icon + Title & Subtitle on Left | Action Buttons on Right */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3.5">
              <div className="h-11 w-11 sm:h-12 sm:w-12 rounded-full bg-[#FDF2F2] border border-[#F8D7DA] flex items-center justify-center text-nk-maroon shrink-0 shadow-2xs">
                <Bell className="h-5 w-5 sm:h-6 sm:w-6 text-nk-maroon" />
              </div>
              <div>
                <h1 className="text-2xl sm:text-3xl font-bold text-nk-ink font-[family-name:var(--font-heading,serif)] tracking-tight">
                  Notifications
                </h1>
                <p className="text-xs sm:text-sm text-nk-muted mt-0.5">
                  {unread > 0 ? 'Stay up to date with who’s interested in you.' : 'You’re all caught up.'}
                </p>
              </div>
            </div>

            {/* Action buttons */}
            <div className="flex items-center gap-2.5 self-end sm:self-auto">
              <button
                type="button"
                disabled={busy !== null || unread === 0}
                onClick={() => void handleMarkAll()}
                className="px-4 py-2 rounded-md bg-white hover:bg-nk-paper active:scale-[0.99] border border-nk-line-strong text-[#4A3D36] text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer shadow-2xs disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Check className="h-3.5 w-3.5 text-[#4A3D36]" />
                <span>{busy === 'mark' ? 'Marking…' : 'Mark all as read'}</span>
              </button>

              <button
                type="button"
                disabled={busy !== null || (list !== null && list.total === 0 && tab === 'all')}
                onClick={() => void handleClearAll()}
                className="px-4 py-2 rounded-md bg-nk-maroon hover:bg-[#620D13] active:scale-[0.99] text-white text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer shadow-xs disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Trash2 className="h-3.5 w-3.5 text-white" />
                <span>{busy === 'clear' ? 'Clearing…' : 'Clear all'}</span>
              </button>
            </div>
          </div>

          {/* Filter Pills Row */}
          <div className="flex items-center gap-2 sm:gap-2.5 overflow-x-auto pb-1">
            {CATEGORY_TABS.map(({ key, label, icon: TabIcon }) => {
              const isActive = tab === key;
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => selectTab(key)}
                  className={`px-4 py-2 rounded-md text-xs font-medium flex items-center gap-2 whitespace-nowrap transition-all cursor-pointer shadow-2xs ${
                    isActive
                      ? 'bg-nk-maroon text-white border border-nk-maroon shadow-xs'
                      : 'bg-white text-[#4A3D36] border border-nk-line-gold hover:border-[#C4B2A0] hover:bg-nk-paper'
                  }`}
                >
                  <TabIcon className="h-3.5 w-3.5" />
                  <span>{label}</span>
                </button>
              );
            })}
          </div>

          {/* Status Message notice */}
          {notice && (
            <div className="rounded-2xl border border-amber-200 bg-amber-50/90 p-4 text-xs sm:text-sm text-amber-900">
              {notice}
            </div>
          )}

          {/* Error Message */}
          {error && (
            <div className="rounded-2xl border border-red-200 bg-red-50/90 p-4 text-xs sm:text-sm font-medium text-nk-maroon">
              {error}
            </div>
          )}

          {/* Empty State Card matching the reference design */}
          {notifications && notifications.length === 0 && (
            <div className="bg-white rounded-2xl sm:rounded-3xl border border-nk-line-gold/80 p-12 sm:p-16 shadow-[0_4px_24px_-4px_rgba(43,21,21,0.05)] flex flex-col items-center justify-center text-center w-full min-h-[300px]">
              {/* Emblem with delicate burst/sparkle doodle around bell */}
              <div className="relative mb-5 flex items-center justify-center">
                <svg
                  viewBox="0 0 120 120"
                  className="absolute -inset-4 w-28 h-28 text-[#F4C4B8]/60 pointer-events-none"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                >
                  <line x1="60" y1="12" x2="60" y2="18" strokeLinecap="round" />
                  <line x1="88" y1="28" x2="82" y2="34" strokeLinecap="round" />
                  <line x1="98" y1="52" x2="92" y2="52" strokeLinecap="round" />
                  <line x1="32" y1="28" x2="38" y2="34" strokeLinecap="round" />
                  <line x1="22" y1="52" x2="28" y2="52" strokeLinecap="round" />
                  <path
                    d="M86 68 C83 65 79 66 79 69 C79 73 86 77 86 77 C86 77 93 73 93 69 C93 66 89 65 86 68 Z"
                    fill="#F4C4B8"
                    fillOpacity="0.4"
                  />
                  <path
                    d="M34 68 C31 65 27 66 27 69 C27 73 34 77 34 77 C34 77 41 73 41 69 C41 66 37 65 34 68 Z"
                    fill="#F4C4B8"
                    fillOpacity="0.4"
                  />
                  <circle cx="36" cy="38" r="1.2" fill="#F4C4B8" />
                  <circle cx="84" cy="38" r="1.2" fill="#F4C4B8" />
                </svg>

                <div className="h-16 w-16 sm:h-20 sm:w-20 rounded-full bg-[#FFF5F5] border border-[#FADBD8] flex items-center justify-center shadow-xs">
                  <Bell className="h-7 w-7 sm:h-8 sm:w-8 text-nk-maroon" />
                </div>
              </div>

              <h2 className="text-base sm:text-lg font-bold text-nk-ink font-[family-name:var(--font-heading,serif)]">
                {tab === 'unread' ? 'No unread notifications.' : tab === 'all' ? 'No notifications yet.' : 'Nothing here yet.'}
              </h2>
              <p className="text-xs sm:text-sm text-nk-muted mt-1.5 max-w-sm">
                We&apos;ll let you know when something new arrives.
              </p>
            </div>
          )}

          {/* List of Notifications (when items exist) */}
          {notifications && notifications.length > 0 && (
            <div className="flex flex-col gap-3">
              {notifications.map((notification) => {
                const style = TYPE_STYLE[notification.type] ?? SYSTEM_STYLE;
                const IconComponent = style.icon;
                const time = formatRelativeTime(notification.createdAt);
                const fullDate = new Date(notification.createdAt).toLocaleString();
                return (
                  <div
                    key={notification.id}
                    role="button"
                    tabIndex={0}
                    aria-label={`${notification.isRead ? '' : 'Unread: '}${notification.message}`}
                    onClick={() => void handleOpen(notification)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        void handleOpen(notification);
                      }
                    }}
                    className={`bg-white rounded-2xl border border-nk-line-soft hover:border-nk-line-strong p-4 flex items-center gap-3.5 sm:gap-4 transition-all shadow-2xs hover:shadow-xs cursor-pointer ${
                      notification.isRead ? '' : 'bg-[#FFFDFB] border-[#FADBD8]'
                    }`}
                  >
                    {/* Category Icon */}
                    <span
                      title={style.label}
                      className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${style.className}`}
                    >
                      <IconComponent className="h-5 w-5" />
                    </span>

                    {/* Actor Photo */}
                    <span className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-full border border-nk-line-gold bg-nk-paper text-nk-muted">
                      {notification.actor.photoUrl ? (
                        <img
                          src={notification.actor.photoUrl}
                          alt=""
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <UserIcon className="h-5 w-5 text-[#A88C78]" />
                      )}
                    </span>

                    {/* Text Details */}
                    <div className="min-w-0 flex-1">
                      <p className={`text-xs sm:text-sm ${notification.isRead ? 'text-nk-muted' : 'text-nk-ink font-medium'}`}>
                        <MessageText notification={notification} />
                      </p>
                      <p className="mt-0.5 truncate text-[11px] sm:text-xs text-nk-subtle">
                        {notification.actor.name} ·{' '}
                        <time dateTime={notification.createdAt} title={fullDate}>
                          {time}
                        </time>
                      </p>
                    </div>

                    {/* Right side relative time & unread indicator */}
                    <div className="flex shrink-0 items-center gap-2.5">
                      <time dateTime={notification.createdAt} title={fullDate} className="hidden text-xs text-nk-subtle sm:inline">
                        {time}
                      </time>
                      {!notification.isRead && (
                        <span className="h-2.5 w-2.5 rounded-full bg-nk-maroon" aria-label="Unread" />
                      )}
                      <ChevronRight className="h-4 w-4 text-nk-subtle" />
                    </div>
                  </div>
                );
              })}

              {list?.nextOffset !== null && list?.nextOffset !== undefined && (
                <button
                  type="button"
                  disabled={loadingMore}
                  onClick={() => void handleLoadMore()}
                  className="self-center px-5 py-2 mt-2 rounded-md border border-nk-line-strong bg-white text-xs font-semibold text-[#4A3D36] hover:bg-nk-paper transition-colors cursor-pointer"
                >
                  {loadingMore ? 'Loading…' : 'Load more'}
                </button>
              )}
            </div>
          )}
        </div>
      </main>
    </>
  );
}
