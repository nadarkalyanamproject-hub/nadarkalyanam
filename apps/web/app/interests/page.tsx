'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import type { Connection, InterestResponse, ListInterestsResponse } from '@nadar-kalyanam/schemas';
import { Button, Card } from '@nadar-kalyanam/ui';
import { AppHeader, UserIcon } from '../../components/app-header';
import { ConnectedBadge } from '../../components/relationship/relationship-action';
import {
  ApiError,
  acceptInterest,
  declineInterest,
  listConnections,
  listInterests,
  markInterestsViewed,
} from '../../lib/api-client';
import { announceInterestsChanged, announceNotificationsChanged } from '../../lib/notifications';
import { useRegistration } from '../providers/registration-provider';
import { useRequireAuth } from '../../lib/use-require-auth';

type Tab = 'received' | 'sent' | 'connected';

const CONNECTIONS_PAGE_SIZE = 20;

interface ConnectionsState {
  items: Connection[];
  total: number;
  nextOffset: number | null;
}

const STATUS_LABELS: Record<string, string> = {
  PENDING: 'Pending',
  ACCEPTED: 'Accepted',
  DECLINED: 'Declined',
  WITHDRAWN: 'Withdrawn',
};

export default function InterestsPage() {
  const { ready } = useRequireAuth();
  const { data } = useRegistration();
  const [tab, setTab] = useState<Tab>('received');
  const [interests, setInterests] = useState<ListInterestsResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<Record<string, string>>({});
  const [actingOn, setActingOn] = useState<string | null>(null);
  const [connections, setConnections] = useState<ConnectionsState | null>(null);
  const [connectionsError, setConnectionsError] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!ready || !data.accessToken) return;
    let cancelled = false;
    listInterests(data.accessToken)
      .then((result) => {
        if (!cancelled) setInterests(result);
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setError(err instanceof ApiError ? err.message : 'Could not load interests. Please try again.');
        }
      });
    // Opening this page counts as having seen everything pending right now:
    // record it, then let the header drop its Interests dot immediately.
    markInterestsViewed(data.accessToken)
      .then(() => announceInterestsChanged())
      .catch(() => {
        // Best-effort; the dot just stays until the next visit.
      });
    listConnections(data.accessToken, { limit: CONNECTIONS_PAGE_SIZE })
      .then((result) => {
        if (!cancelled) setConnections(result);
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setConnectionsError(
            err instanceof ApiError ? err.message : 'Could not load your connections. Please try again.',
          );
        }
      });
    return () => {
      cancelled = true;
    };
  }, [ready, data.accessToken]);

  async function loadMoreConnections() {
    if (!data.accessToken || !connections || connections.nextOffset === null) return;
    setLoadingMore(true);
    try {
      const more = await listConnections(data.accessToken, {
        offset: connections.nextOffset,
        limit: CONNECTIONS_PAGE_SIZE,
      });
      setConnections((prev) =>
        prev ? { items: [...prev.items, ...more.items], total: more.total, nextOffset: more.nextOffset } : more,
      );
    } catch (err) {
      setConnectionsError(err instanceof ApiError ? err.message : 'Could not load more connections.');
    } finally {
      setLoadingMore(false);
    }
  }

  function updateReceived(id: string, status: InterestResponse['status']) {
    setInterests((prev) =>
      prev
        ? {
            ...prev,
            received: prev.received.map((interest) =>
              interest.id === id ? { ...interest, status } : interest,
            ),
          }
        : prev,
    );
  }

  // Accepting connects the pair: the entry leaves Received and appears at
  // the top of Connected right away (no reload). The connections list is
  // then refetched quietly so the new entry gains the fields the interest
  // row doesn't carry (location, connectedAt from the server).
  async function handleAccept(id: string) {
    const interest = interests?.received.find((item) => item.id === id);
    setActingOn(id);
    setSuccessMessage(null);
    setActionError((prev) => ({ ...prev, [id]: '' }));
    try {
      const accepted = await acceptInterest(data.accessToken!, id);
      // Accepting also marked this interest's notification read (server
      // side) — refresh the header's Notifications badge now.
      announceNotificationsChanged();
      setInterests((prev) => (prev ? { ...prev, received: prev.received.filter((item) => item.id !== id) } : prev));
      if (interest) {
        const party = interest.sender;
        const optimistic: Connection = {
          id: party.profileId,
          fullName: party.fullName,
          age: party.age,
          primaryPhotoUrl: party.primaryPhotoUrl,
          // Filled in by the refetch below; the interest row has no location.
          gender: 'OTHER',
          location: { city: '', state: '' },
          religion: '',
          profession: '',
          maritalStatus: 'NEVER_MARRIED',
          hasSentInterest: true,
          relationshipStatus: 'CONNECTED',
          conversationId: accepted.conversationId,
          connectedAt: new Date().toISOString(),
        };
        setConnections((prev) =>
          prev
            ? { ...prev, items: [optimistic, ...prev.items], total: prev.total + 1 }
            : { items: [optimistic], total: 1, nextOffset: null },
        );
        setSuccessMessage(`You're now connected with ${party.fullName}. Find them under Connected.`);
      } else {
        setSuccessMessage("Interest accepted — you're now connected.");
      }
      listConnections(data.accessToken!, { limit: CONNECTIONS_PAGE_SIZE })
        .then(setConnections)
        .catch(() => {
          // Keep the optimistic entry; the next page load will correct it.
        });
    } catch (err) {
      setActionError((prev) => ({
        ...prev,
        [id]: err instanceof ApiError ? err.message : 'Could not accept this interest. Please try again.',
      }));
    } finally {
      setActingOn(null);
    }
  }

  async function handleDecline(id: string) {
    setActingOn(id);
    setActionError((prev) => ({ ...prev, [id]: '' }));
    try {
      await declineInterest(data.accessToken!, id);
      updateReceived(id, 'DECLINED');
    } catch (err) {
      setActionError((prev) => ({
        ...prev,
        [id]: err instanceof ApiError ? err.message : 'Could not decline this interest. Please try again.',
      }));
    } finally {
      setActingOn(null);
    }
  }

  if (!ready) return null;

  const list = tab === 'received' ? interests?.received : tab === 'sent' ? interests?.sent : undefined;

  return (
    <>
      <AppHeader />
      <main className="min-h-screen bg-secondary px-4 py-6 sm:px-6 sm:py-8 lg:px-8 xl:px-12 2xl:px-16">
        <div className="w-full flex flex-col gap-6">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Interests</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Interests you&apos;ve received and sent.
            </p>
          </div>

          <div className="flex gap-2 border-b border-border">
            <button
              type="button"
              onClick={() => setTab('received')}
              className={`px-4 py-2 text-sm font-semibold transition-colors ${
                tab === 'received'
                  ? 'border-b-2 border-primary text-primary'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              Received{interests ? ` (${interests.received.length})` : ''}
            </button>
            <button
              type="button"
              onClick={() => setTab('sent')}
              className={`px-4 py-2 text-sm font-semibold transition-colors ${
                tab === 'sent'
                  ? 'border-b-2 border-primary text-primary'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              Sent{interests ? ` (${interests.sent.length})` : ''}
            </button>
            <button
              type="button"
              onClick={() => setTab('connected')}
              className={`px-4 py-2 text-sm font-semibold transition-colors ${
                tab === 'connected'
                  ? 'border-b-2 border-primary text-primary'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              Connected{connections ? ` (${connections.total})` : ''}
            </button>
          </div>

          {successMessage && (
            <Card className="rounded-2xl border-primary/30 bg-primary/5 p-4 text-sm font-medium text-primary">
              {successMessage}
            </Card>
          )}

          {tab !== 'connected' && !interests && !error && (
            <Card className="rounded-2xl p-8 text-center text-sm text-muted-foreground">
              Loading interests…
            </Card>
          )}

          {tab !== 'connected' && error && (
            <Card className="rounded-2xl p-8 text-center text-sm text-destructive">{error}</Card>
          )}

          {tab === 'connected' && !connections && !connectionsError && (
            <Card className="rounded-2xl p-8 text-center text-sm text-muted-foreground">
              Loading connections…
            </Card>
          )}

          {tab === 'connected' && connectionsError && (
            <Card className="rounded-2xl p-8 text-center text-sm text-destructive">{connectionsError}</Card>
          )}

          {tab === 'connected' && connections && connections.items.length === 0 && (
            <Card className="rounded-2xl p-8 text-center text-sm text-muted-foreground">No connections yet.</Card>
          )}

          {tab === 'connected' && connections && connections.items.length > 0 && (
            <div className="flex flex-col gap-4">
              {connections.items.map((connection) => (
                <Card key={connection.id} className="flex items-center gap-4 rounded-2xl p-4">
                  <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-full border border-border bg-muted text-muted-foreground">
                    {connection.primaryPhotoUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={connection.primaryPhotoUrl} alt="" className="h-full w-full object-cover" />
                    ) : (
                      <UserIcon className="h-7 w-7" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-bold text-foreground">
                      {connection.fullName}, {connection.age}
                    </p>
                    {connection.location.city && (
                      <p className="mt-0.5 truncate text-xs text-muted-foreground">
                        {connection.location.city}, {connection.location.state}
                      </p>
                    )}
                    <div className="mt-1 flex items-center gap-2">
                      <ConnectedBadge />
                      <span className="text-[11px] text-muted-foreground">
                        since {new Date(connection.connectedAt).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                  <Link href={`/messages/${connection.conversationId}`} className="shrink-0">
                    <Button type="button" size="sm">
                      Message
                    </Button>
                  </Link>
                </Card>
              ))}
              {connections.nextOffset !== null && (
                <Button
                  type="button"
                  variant="outline"
                  className="self-center"
                  disabled={loadingMore}
                  onClick={() => void loadMoreConnections()}
                >
                  {loadingMore ? 'Loading…' : 'Load more'}
                </Button>
              )}
            </div>
          )}

          {list && list.length === 0 && (
            <Card className="rounded-2xl p-8 text-center text-sm text-muted-foreground">
              {tab === 'received' ? 'No interests received yet.' : "You haven't sent any interests yet."}
            </Card>
          )}

          {list && list.length > 0 && (
            <div className="flex flex-col gap-4">
              {list.map((interest) => {
                const party = tab === 'received' ? interest.sender : interest.target;
                return (
                  <Card key={interest.id} className="flex items-center gap-4 rounded-2xl p-4">
                    <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-full border border-border bg-muted text-muted-foreground">
                      {party.primaryPhotoUrl ? (
                        // Uploaded photos live in MinIO, an arbitrary external
                        // origin not registered with next/image — a plain
                        // <img> is the simplest correct option here.
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={party.primaryPhotoUrl} alt="" className="h-full w-full object-cover" />
                      ) : (
                        <UserIcon className="h-7 w-7" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-bold text-foreground">
                        {party.fullName}, {party.age}
                      </p>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {STATUS_LABELS[interest.status] ?? interest.status}
                      </p>
                      {actionError[interest.id] ? (
                        <p className="mt-1 text-xs text-destructive">{actionError[interest.id]}</p>
                      ) : null}
                    </div>
                    {tab === 'received' && interest.status === 'PENDING' ? (
                      <div className="flex shrink-0 gap-2">
                        <Button
                          type="button"
                          size="sm"
                          disabled={actingOn === interest.id}
                          onClick={() => void handleAccept(interest.id)}
                        >
                          Accept
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          disabled={actingOn === interest.id}
                          onClick={() => void handleDecline(interest.id)}
                        >
                          Decline
                        </Button>
                      </div>
                    ) : null}
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      </main>
    </>
  );
}
