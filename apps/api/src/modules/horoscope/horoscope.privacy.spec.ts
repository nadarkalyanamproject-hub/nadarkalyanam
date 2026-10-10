import 'reflect-metadata';
import { RequestMethod } from '@nestjs/common';
import * as schemas from '@nadar-kalyanam/schemas';
import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { PartnerPreferencesController } from '../partner-preferences/partner-preferences.controller.js';
import { PartnerPreferencesService } from '../partner-preferences/partner-preferences.service.js';
import { ProfilesController } from '../profiles/profiles.controller.js';
import { HoroscopeController } from './horoscope.controller.js';
import { HoroscopeService, canViewHoroscope, hasHoroscopeContent } from './horoscope.service.js';

/* eslint-disable @typescript-eslint/no-explicit-any */

const ROW = {
  id: 'h1',
  profileId: 'profile-owner',
  birthTime: '06:15',
  birthCity: 'Madurai',
  birthState: 'Tamil Nadu',
  birthCountry: 'India',
  rasi: 'SIMMAM',
  nakshatra: 'MAGAM',
  nakshatraPada: 2,
  lagnam: 'KANNI',
  sevvaiDosham: 'NO',
  raguKethuDosham: 'YES',
  visibility: 'HIDDEN',
  shareBirthDetails: false,
  chartObjectKey: 'horoscopes/profile-owner/c.jpg',
  chartIsModerated: true,
  chartIsApproved: true,
  chartRejectionReason: null,
  chartUploadedAt: new Date(),
  createdAt: new Date(),
  updatedAt: new Date('2026-10-07T00:00:00Z'),
};

function horoscopeService(row: Record<string, unknown> | null, mode: 'pending' | 'auto_approve' = 'pending') {
  const state = { row: row ? { ...row } : null };
  const prisma = {
    profile: {
      findUnique: async ({ where }: any) => (where.userId === 'owner' ? { id: 'profile-owner' } : null),
    },
    profileHoroscope: {
      findUnique: async () => state.row,
      findFirst: async () => state.row,
      upsert: vi.fn(async ({ create, update }: any) => (state.row = state.row ? { ...state.row, ...update } : { ...ROW, ...create })),
      update: vi.fn(async ({ data }: any) => (state.row = { ...state.row!, ...data })),
    },
  };
  const storage = {
    getObjectUrl: async (key: string) => `https://signed.example/${key}?sig=1`,
    createUploadUrl: async (key: string) => `https://upload.example/${key}`,
    deleteObject: vi.fn(async () => undefined),
    validateUploadedImage: vi.fn(async () => ({ mime: 'image/jpeg', sizeBytes: 1024 })),
  };
  const service = new HoroscopeService(prisma as never, storage as never, { moderationMode: () => mode } as never);
  return { service, state, prisma, storage };
}

