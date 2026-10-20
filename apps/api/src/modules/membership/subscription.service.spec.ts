import { ConflictException } from '@nestjs/common';
import { describe, expect, it } from 'vitest';
import { billingWorld } from '../../common/testing/billing-world.js';

/* eslint-disable @typescript-eslint/no-explicit-any */
const DAY = 86400000;
const NOW = new Date('2026-10-07T06:00:00Z');
const at = (days: number) => new Date(NOW.getTime() + days * DAY);

const span = (s: any) => [s.startedAt.toISOString(), s.expiresAt.toISOString()];

describe('SubscriptionService.activate', () => {
  it('with no current plan, starts now', async () => {
    const w = billingWorld();
    const { subscription, created } = await w.service.activate({ userId: 'u1', planId: 'gold', source: 'PAYMENT', orderId: 'o1' }, NOW);
    expect(created).toBe(true);
    expect(span(subscription)).toEqual(span({ startedAt: NOW, expiresAt: at(90) }));
    expect(w.notifications.notify).toHaveBeenCalledWith(expect.objectContaining({ type: 'PLAN_ACTIVATED', recipientUserId: 'u1' }));
  });

  it('chains after the current plan (no overlap), keeping its own length', async () => {
    const w = billingWorld();
    w.seed('gold', at(-10), at(80));
    const { subscription } = await w.service.activate({ userId: 'u1', planId: 'plus', source: 'ADMIN_GRANT', grantedByAdminId: 'a1', reason: 'goodwill', durationDays: 30 }, NOW);
    expect(span(subscription)).toEqual(span({ startedAt: at(80), expiresAt: at(110) }));
    expect(subscription).toMatchObject({ source: 'ADMIN_GRANT', grantedByAdminId: 'a1', grantReason: 'goodwill' });
  });

  it('a concurrent admin grant and webhook activation for one member never overlap', async () => {
    const w = billingWorld();
    const [a, b] = await Promise.all([
      w.service.activate({ userId: 'u1', planId: 'gold', source: 'PAYMENT', orderId: 'o1' }, NOW),
      w.service.activate({ userId: 'u1', planId: 'plus', source: 'ADMIN_GRANT', grantedByAdminId: 'a1', reason: 'x' }, NOW),
    ]);
    const [first, second] = [a.subscription, b.subscription].sort((x, y) => x.startedAt.getTime() - y.startedAt.getTime());
    expect(first!.startedAt.getTime()).toBe(NOW.getTime());
    expect(second!.startedAt.getTime()).toBe(first!.expiresAt.getTime());
  });

  it('is idempotent per order: a second activation of the same order creates nothing', async () => {
    const w = billingWorld();
    await w.service.activate({ userId: 'u1', planId: 'gold', source: 'PAYMENT', orderId: 'o1' }, NOW);
    const again = await w.service.activate({ userId: 'u1', planId: 'gold', source: 'PAYMENT', orderId: 'o1' }, NOW);
    expect(again.created).toBe(false);
    expect(w.subscriptions).toHaveLength(1);
    expect(w.notifications.notify).toHaveBeenCalledTimes(1);
  });

  it('sets the search tier from the plan now running', async () => {
    const w = billingWorld();
    await w.service.activate({ userId: 'u1', planId: 'premium', source: 'ADMIN_GRANT', reason: 'x' }, NOW);
    expect(w.profiles.u1!.searchBoost).toBe(2);
  });
});

