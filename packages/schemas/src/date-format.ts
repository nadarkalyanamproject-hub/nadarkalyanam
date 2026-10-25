// Every date a member or staff user sees is shown as dd-mm-yyyy, in Indian
// time, whatever the server's or browser's time zone. Dates sent between the
// apps stay ISO (yyyy-mm-dd); only display goes through these helpers.

const IST_OFFSET_MS = 330 * 60_000;

function toIst(value: string | Date): Date | null {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  // Shifted so the UTC getters read Indian wall-clock time.
  return new Date(date.getTime() + IST_OFFSET_MS);
}

const pad = (n: number) => String(n).padStart(2, '0');

/** "23-01-2027". Empty string for a missing or invalid value. */
export function formatDisplayDate(value: string | Date | null | undefined): string {
  if (value == null) return '';
  const ist = toIst(value);
  if (!ist) return '';
  return `${pad(ist.getUTCDate())}-${pad(ist.getUTCMonth() + 1)}-${ist.getUTCFullYear()}`;
}

/** "23-01-2027, 3:05 pm". Empty string for a missing or invalid value. */
export function formatDisplayDateTime(value: string | Date | null | undefined): string {
  if (value == null) return '';
  const ist = toIst(value);
  if (!ist) return '';
  const hours = ist.getUTCHours();
  const time = `${hours % 12 || 12}:${pad(ist.getUTCMinutes())} ${hours < 12 ? 'am' : 'pm'}`;
  return `${formatDisplayDate(value)}, ${time}`;
}
