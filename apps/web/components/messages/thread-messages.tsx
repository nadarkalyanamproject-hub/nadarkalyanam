import type { MessageResponse } from '@nadar-kalyanam/schemas';
import { groupMessagesByDay } from '../../lib/message-days';

// Two states only: sent (muted, the bubble's own text colour at low opacity)
// and read (the theme's accent colour — there is no blue token, and accent
// stays legible on the primary-coloured own-message bubble). The status
// comes from the regular message poll, so a flip to READ shows up on the
// next refresh without any extra request.
function ReadTicks({ read }: { read: boolean }) {
  return (
    <span
      className={`inline-flex ${read ? 'text-accent' : 'text-primary-foreground/55'}`}
      data-receipt={read ? 'read' : 'sent'}
    >
      <svg viewBox="0 0 18 12" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className="h-3 w-4" aria-hidden="true">
        <path d="M1 6.5 4.5 10 11 2.5" />
        <path d="M7.5 9 8.5 10 15 2.5" />
      </svg>
      <span className="sr-only">{read ? 'Read' : 'Sent'}</span>
    </span>
  );
}

// The thread's messages, WhatsApp-style: a day pill ("Today", "Yesterday",
// "8 Oct") before each calendar day, and the clock time at the bottom right
// of every bubble, followed by the read ticks on the member's own messages.
// The time floats right after the text, so it shares the last line when
// there's room and drops below it when there isn't, without widening a
// short bubble.
export function ThreadMessages({ messages, ownUserId, now }: { messages: MessageResponse[]; ownUserId: string | undefined; now: Date }) {
  return (
    <div className="flex flex-col gap-2">
      {groupMessagesByDay(messages, now).map((item) => {
        if (item.kind === 'day') {
          return (
            <div key={item.key} className="my-2 flex justify-center" data-testid="day-separator">
              <time dateTime={item.dateTime} className="rounded-full bg-card px-3 py-1 text-xs font-medium text-muted-foreground shadow-xs">
                {item.label}
              </time>
            </div>
          );
        }
        const { message, time } = item;
        const isOwn = message.senderId === ownUserId;
        return (
          <div key={item.key} className={`flex ${isOwn ? 'justify-end' : 'justify-start'}`}>
            <div
              className={`max-w-[75%] whitespace-pre-wrap break-words rounded-2xl px-4 py-2 text-sm ${
                isOwn ? 'bg-primary text-primary-foreground' : 'bg-muted text-foreground'
              }`}
            >
              {message.body}
              {/* Read receipt: only on the current user's own messages,
                  never on the other person's. */}
              {(time || isOwn) && (
                <span
                  className={`float-right ml-2 mt-1 inline-flex translate-y-1 items-center gap-1 whitespace-nowrap text-[11px] leading-none ${
                    isOwn ? 'text-primary-foreground/75' : 'text-muted-foreground'
                  }`}
                  data-testid="message-meta"
                >
                  {time && (
                    <time dateTime={time.dateTime} title={time.title}>
                      {time.label}
                    </time>
                  )}
                  {isOwn && <ReadTicks read={message.status === 'READ'} />}
                </span>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