describe('SubscriptionService.cancel and rechain', () => {
  it('cancelling the running plan starts the queued one immediately with its own length', async () => {
    const w = billingWorld();
    const running = w.seed('premium', at(-5), at(360));
    const queued = w.seed('gold', at(360), at(450));
    w.profiles.u1!.searchBoost = 2;

    await w.service.cancel(running.id, { adminId: 'a1', reason: 'requested by member' }, NOW);

    expect(running).toMatchObject({ status: 'CANCELLED', cancelledByAdminId: 'a1', cancelReason: 'requested by member' });
    expect(span(queued)).toEqual(span({ startedAt: NOW, expiresAt: at(90) }));
    expect(w.profiles.u1!.searchBoost).toBe(0);
    expect(w.notifications.notify).toHaveBeenCalledWith(expect.objectContaining({ type: 'PLAN_CANCELLED' }));
  });

  it('cancelling a queued plan moves the later ones up; the running plan is untouched', async () => {
    const w = billingWorld();
    const running = w.seed('gold', at(-10), at(80));
    const q1 = w.seed('plus', at(80), at(170));
    const q2 = w.seed('premium', at(170), at(535));
    const before = span(running);

    await w.service.cancel(q1.id, { adminId: 'a1', reason: 'duplicate grant' }, NOW);

    expect(span(running)).toEqual(before);
    expect(span(q2)).toEqual(span({ startedAt: at(80), expiresAt: at(445) }));
  });

  it('cannot cancel twice, or cancel a plan that already ended', async () => {
    const w = billingWorld();
    const s = w.seed('gold', at(-10), at(80));
    await w.service.cancel(s.id, { adminId: 'a1', reason: 'x' }, NOW);
    await expect(w.service.cancel(s.id, { adminId: 'a1', reason: 'x' }, NOW)).rejects.toBeInstanceOf(ConflictException);
    const ended = w.seed('gold', at(-100), at(-10));
    await expect(w.service.cancel(ended.id, { adminId: 'a1', reason: 'x' }, NOW)).rejects.toBeInstanceOf(ConflictException);
  });
});

describe('Admin refund', () => {
  function withPaidOrder() {
    const w = billingWorld();
    w.orders.push({ id: 'o1', userId: 'u1', planId: 'premium', amountInPaise: 599900, status: 'PAID' });
    const running = w.seed('premium', at(-5), at(360), { orderId: 'o1' });
    const q1 = w.seed('gold', at(360), at(450));
    const q2 = w.seed('plus', at(450), at(540));
    w.profiles.u1!.searchBoost = 2;
    w.unlocks.push({ viewerId: 'u1', subscriptionId: running.id });
    return { w, running, q1, q2 };
  }

  it('PAID -> REFUNDED: cancels that order’s plan and starts the two queued plans back to back with no gap', async () => {
    const { w, running, q1, q2 } = withPaidOrder();

    await w.admin.refund('a1', 'o1', 'duplicate payment', NOW);

    expect(w.orders[0]).toMatchObject({ status: 'REFUNDED', refundReason: 'duplicate payment', refundedByAdminId: 'a1', refundedAt: NOW });
    expect(running).toMatchObject({ status: 'CANCELLED', cancelReason: 'Order refunded: duplicate payment' });
    expect(span(q1)).toEqual(span({ startedAt: NOW, expiresAt: at(90) }));
    expect(span(q2)).toEqual(span({ startedAt: at(90), expiresAt: at(180) }));
    expect(w.profiles.u1!.searchBoost).toBe(0);
    expect(w.unlocks).toHaveLength(1); // unlocks already made stay
    expect(w.audit.record).toHaveBeenCalledWith('a1', 'order.refund', 'Order', 'o1', expect.objectContaining({ reason: 'duplicate payment' }));
  });

  it('a second refund of the same order is rejected and changes nothing', async () => {
    const { w } = withPaidOrder();
    await w.admin.refund('a1', 'o1', 'duplicate payment', NOW);
    const snapshot = JSON.stringify(w.subscriptions);
    await expect(w.admin.refund('a1', 'o1', 'again', NOW)).rejects.toThrow('Only a paid order can be refunded');
    expect(JSON.stringify(w.subscriptions)).toBe(snapshot);
  });

  it('only a PAID order can be refunded', async () => {
    const w = billingWorld();
    w.orders.push({ id: 'o2', userId: 'u1', planId: 'gold', amountInPaise: 149900, status: 'CREATED' });
    await expect(w.admin.refund('a1', 'o2', 'not paid', NOW)).rejects.toBeInstanceOf(ConflictException);
    expect(w.orders[0].status).toBe('CREATED');
  });
});
