// Pure notification helpers (unit-tested in notifications.spec.ts).

export interface NotificationTarget {
  type: string;
  targetId: string | null;
  targetAvailable: boolean;
}

export type NotificationDestination = { kind: 'navigate'; href: string } | { kind: 'unavailable'; message: string };

// Where clicking a notification goes. Types that point at something that
// can't be opened any more get a friendly message instead of a broken page.
export function notificationDestination(n: NotificationTarget): NotificationDestination {
  if (!n.targetAvailable) {
    return { kind: 'unavailable', message: 'This profile is no longer available.' };
  }
  switch (n.type) {
    case 'INTEREST_RECEIVED':
      // /interests opens on the Received tab by default.
      return { kind: 'navigate', href: '/interests' };
    case 'INTEREST_ACCEPTED':
    case 'NEW_MESSAGE':
      return n.targetId
        ? { kind: 'navigate', href: `/messages/${n.targetId}` }
        : { kind: 'navigate', href: '/messages' };
    case 'PROFILE_VIEWED':
      return n.targetId
        ? { kind: 'navigate', href: `/browse/${n.targetId}` }
        : { kind: 'unavailable', message: 'This profile is no longer available.' };
    case 'ADMIN_PHOTO_REMOVED':
    case 'ACCOUNT_SUSPENDED':
    case 'ACCOUNT_REINSTATED':
    case 'REMOVAL_SCHEDULED':
    case 'REMOVAL_CANCELLED':
      return { kind: 'navigate', href: '/profile' };
    default:
      return { kind: 'unavailable', message: 'There is nothing more to open for this notification.' };
  }
}

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

// "just now", "5m ago", "3h ago", "Yesterday", "4d ago", then a short date.
export function formatRelativeTime(iso: string, now: number = Date.now()): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return '';
  const diff = Math.max(0, now - then);
  if (diff < MINUTE) return 'just now';
  if (diff < HOUR) return `${Math.floor(diff / MINUTE)}m ago`;
  if (diff < DAY) return `${Math.floor(diff / HOUR)}h ago`;
  if (diff < 2 * DAY) return 'Yesterday';
  if (diff < 7 * DAY) return `${Math.floor(diff / DAY)}d ago`;
  const date = new Date(then);
  const sameYear = date.getFullYear() === new Date(now).getFullYear();
  return date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', ...(sameYear ? {} : { year: 'numeric' }) });
}

// Header badge text: nothing for 0, the number up to 9, then "9+".
export function formatBadgeCount(count: number): string | null {
  if (!Number.isFinite(count) || count <= 0) return null;
  return count > 9 ? '9+' : String(Math.floor(count));
}

// Fired by the notifications page after it marks something read, so the
// header badge refreshes immediately instead of waiting for its next poll.
export const NOTIFICATIONS_CHANGED_EVENT = 'nk:notifications-changed';

export function announceNotificationsChanged(): void {
  if (typeof window !== 'undefined') window.dispatchEvent(new Event(NOTIFICATIONS_CHANGED_EVENT));
}

// Fired by a conversation thread once opening it has marked messages read,
// so the header's Messages badge refreshes immediately too.
export const MESSAGES_CHANGED_EVENT = 'nk:messages-changed';

export function announceMessagesChanged(): void {
  if (typeof window !== 'undefined') window.dispatchEvent(new Event(MESSAGES_CHANGED_EVENT));
}
