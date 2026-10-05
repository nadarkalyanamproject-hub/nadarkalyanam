// Calendar boundaries in India time (Asia/Kolkata, UTC+05:30, no daylight
// saving), returned as UTC instants for database comparisons.
const IST_OFFSET_MS = 330 * 60 * 1000;

// The IST calendar month containing `now`: [start, resetsAt).
export function istMonthWindow(now: Date): { start: Date; resetsAt: Date } {
  const ist = new Date(now.getTime() + IST_OFFSET_MS);
  const year = ist.getUTCFullYear();
  const month = ist.getUTCMonth();
  return {
    start: new Date(Date.UTC(year, month, 1) - IST_OFFSET_MS),
    resetsAt: new Date(Date.UTC(year, month + 1, 1) - IST_OFFSET_MS),
  };
}

// Midnight IST at the start of the day containing `now`.
export function istDayStart(now: Date): Date {
  const ist = new Date(now.getTime() + IST_OFFSET_MS);
  return new Date(Date.UTC(ist.getUTCFullYear(), ist.getUTCMonth(), ist.getUTCDate()) - IST_OFFSET_MS);
}
