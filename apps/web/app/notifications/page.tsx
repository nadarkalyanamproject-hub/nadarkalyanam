'use client';

import { useEffect, useState, type ReactNode, type SVGProps } from 'react';
import { useRouter } from 'next/navigation';
import type { NotificationCategory, NotificationResponse } from '@nadar-kalyanam/schemas';
import { Button, Card } from '@nadar-kalyanam/ui';
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

type IconProps = SVGProps<SVGSVGElement>;
const svg = (props: IconProps, children: ReactNode) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>
    {children}
  </svg>
);
const EyeIcon = (p: IconProps) => svg(p, <><path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12Z" /><circle cx="12" cy="12" r="3" /></>);
const StarIcon = (p: IconProps) => svg(p, <path d="m12 3 2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9L12 3Z" />);
const HeartIcon = (p: IconProps) =>
  svg({ ...p, fill: 'currentColor', stroke: 'none' }, <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />);
const ChatIcon = (p: IconProps) => svg(p, <path d="M4 5.5h16a1 1 0 0 1 1 1V15a1 1 0 0 1-1 1H9l-4.5 3.5V16H4a1 1 0 0 1-1-1V6.5a1 1 0 0 1 1-1Z" />);
const BellIcon = (p: IconProps) => svg(p, <><path d="M6 9.5a6 6 0 0 1 12 0c0 4 1.5 5.5 1.5 5.5h-15S6 13.5 6 9.5Z" /><path d="M10 18a2 2 0 0 0 4 0" /></>);
const ChevronIcon = (p: IconProps) => svg(p, <path d="m9 6 6 6-6 6" />);

// The coloured circle per type — colours already used across the app
// (primary maroon, the amber/green used on member cards), nothing new.
const TYPE_STYLE: Record<string, { icon: (p: IconProps) => ReactNode; className: string; label: string }> = {
  PROFILE_VIEWED: { icon: EyeIcon, className: 'bg-[#FEF3C7] text-[#B45309]', label: 'Profile view' },
  INTEREST_RECEIVED: { icon: StarIcon, className: 'bg-primary/10 text-primary', label: 'Interest received' },
  INTEREST_ACCEPTED: { icon: HeartIcon, className: 'bg-[#F0FDF4] text-[#16A34A]', label: 'Interest accepted' },
  NEW_MESSAGE: { icon: ChatIcon, className: 'bg-accent/15 text-[#92400E]', label: 'Message' },
};
const SYSTEM_STYLE = { icon: BellIcon, className: 'bg-muted text-muted-foreground', label: 'Account update' };

const TABS: { key: NotificationCategory; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'unread', label: 'Unread' },
  { key: 'profile', label: 'Profile' },
  { key: 'interests', label: 'Interests' },
];

const PAGE_SIZE = 20;

interface ListState {
  items: NotificationResponse[];
  total: number;
  unreadCount: number;
  nextOffset: number | null;
}

