// Test-only in-memory stand-in for the Prisma calls the profile-list services
// make. It EVALUATES the where clauses the real code builds (rather than
// returning canned rows), so a test proves which members a query would
// actually return — e.g. that blocked or inactive members are excluded.
/* eslint-disable @typescript-eslint/no-explicit-any */
import { Prisma } from '../../generated/prisma/client.js';

export interface FakeProfile {
  id: string;
  userId: string;
  fullName: string;
  gender: string;
  dateOfBirth: Date;
  visibility: 'PUBLIC' | 'MEMBERS_ONLY' | 'HIDDEN';
  isVerified: boolean;
  createdAt: Date;
  details: Record<string, any>;
}

export interface FakeState {
  profiles: FakeProfile[];
  userStatus: Record<string, string>; // userId -> AccountStatus
  photos: { profileId: string }[];
  blocks: { initiatorId: string; targetId: string }[];
  shortlists: { id: string; memberId: string; profileId: string; createdAt: Date }[];
  notifications: { userId: string; actorUserId: string | null; type: string; createdAt: Date }[];
}

export function matchesProfileWhere(state: FakeState, p: FakeProfile, where: any): boolean {
  if (!where) return true;
  if (where.AND && !where.AND.every((w: any) => matchesProfileWhere(state, p, w))) return false;
  if (where.OR && !where.OR.some((w: any) => matchesProfileWhere(state, p, w))) return false;
  if (where.visibility?.not && p.visibility === where.visibility.not) return false;
  if (where.userId?.notIn?.includes(p.userId)) return false;
  if (where.userId?.in && !where.userId.in.includes(p.userId)) return false;
  if (typeof where.userId === 'string' && where.userId !== p.userId) return false;
  if (where.id?.in && !where.id.in.includes(p.id)) return false;
  if (typeof where.id === 'string' && where.id !== p.id) return false;
  if (where.user?.status && state.userStatus[p.userId] !== where.user.status) return false;
  if (where.createdAt?.gte && p.createdAt < where.createdAt.gte) return false;
  if (where.photos?.some && !state.photos.some((photo) => photo.profileId === p.id)) return false;
  if (where.details) {
    const value = (where.details.path as string[]).reduce<any>((node, key) => node?.[key], p.details);
    if (typeof value !== 'string') return false;
    const equal =
      where.details.mode === 'insensitive'
        ? value.toLowerCase() === String(where.details.equals).toLowerCase()
        : value === where.details.equals;
    if (!equal) return false;
  }
  return true;
}

let idSeq = 0;
export function makeProfile(overrides: Partial<FakeProfile> & { userId: string }): FakeProfile {
  idSeq += 1;
  return {
    id: `profile-${overrides.userId}`,
    fullName: `Member ${overrides.userId}`,
    gender: 'FEMALE',
    dateOfBirth: new Date(Date.UTC(1996, 0, 1)),
    visibility: 'PUBLIC',
    isVerified: false,
    createdAt: new Date(Date.UTC(2026, 0, 1) + idSeq * 1000),
    details: { location: { city: 'Chennai', state: 'Tamil Nadu' }, education: { educationLevel: 'Bachelors', profession: 'Engineer' } },
    ...overrides,
  };
}

// A PrismaService-shaped fake over `state`, covering the calls made by
// ShortlistsService, MatchCategoriesService and the shared helpers.
export function fakePrisma(state: FakeState) {
  const byOrder = (orderBy: any) => (a: FakeProfile, b: FakeProfile) =>
    orderBy?.createdAt === 'desc' ? b.createdAt.getTime() - a.createdAt.getTime() : a.id.localeCompare(b.id);
  const sortRows = <T extends { createdAt: Date }>(rows: T[], orderBy: any) =>
    orderBy?.createdAt === 'desc' ? [...rows].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime()) : rows;

  return {
    profile: {
      findUnique: async ({ where, include }: any) => {
        const p = state.profiles.find((x) => (where.id ? x.id === where.id : x.userId === where.userId));
        if (!p) return null;
        return include?.user ? { ...p, user: { status: state.userStatus[p.userId] } } : p;
      },
      findMany: async ({ where, orderBy, take }: any) =>
        state.profiles
          .filter((p) => matchesProfileWhere(state, p, where))
          .sort(byOrder(orderBy))
          .slice(0, take ?? Infinity),
    },
    block: {
      findMany: async ({ where }: any) => {
        const userId = where.OR[0].initiatorId;
        return state.blocks.filter((b) => b.initiatorId === userId || b.targetId === userId);
      },
      findFirst: async ({ where }: any) =>
        state.blocks.find((b) =>
          where.OR.some((w: any) => w.initiatorId === b.initiatorId && w.targetId === b.targetId),
        ) ?? null,
    },
    interest: { findMany: async () => [] },
    shortlist: {
      create: async ({ data }: any) => {
        if (state.shortlists.some((s) => s.memberId === data.memberId && s.profileId === data.profileId)) {
          throw new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
            code: 'P2002',
            clientVersion: 'test',
          });
        }
        const row = { id: `sl-${state.shortlists.length + 1}`, createdAt: new Date(Date.now() + state.shortlists.length), ...data };
        state.shortlists.push(row);
        return row;
      },
      deleteMany: async ({ where }: any) => {
        const before = state.shortlists.length;
        state.shortlists = state.shortlists.filter(
          (s) => !(s.memberId === where.memberId && s.profileId === where.profileId),
        );
        return { count: before - state.shortlists.length };
      },
      findUnique: async ({ where }: any) =>
        state.shortlists.find(
          (s) => s.memberId === where.memberId_profileId.memberId && s.profileId === where.memberId_profileId.profileId,
        ) ?? null,
      findMany: async ({ where, orderBy }: any) =>
        sortRows(
          state.shortlists.filter(
            (s) =>
              (where.memberId === undefined || s.memberId === where.memberId) &&
              (where.profileId === undefined || s.profileId === where.profileId),
          ),
          orderBy,
        ),
    },
    notification: {
      findMany: async ({ where, orderBy, take }: any) =>
        sortRows(
          state.notifications.filter(
            (n) =>
              n.type === where.type &&
              (where.userId === undefined || n.userId === where.userId) &&
              (where.actorUserId === undefined ||
                (typeof where.actorUserId === 'string' ? n.actorUserId === where.actorUserId : n.actorUserId !== null)),
          ),
          orderBy,
        ).slice(0, take ?? Infinity),
    },
  };
}

export const fakePhotosService = {
  getPhotosForProfile: async () => [],
};
