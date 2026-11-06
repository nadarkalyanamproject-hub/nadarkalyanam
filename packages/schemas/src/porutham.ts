import { z } from 'zod';
import { NAKSHATRA_CODES, RASI_CODES, type Nakshatra, type Rasi, nakshatraEnum, rasiEnum } from './horoscope.js';
import { doshamEnum } from './profile.js';

// The ten poruthams of Tamil marriage matching, from the bride's and the
// groom's birth stars (nakshatra) and moon signs (rasi). Counting is always
// from the bride's star (or rasi) to the groom's, inclusive (same star = 1).
// Rajju and Vedha are the ones families treat as essential.

export const PORUTHAMS = [
  { key: 'DINAM', label: 'Dinam', about: 'Health and long, peaceful life together' },
  { key: 'GANAM', label: 'Ganam', about: 'Temperament' },
  { key: 'MAHENDRAM', label: 'Mahendram', about: 'Children and family growth' },
  { key: 'STREE_DEERGHAM', label: 'Stree Deergham', about: 'Prosperity and well-being' },
  { key: 'YONI', label: 'Yoni', about: 'Physical compatibility' },
  { key: 'RASI', label: 'Rasi', about: 'Family harmony' },
  { key: 'RASI_ATHIPATHI', label: 'Rasi Athipathi', about: 'Friendship of the rasi lords' },
  { key: 'VASIYAM', label: 'Vasiyam', about: 'Mutual attraction' },
  { key: 'RAJJU', label: 'Rajju', about: "The husband's long life (essential)" },
  { key: 'VEDHAI', label: 'Vedhai', about: 'Freedom from affliction (essential)' },
] as const;
export type PoruthamKey = (typeof PORUTHAMS)[number]['key'];
export const ESSENTIAL_PORUTHAMS: readonly PoruthamKey[] = ['RAJJU', 'VEDHAI'];

const N = (code: Nakshatra) => NAKSHATRA_CODES.indexOf(code);
const R = (code: Rasi) => RASI_CODES.indexOf(code);
const stars = (...codes: Nakshatra[]) => new Set(codes.map(N));

const DEVA = stars('ASHWINI', 'MIRUGASIRISHAM', 'PUNARPOOSAM', 'POOSAM', 'HASTHAM', 'SWATHI', 'ANUSHAM', 'THIRUVONAM', 'REVATHI');
const RAKSHASA = stars('KARTHIGAI', 'AYILYAM', 'MAGAM', 'CHITHIRAI', 'VISAKAM', 'KETTAI', 'MOOLAM', 'AVITTAM', 'SADHAYAM');
const gana = (n: number) => (DEVA.has(n) ? 'DEVA' : RAKSHASA.has(n) ? 'RAKSHASA' : 'MANUSHYA');

// Each star's yoni animal, in nakshatra order.
const YONI = [
  'Horse', 'Elephant', 'Goat', 'Serpent', 'Serpent', 'Dog', 'Cat', 'Goat', 'Cat', 'Rat', 'Rat', 'Cow', 'Buffalo', 'Tiger',
  'Buffalo', 'Tiger', 'Deer', 'Deer', 'Dog', 'Monkey', 'Mongoose', 'Monkey', 'Lion', 'Horse', 'Lion', 'Cow', 'Elephant',
];
const YONI_ENEMIES = [
  ['Horse', 'Buffalo'], ['Elephant', 'Lion'], ['Goat', 'Monkey'], ['Serpent', 'Mongoose'], ['Dog', 'Deer'], ['Cat', 'Rat'], ['Cow', 'Tiger'],
];

// Rasi lords, in rasi order, and their natural friendships.
type Lord = 'SUN' | 'MOON' | 'MARS' | 'MERCURY' | 'JUPITER' | 'VENUS' | 'SATURN';
const LORDS: Lord[] = ['MARS', 'VENUS', 'MERCURY', 'MOON', 'SUN', 'MERCURY', 'VENUS', 'MARS', 'JUPITER', 'SATURN', 'SATURN', 'JUPITER'];
const ENEMIES: Record<Lord, Lord[]> = {
  SUN: ['VENUS', 'SATURN'],
  MOON: [],
  MARS: ['MERCURY'],
  MERCURY: ['MOON'],
  JUPITER: ['MERCURY', 'VENUS'],
  VENUS: ['SUN', 'MOON'],
  SATURN: ['SUN', 'MOON', 'MARS'],
};

