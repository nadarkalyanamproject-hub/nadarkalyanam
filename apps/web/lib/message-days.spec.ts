import { afterEach, describe, expect, it } from 'vitest';
import { groupMessagesByDay, type ThreadItem } from './message-days';

type Msg = { id: string; createdAt: string };

// The rendered sequence in short form: "[Today]" for a separator, then
// "id@time" for each message.
function outline(items: ThreadItem<Msg>[]): string[] {
  return items.map((item) => (item.kind === 'day' ? `[${item.label}]` : `${item.message.id}@${item.time?.label ?? '-'}`));
}

// Same wall-clock scenarios in two timezones (October: IST and PDT).
describe.each([
  ['Asia/Kolkata', '+05:30'],
  ['America/Los_Angeles', '-07:00'],
])('groupMessagesByDay in %s', (timeZone, offset) => {
  const at = (wall: string) => `${wall}${offset}`;
  const msg = (id: string, wall: string): Msg => ({ id, createdAt: at(wall) });
  const group = (messages: Msg[], now: string) => outline(groupMessagesByDay(messages, new Date(at(now)), { timeZone, locale: 'en-US' }));
  const now = '2026-10-12T10:00:00';

  it('empty thread: nothing to render', () => {
    expect(group([], now)).toEqual([]);
  });

  it('one message: a separator before it, then its time', () => {
    expect(group([msg('a', '2026-10-12T08:15:00')], now)).toEqual(['[Today]', 'a@8:15 AM']);
  });

  it('several messages on one day share one separator', () => {
    expect(group([msg('a', '2026-10-12T08:15:00'), msg('b', '2026-10-12T09:00:00'), msg('c', '2026-10-12T09:59:00')], now)).toEqual([
      '[Today]',
      'a@8:15 AM',
      'b@9:00 AM',
      'c@9:59 AM',
    ]);
  });

  it('a new separator at each day change; bubbles always show the clock time', () => {
    expect(
      group(
        [
          msg('lastyear', '2025-10-08T12:00:00'),
          msg('march', '2026-03-08T12:00:00'),
          msg('older', '2026-10-08T09:30:00'),
          msg('yday', '2026-10-11T14:00:00'),
          msg('today', '2026-10-12T08:15:00'),
        ],
        now,
      ),
    ).toEqual(['[8 Oct 2025]', 'lastyear@12:00 PM', '[8 Mar]', 'march@12:00 PM', '[8 Oct]', 'older@9:30 AM', '[Yesterday]', 'yday@2:00 PM', '[Today]', 'today@8:15 AM']);
  });

  it('11:59 PM then 12:01 AM: two days, two separators', () => {
    expect(group([msg('late', '2026-10-11T23:59:00'), msg('early', '2026-10-12T00:01:00')], now)).toEqual([
      '[Yesterday]',
      'late@11:59 PM',
      '[Today]',
      'early@12:01 AM',
    ]);
  });

  it('an invalid or missing date: no time, no separator, no crash', () => {
    const messages = [msg('a', '2026-10-12T08:15:00'), { id: 'bad', createdAt: 'not-a-date' }, { id: 'empty', createdAt: '' }, msg('b', '2026-10-12T09:00:00')];
    expect(group(messages, now)).toEqual(['[Today]', 'a@8:15 AM', 'bad@-', 'empty@-', 'b@9:00 AM']);
    expect(group([{ id: 'bad', createdAt: 'nope' }], now)).toEqual(['bad@-']);
  });

  it('the clock crossing midnight relabels the days, and the first message after midnight opens a new one', () => {
    const before = [msg('a', '2026-10-12T22:00:00'), msg('b', '2026-10-12T23:58:00')];
    expect(group(before, '2026-10-12T23:59:00')).toEqual(['[Today]', 'a@10:00 PM', 'b@11:58 PM']);
    const after = [...before, msg('c', '2026-10-13T00:02:00')];
    expect(group(after, '2026-10-13T00:03:00')).toEqual(['[Yesterday]', 'a@10:00 PM', 'b@11:58 PM', '[Today]', 'c@12:02 AM']);
  });

  it('a message slightly in the future (clock skew) is still "Today"', () => {
    expect(group([msg('a', '2026-10-13T00:01:00')], '2026-10-12T23:59:30')).toEqual(['[Today]', 'a@12:01 AM']);
  });

  it('separator keys are unique and stable as messages arrive', () => {
    const first = groupMessagesByDay([msg('a', '2026-10-11T09:00:00'), msg('b', '2026-10-12T09:00:00')], new Date(at(now)), { timeZone });
    const later = groupMessagesByDay([msg('a', '2026-10-11T09:00:00'), msg('b', '2026-10-12T09:00:00'), msg('c', '2026-10-12T09:30:00')], new Date(at(now)), { timeZone });
    expect(later.slice(0, first.length).map((i) => i.key)).toEqual(first.map((i) => i.key));
    expect(new Set(later.map((i) => i.key)).size).toBe(later.length);
  });

  it('the separator carries the calendar day for <time dateTime>', () => {
    const [separator] = groupMessagesByDay([msg('a', '2026-10-11T23:59:00')], new Date(at(now)), { timeZone });
    expect(separator).toMatchObject({ kind: 'day', dateTime: '2026-10-11' });
  });
});

