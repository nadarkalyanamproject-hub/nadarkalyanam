'use client';

import { useEffect, useState, type SVGProps } from 'react';
import type { NotificationResponse } from '@nadar-kalyanam/schemas';
import { Card } from '@nadar-kalyanam/ui';
import { AppHeader } from '../../components/app-header';
import { ApiError, listNotifications, markNotificationRead } from '../../lib/api-client';
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

const TYPE_LABELS: Record<string, string> = {
  'message.new': 'New message',
  'interest.received': 'New interest',
  'interest.accepted': 'Interest accepted',
  'payment.confirmed': 'Payment confirmed',
  'verification.status': 'Verification update',
};

export default function NotificationsPage() {
  const { ready } = useRequireAuth();
  const { data } = useRegistration();
  const [notifications, setNotifications] = useState<NotificationResponse[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!ready || !data.accessToken) return;
    let cancelled = false;
    listNotifications(data.accessToken)
      .then((result) => {
        if (!cancelled) setNotifications(result.items);
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

  async function handleMarkRead(id: string) {
    if (!data.accessToken) return;
    // Optimistic — a notification failing to persist as read is low-stakes
    // enough not to need a rollback/error state here.
    setNotifications((prev) => prev?.map((n) => (n.id === id ? { ...n, read: true } : n)) ?? prev);
    try {
      await markNotificationRead(data.accessToken, id);
    } catch {
      // Best-effort; next full list load will reconcile the true state.
    }
  }

  if (!ready) return null;

  return (
    <>
      <AppHeader />
      <main className="min-h-screen bg-secondary px-4 py-6 sm:px-6 sm:py-8 lg:px-8 xl:px-12 2xl:px-16">
        <div className="w-full flex flex-col gap-6">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Notifications</h1>
          </div>

          {!notifications && !error && (
            <Card className="rounded-2xl p-8 text-center text-sm text-muted-foreground">Loading…</Card>
          )}

          {error && (
            <Card className="rounded-2xl p-8 text-center text-sm text-destructive">{error}</Card>
          )}

          {notifications && notifications.length === 0 && (
            <Card className="rounded-2xl p-8 text-center text-sm text-muted-foreground">
              You&apos;re all caught up — no notifications yet.
            </Card>
          )}

          {notifications && notifications.length > 0 && (
            <div className="flex flex-col gap-3">
              {notifications.map((notification) => (
                <Card
                  key={notification.id}
                  role={notification.read ? undefined : 'button'}
                  tabIndex={notification.read ? undefined : 0}
                  onClick={() => !notification.read && void handleMarkRead(notification.id)}
                  className={`flex items-center gap-4 rounded-2xl p-4 transition-colors ${
                    notification.read ? '' : 'cursor-pointer border-l-4 border-l-primary bg-secondary/60'
                  }`}
                >
                  <div
                    className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${
                      notification.read ? 'bg-muted text-muted-foreground' : 'bg-primary text-primary-foreground'
                    }`}
                  >
                    <BellIcon className="h-5 w-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className={`text-sm font-semibold ${notification.read ? 'text-muted-foreground' : 'text-foreground'}`}>
                      {TYPE_LABELS[notification.type] ?? notification.type}
                    </p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {new Date(notification.createdAt).toLocaleString()}
                    </p>
                  </div>
                  {!notification.read && (
                    <span className="h-2 w-2 shrink-0 rounded-full bg-primary" aria-label="Unread" />
                  )}
                </Card>
              ))}
            </div>
          )}
        </div>
      </main>
    </>
  );
}
