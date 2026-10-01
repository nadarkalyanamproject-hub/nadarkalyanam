import type { Prisma } from '../generated/prisma/client.js';
import type { PrismaService } from '../modules/prisma/prisma.service.js';

// Profile filters shared by the Matches categories and Search, so a rule like
// "nearby" means exactly the same thing on both pages.

const DAY_MS = 24 * 60 * 60 * 1000;

// Created in the last `days` days ("Newly Joined" uses 30).
export function joinedWithinWhere(days: number, now = new Date()): Prisma.ProfileWhereInput {
  return { createdAt: { gte: new Date(now.getTime() - days * DAY_MS) } };
}

// At least one photo ("With Photos").
export const WITH_PHOTO_WHERE: Prisma.ProfileWhereInput = { photos: { some: {} } };

export interface CallerLocation {
  city: string | null;
  state: string | null;
}

export async function getCallerLocation(prisma: PrismaService, callerUserId: string): Promise<CallerLocation> {
  const own = await prisma.profile.findUnique({ where: { userId: callerUserId } });
  const location = (own?.details as { location?: { city?: string; state?: string } } | null)?.location;
  return { city: location?.city?.trim() || null, state: location?.state?.trim() || null };
}

// No geolocation exists: "nearby" means the same city or the same state as
// the caller's own stored location (whole value, case-insensitive). Null when
// the caller has no location, i.e. nobody can be nearby.
export function nearbyWhere({ city, state }: CallerLocation): Prisma.ProfileWhereInput | null {
  if (!city && !state) return null;
  return {
    OR: [
      ...(city ? [{ details: { path: ['location', 'city'], equals: city, mode: 'insensitive' as const } }] : []),
      ...(state ? [{ details: { path: ['location', 'state'], equals: state, mode: 'insensitive' as const } }] : []),
    ],
  };
}

// Height is stored as text: the onboarding picker saves `5'4" (163 cm)`, and
// older profiles hold free text such as "170 cm", "5ft 8in" or "5 ft 10 in".
// Returns whole centimetres, or null when the value isn't a readable height.
export function parseHeightCm(raw: unknown): number | null {
  if (typeof raw !== 'string') return null;
  const value = raw.trim().toLowerCase();
  const cm = value.match(/^(?:.*\()?\s*(\d{2,3})\s*cm\s*\)?$/);
  if (cm) return Number(cm[1]);
  const feet = value.match(/^(\d)\s*(?:'|ft|feet)\s*(?:(\d{1,2})\s*(?:"|in|inch|inches)?)?$/);
  if (feet) {
    const inches = Number(feet[1]) * 12 + Number(feet[2] ?? 0);
    return Math.round(inches * 2.54);
  }
  return null;
}

// Annual income is free text in lakhs ("8-12 LPA", "10LPA", "14 - 18 Lakhs").
// Only values that state a lakh unit are read — a bare number such as "10" is
// ambiguous and returns null rather than being guessed. A single amount is a
// range of one value.
export function parseIncomeLakhs(raw: unknown): { min: number; max: number } | null {
  if (typeof raw !== 'string') return null;
  const value = raw.trim().toLowerCase();
  const unit = String.raw`\s*(?:lpa|lakhs?|lacs?|l)\.?`;
  const num = String.raw`(\d+(?:\.\d+)?)`;
  const range = value.match(new RegExp(`^${num}\\s*(?:-|–|to)\\s*${num}${unit}$`));
  if (range) {
    const [a, b] = [Number(range[1]), Number(range[2])];
    return { min: Math.min(a, b), max: Math.max(a, b) };
  }
  const single = value.match(new RegExp(`^${num}${unit}$`));
  if (single) return { min: Number(single[1]), max: Number(single[1]) };
  return null;
}

// Inclusive overlap: a profile earning "8-12 LPA" matches a 10-15 lakh search.
export function rangesOverlap(value: { min: number; max: number }, min?: number, max?: number): boolean {
  return (min === undefined || value.max >= min) && (max === undefined || value.min <= max);
}
