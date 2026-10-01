import { searchProfilesQuerySchema, type SearchProfilesQuery } from '@nadar-kalyanam/schemas';
import { describe, expect, it, vi } from 'vitest';
import { DiscoveryService } from './discovery.service.js';

interface FakeProfile {
  id: string;
  userId: string;
  fullName: string;
  gender: 'MALE' | 'FEMALE';
  dateOfBirth: Date;
  visibility: 'PUBLIC' | 'HIDDEN';
  isVerified: boolean;
  createdAt: Date;
  details: Record<string, unknown>;
  user: { status: string };
}

// Evaluates the subset of Prisma's ProfileWhereInput the service builds, so
// tests check which rows the real query would return, not just its shape.
// JSON path `equals` with mode 'insensitive' compares whole values ignoring
// case — the behavior confirmed against PostgreSQL for this service.
/* eslint-disable @typescript-eslint/no-explicit-any */
function matchesWhere(profile: FakeProfile, where: any): boolean {
  if (where.visibility?.not && profile.visibility === where.visibility.not) return false;
  if (where.userId?.notIn?.includes(profile.userId)) return false;
  if (where.user?.status && profile.user.status !== where.user.status) return false;
  if (where.gender && profile.gender !== where.gender) return false;
  if (where.dateOfBirth?.gte && profile.dateOfBirth < where.dateOfBirth.gte) return false;
  if (where.dateOfBirth?.lte && profile.dateOfBirth > where.dateOfBirth.lte) return false;
  if (where.details && !matchesDetails(profile, where.details)) return false;
  for (const clause of where.AND ?? []) if (!matchesWhere(profile, clause)) return false;
  return true;
}
function matchesDetails(profile: FakeProfile, filter: any): boolean {
  const value = (filter.path as string[]).reduce<any>((node, key) => node?.[key], profile.details);
  if (typeof value !== 'string') return false;
  return filter.mode === 'insensitive' ? value.toLowerCase() === String(filter.equals).toLowerCase() : value === filter.equals;
}
/* eslint-enable @typescript-eslint/no-explicit-any */

function yearsAgo(years: number): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear() - years, 0, 1));
}

let seq = 0;
function profile(overrides: {
  gender?: 'MALE' | 'FEMALE';
  age?: number;
  city?: string;
  educationLevel?: string;
  profession?: string;
  maritalStatus?: string;
}): FakeProfile {
  seq += 1;
  return {
    id: `p${String(seq).padStart(2, '0')}`,
    userId: `u${seq}`,
    fullName: `Member ${seq}`,
    gender: overrides.gender ?? 'FEMALE',
    dateOfBirth: yearsAgo(overrides.age ?? 28),
    visibility: 'PUBLIC',
    isVerified: false,
    createdAt: new Date(),
    user: { status: 'ACTIVE' },
    details: {
      maritalStatus: overrides.maritalStatus ?? 'NEVER_MARRIED',
      location: { city: overrides.city ?? 'Chennai' },
      education: { educationLevel: overrides.educationLevel ?? 'Bachelors', profession: overrides.profession ?? 'Engineer' },
    },
  };
}

function buildService(profiles: FakeProfile[]) {
  const findMany = vi.fn(async ({ where, take }: { where: unknown; take: number }) =>
    profiles
      .filter((p) => matchesWhere(p, where))
      .sort((a, b) => a.id.localeCompare(b.id))
      .slice(0, take),
  );
  const count = vi.fn(async ({ where }: { where: unknown }) => profiles.filter((p) => matchesWhere(p, where)).length);
  const prisma = {
    profile: { findMany, count },
    block: { findMany: vi.fn().mockResolvedValue([]) },
    interest: { findMany: vi.fn().mockResolvedValue([]) },
  };
  const photosService = { getPhotosForProfile: vi.fn().mockResolvedValue([]) };
  return { service: new DiscoveryService(prisma as never, photosService as never), findMany };
}

