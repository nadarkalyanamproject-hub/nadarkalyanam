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
    case 'PLAN_ACTIVATED':
    case 'PLAN_EXPIRED':
    case 'PLAN_CANCELLED':
      return { kind: 'navigate', href: '/membership' };
    default:
      return { kind: 'unavailable', message: 'There is nothing more to open for this notification.' };
  }
}

// Now shared with the admin app; re-exported so existing imports keep working.
export { formatRelativeTime } from '@nadar-kalyanam/ui/relative-time';

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

// Fired by the Interests page once it has recorded the visit, so the
// header's Interests dot clears immediately.
export const INTERESTS_CHANGED_EVENT = 'nk:interests-changed';

export function announceInterestsChanged(): void {
  if (typeof window !== 'undefined') window.dispatchEvent(new Event(INTERESTS_CHANGED_EVENT));
}
