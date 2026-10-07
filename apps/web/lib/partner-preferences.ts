// Pure helpers for partner preferences and horoscope display (unit-tested in
// partner-preferences.spec.ts). Everything shown comes from the API; these
// only map form state and format values.
import {
  NAKSHATRAS,
  RASIS,
  type DoshamPreference,
  type HoroscopeView,
  type ListMatchesResponse,
  type MyHoroscope,
  type PartnerPreferencesRequest,
  type PreferenceFit,
  type PreferenceFitKey,
  type SavedPartnerPreferences,
  type UpdateHoroscopeRequest,
} from '@nadar-kalyanam/schemas';
import type { SearchFilters } from './search-query';

export const MARITAL_LABELS: Record<string, string> = {
  NEVER_MARRIED: 'Never married',
  DIVORCED: 'Divorced',
  WIDOWED: 'Widowed',
  AWAITING_DIVORCE: 'Awaiting divorce',
};

export const DOSHAM_PREFERENCE_LABELS: Record<DoshamPreference, string> = {
  DOESNT_MATTER: "Doesn't matter",
  WITHOUT_DOSHAM: 'No dosham',
  WITH_DOSHAM: 'Has dosham',
};

export const FIT_KEY_LABELS: Record<PreferenceFitKey, string> = {
  age: 'Age',
  height: 'Height',
  maritalStatus: 'Marital status',
  motherTongue: 'Mother tongue',
  location: 'Location',
  income: 'Income',
  dosham: 'Dosham',
};

// --- Preferences form -----------------------------------------------------

export interface PreferencesForm {
  ageMin: string;
  ageMax: string;
  heightMinCm: string;
  heightMaxCm: string;
  maritalStatuses: string[];
  motherTongues: string[];
  states: string[];
  cities: string[];
  incomeMinLakhs: string;
  incomeMaxLakhs: string;
  doshamPreference: DoshamPreference;
  mustHaveAge: boolean;
  mustHaveMaritalStatus: boolean;
  mustHaveLocation: boolean;
}

const str = (n: number | null) => (n === null ? '' : String(n));
const num = (s: string) => (s.trim() === '' ? null : Number(s));

export function preferencesFormFrom(saved: SavedPartnerPreferences | null): PreferencesForm {
  return {
    ageMin: str(saved?.ageMin ?? null),
    ageMax: str(saved?.ageMax ?? null),
    heightMinCm: str(saved?.heightMinCm ?? null),
    heightMaxCm: str(saved?.heightMaxCm ?? null),
    maritalStatuses: saved?.maritalStatuses ?? [],
    motherTongues: saved?.motherTongues ?? [],
    states: saved?.states ?? [],
    cities: saved?.cities ?? [],
    incomeMinLakhs: str(saved?.incomeMinLakhs ?? null),
    incomeMaxLakhs: str(saved?.incomeMaxLakhs ?? null),
    doshamPreference: saved?.doshamPreference ?? 'DOESNT_MATTER',
    mustHaveAge: saved?.mustHaveAge ?? false,
    mustHaveMaritalStatus: saved?.mustHaveMaritalStatus ?? false,
    mustHaveLocation: saved?.mustHaveLocation ?? false,
  };
}

export function toPreferencesRequest(form: PreferencesForm): PartnerPreferencesRequest {
  return {
    ageMin: num(form.ageMin),
    ageMax: num(form.ageMax),
    heightMinCm: num(form.heightMinCm),
    heightMaxCm: num(form.heightMaxCm),
    maritalStatuses: form.maritalStatuses as PartnerPreferencesRequest['maritalStatuses'],
    motherTongues: form.motherTongues as PartnerPreferencesRequest['motherTongues'],
    states: form.states as PartnerPreferencesRequest['states'],
    cities: form.cities,
    incomeMinLakhs: num(form.incomeMinLakhs),
    incomeMaxLakhs: num(form.incomeMaxLakhs),
    doshamPreference: form.doshamPreference,
    // A must-have only makes sense with a value; the API refuses otherwise.
    mustHaveAge: form.mustHaveAge,
    mustHaveMaritalStatus: form.mustHaveMaritalStatus,
    mustHaveLocation: form.mustHaveLocation,
  };
}

// "a, b" free-text city entry -> trimmed, non-empty names.
export function parseCityList(text: string): string[] {
  return [
    ...new Set(
      text
        .split(',')
        .map((c) => c.trim().replace(/\s+/g, ' '))
        .filter(Boolean),
    ),
  ];
}

function range(min: number | null, max: number | null, unit: (n: number) => string): string | null {
  if (min === null && max === null) return null;
  if (min !== null && max !== null) return `${unit(min)} – ${unit(max)}`;
  return min !== null ? `${unit(min)} or more` : `Up to ${unit(max!)}`;
}
export const formatLakhs = (lakhs: number) => (lakhs >= 100 ? `₹${lakhs / 100} Cr` : `₹${lakhs} L`);