const search = (service: DiscoveryService, query: Partial<SearchProfilesQuery>) =>
  service.search('caller', searchProfilesQuerySchema.parse(query));

describe('DiscoveryService.search filters', () => {
  it('applies city, educationLevel and profession together — each one narrows the results', async () => {
    const target = profile({ city: 'Madurai', educationLevel: 'Masters', profession: 'Doctor' });
    const profiles = [
      target,
      profile({ city: 'Chennai', educationLevel: 'Masters', profession: 'Doctor' }), // wrong city
      profile({ city: 'Madurai', educationLevel: 'Bachelors', profession: 'Doctor' }), // wrong education
      profile({ city: 'Madurai', educationLevel: 'Masters', profession: 'Teacher' }), // wrong profession
    ];
    const { service, findMany } = buildService(profiles);

    const { items } = await search(service, { city: 'Madurai', educationLevel: 'Masters', profession: 'Doctor' });

    expect(items.map((item) => item.profileId)).toEqual([target.id]);
    // All three reach the query as separate AND clauses (none overwritten).
    expect(findMany.mock.calls[0][0].where).toMatchObject({
      AND: [
        { details: { path: ['location', 'city'], equals: 'Madurai' } },
        { details: { path: ['education', 'educationLevel'], equals: 'Masters' } },
        { details: { path: ['education', 'profession'], equals: 'Doctor' } },
      ],
    });
  });

  it('combines gender, age range, marital status and city', async () => {
    const target = profile({ gender: 'FEMALE', age: 27, city: 'Madurai', maritalStatus: 'NEVER_MARRIED' });
    const profiles = [
      target,
      profile({ gender: 'MALE', age: 27, city: 'Madurai', maritalStatus: 'NEVER_MARRIED' }), // wrong gender
      profile({ gender: 'FEMALE', age: 40, city: 'Madurai', maritalStatus: 'NEVER_MARRIED' }), // too old
      profile({ gender: 'FEMALE', age: 27, city: 'Madurai', maritalStatus: 'DIVORCED' }), // wrong marital status
      profile({ gender: 'FEMALE', age: 27, city: 'Salem', maritalStatus: 'NEVER_MARRIED' }), // wrong city
    ];
    const { service } = buildService(profiles);

    const { items } = await search(service, {
      gender: 'FEMALE',
      ageMin: 25,
      ageMax: 30,
      maritalStatus: 'NEVER_MARRIED',
      city: 'Madurai',
    });

    expect(items.map((item) => item.profileId)).toEqual([target.id]);
  });

  it('no longer lets the last details filter replace the earlier ones', async () => {
    // Matches only the LAST filter (maritalStatus) — the old query, which kept
    // just the last `details:` key, returned it despite the wrong city.
    const wrongCity = profile({ city: 'Chennai', maritalStatus: 'NEVER_MARRIED' });
    const { service } = buildService([wrongCity]);

    const { items } = await search(service, { city: 'NoSuchCity', maritalStatus: 'NEVER_MARRIED' });

    expect(items).toEqual([]);
  });

  it('matches free-text fields on the whole value, ignoring case and surrounding spaces — not partially', async () => {
    const madurai = profile({ city: 'Madurai', profession: 'Software Engineer' });
    const { service } = buildService([madurai]);

    expect((await search(service, { city: 'madurai' })).items).toHaveLength(1);
    expect((await search(service, { city: '  MADURAI ' })).items).toHaveLength(1);
    expect((await search(service, { city: 'Madu' })).items).toHaveLength(0);
    expect((await search(service, { profession: 'software engineer' })).items).toHaveLength(1);
    expect((await search(service, { profession: 'Engineer' })).items).toHaveLength(0);
  });

  it('ignores blank text filters instead of matching an empty value', async () => {
    const { service, findMany } = buildService([profile({})]);

    const { items } = await search(service, { city: '   ', profession: '' });

    expect(items).toHaveLength(1);
    expect(findMany.mock.calls[0][0].where).not.toHaveProperty('AND');
  });
});
