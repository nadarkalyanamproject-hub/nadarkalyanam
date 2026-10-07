import { z } from 'zod';
import { photoStatusEnum } from './photo.js';
import { doshamEnum } from './profile.js';
import { INDIA_STATES_AND_UTS } from './reference-data.js';

// Horoscope (jathagam) details. Stored codes are stable uppercase keys; the
// labels use the Tamil spellings common in Tamil matrimony (the product is
// Tamil Nadu-first), with the English sign name alongside for rasis.

// The 12 rasis (moon signs). Lagnam (ascendant) uses the same 12 signs.
export const RASIS = [
  { code: 'MESHAM', label: 'Mesham', english: 'Aries' },
  { code: 'RISHABAM', label: 'Rishabam', english: 'Taurus' },
  { code: 'MITHUNAM', label: 'Mithunam', english: 'Gemini' },
  { code: 'KADAGAM', label: 'Kadagam', english: 'Cancer' },
  { code: 'SIMMAM', label: 'Simmam', english: 'Leo' },
  { code: 'KANNI', label: 'Kanni', english: 'Virgo' },
  { code: 'THULAM', label: 'Thulam', english: 'Libra' },
  { code: 'VIRUCHIGAM', label: 'Viruchigam', english: 'Scorpio' },
  { code: 'DHANUSU', label: 'Dhanusu', english: 'Sagittarius' },
  { code: 'MAGARAM', label: 'Magaram', english: 'Capricorn' },
  { code: 'KUMBAM', label: 'Kumbam', english: 'Aquarius' },
  { code: 'MEENAM', label: 'Meenam', english: 'Pisces' },
] as const;
export const RASI_CODES = RASIS.map((r) => r.code) as unknown as readonly [(typeof RASIS)[number]['code'], ...(typeof RASIS)[number]['code'][]];
export const rasiEnum = z.enum(RASI_CODES);
export type Rasi = z.infer<typeof rasiEnum>;

// The 27 nakshatras (birth stars), in their traditional order.
export const NAKSHATRAS = [
  { code: 'ASHWINI', label: 'Ashwini' },
  { code: 'BHARANI', label: 'Bharani' },
  { code: 'KARTHIGAI', label: 'Karthigai' },
  { code: 'ROHINI', label: 'Rohini' },
  { code: 'MIRUGASIRISHAM', label: 'Mirugasirisham' },
  { code: 'THIRUVATHIRAI', label: 'Thiruvathirai' },
  { code: 'PUNARPOOSAM', label: 'Punarpoosam' },
  { code: 'POOSAM', label: 'Poosam' },
  { code: 'AYILYAM', label: 'Ayilyam' },
  { code: 'MAGAM', label: 'Magam' },
  { code: 'POORAM', label: 'Pooram' },
  { code: 'UTHIRAM', label: 'Uthiram' },
  { code: 'HASTHAM', label: 'Hastham' },
  { code: 'CHITHIRAI', label: 'Chithirai' },
  { code: 'SWATHI', label: 'Swathi' },
  { code: 'VISAKAM', label: 'Visakam' },
  { code: 'ANUSHAM', label: 'Anusham' },
  { code: 'KETTAI', label: 'Kettai' },
  { code: 'MOOLAM', label: 'Moolam' },
  { code: 'POORADAM', label: 'Pooradam' },
  { code: 'UTHIRADAM', label: 'Uthiradam' },
  { code: 'THIRUVONAM', label: 'Thiruvonam' },
  { code: 'AVITTAM', label: 'Avittam' },
  { code: 'SADHAYAM', label: 'Sadhayam' },
  { code: 'POORATTATHI', label: 'Poorattathi' },
  { code: 'UTHIRATTATHI', label: 'Uthirattathi' },
  { code: 'REVATHI', label: 'Revathi' },
] as const;
export const NAKSHATRA_CODES = NAKSHATRAS.map((n) => n.code) as unknown as readonly [
  (typeof NAKSHATRAS)[number]['code'],
  ...(typeof NAKSHATRAS)[number]['code'][],
];
export const nakshatraEnum = z.enum(NAKSHATRA_CODES);
export type Nakshatra = z.infer<typeof nakshatraEnum>;

// Who may see the horoscope. HIDDEN (the default until the member chooses)
// shows it to nobody but the member. CONNECTED: members they're connected
// with (an accepted interest either way). EVERYONE: any member who can see
// the profile. Lists (Search, Matches, Browse) never carry horoscope fields
// whatever the setting — only the single profile view does.
export const horoscopeVisibilityEnum = z.enum(['EVERYONE', 'CONNECTED', 'HIDDEN']);
export type HoroscopeVisibility = z.infer<typeof horoscopeVisibilityEnum>;

const blankToNull = (value: unknown) => (typeof value === 'string' && value.trim() === '' ? null : value);