// One line per preference that is set, for the read-only view. Must-haves
// are marked. Nothing set -> [].
export function preferenceSummary(saved: SavedPartnerPreferences): { label: string; value: string; mustHave: boolean }[] {
  const lines: { label: string; value: string; mustHave: boolean }[] = [];
  const add = (label: string, value: string | null, mustHave = false) => {
    if (value) lines.push({ label, value, mustHave });
  };
  add(
    'Age',
    range(saved.ageMin, saved.ageMax, (n) => `${n} yrs`),
    saved.mustHaveAge,
  );
  add(
    'Height',
    range(saved.heightMinCm, saved.heightMaxCm, (n) => `${n} cm`),
  );
  add('Marital status', saved.maritalStatuses.map((m) => MARITAL_LABELS[m] ?? m).join(', ') || null, saved.mustHaveMaritalStatus);
  add('Mother tongue', saved.motherTongues.join(', ') || null);
  add('Location', [...saved.states, ...saved.cities].join(', ') || null, saved.mustHaveLocation);
  add('Annual income', range(saved.incomeMinLakhs, saved.incomeMaxLakhs, formatLakhs));
  add('Dosham', saved.doshamPreference === 'DOESNT_MATTER' ? null : DOSHAM_PREFERENCE_LABELS[saved.doshamPreference]);
  return lines;
}

// "3 of 5 of your preferences match" (+ how many couldn't be checked).
export function preferenceFitLine(fit: PreferenceFit): string {
  const base = `${fit.matched} of ${fit.total} of your preferences match`;
  return fit.unknown > 0 ? `${base} (${fit.unknown} not stated on this profile)` : base;
}

// Matches: what to say when must-haves are holding members back.
export function mustHaveNotice(prefs: ListMatchesResponse['preferences'], shown: number): string | null {
  if (prefs.mustHave.length === 0 || prefs.hiddenByMustHave === 0) return null;
  const which = prefs.mustHave.map((k) => FIT_KEY_LABELS[k].toLowerCase()).join(', ');
  const n = prefs.hiddenByMustHave;
  const members = `${n} ${n === 1 ? 'member' : 'members'}`;
  return shown === 0
    ? `No members meet your must-have preferences (${which}). ${members} would show if you relaxed them.`
    : `Your must-have preferences (${which}) are hiding ${members}.`;
}

// --- Search "Use my preferences" ----------------------------------------------

export type PreferenceSearchFields = Pick<
  SearchFilters,
  | 'ageMin'
  | 'ageMax'
  | 'heightMinCm'
  | 'heightMaxCm'
  | 'incomeMinLakhs'
  | 'incomeMaxLakhs'
  | 'dosham'
  | 'maritalStatus'
  | 'motherTongue'
  | 'city'
  | 'maritalStatusIn'
  | 'motherTongueIn'
  | 'stateIn'
  | 'cityIn'
>;

// The Search filters the member's preferences fill in (soft and must-have
// alike — Search is an explicit filter). List preferences become "any of"
// lists; the matching single-value boxes are cleared so the two can't
// contradict each other.
export function searchFiltersFromPreferences(saved: SavedPartnerPreferences): PreferenceSearchFields {
  return {
    ageMin: str(saved.ageMin),
    ageMax: str(saved.ageMax),
    heightMinCm: str(saved.heightMinCm),
    heightMaxCm: str(saved.heightMaxCm),
    incomeMinLakhs: str(saved.incomeMinLakhs),
    incomeMaxLakhs: str(saved.incomeMaxLakhs),
    dosham: saved.doshamPreference === 'WITHOUT_DOSHAM' ? 'NO' : saved.doshamPreference === 'WITH_DOSHAM' ? 'YES' : '',
    maritalStatus: '',
    motherTongue: '',
    city: '',
    maritalStatusIn: saved.maritalStatuses.join(','),
    motherTongueIn: saved.motherTongues.join(','),
    stateIn: saved.states.join(','),
    cityIn: saved.cities.join(','),
  };
}

// --- Horoscope -----------------------------------------------------------------

export const HOROSCOPE_VISIBILITY_OPTIONS = [
  { value: 'HIDDEN', label: 'Hidden', help: 'Only you can see it.' },
  {
    value: 'CONNECTED',
    label: "Members I'm connected with",
    help: 'Members whose interest you accepted, or who accepted yours.',
  },
  {
    value: 'EVERYONE',
    label: 'Visible to all members',
    help: 'Any signed-in member who can see your profile.',
  },
] as const;

