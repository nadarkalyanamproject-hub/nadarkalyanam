'use client';

import { useEffect, useLayoutEffect, useRef, useState, type FormEvent } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import type { ConversationDetail, MessageResponse } from '@nadar-kalyanam/schemas';
import { Button, Card, Input } from '@nadar-kalyanam/ui';
import { AppHeader, UserIcon } from '../../../components/app-header';
import { ApiError, getConversation, listMessages, sendMessage } from '../../../lib/api-client';
import { announceMessagesChanged } from '../../../lib/notifications';
import { useRegistration } from '../../providers/registration-provider';
import { useRequireAuth } from '../../../lib/use-require-auth';

// Plain interval-based refetch — deliberately not WebSocket-backed, per this
// task's explicit scope decision to stay polling-based for now.
const POLL_INTERVAL_MS = 4000;
// "At the bottom" tolerance: while the reader is within this many px of the
// newest message, new ones keep the list pinned to the bottom; once they've
// scrolled up to read older messages, polling leaves their position alone.
const STICK_TO_BOTTOM_PX = 80;

export default function ConversationThreadPage() {
  const { ready } = useRequireAuth();
  const params = useParams<{ conversationId: string }>();
  const { data } = useRegistration();
  const [conversation, setConversation] = useState<ConversationDetail | null>(null);
  const [messages, setMessages] = useState<MessageResponse[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<string | undefined>();
  const listRef = useRef<HTMLDivElement>(null);
  const stickToBottomRef = useRef(true);
  const accessToken = data.accessToken;
  const conversationId = params.conversationId;

  // Who we're talking to — fetched once for the header.
  useEffect(() => {
    if (!ready || !accessToken) return;
    let cancelled = false;
    getConversation(accessToken, conversationId)
      .then((result) => {
        if (!cancelled) setConversation(result);
      })
      .catch(() => {
        // The message fetch below surfaces the error (same access rule).
      });
    return () => {
      cancelled = true;
    };
  }, [ready, accessToken, conversationId]);

  useEffect(() => {
    if (!ready || !accessToken) return;
    let cancelled = false;
    let lastSeenId: string | null = null;

    async function fetchMessages(showErrors: boolean) {
      try {
        // Fetching also marks the other person's messages as read (server
        // side), so tell the header to refresh its Messages badge whenever
        // this brought in something new — the first load included.
        const result = await listMessages(accessToken!, conversationId);
        if (cancelled) return;
        setMessages(result.items);
        setError(null);
        const newestId = result.items[result.items.length - 1]?.id ?? null;
        if (newestId !== lastSeenId) {
          lastSeenId = newestId;
          announceMessagesChanged();
        }
      } catch (err) {
        // A poll tick failing transiently shouldn't blank out an already-
        // loaded thread with an error state — only surface it on first load.
        if (!cancelled && showErrors) {
          setError(
            err instanceof ApiError && err.status === 403
              ? 'This conversation is no longer available.'
              : err instanceof ApiError
                ? err.message
                : 'Could not load messages. Please try again.',
          );
        }
      }
    }

    void fetchMessages(true);
    const interval = setInterval(() => void fetchMessages(false), POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [ready, accessToken, conversationId]);

  // Keep the list pinned to the newest message only while the reader is
  // already at the bottom. Scrolls the LIST, never the window (the old
  // scrollIntoView also scrolled the page, pushing the top of the thread
  // under the site header).
  useLayoutEffect(() => {
    const list = listRef.current;
    if (list && stickToBottomRef.current) list.scrollTop = list.scrollHeight;
  }, [messages]);

  function handleListScroll() {
    const list = listRef.current;
    if (!list) return;
    stickToBottomRef.current = list.scrollHeight - list.scrollTop - list.clientHeight < STICK_TO_BOTTOM_PX;
  }

  async function handleSend(event: FormEvent) {
    event.preventDefault();
    const body = draft.trim();
    if (!body || !accessToken) return;

    setSending(true);
    setSendError(undefined);
    try {
      const sent = await sendMessage(accessToken, conversationId, body);
      setDraft('');
      stickToBottomRef.current = true;
      setMessages((prev) => (prev ? [...prev, sent] : [sent]));
    } catch (err) {
      setSendError(err instanceof ApiError ? err.message : 'Could not send message. Please try again.');
    } finally {
      setSending(false);
    }
  }

  if (!ready) return null;

  const other = conversation?.otherParticipant;

  return (
    // The page is exactly one viewport tall and never scrolls itself: the
    // conversation header stays put above the message list, which is the
    // only thing that scrolls.
    <div className="flex h-dvh flex-col bg-secondary">
      <AppHeader />
      <main className="flex min-h-0 flex-1 flex-col px-3 py-4 sm:px-6 sm:py-8 lg:px-8 xl:px-12 2xl:px-16">
        <Card className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl shadow-sm">
          <div
            className="flex shrink-0 items-center gap-3 border-b border-border bg-card px-4 py-3"
            data-testid="conversation-header"
          >
            <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full border border-border bg-muted text-muted-foreground">
              {other?.primaryPhotoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={other.primaryPhotoUrl} alt="" className="h-full w-full object-cover" />
              ) : (
                <UserIcon className="h-5 w-5" />
              )}
            </div>
            <div className="min-w-0 flex-1">
              {other?.available && other.profileId ? (
                <Link
                  href={`/browse/${other.profileId}`}
                  className="block truncate text-sm font-bold text-foreground hover:text-primary"
                >
                  {other.fullName}
                </Link>
              ) : (
                <p className="truncate text-sm font-bold text-foreground">
                  {other?.fullName ?? (error ? 'Conversation unavailable' : '…')}
                </p>
              )}
              {other && !other.available && (
                <p className="text-xs text-muted-foreground">This member is no longer active.</p>
              )}
            </div>
          </div>

          <div ref={listRef} onScroll={handleListScroll} className="min-h-0 flex-1 overflow-y-auto p-4">
            {!messages && !error && (
              <p className="mt-8 text-center text-sm text-muted-foreground">Loading messages…</p>
            )}

            {error && <p className="mt-8 text-center text-sm text-destructive">{error}</p>}

            {messages && messages.length === 0 && (
              <p className="mt-8 text-center text-sm text-muted-foreground">No messages yet. Say hello!</p>
            )}

            {messages && messages.length > 0 && (
              <div className="flex flex-col gap-2">
                {messages.map((message) => {
                  const isOwn = message.senderId === data.userId;
                  return (
                    <div key={message.id} className={`flex ${isOwn ? 'justify-end' : 'justify-start'}`}>
                      <div
                        className={`max-w-[75%] whitespace-pre-wrap break-words rounded-2xl px-4 py-2 text-sm ${
                          isOwn ? 'bg-primary text-primary-foreground' : 'bg-muted text-foreground'
                        }`}
                      >
                        {message.body}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <form className="flex shrink-0 items-center gap-2 border-t border-border p-3" onSubmit={(e) => void handleSend(e)}>
            <Input
              type="text"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder="Type a message…"
              disabled={sending}
              className="flex-1"
            />
            <Button type="submit" size="md" disabled={sending || !draft.trim()}>
              Send
            </Button>
          </form>
          {sendError ? <p className="shrink-0 px-3 pb-3 text-xs text-destructive">{sendError}</p> : null}
        </Card>
      </main>
    </div>
  );
}
