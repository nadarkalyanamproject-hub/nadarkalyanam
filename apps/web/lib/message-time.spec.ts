import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { formatMessageTime, msUntilNextLocalMidnight, scheduleDayRollover } from './message-time';

const label = (iso: string, now: string, timeZone: string) => formatMessageTime(iso, new Date(now), { timeZone, locale: 'en-US' })?.label ?? null;

// The same wall-clock scenarios in two timezones: each instant is written
// with that zone's UTC offset (both on summer time / no DST in October).
describe.each([
  ['Asia/Kolkata', '+05:30'],
  ['America/Los_Angeles', '-07:00'],
])('formatMessageTime in %s', (timeZone, offset) => {
  const at = (wall: string) => `${wall}${offset}`;
  const morning = at('2026-10-12T10:00:00');

  it.each([
    ['same day, morning', '2026-10-12T08:15:00', morning, '8:15 AM'],
    ['same day, late evening', '2026-10-12T22:45:00', at('2026-10-12T23:30:00'), '10:45 PM'],
    ['00:01 today', '2026-10-12T00:01:00', morning, '12:01 AM'],
    ['11:59 PM yesterday, seen just after midnight', '2026-10-11T23:59:00', at('2026-10-12T00:05:00'), 'Yesterday'],
    ['yesterday afternoon', '2026-10-11T14:00:00', morning, 'Yesterday'],
    ['36 hours ago, on an earlier day', '2026-10-10T22:00:00', morning, '10 Oct'],
    ['two days ago', '2026-10-10T09:00:00', morning, '10 Oct'],
    ['earlier this year', '2026-03-08T12:00:00', morning, '8 Mar'],
    ['a previous year', '2025-10-08T12:00:00', morning, '8 Oct 2025'],
    ['just after midnight, now just before the next midnight', '2026-10-12T00:00:30', at('2026-10-12T23:59:30'), '12:00 AM'],
    ['a minute in the future (clock skew)', '2026-10-12T10:01:00', morning, '10:01 AM'],
    ['in the future across midnight (clock skew)', '2026-10-13T00:01:00', at('2026-10-12T23:59:30'), '12:01 AM'],
  ])('%s', (_name, message, now, expected) => {
    expect(label(at(message), now, timeZone)).toBe(expected);
  });

  it('shows nothing for an invalid date', () => {
    expect(formatMessageTime('not a date', new Date(morning), { timeZone })).toBeNull();
    expect(formatMessageTime('', new Date(morning), { timeZone })).toBeNull();
  });

  it('gives the exact moment for the tooltip and <time dateTime>', () => {
    const result = formatMessageTime(at('2026-10-10T09:00:00'), new Date(morning), { timeZone, locale: 'en-US' });
    expect(result?.dateTime).toBe(new Date(at('2026-10-10T09:00:00')).toISOString());
    expect(result?.title).toBe('Saturday, October 10, 2026 at 9:00 AM');
  });
});

describe('the viewer’s timezone decides the day', () => {
  it('the same two instants are "Yesterday" in India but today in Los Angeles', () => {
    const message = '2026-10-11T18:29:00Z'; // 11:59 PM in India, 11:29 AM in LA
    const now = '2026-10-11T18:35:00Z'; // 12:05 AM next day in India, 11:35 AM in LA
    expect(label(message, now, 'Asia/Kolkata')).toBe('Yesterday');
    expect(label(message, now, 'America/Los_Angeles')).toBe('11:29 AM');
  });

  it('DST end (25-hour day): 00:30 and 23:30 on 1 Nov in LA are the same day', () => {
    // 00:30 PDT and 23:30 PST: 24 hours apart, still the same calendar day.
    expect(label('2026-11-01T00:30:00-07:00', '2026-11-01T23:30:00-08:00', 'America/Los_Angeles')).toBe('12:30 AM');
    expect(label('2026-10-31T23:59:00-07:00', '2026-11-01T23:30:00-08:00', 'America/Los_Angeles')).toBe('Yesterday');
  });

  it('DST start (23-hour day): under 24 hours apart but on the previous day is "Yesterday"', () => {
    // 11:30 PM PST on 7 Mar and 11:00 PM PDT on 8 Mar are 22.5 hours apart.
    expect(label('2026-03-07T23:30:00-08:00', '2026-03-08T23:00:00-07:00', 'America/Los_Angeles')).toBe('Yesterday');
  });
});

// The page doesn't pass a timezone: it uses the process/browser's own.
describe('with the local timezone (TZ)', () => {
  const originalTz = process.env.TZ;
  afterEach(() => {
    process.env.TZ = originalTz;
  });

  it.each([
    ['Asia/Kolkata', 'Yesterday'],
    ['America/Los_Angeles', '11:29 AM'],
  ])('%s', (tz, expected) => {
    process.env.TZ = tz;
    expect(formatMessageTime('2026-10-11T18:29:00Z', new Date('2026-10-11T18:35:00Z'), { locale: 'en-US' })?.label).toBe(expected);
  });
});

describe('midnight rollover', () => {
  const originalTz = process.env.TZ;
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
    process.env.TZ = originalTz;
  });

  it('msUntilNextLocalMidnight follows local days, including DST days', () => {
    process.env.TZ = 'America/Los_Angeles';
    const HOUR = 3_600_000;
    expect(msUntilNextLocalMidnight(new Date('2026-10-12T23:00:00-07:00'))).toBe(HOUR);
    // 1 Nov is 25 hours long, 8 Mar 23 hours.
    expect(msUntilNextLocalMidnight(new Date('2026-11-01T00:00:00-07:00'))).toBe(25 * HOUR);
    expect(msUntilNextLocalMidnight(new Date('2026-03-08T00:00:00-08:00'))).toBe(23 * HOUR);
  });

  it.each(['Asia/Kolkata', 'America/Los_Angeles'])('fires just after each local midnight in %s, and not before', (tz) => {
    process.env.TZ = tz;
    const offset = tz === 'Asia/Kolkata' ? '+05:30' : '-07:00';
    vi.setSystemTime(new Date(`2026-10-12T23:30:00${offset}`));
    const onNewDay = vi.fn();
    const cancel = scheduleDayRollover(onNewDay);

    vi.advanceTimersByTime(30 * 60_000 - 1);
    expect(onNewDay).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1001);
    expect(onNewDay).toHaveBeenCalledTimes(1);
    expect(new Date().getDate()).toBe(13);

    // Re-scheduled for the following midnight, not on a short poll.
    vi.advanceTimersByTime(24 * 3_600_000 - 1000);
    expect(onNewDay).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(1000);
    expect(onNewDay).toHaveBeenCalledTimes(2);

    cancel();
    vi.advanceTimersByTime(3 * 24 * 3_600_000);
    expect(onNewDay).toHaveBeenCalledTimes(2);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('over the 25-hour DST-end day it still fires once per midnight', () => {
    process.env.TZ = 'America/Los_Angeles';
    vi.setSystemTime(new Date('2026-10-31T23:00:00-07:00'));
    const onNewDay = vi.fn();
    const cancel = scheduleDayRollover(onNewDay);
    vi.advanceTimersByTime(3_600_000 + 1000); // midnight starting 1 Nov
    expect(onNewDay).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(24 * 3_600_000); // 24h later it's only 11 PM on 1 Nov
    expect(onNewDay).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(3_600_000);
    expect(onNewDay).toHaveBeenCalledTimes(2);
    expect(new Date().getDate()).toBe(2);
    cancel();
  });
});
