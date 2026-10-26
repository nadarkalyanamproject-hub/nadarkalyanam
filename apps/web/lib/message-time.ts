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

function parseDate(iso: string | null | undefined): Date | null {
  if (!iso) return null;
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? null : date;
}

function clockTime(date: Date, { timeZone, locale }: Options): string {
  return date.toLocaleTimeString(locale, { timeZone, hour: 'numeric', minute: '2-digit', hourCycle: 'h12' });
}

function withDetails(date: Date, label: string, { timeZone, locale }: Options): MessageTimeLabel {
  return { label, title: date.toLocaleString(locale, { timeZone, dateStyle: 'full', timeStyle: 'short' }), dateTime: date.toISOString() };
}

// "8 Oct", or "8 Oct 2025" from an earlier year: day then short month, as
// elsewhere in the app (see formatRelativeTime).
function shortDate(date: Date, sameYear: boolean, timeZone: string | undefined): string {
  return date.toLocaleDateString('en-IN', { timeZone, day: 'numeric', month: 'short', ...(sameYear ? {} : { year: 'numeric' }) });
}

export function formatMessageTime(iso: string, now: Date, options: Options = {}): MessageTimeLabel | null {
  const date = parseDate(iso);
  if (!date || Number.isNaN(now.getTime())) return null;
  const { timeZone } = options;

  const ahead = date.getTime() - now.getTime();
  if (ahead > 0 && ahead <= CLOCK_SKEW_MS) return withDetails(date, clockTime(date, options), options);

  const message = calendarDay(date, timeZone);
  const today = calendarDay(now, timeZone);
  if (message.day === today.day) return withDetails(date, clockTime(date, options), options);
  if (message.day === today.day - DAY_MS) return withDetails(date, 'Yesterday', options);
  return withDetails(date, shortDate(date, message.year === today.year, timeZone), options);
}

// The clock time only ("10:45 AM"), whatever the day: for a message bubble,
// where the day separator above carries the day.
export function formatClockTime(iso: string | null | undefined, options: Options = {}): MessageTimeLabel | null {
  const date = parseDate(iso);
  return date ? withDetails(date, clockTime(date, options), options) : null;
}

export interface MessageDay {
  // The calendar day, e.g. "2026-10-12", for keys and <time dateTime>.
  key: string;
  // "Today", "Yesterday", "8 Oct" or "8 Oct 2025".
  label: string;
}

// Which calendar day a message falls on, and how a day separator names it.
// The same day rules as formatMessageTime; a day after today (clock skew)
// still reads "Today".
export function messageDay(iso: string | null | undefined, now: Date, { timeZone }: Options = {}): MessageDay | null {
  const date = parseDate(iso);
  if (!date || Number.isNaN(now.getTime())) return null;
  const message = calendarDay(date, timeZone);
  const today = calendarDay(now, timeZone);
  const key = new Date(message.day).toISOString().slice(0, 10);
  if (message.day >= today.day) return { key, label: 'Today' };
  if (message.day === today.day - DAY_MS) return { key, label: 'Yesterday' };
  return { key, label: shortDate(date, message.year === today.year, timeZone) };
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
