'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ChevronRight } from 'lucide-react';
import type { ConversationSummary } from '@nadar-kalyanam/schemas';
import { Card } from '@nadar-kalyanam/ui';
import { AppHeader, UserIcon } from '../../components/app-header';
import { ApiError, listConversations } from '../../lib/api-client';
import { useRegistration } from '../providers/registration-provider';
import { useRequireAuth } from '../../lib/use-require-auth';
import { PlanGate } from '../../components/plan/plan-gate';
import { formatMessageTime } from '../../lib/message-time';
import { useNow } from '../../lib/use-now';

// Same size, border and shadow as a Notifications row, so the two lists
// read as one family (see the notification rows in notifications/page.tsx).
const CONVERSATION_CARD_CLASS =
  'flex items-center gap-3.5 sm:gap-4 rounded-2xl border border-nk-line-soft bg-white p-4 shadow-2xs transition-all hover:border-nk-line-strong hover:shadow-xs';

// The last message's time, WhatsApp-style ("10:45 AM", "Yesterday",
// "8 Oct"), with the exact moment in the tooltip. Nothing for a bad date.
function MessageTime({ iso, now }: { iso: string; now: Date }) {
  const time = formatMessageTime(iso, now);
  if (!time) return null;
  return (
    <time dateTime={time.dateTime} title={time.title} className="shrink-0 text-[11px] text-nk-subtle sm:text-xs">
      {time.label}
    </time>
  );
}

function MessagesPageContent() {
  const { ready } = useRequireAuth();
  const { data } = useRegistration();
  const [conversations, setConversations] = useState<ConversationSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const now = useNow();

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
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
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
                <Link key={conversation.id} href={`/messages/${conversation.id}`} className="block rounded-2xl transition-transform hover:-translate-y-0.5">
                  <div className={CONVERSATION_CARD_CLASS}>
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-full border border-nk-line-gold bg-nk-paper text-nk-muted">
                      {conversation.otherParticipant.primaryPhotoUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={conversation.otherParticipant.primaryPhotoUrl}
                          alt=""
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <UserIcon className="h-5 w-5 text-[#A88C78]" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-baseline justify-between gap-2">
                        <p className="flex min-w-0 items-center gap-2 text-sm font-bold text-nk-ink sm:text-base">
                          {/* Unread dot: messages from them you haven't opened yet. */}
                          {conversation.hasUnread && (
                            <span
                              role="status"
                              aria-label="Unread messages"
                              data-testid="conversation-unread-dot"
                              className="inline-block h-2.5 w-2.5 shrink-0 rounded-full bg-primary"
                            />
                          )}
                          <span className="truncate">{conversation.otherParticipant.fullName}</span>
                        </p>
                        {conversation.lastMessage ? <MessageTime iso={conversation.lastMessage.createdAt} now={now} /> : null}
                      </div>
                      <p className="mt-0.5 truncate text-xs text-nk-subtle sm:text-sm">
                        {conversation.lastMessage ? conversation.lastMessage.body : 'Say hello!'}
                      </p>
                    </div>
                    <ChevronRight className="h-4 w-4 shrink-0 text-nk-subtle" aria-hidden="true" />
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </main>
    </>
  );
}

// Needs a membership plan when the server requires one (see PlanGate).
export default function MessagesPage() {
  return (
    <PlanGate>
      <MessagesPageContent />
    </PlanGate>
  );
}