// PUT /me/horoscope. Every detail is optional (null = not given).
export const updateHoroscopeSchema = z
  .object({
    // 24-hour HH:MM.
    birthTime: z.preprocess(
      blankToNull,
      z
        .string()
        .regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Use HH:MM (24-hour)')
        .nullable(),
    ),
    birthCity: z.preprocess(blankToNull, z.string().trim().max(60).nullable()),
    birthState: z.preprocess(blankToNull, z.enum(INDIA_STATES_AND_UTS).nullable()),
    birthCountry: z.preprocess(blankToNull, z.string().trim().max(60).nullable()),
    rasi: z.preprocess(blankToNull, rasiEnum.nullable()),
    nakshatra: z.preprocess(blankToNull, nakshatraEnum.nullable()),
    nakshatraPada: z.preprocess(blankToNull, z.number().int().min(1).max(4).nullable()),
    lagnam: z.preprocess(blankToNull, rasiEnum.nullable()),
    sevvaiDosham: z.preprocess(blankToNull, doshamEnum.nullable()),
    raguKethuDosham: z.preprocess(blankToNull, doshamEnum.nullable()),
    visibility: horoscopeVisibilityEnum,
    // Birth time and place are more sensitive: even when the horoscope is
    // shared, they're shown only if this is also on.
    shareBirthDetails: z.boolean(),
  })
  .strict()
  .superRefine((value, ctx) => {
    if (value.nakshatraPada !== null && value.nakshatra === null) {
      ctx.addIssue({
        code: 'custom',
        path: ['nakshatraPada'],
        message: 'Choose the nakshatra first',
      });
    }
    if (value.birthState !== null && value.birthCountry !== null && value.birthCountry.toLowerCase() !== 'india') {
      ctx.addIssue({
        code: 'custom',
        path: ['birthState'],
        message: 'State applies to India only',
      });
    }
  });
export type UpdateHoroscopeRequest = z.infer<typeof updateHoroscopeSchema>;

// The chart image as its owner (or an admin) sees it, with its moderation
// state. Other members only ever get an APPROVED chart's URL.
export const horoscopeChartSchema = z.object({
  url: z.string(),
  status: photoStatusEnum,
  rejectionReason: z.string().nullable(),
});
export type HoroscopeChart = z.infer<typeof horoscopeChartSchema>;

// The member's own horoscope (GET/PUT /me/horoscope).
export const horoscopeDetailsSchema = z.object({
  birthTime: z.string().nullable(),
  birthCity: z.string().nullable(),
  birthState: z.string().nullable(),
  birthCountry: z.string().nullable(),
  rasi: rasiEnum.nullable(),
  nakshatra: nakshatraEnum.nullable(),
  nakshatraPada: z.number().nullable(),
  lagnam: rasiEnum.nullable(),
  sevvaiDosham: doshamEnum.nullable(),
  raguKethuDosham: doshamEnum.nullable(),
});
export const myHoroscopeSchema = horoscopeDetailsSchema.extend({
  visibility: horoscopeVisibilityEnum,
  shareBirthDetails: z.boolean(),
  chart: horoscopeChartSchema.nullable(),
  updatedAt: z.string(),
});
export type MyHoroscope = z.infer<typeof myHoroscopeSchema>;
export const myHoroscopeResponseSchema = z.object({
  horoscope: myHoroscopeSchema.nullable(),
});
export type MyHoroscopeResponse = z.infer<typeof myHoroscopeResponseSchema>;

// What another member may see on a profile page. `shared: false` covers
// both "hidden from you" and "not added", so the viewer can't tell which.
// Birth time/place are null unless the owner also chose to share them.
export const horoscopeViewSchema = z.discriminatedUnion('shared', [
  z.object({ shared: z.literal(false) }),
  z.object({
    shared: z.literal(true),
    rasi: rasiEnum.nullable(),
    nakshatra: nakshatraEnum.nullable(),
    nakshatraPada: z.number().nullable(),
    lagnam: rasiEnum.nullable(),
    sevvaiDosham: doshamEnum.nullable(),
    raguKethuDosham: doshamEnum.nullable(),
    birthTime: z.string().nullable(),
    birthPlace: z
      .object({
        city: z.string().nullable(),
        state: z.string().nullable(),
        country: z.string().nullable(),
      })
      .nullable(),
    chartImageUrl: z.string().nullable(),
  }),
]);
export type HoroscopeView = z.infer<typeof horoscopeViewSchema>;

// Chart upload (same flow as profile photos: signed upload URL, then confirm).
export const HOROSCOPE_CHART_CONTENT_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const;
export const horoscopeChartUploadRequestSchema = z.object({
  contentType: z.enum(HOROSCOPE_CHART_CONTENT_TYPES),
});
export type HoroscopeChartUploadRequest = z.infer<typeof horoscopeChartUploadRequestSchema>;
export const confirmHoroscopeChartSchema = z.object({
  objectKey: z.string().min(1, 'objectKey is required'),
});
export type ConfirmHoroscopeChartRequest = z.infer<typeof confirmHoroscopeChartSchema>;

export function rasiLabel(code: string | null | undefined): string | null {
  const rasi = RASIS.find((r) => r.code === code);
  return rasi ? `${rasi.label} (${rasi.english})` : null;
}
export function nakshatraLabel(code: string | null | undefined): string | null {
  return NAKSHATRAS.find((n) => n.code === code)?.label ?? null;
}
