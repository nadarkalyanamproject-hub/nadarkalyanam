import { describe, expect, it } from 'vitest';
import { formatBadgeCount, formatRelativeTime, notificationDestination } from './notifications';

const n = (type: string, targetId: string | null = 't-1', targetAvailable = true) => ({ type, targetId, targetAvailable });

describe('notificationDestination', () => {
  it.each([
    ['INTEREST_RECEIVED', '/interests'],
    ['INTEREST_ACCEPTED', '/messages/t-1'],
    ['NEW_MESSAGE', '/messages/t-1'],
    ['PROFILE_VIEWED', '/browse/t-1'],
    ['ADMIN_PHOTO_REMOVED', '/profile'],
    ['ACCOUNT_SUSPENDED', '/profile'],
    ['ACCOUNT_REINSTATED', '/profile'],
    ['REMOVAL_SCHEDULED', '/profile'],
    ['REMOVAL_CANCELLED', '/profile'],
  ])('%s -> %s', (type, href) => {
    expect(notificationDestination(n(type))).toEqual({ kind: 'navigate', href });
  });

  it('a target that is no longer available shows a friendly message instead of navigating', () => {
    expect(notificationDestination(n('PROFILE_VIEWED', 'p-1', false))).toMatchObject({ kind: 'unavailable' });
  });

  it('an unknown/legacy type never produces a broken link', () => {
    expect(notificationDestination(n('message.new'))).toMatchObject({ kind: 'unavailable' });
  });

  it('a conversation notice without a target falls back to the inbox', () => {
    expect(notificationDestination(n('NEW_MESSAGE', null))).toEqual({ kind: 'navigate', href: '/messages' });
  });
});

describe('formatRelativeTime', () => {
  const now = new Date('2026-09-28T12:00:00.000Z').getTime();
  const ago = (ms: number) => new Date(now - ms).toISOString();

  it.each([
    [10_000, 'just now'],
    [5 * 60_000, '5m ago'],
    [3 * 3_600_000, '3h ago'],
    [30 * 3_600_000, 'Yesterday'],
    [4 * 86_400_000, '4d ago'],
  ])('%i ms ago -> %s', (ms, expected) => {
    expect(formatRelativeTime(ago(ms), now)).toBe(expected);
  });

  it('older than a week shows a short date (with the year only when it differs)', () => {
    expect(formatRelativeTime('2026-09-01T12:00:00.000Z', now)).toMatch(/1 Sept?/);
    expect(formatRelativeTime('2025-09-01T12:00:00.000Z', now)).toMatch(/2025/);
  });

  it('never shows a negative time for a slightly-future timestamp (clock skew)', () => {
    expect(formatRelativeTime(new Date(now + 5_000).toISOString(), now)).toBe('just now');
  });

  it('returns an empty string for an invalid date', () => {
    expect(formatRelativeTime('not-a-date', now)).toBe('');
  });
});

describe('formatBadgeCount', () => {
  it.each([
    [0, null],
    [-1, null],
    [1, '1'],
    [9, '9'],
    [10, '9+'],
    [250, '9+'],
  ])('%i -> %s', (count, expected) => {
    expect(formatBadgeCount(count)).toBe(expected);
  });
});
