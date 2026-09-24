'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import type { ConversationSummary } from '@nadar-kalyanam/schemas';
import { Card } from '@nadar-kalyanam/ui';
import { AppHeader, UserIcon } from '../../components/app-header';
import { ApiError, listConversations } from '../../lib/api-client';
import { useRegistration } from '../providers/registration-provider';
import { useRequireAuth } from '../../lib/use-require-auth';

function formatTimestamp(iso: string): string {
  const date = new Date(iso);
  return date.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}

export default function MessagesPage() {
  const { ready } = useRequireAuth();
  const { data } = useRegistration();
  const [conversations, setConversations] = useState<ConversationSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!ready || !data.accessToken) return;
    let cancelled = false;
    listConversations(data.accessToken)
      .then((result) => {
        if (!cancelled) setConversations(result.items);
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setError(err instanceof ApiError ? err.message : 'Could not load conversations. Please try again.');
        }
      });
    return () => {
      cancelled = true;
    };
  }, [ready, data.accessToken]);

  if (!ready) return null;

  return (
    <>
      <AppHeader />
      <main className="min-h-screen bg-secondary px-4 py-6 sm:px-6 sm:py-8 lg:px-8 xl:px-12 2xl:px-16">
        <div className="w-full flex flex-col gap-6">
          <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold text-foreground">Messages</h1>
              <p className="mt-1 text-sm text-muted-foreground">
                Conversations that started once an interest was accepted.
              </p>
            </div>
            {conversations && conversations.length > 0 && (
              <span className="text-xs font-semibold text-muted-foreground">
                {conversations.length} conversation{conversations.length === 1 ? '' : 's'}
              </span>
            )}
          </div>

          {!conversations && !error && (
            <Card className="rounded-2xl p-8 sm:p-12 text-center text-sm text-muted-foreground">
              Loading conversations…
            </Card>
          )}

          {error && (
            <Card className="rounded-2xl p-8 sm:p-12 text-center text-sm text-destructive">{error}</Card>
          )}

          {conversations && conversations.length === 0 && (
            <Card className="flex flex-col items-center justify-center rounded-2xl border border-border bg-card p-8 sm:p-12 text-center shadow-sm">
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-muted text-muted-foreground mb-4">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="h-7 w-7 text-primary">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8.625 12a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0H8.25m4.125 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0H12m4.125 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 0 1-2.555-.337A5.972 5.972 0 0 1 5.41 20.97a.75.75 0 0 1-.703-.99 4.99 4.99 0 0 0 .82-2.193C3.69 16.48 3 14.364 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25Z" />
                </svg>
              </div>
              <h2 className="text-lg font-bold text-foreground">No conversations yet</h2>
              <p className="mt-1.5 max-w-md text-sm text-muted-foreground">
                When you or another member accepts an interest, your private conversation opens here.
              </p>
              <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
                <Link
                  href="/matches"
                  className="inline-flex items-center justify-center rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground shadow-sm transition-all hover:opacity-95"
                >
                  Explore Matches
                </Link>
                <Link
                  href="/interests"
                  className="inline-flex items-center justify-center rounded-xl border border-border bg-background px-5 py-2.5 text-sm font-medium text-foreground transition-all hover:bg-muted"
                >
                  View Interests
                </Link>
              </div>
            </Card>
          )}

          {conversations && conversations.length > 0 && (
            <div className="flex flex-col gap-3">
              {conversations.map((conversation) => (
                <Link key={conversation.id} href={`/messages/${conversation.id}`} className="block transition-transform hover:-translate-y-0.5">
                  <Card className="flex items-center gap-4 rounded-2xl p-4 sm:p-5 transition-colors hover:bg-muted/60">
                    <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-full border border-border bg-muted text-muted-foreground">
                      {conversation.otherParticipant.primaryPhotoUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={conversation.otherParticipant.primaryPhotoUrl}
                          alt=""
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <UserIcon className="h-7 w-7" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-baseline justify-between gap-2">
                        <p className="truncate text-base font-bold text-foreground">
                          {conversation.otherParticipant.fullName}
                        </p>
                        {conversation.lastMessage ? (
                          <span className="shrink-0 text-xs text-muted-foreground">
                            {formatTimestamp(conversation.lastMessage.createdAt)}
                          </span>
                        ) : null}
                      </div>
                      <p className="mt-1 truncate text-sm text-muted-foreground">
                        {conversation.lastMessage ? conversation.lastMessage.body : 'Say hello!'}
                      </p>
                    </div>
                  </Card>
                </Link>
              ))}
            </div>
          )}
        </div>
      </main>
    </>
  );
}
