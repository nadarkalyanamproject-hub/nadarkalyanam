// Pure display helpers for the Membership page (unit-tested in
// membership.spec.ts). Everything shown comes from GET /membership-plans and
// GET /me/membership; these only format it.

export function formatPrice(priceInPaise: number): string {
  return `₹${(priceInPaise / 100).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
}

// Whole-percent saving against the plan's original (struck-out) price, or
// null when there's no real discount to show.
export function discountPercent(priceInPaise: number, originalPriceInPaise: number | null): number | null {
  if (originalPriceInPaise === null || originalPriceInPaise <= priceInPaise) return null;
  const percent = Math.round(((originalPriceInPaise - priceInPaise) / originalPriceInPaise) * 100);
  return percent > 0 ? percent : null;
}

// 90 -> "3 months", 365 -> "12 months", 45 -> "45 days".
export function durationLabel(days: number): string {
  if (days === 365) return '12 months';
  if (days % 30 === 0) {
    const months = days / 30;
    return `${months} month${months === 1 ? '' : 's'}`;
  }
  return `${days} days`;
}

// "5 Oct 2026" — expiry dates, in India time.
export function formatPlanDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Asia/Kolkata' });
}

// The VIP enquiry link. NEXT_PUBLIC_WHATSAPP_NUMBER is digits with country
// code (e.g. 9198xxxxxxxx); anything else means there's no real number to
// offer, so callers hide the button.
export function whatsappHref(number: string | undefined, message: string): string | null {
  const digits = number?.replace(/[\s+-]/g, '') ?? '';
  if (!/^\d{10,15}$/.test(digits)) return null;
  return `https://wa.me/${digits}?text=${encodeURIComponent(message)}`;
}

const IST_OFFSET_MS = 330 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;
const istDayNumber = (d: Date) => Math.floor((d.getTime() + IST_OFFSET_MS) / DAY_MS);

// Whole India-time calendar days from now until the plan's end date:
// 0 = it ends today (IST), 1 = tomorrow, and so on. Never negative.
export function daysLeft(expiresAtIso: string, now: Date = new Date()): number {
  return Math.max(0, istDayNumber(new Date(expiresAtIso)) - istDayNumber(now));
}

export type MembershipBanner =
  | { kind: 'EXPIRING'; expiresAt: string; daysLeft: number }
  | { kind: 'EXPIRED'; planName: string; endedAt: string }
  | { kind: 'CANCELLED'; planName: string; endedAt: string }
  | null;

// Which notice the Membership page shows, from GET /me/membership:
//  - a running plan ending within 7 IST days with no renewal queued;
//  - no plan now, and the last one expired / was ended by our team.
export function membershipBanner(
  me: {
    status: 'ACTIVE' | 'FREE';
    expiresAt: string | null;
    paidThroughAt: string | null;
    lastEnded: { planName: string; endedAt: string; kind: 'EXPIRED' | 'CANCELLED' } | null;
  },
  now: Date = new Date(),
): MembershipBanner {
  if (me.status === 'ACTIVE' && me.expiresAt) {
    const renewalQueued = me.paidThroughAt !== null && me.paidThroughAt !== me.expiresAt;
    const left = daysLeft(me.expiresAt, now);
    return !renewalQueued && left <= 7 ? { kind: 'EXPIRING', expiresAt: me.expiresAt, daysLeft: left } : null;
  }
  if (me.lastEnded) return { kind: me.lastEnded.kind, planName: me.lastEnded.planName, endedAt: me.lastEnded.endedAt };
  return null;
}

export function daysLeftLabel(days: number): string {
  if (days === 0) return 'ends today';
  return `${days} day${days === 1 ? '' : 's'} left`;
}

// Links for the Contact page, built only from what GET /support/contact
// returned. Nothing configured -> no links (the page says so).
export function supportContactLinks(contact: { email: string | null; whatsappNumber: string | null } | null) {
  const links: { kind: 'email' | 'whatsapp'; label: string; href: string }[] = [];
  if (contact?.email) links.push({ kind: 'email', label: contact.email, href: `mailto:${contact.email}` });
  const wa = whatsappHref(contact?.whatsappNumber ?? undefined, 'Hi, I have a question about Nadar Kalyanam');
  if (wa && contact?.whatsappNumber) links.push({ kind: 'whatsapp', label: `+${contact.whatsappNumber}`, href: wa });
  return links;
}
