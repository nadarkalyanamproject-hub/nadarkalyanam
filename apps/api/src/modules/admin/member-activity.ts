import type { MemberActivityPoint } from '@nadar-kalyanam/schemas';

// Member Activity is reported in India time: the platform's members and
// admins are in IST, which has a fixed +05:30 offset (no daylight saving), so
// a "day" is an IST calendar day.
export const ACTIVITY_TZ_OFFSET_MINUTES = 330;
const DAY_MS = 24 * 60 * 60 * 1000;
const OFFSET_MS = ACTIVITY_TZ_OFFSET_MINUTES * 60 * 1000;

// The IST calendar date (YYYY-MM-DD) an instant falls on.
export function istDate(instant: Date): string {
  return new Date(instant.getTime() + OFFSET_MS).toISOString().slice(0, 10);
}

// The last `days` IST dates, oldest first, ending with today, plus the UTC
// instant the window starts at (IST midnight of its first day).
export function activityWindow(days: number, now: Date): { dates: string[]; start: Date } {
  const today = istDate(now);
  const todayMidnightUtc = Date.parse(`${today}T00:00:00.000Z`) - OFFSET_MS;
  const start = new Date(todayMidnightUtc - (days - 1) * DAY_MS);
  const dates = Array.from({ length: days }, (_, i) => istDate(new Date(start.getTime() + i * DAY_MS)));
  return { dates, start };
}

// Per-day series from real counts only: newSignups is that day's count (0 for
// a day nobody joined), totalMembers is every account created before the
// window plus the running sum of signups through that day.
export function buildActivitySeries(
  dates: string[],
  membersBeforeWindow: number,
  signupsByDay: Map<string, number>,
): MemberActivityPoint[] {
  let total = membersBeforeWindow;
  return dates.map((date) => {
    const newSignups = signupsByDay.get(date) ?? 0;
    total += newSignups;
    return { date, newSignups, totalMembers: total };
  });
}
