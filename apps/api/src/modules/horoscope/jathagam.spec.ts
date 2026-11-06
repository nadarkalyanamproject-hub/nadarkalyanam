import { describe, expect, it } from 'vitest';
import { computePorutham, poruthamVerdict } from '@nadar-kalyanam/schemas';
import { generateHoroscope } from './jathagam.js';

const birth = (date: string, birthTime: string | null, birthCity: string | null, birthState: string | null = null) => ({
  dateOfBirth: new Date(`${date}T00:00:00.000Z`),
  birthTime,
  birthCity,
  birthState,
  birthCountry: 'India',
});

describe('generateHoroscope', () => {
  // India's independence chart (15 Aug 1947, 00:00 IST, Delhi), the most
  // published chart there is: lagnam 7°46' Rishabam, moon 3°59' Kadagam.
  it('matches the well-known chart for 15 Aug 1947, midnight, Delhi', () => {
    const h = generateHoroscope(birth('1947-08-15', '00:00', 'Delhi'))!;
    expect(h.lagnam).toBe('RISHABAM');
    expect(h.rasi).toBe('KADAGAM');
    expect(h.nakshatra).toBe('POOSAM');
    expect(h.nakshatraPada).toBe(1);
    expect(h.planets).toEqual({
      SUN: 'KADAGAM',
      MOON: 'KADAGAM',
      MARS: 'MITHUNAM',
      MERCURY: 'KADAGAM',
      JUPITER: 'THULAM',
      VENUS: 'KADAGAM',
      SATURN: 'KADAGAM',
      RAHU: 'RISHABAM',
      KETU: 'VIRUCHIGAM',
    });
    expect(h.approximatePlace).toBe(false);
  });

  it('falls back to the state capital for an unlisted town, and says so', () => {
    const h = generateHoroscope(birth('1995-03-10', '06:30', 'Some Village', 'Tamil Nadu'))!;
    expect(h.place!.city).toBe('Chennai');
    expect(h.approximatePlace).toBe(true);
  });

  it('knows the common old spellings', () => {
    expect(generateHoroscope(birth('1995-03-10', '06:30', 'Trichy'))!.place!.city).toBe('Tiruchirappalli');
  });

  it('needs the birth time and a place in India', () => {
    expect(generateHoroscope(birth('1995-03-10', null, 'Chennai'))).toBeNull();
    expect(generateHoroscope(birth('1995-03-10', '06:30', null))).toBeNull();
    expect(generateHoroscope({ ...birth('1995-03-10', '06:30', 'Chennai'), birthCountry: 'Singapore' })).toBeNull();
  });
});

describe('computePorutham', () => {
  it('fails Rajju for two stars in the same rajju, and Vedhai for a vedhai pair', () => {
    const sameRajju = computePorutham({ nakshatra: 'ASHWINI', rasi: 'MESHAM' }, { nakshatra: 'MAGAM', rasi: 'SIMMAM' });
    expect(sameRajju.find((r) => r.key === 'RAJJU')!.matched).toBe(false);
    expect(poruthamVerdict(sameRajju)).toBe('NOT_RECOMMENDED');

    const vedhai = computePorutham({ nakshatra: 'ASHWINI', rasi: 'MESHAM' }, { nakshatra: 'KETTAI', rasi: 'VIRUCHIGAM' });
    expect(vedhai.find((r) => r.key === 'VEDHAI')!.matched).toBe(false);
  });

  it('counts from the bride to the groom', () => {
    // Ashwini to Rohini is 4: Dinam and Mahendram both hold.
    const results = computePorutham({ nakshatra: 'ASHWINI', rasi: 'MESHAM' }, { nakshatra: 'ROHINI', rasi: 'RISHABAM' });
    expect(results.find((r) => r.key === 'DINAM')!.matched).toBe(true);
    expect(results.find((r) => r.key === 'MAHENDRAM')!.matched).toBe(true);
    expect(results.find((r) => r.key === 'STREE_DEERGHAM')!.matched).toBe(false);
    expect(results).toHaveLength(10);
  });
});
