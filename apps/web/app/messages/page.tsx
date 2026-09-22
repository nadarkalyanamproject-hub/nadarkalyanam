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
      <main className="min-h-screen bg-secondary px-4 py-12">
        <div className="mx-auto flex max-w-2xl flex-col gap-6">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Messages</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Conversations that started once an interest was accepted.
            </p>
          </div>

          {!conversations && !error && (
            <Card className="rounded-2xl p-8 text-center text-sm text-muted-foreground">
              Loading conversations…
            </Card>
          )}

          {error && (
            <Card className="rounded-2xl p-8 text-center text-sm text-destructive">{error}</Card>
          )}

          {conversations && conversations.length === 0 && (
            <Card className="rounded-2xl p-8 text-center text-sm text-muted-foreground">
              No conversations yet. Accepting an interest starts one.
            </Card>
          )}

          {conversations && conversations.length > 0 && (
            <div className="flex flex-col gap-3">
              {conversations.map((conversation) => (
                <Link key={conversation.id} href={`/messages/${conversation.id}`}>
                  <Card className="flex items-center gap-4 rounded-2xl p-4 transition-colors hover:bg-muted">
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
                        <p className="truncate text-sm font-bold text-foreground">
                          {conversation.otherParticipant.fullName}
                        </p>
                        {conversation.lastMessage ? (
                          <span className="shrink-0 text-xs text-muted-foreground">
                            {formatTimestamp(conversation.lastMessage.createdAt)}
                          </span>
                        ) : null}
                      </div>
                      <p className="mt-0.5 truncate text-sm text-muted-foreground">
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
