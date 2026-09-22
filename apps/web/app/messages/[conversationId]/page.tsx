'use client';

import { useEffect, useRef, useState, type FormEvent } from 'react';
import { useParams } from 'next/navigation';
import type { MessageResponse } from '@nadar-kalyanam/schemas';
import { Button, Card, Input } from '@nadar-kalyanam/ui';
import { AppHeader } from '../../../components/app-header';
import { ApiError, listMessages, sendMessage } from '../../../lib/api-client';
import { useRegistration } from '../../providers/registration-provider';
import { useRequireAuth } from '../../../lib/use-require-auth';

// Plain interval-based refetch — deliberately not WebSocket-backed, per this
// task's explicit scope decision to stay polling-based for now.
const POLL_INTERVAL_MS = 4000;

export default function ConversationThreadPage() {
  const { ready } = useRequireAuth();
  const params = useParams<{ conversationId: string }>();
  const { data } = useRegistration();
  const [messages, setMessages] = useState<MessageResponse[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<string | undefined>();
  const bottomRef = useRef<HTMLDivElement>(null);
  const accessToken = data.accessToken;
  const conversationId = params.conversationId;

  useEffect(() => {
    if (!ready || !accessToken) return;
    let cancelled = false;

    async function fetchMessages(showErrors: boolean) {
      try {
        const result = await listMessages(accessToken!, conversationId);
        if (!cancelled) {
          setMessages(result.items);
          setError(null);
        }
      } catch (err) {
        // A poll tick failing transiently shouldn't blank out an already-
        // loaded thread with an error state — only surface it on first load.
        if (!cancelled && showErrors) {
          setError(err instanceof ApiError ? err.message : 'Could not load messages. Please try again.');
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

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  async function handleSend(event: FormEvent) {
    event.preventDefault();
    const body = draft.trim();
    if (!body || !accessToken) return;

    setSending(true);
    setSendError(undefined);
    try {
      const sent = await sendMessage(accessToken, conversationId, body);
      setDraft('');
      setMessages((prev) => (prev ? [...prev, sent] : [sent]));
    } catch (err) {
      setSendError(err instanceof ApiError ? err.message : 'Could not send message. Please try again.');
    } finally {
      setSending(false);
    }
  }

  if (!ready) return null;

  return (
    <>
      <AppHeader />
      <main className="flex min-h-screen flex-col bg-secondary px-4 py-12">
        <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col">
          <Card className="flex h-[70vh] flex-col overflow-hidden rounded-2xl">
            <div className="flex-1 overflow-y-auto p-4">
              {!messages && !error && (
                <p className="mt-8 text-center text-sm text-muted-foreground">Loading messages…</p>
              )}

              {error && <p className="mt-8 text-center text-sm text-destructive">{error}</p>}

              {messages && messages.length === 0 && (
                <p className="mt-8 text-center text-sm text-muted-foreground">
                  No messages yet. Say hello!
                </p>
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
                  <div ref={bottomRef} />
                </div>
              )}
            </div>

            <form
              className="flex items-center gap-2 border-t border-border p-3"
              onSubmit={(e) => void handleSend(e)}
            >
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
            {sendError ? <p className="px-3 pb-3 text-xs text-destructive">{sendError}</p> : null}
          </Card>
        </div>
      </main>
    </>
  );
}
