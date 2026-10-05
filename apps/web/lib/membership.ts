// Pure display helpers for the Membership page (unit-tested in
// membership.spec.ts). Everything shown comes from GET /membership-plans and
// GET /me/membership; these only format it.

export function formatPrice(priceInPaise: number): string {
  return `₹${(priceInPaise / 100).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
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
