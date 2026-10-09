import { describe, expect, it } from 'vitest';
import {
  daysLeft,
  daysLeftLabel,
  discountPercent,
  durationLabel,
  formatPrice,
  membershipBanner,
  supportContactLinks,
  whatsappHref,
} from './membership';

describe('membership display helpers', () => {
  it('formats paise as rupees', () => {
    expect(formatPrice(149900)).toBe('₹1,499');
    expect(formatPrice(1499900)).toBe('₹14,999');
  });

  it('labels plan durations', () => {
    expect(durationLabel(90)).toBe('3 months');
    expect(durationLabel(180)).toBe('6 months');
    expect(durationLabel(365)).toBe('12 months');
    expect(durationLabel(30)).toBe('1 month');
    expect(durationLabel(45)).toBe('45 days');
  });

  it('builds a WhatsApp link only from a real-looking number', () => {
    expect(whatsappHref('919812345678', 'Hi there')).toBe('https://wa.me/919812345678?text=Hi%20there');
    expect(whatsappHref('+91 98123 45678', 'x')).toBe('https://wa.me/919812345678?text=x');
    expect(whatsappHref(undefined, 'x')).toBeNull();
    expect(whatsappHref('', 'x')).toBeNull();
    expect(whatsappHref('call-us', 'x')).toBeNull();
  });
});

describe('daysLeft and membershipBanner (India time)', () => {
  // 6 Oct 2026, 20:00 IST.
  const NOW = new Date('2026-10-06T14:30:00Z');

  it('counts India-time calendar days, not 24-hour blocks', () => {
    expect(daysLeft('2026-10-06T18:29:00Z', NOW)).toBe(0); // 23:59 IST today
    expect(daysLeft('2026-10-06T18:31:00Z', NOW)).toBe(1); // 00:01 IST tomorrow
    expect(daysLeft('2026-10-13T06:00:00Z', NOW)).toBe(7);
    expect(daysLeft('2026-10-01T00:00:00Z', NOW)).toBe(0);
    expect(daysLeftLabel(0)).toBe('ends today');
    expect(daysLeftLabel(1)).toBe('1 day left');
  });

  const active = (expiresAt: string, paidThroughAt = expiresAt) => ({ status: 'ACTIVE' as const, expiresAt, paidThroughAt, lastEnded: null });

  it('expiring: 7 IST days or fewer and no renewal queued', () => {
    expect(membershipBanner(active('2026-10-13T06:00:00Z'), NOW)).toEqual({ kind: 'EXPIRING', expiresAt: '2026-10-13T06:00:00Z', daysLeft: 7 });
    expect(membershipBanner(active('2026-10-14T06:00:00Z'), NOW)).toBeNull();
    expect(membershipBanner(active('2026-10-10T06:00:00Z', '2027-01-08T06:00:00Z'), NOW)).toBeNull();
  });

  it('expired and cancelled states for a free member; nothing for someone who never had a plan', () => {
    const free = { status: 'FREE' as const, expiresAt: null, paidThroughAt: null };
    expect(membershipBanner({ ...free, lastEnded: { planName: 'Gold', endedAt: '2026-10-01T00:00:00Z', kind: 'EXPIRED' } }, NOW)).toEqual({
      kind: 'EXPIRED',
      planName: 'Gold',
      endedAt: '2026-10-01T00:00:00Z',
    });
    expect(membershipBanner({ ...free, lastEnded: { planName: 'Gold', endedAt: '2026-10-02T00:00:00Z', kind: 'CANCELLED' } }, NOW)?.kind).toBe('CANCELLED');
    expect(membershipBanner({ ...free, lastEnded: null }, NOW)).toBeNull();
  });
});

describe('plan card pricing', () => {
  it('shows a discount only when the original price is really higher', () => {
    expect(discountPercent(340000, 550000)).toBe(38);
    expect(discountPercent(460000, 790000)).toBe(42);
    expect(discountPercent(149900, null)).toBeNull();
    expect(discountPercent(149900, 149900)).toBeNull();
    expect(discountPercent(149900, 100000)).toBeNull();
  });
});

describe('support contact links', () => {
  it('shows only configured details', () => {
    expect(supportContactLinks({ email: 'help@example.org', whatsappNumber: '919812345678' })).toEqual([
      { kind: 'email', label: 'help@example.org', href: 'mailto:help@example.org' },
      { kind: 'whatsapp', label: '+919812345678', href: expect.stringMatching(/^https:\/\/wa\.me\/919812345678\?text=/) },
    ]);
    expect(supportContactLinks({ email: null, whatsappNumber: '919812345678' }).map((l) => l.kind)).toEqual(['whatsapp']);
  });

  it('returns nothing when nothing is configured', () => {
    expect(supportContactLinks({ email: null, whatsappNumber: null })).toEqual([]);
    expect(supportContactLinks(null)).toEqual([]);
  });
});