describe('day boundaries follow the viewer’s timezone', () => {
  it('the same two instants are one day in Los Angeles but two in India', () => {
    const messages = [
      { id: 'a', createdAt: '2026-10-11T18:20:00Z' }, // 11:50 PM IST, 11:20 AM PDT
      { id: 'b', createdAt: '2026-10-11T18:40:00Z' }, // 12:10 AM IST (next day), 11:40 AM PDT
    ];
    const now = new Date('2026-10-11T19:00:00Z');
    expect(outline(groupMessagesByDay(messages, now, { timeZone: 'Asia/Kolkata', locale: 'en-US' }))).toEqual(['[Yesterday]', 'a@11:50 PM', '[Today]', 'b@12:10 AM']);
    expect(outline(groupMessagesByDay(messages, now, { timeZone: 'America/Los_Angeles', locale: 'en-US' }))).toEqual(['[Today]', 'a@11:20 AM', 'b@11:40 AM']);
  });

  it('DST end (25-hour day): 00:30 PDT and 23:30 PST on 1 Nov are one day', () => {
    const messages = [
      { id: 'a', createdAt: '2026-11-01T00:30:00-07:00' },
      { id: 'b', createdAt: '2026-11-01T23:30:00-08:00' },
    ];
    expect(outline(groupMessagesByDay(messages, new Date('2026-11-01T23:45:00-08:00'), { timeZone: 'America/Los_Angeles', locale: 'en-US' }))).toEqual([
      '[Today]',
      'a@12:30 AM',
      'b@11:30 PM',
    ]);
  });

  it('DST start (23-hour day): 22.5 hours apart but on two days', () => {
    const messages = [
      { id: 'a', createdAt: '2026-03-07T23:30:00-08:00' },
      { id: 'b', createdAt: '2026-03-08T23:00:00-07:00' },
    ];
    expect(outline(groupMessagesByDay(messages, new Date('2026-03-08T23:10:00-07:00'), { timeZone: 'America/Los_Angeles', locale: 'en-US' }))).toEqual([
      '[Yesterday]',
      'a@11:30 PM',
      '[Today]',
      'b@11:00 PM',
    ]);
  });
});

// The page passes no timezone: it uses the browser's own.
describe('with the local timezone (TZ)', () => {
  const originalTz = process.env.TZ;
  afterEach(() => {
    process.env.TZ = originalTz;
  });

  it.each([
    ['Asia/Kolkata', ['[Yesterday]', 'a', '[Today]', 'b']],
    ['America/Los_Angeles', ['[Today]', 'a', 'b']],
  ])('%s', (tz, expected) => {
    process.env.TZ = tz;
    const items = groupMessagesByDay(
      [
        { id: 'a', createdAt: '2026-10-11T18:20:00Z' },
        { id: 'b', createdAt: '2026-10-11T18:40:00Z' },
      ],
      new Date('2026-10-11T19:00:00Z'),
    );
    expect(items.map((i) => (i.kind === 'day' ? `[${i.label}]` : i.message.id))).toEqual(expected);
  });
});
