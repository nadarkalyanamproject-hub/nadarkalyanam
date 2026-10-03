import { memberActivityQuerySchema } from '@nadar-kalyanam/schemas';
import { describe, expect, it, vi } from 'vitest';
import { AdminService } from './admin.service.js';
import { activityWindow, buildActivitySeries, istDate } from './member-activity.js';

/* eslint-disable @typescript-eslint/no-explicit-any */
describe('member activity: India-time days', () => {
  it('buckets an instant on its IST calendar day', () => {
    expect(istDate(new Date('2026-10-03T18:29:59.999Z'))).toBe('2026-10-03'); // 23:59:59 IST
    expect(istDate(new Date('2026-10-03T18:30:00.000Z'))).toBe('2026-10-04'); // 00:00 IST next day
  });

  it('a 7-day window ends today (IST) and starts at IST midnight 6 days earlier', () => {
    const { dates, start } = activityWindow(7, new Date('2026-10-03T20:00:00.000Z')); // 01:30 IST on Oct 4
    expect(dates).toEqual(['2026-09-28', '2026-09-29', '2026-09-30', '2026-10-01', '2026-10-02', '2026-10-03', '2026-10-04']);
    expect(start.toISOString()).toBe('2026-09-27T18:30:00.000Z'); // 2026-09-28 00:00 IST
  });

  it.each([7, 30, 90])('a %i-day window has exactly that many consecutive days', (days) => {
    const { dates } = activityWindow(days, new Date('2026-10-03T06:00:00.000Z'));
    expect(dates).toHaveLength(days);
    expect(dates.at(-1)).toBe('2026-10-03');
    for (let i = 1; i < dates.length; i++) {
      expect(Date.parse(dates[i]!) - Date.parse(dates[i - 1]!)).toBe(24 * 60 * 60 * 1000);
    }
  });
});

describe('member activity: series', () => {
  it('uses real per-day counts, zero for empty days, and a running total from the pre-window baseline', () => {
    const series = buildActivitySeries(['2026-10-01', '2026-10-02', '2026-10-03'], 100, new Map([['2026-10-01', 4], ['2026-10-03', 2]]));
    expect(series).toEqual([
      { date: '2026-10-01', newSignups: 4, totalMembers: 104 },
      { date: '2026-10-02', newSignups: 0, totalMembers: 104 },
      { date: '2026-10-03', newSignups: 2, totalMembers: 106 },
    ]);
  });
});

describe('AdminService.getMemberActivity', () => {
  // Seeded signups (UTC instants) around known IST day boundaries.
  const signups = [
    '2026-09-20T10:00:00.000Z', // before the 7-day window -> baseline
    '2026-09-27T18:29:00.000Z', // 23:59 IST Sep 27 -> still before the window
    '2026-09-27T18:30:00.000Z', // 00:00 IST Sep 28 -> first day
    '2026-10-01T05:00:00.000Z',
    '2026-10-01T23:00:00.000Z', // 04:30 IST Oct 2
    '2026-10-03T19:00:00.000Z', // 00:30 IST Oct 4 -> today
  ].map((iso) => new Date(iso));

  function service() {
    const prisma = {
      user: { count: vi.fn(async ({ where }: any) => signups.filter((d) => d < where.createdAt.lt).length) },
      // Mirrors the SQL: IST date of each signup at/after the window start.
      $queryRaw: vi.fn(async (_strings: TemplateStringsArray, _offset: number, start: Date) => {
        const counts = new Map<string, number>();
        for (const d of signups.filter((s) => s >= start)) counts.set(istDate(d), (counts.get(istDate(d)) ?? 0) + 1);
        return [...counts].map(([day, count]) => ({ day, count }));
      }),
    };
    return { prisma, svc: new AdminService(prisma as never, {} as never, {} as never, {} as never) };
  }

  it('returns real per-day signups and running totals for the window', async () => {
    const { svc } = service();
    const result = await svc.getMemberActivity(7, new Date('2026-10-03T20:00:00.000Z'));

    expect(result.timezone).toBe('Asia/Kolkata');
    expect(result.points.map((p) => [p.date, p.newSignups, p.totalMembers])).toEqual([
      ['2026-09-28', 1, 3],
      ['2026-09-29', 0, 3],
      ['2026-09-30', 0, 3],
      ['2026-10-01', 1, 4],
      ['2026-10-02', 1, 5],
      ['2026-10-03', 0, 5],
      ['2026-10-04', 1, 6],
    ]);
    // The last point equals every account created up to now.
    expect(result.points.at(-1)!.totalMembers).toBe(signups.length);
  });

  it('a wider window moves earlier signups out of the baseline and into the series', async () => {
    const { svc } = service();
    const result = await svc.getMemberActivity(30, new Date('2026-10-03T20:00:00.000Z'));
    expect(result.points).toHaveLength(30);
    expect(result.points[0]).toEqual({ date: '2026-09-05', newSignups: 0, totalMembers: 0 });
    expect(result.points.find((p) => p.date === '2026-09-20')).toEqual({ date: '2026-09-20', newSignups: 1, totalMembers: 1 });
    expect(result.points.at(-1)!.totalMembers).toBe(signups.length);
  });

  it('accepts only 7, 30 or 90 days', () => {
    expect(memberActivityQuerySchema.parse({ days: '30' })).toEqual({ days: 30 });
    for (const days of ['0', '14', '365', 'x']) expect(memberActivityQuerySchema.safeParse({ days }).success).toBe(false);
  });
});