// Vasiyam: the rasis each rasi attracts, in rasi order (indexes).
const VASIYAM: number[][] = [[4, 7], [3, 6], [5], [7, 8], [6], [1, 11], [9], [3], [11], [10], [0], [9]];

// Rajju groups: feet, thigh, navel, neck, head.
const RAJJU = [
  stars('ASHWINI', 'AYILYAM', 'MAGAM', 'KETTAI', 'MOOLAM', 'REVATHI'),
  stars('BHARANI', 'POOSAM', 'POORAM', 'ANUSHAM', 'POORADAM', 'UTHIRATTATHI'),
  stars('KARTHIGAI', 'PUNARPOOSAM', 'UTHIRAM', 'VISAKAM', 'UTHIRADAM', 'POORATTATHI'),
  stars('ROHINI', 'THIRUVATHIRAI', 'HASTHAM', 'SWATHI', 'THIRUVONAM', 'SADHAYAM'),
  stars('MIRUGASIRISHAM', 'CHITHIRAI', 'AVITTAM'),
];
const RAJJU_NAMES = ['Paadha (feet)', 'Thodai (thigh)', 'Udhara (navel)', 'Kanta (neck)', 'Sirasu (head)'];
const rajju = (n: number) => RAJJU.findIndex((group) => group.has(n));

// Vedhai: pairs of stars that afflict each other.
const VEDHAI: [Nakshatra, Nakshatra][] = [
  ['ASHWINI', 'KETTAI'], ['BHARANI', 'ANUSHAM'], ['KARTHIGAI', 'VISAKAM'], ['ROHINI', 'SWATHI'], ['THIRUVATHIRAI', 'THIRUVONAM'],
  ['PUNARPOOSAM', 'UTHIRADAM'], ['POOSAM', 'POORADAM'], ['AYILYAM', 'MOOLAM'], ['MAGAM', 'REVATHI'], ['POORAM', 'UTHIRATTATHI'],
  ['UTHIRAM', 'POORATTATHI'], ['HASTHAM', 'SADHAYAM'], ['MIRUGASIRISHAM', 'AVITTAM'], ['MIRUGASIRISHAM', 'CHITHIRAI'], ['CHITHIRAI', 'AVITTAM'],
];

export const poruthamResultSchema = z.object({
  key: z.enum(PORUTHAMS.map((p) => p.key) as unknown as [PoruthamKey, ...PoruthamKey[]]),
  label: z.string(),
  about: z.string(),
  matched: z.boolean(),
  note: z.string(),
});
export type PoruthamResult = z.infer<typeof poruthamResultSchema>;

export interface PoruthamPerson {
  nakshatra: Nakshatra;
  rasi: Rasi;
}

