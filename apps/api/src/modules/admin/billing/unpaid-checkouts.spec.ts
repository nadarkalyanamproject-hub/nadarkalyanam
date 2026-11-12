import 'reflect-metadata';
import { RequestMethod } from '@nestjs/common';
import { describe, expect, it } from 'vitest';
import { PERMISSIONS } from '../../../common/permissions.js';
import { PERMISSION_METADATA_KEY } from '../decorators/require-permission.decorator.js';
import { AdminAuthGuard } from '../guards/admin-auth.guard.js';
import { PermissionsGuard } from '../guards/permissions.guard.js';
import { AdminUnpaidCheckoutsController } from './admin-unpaid-checkouts.controller.js';
import { buildUnpaidCheckouts, type UnpaidAttempt } from './unpaid-checkouts.js';

const NOW = new Date('2026-11-11T12:00:00Z');
const hoursAgo = (h: number) => new Date(NOW.getTime() - h * 60 * 60 * 1000);
const attempt = (over: Partial<UnpaidAttempt>): UnpaidAttempt => ({
  id: 'o1',
  userId: 'u1',
  kind: 'MEMBERSHIP',
  status: 'CREATED',
  amountInPaise: 149900,
  createdAt: hoursAgo(72),
  wanted: 'Gold',
  ...over,
});

describe('buildUnpaidCheckouts (left at payment)', () => {
  it('lists a member whose unpaid order is two days old or more', () => {
    const rows = buildUnpaidCheckouts([attempt({ createdAt: hoursAgo(48) })], [], NOW);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ userId: 'u1', wanted: 'Gold', attempts: 1, daysSinceLastAttempt: 2, lastStatus: 'CREATED' });
  });

  it('leaves out a member still inside the two days', () => {
    expect(buildUnpaidCheckouts([attempt({ createdAt: hoursAgo(47) })], [], NOW)).toEqual([]);
  });

  it('waits for the newest attempt: an old one plus a fresh retry is not listed yet', () => {
    const rows = buildUnpaidCheckouts([attempt({ id: 'old', createdAt: hoursAgo(100) }), attempt({ id: 'new', createdAt: hoursAgo(5) })], [], NOW);
    expect(rows).toEqual([]);
  });

  it('drops a member who paid for the same kind after their last attempt', () => {
    const rows = buildUnpaidCheckouts([attempt({ createdAt: hoursAgo(72) })], [{ userId: 'u1', kind: 'MEMBERSHIP', createdAt: hoursAgo(60) }], NOW);
    expect(rows).toEqual([]);
  });

  it('keeps a member whose payment was before the abandoned attempt, or for another kind', () => {
    const rows = buildUnpaidCheckouts(
      [attempt({ createdAt: hoursAgo(72) })],
      [
        { userId: 'u1', kind: 'MEMBERSHIP', createdAt: hoursAgo(500) },
        { userId: 'u1', kind: 'HOROSCOPE_MATCH', createdAt: hoursAgo(10) },
      ],
      NOW,
    );
    expect(rows).toHaveLength(1);
  });

  it('one row per member and kind, counting attempts, with the latest price and result', () => {
    const rows = buildUnpaidCheckouts(
      [
        attempt({ id: 'a', createdAt: hoursAgo(200), amountInPaise: 249900, wanted: 'Gold Plus' }),
        attempt({ id: 'b', createdAt: hoursAgo(80), status: 'FAILED' }),
        attempt({ id: 'c', kind: 'HOROSCOPE_MATCH', createdAt: hoursAgo(90), amountInPaise: 9900, wanted: 'Porutham report' }),
        attempt({ id: 'd', userId: 'u2', createdAt: hoursAgo(50) }),
      ],
      [],
      NOW,
    );
    expect(rows.map((r) => [r.userId, r.kind, r.attempts, r.lastOrderId, r.lastStatus, r.amountInPaise])).toEqual([
      ['u2', 'MEMBERSHIP', 1, 'd', 'CREATED', 149900],
      ['u1', 'MEMBERSHIP', 2, 'b', 'FAILED', 149900],
      ['u1', 'HOROSCOPE_MATCH', 1, 'c', 'CREATED', 9900],
    ]);
    expect(rows[1]!.firstAttemptAt).toEqual(hoursAgo(200));
  });
});

describe('AdminUnpaidCheckoutsController', () => {
  it('is GET /admin/unpaid-checkouts behind the admin guards and finance.dashboard.view', () => {
    const fn = AdminUnpaidCheckoutsController.prototype.list;
    expect(Reflect.getMetadata('__guards__', AdminUnpaidCheckoutsController)).toEqual([AdminAuthGuard, PermissionsGuard]);
    expect(Reflect.getMetadata('path', fn)).toBe('unpaid-checkouts');
    expect(Reflect.getMetadata('method', fn)).toBe(RequestMethod.GET);
    expect(Reflect.getMetadata(PERMISSION_METADATA_KEY, fn)).toBe(PERMISSIONS.FINANCE_DASHBOARD_VIEW);
  });
});