// "Priya Soundararajan sent you an interest" -> bold name + the rest. System
// notices (no member actor) don't start with the name and render as-is.
function MessageText({ notification }: { notification: NotificationResponse }) {
  const { message, actor } = notification;
  if (actor.name && message.startsWith(actor.name)) {
    return (
      <>
        <span className="font-bold text-foreground">{actor.name}</span>
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

  // (Re)load whenever the tab changes — in place, no page reload.
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

  // Unchanged behaviour: mark read, then go where the notification points
  // (or explain why it can't open).
  async function handleOpen(notification: NotificationResponse) {
    if (!data.accessToken) return;
    setNotice(null);
    if (!notification.isRead) {
      markLocallyRead(notification.id);
      try {
        await markNotificationRead(data.accessToken, notification.id);
      } catch {
        // Best-effort; the next list load reconciles the true state.
      }
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
      setList({ ...list, unreadCount: 0, items: tab === 'unread' ? [] : list.items.map((n) => ({ ...n, isRead: true })) });
      announceNotificationsChanged();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not mark notifications as read.');
    } finally {
      setBusy(null);
    }
  }

  // Permanent: deletes every notification the member has (all tabs).
  async function handleClearAll() {
    if (!data.accessToken) return;
    const ok = window.confirm(
      'Clear all notifications?\n\nThis permanently deletes every notification (on every tab). It cannot be undone.',
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
      const more = await listNotifications(data.accessToken, { category: tab, offset: list.nextOffset, limit: PAGE_SIZE });
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

  return (
    <>
      <AppHeader />
      <main className="min-h-screen bg-secondary px-4 py-6 sm:px-6 sm:py-8 lg:px-8 xl:px-12 2xl:px-16">
        <div className="mx-auto flex w-full max-w-4xl flex-col gap-5">
          {/* Title + unread badge, and the two actions */}
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h1 className="flex items-center gap-2 text-2xl font-bold text-foreground">
                Notifications
                {unread > 0 && (
                  <span
                    aria-label={`${unread} unread`}
                    data-testid="page-unread-badge"
                    className="inline-flex h-6 min-w-6 items-center justify-center rounded-full bg-destructive px-1.5 text-xs font-bold text-destructive-foreground"
                  >
                    {unread > 99 ? '99+' : unread}
                  </span>
                )}
              </h1>
              <p className="mt-1 text-sm text-muted-foreground">
                {unread > 0 ? 'Stay up to date with who’s interested in you.' : 'You’re all caught up.'}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={busy !== null || unread === 0}
                onClick={() => void handleMarkAll()}
              >
                {busy === 'mark' ? 'Marking…' : 'Mark all as read'}
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="border-destructive/40 text-destructive hover:bg-destructive/10"
                disabled={busy !== null || (list !== null && list.total === 0 && tab === 'all')}
                onClick={() => void handleClearAll()}
              >
                {busy === 'clear' ? 'Clearing…' : 'Clear all'}
              </Button>
            </div>
          </div>

          {/* Tabs (scroll sideways on narrow screens) */}
          <div role="tablist" aria-label="Filter notifications" className="-mx-1 flex gap-1 overflow-x-auto border-b border-border px-1">
            {TABS.map((t) => (
              <button
                key={t.key}
                type="button"
                role="tab"
                aria-selected={tab === t.key}
                onClick={() => selectTab(t.key)}
                className={`shrink-0 whitespace-nowrap px-3 py-2 text-sm font-semibold transition-colors ${
                  tab === t.key ? 'border-b-2 border-primary text-primary' : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {t.label}
                {t.key === 'unread' && list ? ` (${unread})` : ''}
              </button>
            ))}
          </div>

          {notice && (
            <Card role="status" className="rounded-2xl border-primary/30 bg-primary/5 p-4 text-sm text-primary">
              {notice}
            </Card>
          )}

          {!notifications && !error && (
            <Card className="rounded-2xl p-8 text-center text-sm text-muted-foreground">Loading notifications…</Card>
          )}

          {error && <Card className="rounded-2xl p-8 text-center text-sm text-destructive">{error}</Card>}

          {notifications && notifications.length === 0 && (
            <Card className="rounded-2xl p-8 text-center text-sm text-muted-foreground">
              {tab === 'unread' ? (
                'No unread notifications.'
              ) : tab === 'all' ? (
                'No notifications yet.'
              ) : (
                'Nothing here yet.'
              )}
            </Card>
          )}

          {notifications && notifications.length > 0 && (
            <div className="flex flex-col gap-2.5">
              {notifications.map((notification) => {
                const style = TYPE_STYLE[notification.type] ?? SYSTEM_STYLE;
                const Icon = style.icon;
                const time = formatRelativeTime(notification.createdAt);
                const fullDate = new Date(notification.createdAt).toLocaleString();
                return (
                  <Card
                    key={notification.id}
                    role="button"
                    tabIndex={0}
                    aria-label={`${notification.isRead ? '' : 'Unread: '}${notification.message}`}
                    data-type={notification.type}
                    data-unread={!notification.isRead || undefined}
                    onClick={() => void handleOpen(notification)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        void handleOpen(notification);
                      }
                    }}
                    className={`flex cursor-pointer items-center gap-3 rounded-2xl p-3 transition-colors hover:bg-muted/40 sm:gap-4 sm:p-4 ${
                      notification.isRead ? '' : 'bg-primary/[0.03]'
                    }`}
                  >
                    <span
                      title={style.label}
                      className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${style.className}`}
                      data-testid="type-icon"
                    >
                      <Icon className="h-5 w-5" />
                    </span>
                    <span className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-full border border-border bg-muted text-muted-foreground">
                      {notification.actor.photoUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={notification.actor.photoUrl} alt="" className="h-full w-full object-cover" />
                      ) : (
                        <UserIcon className="h-5 w-5" />
                      )}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className={`text-sm ${notification.isRead ? 'text-muted-foreground' : 'text-foreground'}`}>
                        <MessageText notification={notification} />
                      </p>
                      <p className="mt-0.5 truncate text-xs text-muted-foreground">
                        {notification.actor.name} ·{' '}
                        <time dateTime={notification.createdAt} title={fullDate}>
                          {time}
                        </time>
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <time dateTime={notification.createdAt} title={fullDate} className="hidden text-xs text-muted-foreground sm:inline">
                        {time}
                      </time>
                      {!notification.isRead && (
                        <span className="h-2.5 w-2.5 rounded-full bg-destructive" aria-label="Unread" data-testid="unread-dot" />
                      )}
                      <ChevronIcon className="h-4 w-4 text-muted-foreground" />
                    </div>
                  </Card>
                );
              })}
              {list?.nextOffset !== null && list?.nextOffset !== undefined && (
                <Button
                  type="button"
                  variant="outline"
                  className="self-center"
                  disabled={loadingMore}
                  onClick={() => void handleLoadMore()}
                >
                  {loadingMore ? 'Loading…' : 'Load more'}
                </Button>
              )}
            </div>
          )}
        </div>
      </main>
    </>
  );
}