describe('horoscope visibility, enforced in the API', () => {
  it.each([
    ['EVERYONE', 'NONE', true],
    ['EVERYONE', 'CONNECTED', true],
    ['EVERYONE', 'INTEREST_SENT', true],
    ['CONNECTED', 'CONNECTED', true],
    ['CONNECTED', 'NONE', false],
    ['CONNECTED', 'INTEREST_SENT', false],
    ['CONNECTED', 'INTEREST_RECEIVED', false],
    ['CONNECTED', undefined, false],
    ['HIDDEN', 'CONNECTED', false],
    ['HIDDEN', 'NONE', false],
  ] as const)('%s, viewer %s -> visible %s', async (visibility, relationship, visible) => {
    expect(canViewHoroscope(visibility, relationship)).toBe(visible);
    const { service } = horoscopeService({
      ...ROW,
      visibility,
      shareBirthDetails: true,
    });
    const view = await service.viewFor('profile-owner', relationship);
    expect(view.shared).toBe(visible);
    if (!visible) {
      // Nothing at all beyond "not shared": not even the rasi.
      expect(view).toEqual({ shared: false });
      expect(JSON.stringify(view)).not.toMatch(/SIMMAM|MAGAM|06:15|Madurai|horoscopes\//);
    }
  });

  it('defaults to hidden (no row, or a new row) — "not shared"', async () => {
    expect(await horoscopeService(null).service.viewFor('profile-owner', 'CONNECTED')).toEqual({ shared: false });
    expect(schemas.updateHoroscopeSchema.safeParse({}).success).toBe(false);
  });

  it('birth time and place stay hidden unless the owner also shares birth details', async () => {
    const off = await horoscopeService({
      ...ROW,
      visibility: 'EVERYONE',
      shareBirthDetails: false,
    }).service.viewFor('profile-owner', 'NONE');
    expect(off).toMatchObject({
      shared: true,
      rasi: 'SIMMAM',
      nakshatra: 'MAGAM',
      birthTime: null,
      birthPlace: null,
    });
    expect(JSON.stringify(off)).not.toMatch(/06:15|Madurai/);
    const on = await horoscopeService({
      ...ROW,
      visibility: 'CONNECTED',
      shareBirthDetails: true,
    }).service.viewFor('profile-owner', 'CONNECTED');
    expect(on).toMatchObject({
      birthTime: '06:15',
      birthPlace: { city: 'Madurai', state: 'Tamil Nadu', country: 'India' },
    });
  });

  it('the chart image is only ever sent once approved', async () => {
    for (const [moderated, approved, sent] of [
      [true, true, true],
      [false, false, false],
      [true, false, false],
    ] as const) {
      const { service } = horoscopeService({
        ...ROW,
        visibility: 'EVERYONE',
        chartIsModerated: moderated,
        chartIsApproved: approved,
      });
      const view = (await service.viewFor('profile-owner', 'NONE')) as any;
      expect(Boolean(view.chartImageUrl)).toBe(sent);
    }
  });

  it('hiding the horoscope does not count against the member (completion item = content entered)', () => {
    expect(hasHoroscopeContent({ ...ROW, visibility: 'HIDDEN' } as any)).toBe(true);
    expect(hasHoroscopeContent(null)).toBe(false);
    expect(
      hasHoroscopeContent({
        ...ROW,
        ...Object.fromEntries(
          Object.keys(ROW)
            .filter(
              (k) =>
                !['id', 'profileId', 'visibility', 'shareBirthDetails', 'createdAt', 'updatedAt', 'chartIsModerated', 'chartIsApproved'].includes(k),
            )
            .map((k) => [k, null]),
        ),
      } as any),
    ).toBe(false);
  });
});

describe('profile view: horoscope and preference fit are computed for the viewer', () => {
  const owner = {
    id: 'profile-owner',
    userId: 'owner',
    fullName: 'Owner',
    gender: 'FEMALE',
    dateOfBirth: new Date('1996-01-01'),
    details: {
      maritalStatus: 'NEVER_MARRIED',
      location: { city: 'Madurai', state: 'Tamil Nadu' },
      education: { profession: 'Engineer' },
    },
  };
  function controller(relationship: string | null, row: Record<string, unknown>, viewerPrefs: unknown) {
    const { service } = horoscopeService(row);
    const preferences = {
      findForUser: vi.fn(async (userId: string) => (userId === 'viewer' ? viewerPrefs : { ageMin: 99, secret: 'OWNER-PREF' })),
      fitForViewer: (userId: string, profile: any) =>
        new PartnerPreferencesService({} as never).fitForViewer.call({ findForUser: preferences.findForUser }, userId, profile),
    };
    const ctl = new ProfilesController(
      {
        getOtherProfile: async () => owner,
        getRelationshipStates: async () => new Map(relationship ? [['owner', { status: relationship, conversationId: null }]] : []),
      } as never,
      { getPhotosForProfile: async () => [] } as never,
      { notify: vi.fn() } as never,
      {} as never,
      preferences as never,
      service as never,
    );
    return { ctl, preferences };
  }
  const viewer = { userId: 'viewer', sessionId: 's' };
  const viewerPrefs = {
    ageMin: null,
    ageMax: null,
    heightMinCm: null,
    heightMaxCm: null,
    maritalStatuses: ['NEVER_MARRIED'],
    motherTongues: [],
    states: ['Kerala'],
    cities: [],
    incomeMinLakhs: null,
    incomeMaxLakhs: null,
    doshamPreference: 'DOESNT_MATTER',
    mustHaveAge: false,
    mustHaveMaritalStatus: false,
    mustHaveLocation: false,
    updatedAt: 'x',
  };

  it('connected viewer sees a CONNECTED horoscope; an unconnected viewer does not', async () => {
    const row = { ...ROW, visibility: 'CONNECTED' };
    expect((await controller('CONNECTED', row, null).ctl.getOne(viewer, 'profile-owner')).horoscope).toMatchObject({ shared: true, rasi: 'SIMMAM' });
    expect((await controller(null, row, null).ctl.getOne(viewer, 'profile-owner')).horoscope).toEqual({ shared: false });
    expect((await controller('INTEREST_SENT', row, null).ctl.getOne(viewer, 'profile-owner')).horoscope).toEqual({ shared: false });
  });

  it('"N of M" uses only the VIEWER\'s preferences and never carries the owner\'s', async () => {
    const { ctl, preferences } = controller(null, ROW, viewerPrefs);
    const detail = await ctl.getOne(viewer, 'profile-owner');
    expect(detail.preferenceFit).toEqual({
      matched: 1,
      total: 2,
      unknown: 0,
      fields: [
        { key: 'maritalStatus', matched: true },
        { key: 'location', matched: false },
      ],
    });
    expect(preferences.findForUser).toHaveBeenCalledWith('viewer');
    expect(preferences.findForUser).not.toHaveBeenCalledWith('owner');
    expect(JSON.stringify(detail)).not.toContain('OWNER-PREF');
    // A viewer without preferences gets no fit line.
    expect((await controller(null, ROW, null).ctl.getOne(viewer, 'profile-owner')).preferenceFit).toBeNull();
  });
});

// Every key reachable in a schema (objects, arrays, optionals, unions).
function allKeys(schema: z.ZodType, seen = new Set<z.ZodType>()): string[] {
  if (seen.has(schema)) return [];
  seen.add(schema);
  if (schema instanceof z.ZodObject) return Object.entries(schema.shape as Record<string, z.ZodType>).flatMap(([k, v]) => [k, ...allKeys(v, seen)]);
  if (schema instanceof z.ZodArray) return allKeys(schema.element as z.ZodType, seen);
  if (schema instanceof z.ZodOptional || schema instanceof z.ZodNullable) return allKeys(schema.unwrap() as z.ZodType, seen);
  if (schema instanceof z.ZodUnion || schema instanceof z.ZodDiscriminatedUnion)
    return (schema.options as z.ZodType[]).flatMap((o) => allKeys(o, seen));
  return [];
}
const HOROSCOPE_KEYS =
  /^(horoscope|rasi|nakshatra|nakshatraPada|lagnam|sevvaiDosham|raguKethuDosham|birthTime|birthCity|birthState|birthCountry|birthPlace|chart|chartImageUrl)$/;
const PREFERENCE_KEYS =
  /^(preferences|partnerPreferences|ageMin|ageMax|heightMinCm|heightMaxCm|maritalStatuses|motherTongues|states|cities|incomeMinLakhs|incomeMaxLakhs|doshamPreference|mustHaveAge|mustHaveMaritalStatus|mustHaveLocation)$/;

describe('list responses never carry horoscope or partner-preference fields', () => {
  const LISTS: Record<string, z.ZodType> = {
    searchProfiles: schemas.searchProfilesResponseSchema,
    listMatches: schemas.listMatchesResponseSchema.shape.items,
    profileCardList: schemas.profileCardListResponseSchema,
    nearbyMatches: schemas.nearbyMatchesResponseSchema,
    profileList: schemas.profileListResponseSchema,
    listConnections: schemas.listConnectionsResponseSchema,
    listInterests: schemas.listInterestsResponseSchema,
    shortlist: schemas.shortlistResponseSchema,
  };
  it.each(Object.entries(LISTS))('%s', (_name, schema) => {
    const keys = allKeys(schema);
    expect(keys.filter((k) => HOROSCOPE_KEYS.test(k))).toEqual([]);
    expect(keys.filter((k) => PREFERENCE_KEYS.test(k))).toEqual([]);
  });

  it("the profile view never carries birth time/place outside the shared horoscope block, nor anyone's preferences", () => {
    const detail = schemas.publicProfileDetailSchema.shape;
    const outside = Object.entries(detail)
      .filter(([k]) => k !== 'horoscope')
      .flatMap(([k, v]) => [k, ...allKeys(v as z.ZodType)]);
    expect(outside.filter((k) => /^birth/.test(k))).toEqual([]);
    expect(allKeys(schemas.publicProfileDetailSchema).filter((k) => PREFERENCE_KEYS.test(k))).toEqual([]);
  });
});

describe('owner-only routes', () => {
  it.each([
    [PartnerPreferencesController, 'me/partner-preferences'],
    [HoroscopeController, 'me/horoscope'],
  ])('%o is under /me, member-guarded, and no route takes another member id', (ctl: any, base) => {
    expect(Reflect.getMetadata('path', ctl)).toBe(base);
    expect(Reflect.getMetadata('__guards__', ctl)).toEqual([JwtAuthGuard]);
    for (const name of Object.getOwnPropertyNames(ctl.prototype).filter((n) => n !== 'constructor')) {
      const path = Reflect.getMetadata('path', ctl.prototype[name]) as string | undefined;
      if (path !== undefined) expect(path).not.toMatch(/:/);
    }
  });

  it('preferences are read and written only for the caller', async () => {
    const calls: any[] = [];
    const prisma = {
      profile: {
        findUnique: async ({ where }: any) => (calls.push(where), { id: `profile-${where.userId}` }),
      },
      partnerPreference: {
        findFirst: async ({ where }: any) => (calls.push(where), null),
        upsert: async ({ where, create }: any) => (calls.push(where), { ...create, id: 'p', createdAt: new Date(), updatedAt: new Date() }),
        deleteMany: async ({ where }: any) => (calls.push(where), { count: 1 }),
      },
    };
    const ctl = new PartnerPreferencesController(new PartnerPreferencesService(prisma as never));
    const me = { userId: 'u1', sessionId: 's' };
    await ctl.get(me);
    await ctl.save(
      me,
      schemas.partnerPreferencesSchema.parse({
        ageMin: 25,
        ageMax: 30,
        heightMinCm: null,
        heightMaxCm: null,
        maritalStatuses: [],
        motherTongues: [],
        states: [],
        cities: [],
        incomeMinLakhs: null,
        incomeMaxLakhs: null,
        doshamPreference: 'DOESNT_MATTER',
        mustHaveAge: true,
        mustHaveMaritalStatus: false,
        mustHaveLocation: false,
      }),
    );
    expect((await ctl.reset(me)).preferences).toBeNull();
    expect(calls).toEqual([
      { profile: { userId: 'u1' } },
      { userId: 'u1' },
      { profileId: 'profile-u1' },
      { userId: 'u1' },
      { profileId: 'profile-u1' },
    ]);
  });
});

describe('horoscope details validation', () => {
  const base = {
    birthTime: null,
    birthCity: null,
    birthState: null,
    birthCountry: null,
    rasi: null,
    nakshatra: null,
    nakshatraPada: null,
    lagnam: null,
    sevvaiDosham: null,
    raguKethuDosham: null,
    visibility: 'HIDDEN',
    shareBirthDetails: false,
  };
  it('accepts a full, valid record and blanks as "not given"', () => {
    expect(
      schemas.updateHoroscopeSchema.safeParse({
        ...base,
        birthTime: '23:59',
        birthCity: 'Madurai',
        birthState: 'Tamil Nadu',
        birthCountry: 'India',
        rasi: 'MEENAM',
        nakshatra: 'REVATHI',
        nakshatraPada: 4,
        lagnam: 'MESHAM',
        sevvaiDosham: 'YES',
        raguKethuDosham: 'DONT_KNOW',
        visibility: 'CONNECTED',
        shareBirthDetails: true,
      }).success,
    ).toBe(true);
    expect(schemas.updateHoroscopeSchema.parse({ ...base, birthTime: '', rasi: '' })).toMatchObject({ birthTime: null, rasi: null });
  });
  it.each([
    [{ birthTime: '24:00' }],
    [{ birthTime: '6:15' }],
    [{ rasi: 'ARIES' }],
    [{ nakshatra: 'ASWINI' }],
    [{ nakshatra: 'ROHINI', nakshatraPada: 5 }],
    [{ nakshatraPada: 1 }],
    [{ lagnam: 'LEO' }],
    [{ birthState: 'Ontario' }],
    [{ birthState: 'Kerala', birthCountry: 'UAE' }],
    [{ sevvaiDosham: 'MAYBE' }],
    [{ visibility: 'PUBLIC' }],
    [{ phoneNumber: '+919800000000' }],
  ])('rejects %j', (overrides) => {
    expect(schemas.updateHoroscopeSchema.safeParse({ ...base, ...overrides }).success).toBe(false);
  });
  it('has exactly 12 rasis and 27 nakshatras', () => {
    expect(schemas.RASIS).toHaveLength(12);
    expect(schemas.NAKSHATRAS).toHaveLength(27);
    expect(new Set(schemas.NAKSHATRA_CODES).size).toBe(27);
  });
});

describe('chart image: private upload + moderation hold', () => {
  it("upload keys are scoped to the member and confirm refuses someone else's key", async () => {
    const { service } = horoscopeService(null);
    const { objectKey } = await service.createChartUploadUrl('owner', 'image/png');
    expect(objectKey).toMatch(/^horoscopes\/profile-owner\/[0-9a-f-]+\.png$/);
    await expect(service.confirmChart('owner', 'horoscopes/profile-other/x.png')).rejects.toThrow('does not belong');
    await expect(service.confirmChart('owner', 'profiles/profile-owner/x.png')).rejects.toThrow('does not belong');
  });

  it('a new chart is PENDING (not shown to anyone) until approved; replacing deletes the old object', async () => {
    const { service, storage } = horoscopeService({ ...ROW, visibility: 'EVERYONE' }, 'pending');
    const mine = await service.confirmChart('owner', 'horoscopes/profile-owner/new.jpg');
    expect(mine.horoscope!.chart).toMatchObject({ status: 'PENDING' });
    expect(storage.deleteObject).toHaveBeenCalledWith('horoscopes/profile-owner/c.jpg');
    expect(((await service.viewFor('profile-owner', 'NONE')) as any).chartImageUrl).toBeNull();
    const rejected = await service.moderateChart('owner', {
      approve: false,
      reason: 'Not a horoscope chart',
    });
    expect(rejected.chart).toMatchObject({
      status: 'REJECTED',
      rejectionReason: 'Not a horoscope chart',
    });
    expect(((await service.viewFor('profile-owner', 'NONE')) as any).chartImageUrl).toBeNull();
    const approved = await service.moderateChart('owner', { approve: true });
    expect(approved.chart).toMatchObject({
      status: 'APPROVED',
      rejectionReason: null,
    });
    expect(((await service.viewFor('profile-owner', 'NONE')) as any).chartImageUrl).toContain('horoscopes/profile-owner/new.jpg');
  });

  it('dev auto-approve mode (same setting as photos) approves on upload', async () => {
    const { service } = horoscopeService(null, 'auto_approve');
    expect((await service.confirmChart('owner', 'horoscopes/profile-owner/a.jpg')).horoscope!.chart!.status).toBe('APPROVED');
  });

  it('moderating a member without a chart 404s', async () => {
    const { service } = horoscopeService({ ...ROW, chartObjectKey: null });
    await expect(service.moderateChart('owner', { approve: true })).rejects.toThrow('no chart');
  });
});

it('chart routes are POST/DELETE on /me/horoscope/chart/*', () => {
  const proto = HoroscopeController.prototype as any;
  expect(Reflect.getMetadata('path', proto.chartUploadUrl)).toBe('chart/upload-url');
  expect(Reflect.getMetadata('method', proto.confirmChart)).toBe(RequestMethod.POST);
  expect(Reflect.getMetadata('method', proto.deleteChart)).toBe(RequestMethod.DELETE);
});

describe('completeness: optional items, never a penalty', () => {
  const profile = {
    id: 'profile-owner',
    userId: 'owner',
    fullName: 'O',
    gender: 'FEMALE',
    dateOfBirth: new Date('1996-01-01'),
    completionScore: 76,
    visibility: 'MEMBERS_ONLY',
    details: {},
  };
  const ctl = (prefs: unknown, row: unknown) =>
    new ProfilesController(
      { getMyProfile: async () => profile } as never,
      { getPhotosForProfile: async () => [] } as never,
      {} as never,
      {} as never,
      { findForUser: async () => prefs } as never,
      { findByProfileId: async () => row } as never,
    );
  const me = { userId: 'owner', sessionId: 's' };

  it('reports preferences and horoscope separately and leaves the score alone', async () => {
    expect((await ctl(null, null).getMe(me)).optionalCompletion).toEqual({
      partnerPreferences: false,
      horoscope: false,
    });
    const done = await ctl({ ageMin: 25 }, { ...ROW, visibility: 'HIDDEN' }).getMe(me);
    // A hidden horoscope still counts as done.
    expect(done.optionalCompletion).toEqual({
      partnerPreferences: true,
      horoscope: true,
    });
    expect(done.completionScore).toBe(76);
    expect(done.completionMissing).not.toContain('horoscope');
    expect(done.completionMissing).not.toContain('partnerPreferences');
  });
});
