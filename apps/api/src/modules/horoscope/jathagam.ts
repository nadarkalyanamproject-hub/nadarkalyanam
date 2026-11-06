import { Body, Ecliptic, GeoVector, MakeTime, SiderealTime, SunPosition, e_tilt } from 'astronomy-engine';
import {
  type GeneratedHoroscope,
  type Graha,
  NAKSHATRA_CODES,
  RASI_CODES,
  birthPlaceFor,
} from '@nadar-kalyanam/schemas';

// Works out a member's horoscope (jathagam) from their date, time and place
// of birth, the way Tamil almanacs do: sidereal positions with the Lahiri
// (Chitrapaksha) ayanamsa, India Standard Time, mean Rahu/Ketu.
// Accuracy: well within a minute of arc for the moon, so the star and pada
// are right except for births a few minutes from a boundary.

const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;
const DEG = Math.PI / 180;
const norm = (deg: number) => ((deg % 360) + 360) % 360;

// Lahiri ayanamsa (degrees) at a moment, T in Julian centuries from J2000.
function lahiriAyanamsa(T: number): number {
  return 23.85305 + 1.396971278 * T + 0.000308889 * T * T;
}

// Mean longitude of the moon's ascending node (Rahu), tropical degrees.
function meanRahu(T: number): number {
  return norm(125.04452 - 1934.136261 * T + 0.0020708 * T * T + (T * T * T) / 450000);
}

// The ascendant's tropical longitude for a local sidereal time (degrees),
// latitude and obliquity.
function ascendant(lstDeg: number, latDeg: number, oblDeg: number): number {
  const lst = lstDeg * DEG;
  const eps = oblDeg * DEG;
  const lat = latDeg * DEG;
  return norm(Math.atan2(Math.cos(lst), -(Math.sin(lst) * Math.cos(eps) + Math.tan(lat) * Math.sin(eps))) / DEG);
}

const PLANET_BODIES: [Graha, Body][] = [
  ['MOON', Body.Moon],
  ['MARS', Body.Mars],
  ['MERCURY', Body.Mercury],
  ['JUPITER', Body.Jupiter],
  ['VENUS', Body.Venus],
  ['SATURN', Body.Saturn],
];

export interface BirthDetails {
  // The profile's date of birth (stored as UTC midnight of that date).
  dateOfBirth: Date;
  // HH:MM, 24-hour, India time.
  birthTime: string | null;
  birthCity: string | null;
  birthState: string | null;
  birthCountry: string | null;
}

// The sidereal longitudes (degrees) of the nine grahas and the lagnam at a
// moment and place. Exported for tests.
export function siderealPositions(utc: Date, lat: number, lon: number): { grahas: Record<Graha, number>; lagnam: number } {
  const time = MakeTime(utc);
  const T = time.tt / 36525;
  const ayanamsa = lahiriAyanamsa(T);
  const sidereal = (tropical: number) => norm(tropical - ayanamsa);
  const grahas = { SUN: sidereal(SunPosition(time).elon) } as Record<Graha, number>;
  for (const [graha, body] of PLANET_BODIES) grahas[graha] = sidereal(Ecliptic(GeoVector(body, time, true)).elon);
  grahas.RAHU = sidereal(meanRahu(T));
  grahas.KETU = norm(grahas.RAHU + 180);
  const lst = norm(SiderealTime(time) * 15 + lon);
  return { grahas, lagnam: sidereal(ascendant(lst, lat, e_tilt(time).tobl)) };
}

// The horoscope, or null when there isn't enough to cast it: the birth time
// and a recognisable place (a listed city, or at least the state) in India.
export function generateHoroscope(details: BirthDetails): GeneratedHoroscope | null {
  const { birthTime, birthCountry } = details;
  if (!birthTime || !/^([01]\d|2[0-3]):[0-5]\d$/.test(birthTime)) return null;
  if (birthCountry && birthCountry.trim().toLowerCase() !== 'india') return null;
  const where = birthPlaceFor(details.birthCity, details.birthState);
  if (!where) return null;

  const [hours, minutes] = birthTime.split(':').map(Number) as [number, number];
  const dob = details.dateOfBirth;
  const utc = new Date(Date.UTC(dob.getUTCFullYear(), dob.getUTCMonth(), dob.getUTCDate(), hours, minutes) - IST_OFFSET_MS);
  const { grahas, lagnam } = siderealPositions(utc, where.place.lat, where.place.lon);

  const sign = (deg: number) => RASI_CODES[Math.floor(deg / 30)]!;
  const moon = grahas.MOON;
  const starSpan = 360 / 27;
  return {
    rasi: sign(moon),
    nakshatra: NAKSHATRA_CODES[Math.floor(moon / starSpan)]!,
    nakshatraPada: Math.floor((moon % starSpan) / (starSpan / 4)) + 1,
    lagnam: sign(lagnam),
    planets: Object.fromEntries(Object.entries(grahas).map(([graha, deg]) => [graha, sign(deg)])) as GeneratedHoroscope['planets'],
    place: { city: where.place.city, state: where.place.state },
    approximatePlace: where.approximate,
  };
}
