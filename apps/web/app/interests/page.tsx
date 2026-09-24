'use client';

import { useEffect, useState } from 'react';
import type { InterestResponse, ListInterestsResponse } from '@nadar-kalyanam/schemas';
import { Button, Card } from '@nadar-kalyanam/ui';
import { AppHeader, UserIcon } from '../../components/app-header';
import { ApiError, acceptInterest, declineInterest, listInterests } from '../../lib/api-client';
import { useRegistration } from '../providers/registration-provider';
import { useRequireAuth } from '../../lib/use-require-auth';

type Tab = 'received' | 'sent';

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
    return () => {
      cancelled = true;
    };
  }, [ready, data.accessToken]);

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

  async function handleAccept(id: string) {
    setActingOn(id);
    setActionError((prev) => ({ ...prev, [id]: '' }));
    try {
      await acceptInterest(data.accessToken!, id);
      updateReceived(id, 'ACCEPTED');
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

  const list = tab === 'received' ? interests?.received : interests?.sent;

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
          </div>

          {!interests && !error && (
            <Card className="rounded-2xl p-8 text-center text-sm text-muted-foreground">
              Loading interests…
            </Card>
          )}

          {error && (
            <Card className="rounded-2xl p-8 text-center text-sm text-destructive">{error}</Card>
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