export function computePorutham(bride: PoruthamPerson, groom: PoruthamPerson): PoruthamResult[] {
  const g = N(bride.nakshatra);
  const b = N(groom.nakshatra);
  const count = ((b - g + 27) % 27) + 1; // bride's star to groom's, 1..27
  const rasiCount = ((R(groom.rasi) - R(bride.rasi) + 12) % 12) + 1;
  const result = (key: PoruthamKey, matched: boolean, note: string): PoruthamResult => {
    const meta = PORUTHAMS.find((p) => p.key === key)!;
    return { key, label: meta.label, about: meta.about, matched, note };
  };

  const ganaB = gana(g);
  const ganaG = gana(b);
  const yoniB = YONI[g]!;
  const yoniG = YONI[b]!;
  const yoniEnemy = YONI_ENEMIES.some(([x, y]) => (x === yoniB && y === yoniG) || (x === yoniG && y === yoniB));
  const lordB = LORDS[R(bride.rasi)]!;
  const lordG = LORDS[R(groom.rasi)]!;
  const lordsEnemy = ENEMIES[lordB].includes(lordG) || ENEMIES[lordG].includes(lordB);
  const vasiyam = VASIYAM[R(bride.rasi)]!.includes(R(groom.rasi)) || VASIYAM[R(groom.rasi)]!.includes(R(bride.rasi));
  const rajjuB = rajju(g);
  const rajjuG = rajju(b);
  const vedhai = VEDHAI.some(([x, y]) => (x === bride.nakshatra && y === groom.nakshatra) || (x === groom.nakshatra && y === bride.nakshatra));
  const title = (s: string) => s.charAt(0) + s.slice(1).toLowerCase();

  return [
    result('DINAM', [0, 2, 4, 6, 8].includes(count % 9), `The groom's star is ${count} from the bride's`),
    result(
      'GANAM',
      ganaB === ganaG || (ganaB !== 'RAKSHASA' && ganaG !== 'RAKSHASA'),
      `Bride ${title(ganaB)} ganam, groom ${title(ganaG)} ganam`,
    ),
    result('MAHENDRAM', [4, 7, 10, 13, 16, 19, 22, 25].includes(count), `The groom's star is ${count} from the bride's`),
    result('STREE_DEERGHAM', count > 13, `The groom's star is ${count} from the bride's (more than 13 is good)`),
    result('YONI', !yoniEnemy, `Bride ${yoniB}, groom ${yoniG}${yoniEnemy ? ' (enemy yonis)' : ''}`),
    // 2/12, 5/9 and 6/8 apart are the combinations to avoid.
    result('RASI', [1, 3, 4, 7, 10, 11].includes(rasiCount), `The groom's rasi is ${rasiCount} from the bride's`),
    result(
      'RASI_ATHIPATHI',
      !lordsEnemy,
      `Lords ${title(lordB)} and ${title(lordG)}${lordsEnemy ? ' are enemies' : lordB === lordG ? ' (the same lord)' : ' are not enemies'}`,
    ),
    result('VASIYAM', vasiyam, vasiyam ? 'The rasis attract each other' : 'No vasiyam between the rasis'),
    result(
      'RAJJU',
      rajjuB !== rajjuG,
      rajjuB === rajjuG ? `Both in ${RAJJU_NAMES[rajjuB]} rajju` : `Bride ${RAJJU_NAMES[rajjuB]}, groom ${RAJJU_NAMES[rajjuG]}`,
    ),
    result('VEDHAI', !vedhai, vedhai ? 'The two stars afflict each other' : 'No vedhai between the stars'),
  ];
}

// "Good" needs both essentials and at least 6 of 10; "Average" both
// essentials and fewer; otherwise "Not recommended".
export function poruthamVerdict(results: PoruthamResult[]): 'GOOD' | 'AVERAGE' | 'NOT_RECOMMENDED' {
  const score = results.filter((r) => r.matched).length;
  const essentials = results.filter((r) => ESSENTIAL_PORUTHAMS.includes(r.key)).every((r) => r.matched);
  if (!essentials) return 'NOT_RECOMMENDED';
  return score >= 6 ? 'GOOD' : 'AVERAGE';
}

// --- API: GET /horoscope-match/:profileId ----------------------------------

const matchSideSchema = z.object({
  name: z.string(),
  nakshatra: nakshatraEnum,
  rasi: rasiEnum,
  sevvaiDosham: doshamEnum.nullable(),
  raguKethuDosham: doshamEnum.nullable(),
});

export const horoscopeMatchResponseSchema = z.discriminatedUnion('status', [
  // Can't be matched: one side has no rasi/nakshatra (or the other member
  // doesn't share their horoscope with the caller).
  z.object({
    status: z.literal('UNAVAILABLE'),
    reason: z.enum(['ADD_YOUR_HOROSCOPE', 'THEIR_HOROSCOPE_NOT_SHARED', 'SAME_GENDER']),
    message: z.string(),
  }),
  // Not bought yet for this pair.
  z.object({ status: z.literal('LOCKED'), priceInPaise: z.number().int() }),
  z.object({
    status: z.literal('READY'),
    bride: matchSideSchema,
    groom: matchSideSchema,
    results: z.array(poruthamResultSchema),
    score: z.number().int(),
    verdict: z.enum(['GOOD', 'AVERAGE', 'NOT_RECOMMENDED']),
  }),
]);
export type HoroscopeMatchResponse = z.infer<typeof horoscopeMatchResponseSchema>;
