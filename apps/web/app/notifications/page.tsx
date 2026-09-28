'use client';

import { useEffect, useState, type SVGProps } from 'react';
import { useRouter } from 'next/navigation';
import type { NotificationResponse } from '@nadar-kalyanam/schemas';
import { Button, Card } from '@nadar-kalyanam/ui';
import { AppHeader } from '../../components/app-header';
import {
  ApiError,
  listNotifications,
  markAllNotificationsRead,
  markNotificationRead,
} from '../../lib/api-client';
import { announceNotificationsChanged, formatRelativeTime, notificationDestination } from '../../lib/notifications';
import { useRegistration } from '../providers/registration-provider';
import { useRequireAuth } from '../../lib/use-require-auth';

function BellIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M6 9.5a6 6 0 0 1 12 0c0 4 1.5 5.5 1.5 5.5h-15S6 13.5 6 9.5Z" />
      <path d="M10 18a2 2 0 0 0 4 0" />
    </svg>
  );
}

const PAGE_SIZE = 20;

interface ListState {
  items: NotificationResponse[];
  total: number;
  unreadCount: number;
  nextOffset: number | null;
}

export default function NotificationsPage() {
  const { ready } = useRequireAuth();
  const { data } = useRegistration();
  const router = useRouter();
  const [list, setList] = useState<ListState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [markingAll, setMarkingAll] = useState(false);

  useEffect(() => {
    if (!ready || !data.accessToken) return;
    let cancelled = false;
    listNotifications(data.accessToken, { limit: PAGE_SIZE })
      .then((result) => {
        if (!cancelled) setList(result);
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setError(err instanceof ApiError ? err.message : 'Could not load notifications. Please try again.');
        }
      });
    return () => {
      cancelled = true;
    };
  }, [ready, data.accessToken]);

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

  // Mark read first (awaited, so the header badge and the next visit agree),
  // then go where the notification points — or explain why we can't.
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
    if (destination.kind === 'navigate') {
      router.push(destination.href);
    } else {
      setNotice(destination.message);
    }
  }

  async function handleMarkAll() {
    if (!data.accessToken || !list) return;
    setMarkingAll(true);
    try {
      await markAllNotificationsRead(data.accessToken);
      setList({ ...list, unreadCount: 0, items: list.items.map((n) => ({ ...n, isRead: true })) });
      announceNotificationsChanged();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not mark notifications as read.');
    } finally {
      setMarkingAll(false);
    }
  }

  async function handleLoadMore() {
    if (!data.accessToken || !list || list.nextOffset === null) return;
    setLoadingMore(true);
    try {
      const more = await listNotifications(data.accessToken, { offset: list.nextOffset, limit: PAGE_SIZE });
      setList({ ...more, items: [...list.items, ...more.items] });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not load more notifications.');
    } finally {
      setLoadingMore(false);
    }
  }

  if (!ready) return null;

  const notifications = list?.items ?? null;

  return (
    <>
      <AppHeader />
      <main className="min-h-screen bg-secondary px-4 py-6 sm:px-6 sm:py-8 lg:px-8 xl:px-12 2xl:px-16">
        <div className="w-full flex flex-col gap-6">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h1 className="text-2xl font-bold text-foreground">Notifications</h1>
              {list && (
                <p className="mt-1 text-sm text-muted-foreground">
                  {list.unreadCount > 0 ? `${list.unreadCount} unread` : 'You’re all caught up.'}
                </p>
              )}
            </div>
            {list && list.unreadCount > 0 && (
              <Button type="button" variant="outline" size="sm" disabled={markingAll} onClick={() => void handleMarkAll()}>
                {markingAll ? 'Marking…' : 'Mark all as read'}
              </Button>
            )}
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
            <Card className="rounded-2xl p-8 text-center text-sm text-muted-foreground">No notifications yet.</Card>
          )}

          {notifications && notifications.length > 0 && (
            <div className="flex flex-col gap-3">
              {notifications.map((notification) => (
                <Card
                  key={notification.id}
                  role="button"
                  tabIndex={0}
                  aria-label={`${notification.isRead ? '' : 'Unread: '}${notification.message}`}
                  data-unread={!notification.isRead || undefined}
                  onClick={() => void handleOpen(notification)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      void handleOpen(notification);
                    }
                  }}
                  className={`flex cursor-pointer items-center gap-4 rounded-2xl p-4 transition-colors hover:bg-muted/40 ${
                    notification.isRead ? '' : 'border-l-4 border-l-primary bg-secondary/60'
                  }`}
                >
                  <div
                    className={`flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full ${
                      notification.isRead ? 'bg-muted text-muted-foreground' : 'bg-primary text-primary-foreground'
                    }`}
                  >
                    {notification.actor.photoUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={notification.actor.photoUrl} alt="" className="h-full w-full object-cover" />
                    ) : (
                      <BellIcon className="h-5 w-5" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p
                      className={`text-sm ${
                        notification.isRead ? 'text-muted-foreground' : 'font-semibold text-foreground'
                      }`}
                    >
                      {notification.message}
                    </p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      <span className="font-medium">{notification.actor.name}</span>
                      {' · '}
                      <time dateTime={notification.createdAt} title={new Date(notification.createdAt).toLocaleString()}>
                        {formatRelativeTime(notification.createdAt)}
                      </time>
                    </p>
                  </div>
                  {!notification.isRead && (
                    <span className="h-2 w-2 shrink-0 rounded-full bg-primary" aria-label="Unread" />
                  )}
                </Card>
              ))}
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
