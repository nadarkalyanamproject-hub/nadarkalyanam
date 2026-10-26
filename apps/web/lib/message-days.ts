import { formatClockTime, messageDay, type MessageTimeLabel } from './message-time';

// What a chat thread renders, in order: a day separator before the first
// message of each calendar day (the viewer's own), then the messages, each
// with its clock time. Pure: the caller passes `now`, which only decides the
// "Today" / "Yesterday" wording, never which messages share a day.

export type ThreadItem<T> =
  | { kind: 'day'; key: string; dateTime: string; label: string }
  | { kind: 'message'; key: string; message: T; time: MessageTimeLabel | null };

export function groupMessagesByDay<T extends { id: string; createdAt: string }>(
  messages: readonly T[],
  now: Date,
  options: { timeZone?: string; locale?: string } = {},
): ThreadItem<T>[] {
  const items: ThreadItem<T>[] = [];
  let currentDay: string | null = null;
  for (const message of messages) {
    // A message without a usable date gets no time and no separator; it
    // stays with the day before it.
    const day = messageDay(message.createdAt, now, options);
    if (day && day.key !== currentDay) {
      currentDay = day.key;
      // Keyed by the message that opens the day, so keys stay unique and
      // stable as newer messages arrive.
      items.push({ kind: 'day', key: `day-${message.id}`, dateTime: day.key, label: day.label });
    }
    items.push({ kind: 'message', key: message.id, message, time: formatClockTime(message.createdAt, options) });
  }
  return items;
}