export const DOSHAM_FLAG_LABELS: Record<string, string> = {
  YES: 'Yes',
  NO: 'No',
  DONT_KNOW: "Don't know",
};

export function rasiName(code: string | null): string | null {
  const r = RASIS.find((x) => x.code === code);
  return r ? `${r.label} (${r.english})` : null;
}
export function nakshatraName(code: string | null, pada: number | null = null): string | null {
  const n = NAKSHATRAS.find((x) => x.code === code);
  return n ? (pada ? `${n.label}, pada ${pada}` : n.label) : null;
}

export interface HoroscopeForm {
  birthTime: string;
  birthCity: string;
  birthState: string;
  birthCountry: string;
  rasi: string;
  nakshatra: string;
  nakshatraPada: string;
  lagnam: string;
  sevvaiDosham: string;
  raguKethuDosham: string;
  visibility: 'EVERYONE' | 'CONNECTED' | 'HIDDEN';
  shareBirthDetails: boolean;
}

export function horoscopeFormFrom(saved: MyHoroscope | null): HoroscopeForm {
  return {
    birthTime: saved?.birthTime ?? '',
    birthCity: saved?.birthCity ?? '',
    birthState: saved?.birthState ?? '',
    birthCountry: saved?.birthCountry ?? (saved ? '' : 'India'),
    rasi: saved?.rasi ?? '',
    nakshatra: saved?.nakshatra ?? '',
    nakshatraPada: saved?.nakshatraPada ? String(saved.nakshatraPada) : '',
    lagnam: saved?.lagnam ?? '',
    sevvaiDosham: saved?.sevvaiDosham ?? '',
    raguKethuDosham: saved?.raguKethuDosham ?? '',
    // New horoscopes start hidden until the member picks something else.
    visibility: saved?.visibility ?? 'HIDDEN',
    shareBirthDetails: saved?.shareBirthDetails ?? false,
  };
}

export function toHoroscopeRequest(form: HoroscopeForm): UpdateHoroscopeRequest {
  const opt = (s: string) => (s.trim() === '' ? null : s.trim());
  return {
    birthTime: opt(form.birthTime),
    birthCity: opt(form.birthCity),
    birthState: opt(form.birthState) as UpdateHoroscopeRequest['birthState'],
    birthCountry: opt(form.birthCountry),
    rasi: opt(form.rasi) as UpdateHoroscopeRequest['rasi'],
    nakshatra: opt(form.nakshatra) as UpdateHoroscopeRequest['nakshatra'],
    nakshatraPada: form.nakshatraPada ? Number(form.nakshatraPada) : null,
    lagnam: opt(form.lagnam) as UpdateHoroscopeRequest['lagnam'],
    sevvaiDosham: opt(form.sevvaiDosham) as UpdateHoroscopeRequest['sevvaiDosham'],
    raguKethuDosham: opt(form.raguKethuDosham) as UpdateHoroscopeRequest['raguKethuDosham'],
    visibility: form.visibility,
    shareBirthDetails: form.shareBirthDetails,
  };
}

// Rows for a horoscope card. Only filled values; birth details only when
// present (the API already withholds them unless the owner shares them).
export function horoscopeRows(h: {
  rasi: string | null;
  nakshatra: string | null;
  nakshatraPada: number | null;
  lagnam: string | null;
  sevvaiDosham: string | null;
  raguKethuDosham: string | null;
  birthTime?: string | null;
  birthPlace?: {
    city: string | null;
    state: string | null;
    country: string | null;
  } | null;
}): { label: string; value: string }[] {
  const rows: { label: string; value: string | null }[] = [
    { label: 'Rasi', value: rasiName(h.rasi) },
    { label: 'Nakshatra', value: nakshatraName(h.nakshatra, h.nakshatraPada) },
    { label: 'Lagnam', value: rasiName(h.lagnam) },
    {
      label: 'Sevvai (Chevvai) dosham',
      value: h.sevvaiDosham ? (DOSHAM_FLAG_LABELS[h.sevvaiDosham] ?? null) : null,
    },
    {
      label: 'Raghu-Kethu dosham',
      value: h.raguKethuDosham ? (DOSHAM_FLAG_LABELS[h.raguKethuDosham] ?? null) : null,
    },
    { label: 'Birth time', value: h.birthTime ?? null },
    {
      label: 'Birth place',
      value: h.birthPlace ? [h.birthPlace.city, h.birthPlace.state, h.birthPlace.country].filter(Boolean).join(', ') || null : null,
    },
  ];
  return rows.filter((r): r is { label: string; value: string } => Boolean(r.value));
}

export function horoscopeViewRows(view: HoroscopeView): { label: string; value: string }[] {
  return view.shared ? horoscopeRows(view) : [];
}
