// WhatsApp-style time labels for the Messages list: the time for today,
// "Yesterday", then "8 Oct" (and "8 Oct 2025" from an earlier year). Days
// are calendar days in the viewer's own timezone, compared by their date
// parts, so DST days (23 or 25 hours long) and late-night messages land on
// the right day. Pure: the caller passes `now`.

export interface MessageTimeLabel {
  // What the list shows, e.g. "10:45 AM", "Yesterday", "8 Oct".
  label: string;
  // The exact moment, for the tooltip.
  title: string;
  // Machine-readable value for <time dateTime>.
  dateTime: string;
}

// A clock a little behind the server's makes the newest message look
// slightly in the future; that still reads as "just now", i.e. a time.
const CLOCK_SKEW_MS = 5 * 60 * 1000;

interface Options {
  // Defaults to the viewer's own; tests pass one explicitly.
  timeZone?: string;
  // Locale for the time of day (defaults to the viewer's).
  locale?: string;
}

// Calendar date in the given timezone, as a UTC-midnight timestamp, so
// whole days can be compared and counted without DST getting in the way.
function calendarDay(date: Date, timeZone: string | undefined): { day: number; year: number } {
  const parts = new Intl.DateTimeFormat('en-US', { timeZone, year: 'numeric', month: 'numeric', day: 'numeric' }).formatToParts(date);
  const part = (type: 'year' | 'month' | 'day') => Number(parts.find((p) => p.type === type)?.value);
  return { day: Date.UTC(part('year'), part('month') - 1, part('day')), year: part('year') };
}

const DAY_MS = 24 * 60 * 60 * 1000;

export function formatMessageTime(iso: string, now: Date, { timeZone, locale }: Options = {}): MessageTimeLabel | null {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime()) || Number.isNaN(now.getTime())) return null;

  const time = () => date.toLocaleTimeString(locale, { timeZone, hour: 'numeric', minute: '2-digit', hourCycle: 'h12' });
  const title = date.toLocaleString(locale, { timeZone, dateStyle: 'full', timeStyle: 'short' });
  const result = (label: string): MessageTimeLabel => ({ label, title, dateTime: date.toISOString() });

  const ahead = date.getTime() - now.getTime();
  if (ahead > 0 && ahead <= CLOCK_SKEW_MS) return result(time());

  const message = calendarDay(date, timeZone);
  const today = calendarDay(now, timeZone);
  if (message.day === today.day) return result(time());
  if (message.day === today.day - DAY_MS) return result('Yesterday');
  // Day then short month, as elsewhere in the app (see formatRelativeTime).
  return result(
    date.toLocaleDateString('en-IN', {
      timeZone,
      day: 'numeric',
      month: 'short',
      ...(message.year === today.year ? {} : { year: 'numeric' }),
    }),
  );
}

// Milliseconds from `now` until the next local midnight. Built from local
// date parts, so it's right on DST days too.
export function msUntilNextLocalMidnight(now: Date): number {
  const next = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 0, 0, 0);
  return next.getTime() - now.getTime();
}

// Calls `onNewDay` just after each local midnight until cancelled. Each run
// schedules the next from the clock at that moment, so a timer that fired
// late (a sleeping laptop, a throttled background tab) never drifts.
export function scheduleDayRollover(onNewDay: () => void, clock: () => Date = () => new Date()): () => void {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const schedule = () => {
    // A moment past midnight, so "now" is safely on the new day.
    timer = setTimeout(() => {
      onNewDay();
      schedule();
    }, msUntilNextLocalMidnight(clock()) + 1000);
  };
  schedule();
  return () => clearTimeout(timer);
}
