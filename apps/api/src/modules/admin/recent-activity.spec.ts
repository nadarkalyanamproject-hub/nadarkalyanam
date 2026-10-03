import { recentActivityQuerySchema } from '@nadar-kalyanam/schemas';
import { describe, expect, it } from 'vitest';
import { PERMISSIONS } from '../../common/permissions.js';
import type { AuthenticatedAdmin } from './guards/admin-auth.guard.js';
import { loadRecentActivity } from './recent-activity.js';

/* eslint-disable @typescript-eslint/no-explicit-any */
const t = (iso: string) => new Date(`2026-10-03T${iso}:00.000Z`);
const ALL = Object.values(PERMISSIONS);

function db(seed: {
  users?: { id: string; phoneNumber: string; createdAt: Date; fullName?: string }[];
  verifications?: { id: string; userId: string; status: string; decidedAt: Date | null }[];
  reports?: { id: string; targetType: string; status: string; createdAt: Date }[];
  audits?: { id: string; adminId: string; action: string; targetType: string; targetId: string; metadata?: any; createdAt: Date }[];
  admins?: { id: string; email: string }[];
}) {
  const users = seed.users ?? [];
  const asMember = (u: (typeof users)[number]) => ({ id: u.id, phoneNumber: u.phoneNumber, profile: u.fullName ? { fullName: u.fullName } : null });
  const newest = <T,>(rows: T[], key: (r: T) => Date, take: number) => [...rows].sort((a, b) => key(b).getTime() - key(a).getTime()).slice(0, take);
  const calls: string[] = [];
  return {
    calls,
    prisma: {
      user: {
        findMany: async ({ where, take }: any) => {
          calls.push(`user(take=${take ?? 'ids'})`);
          if (where?.id?.in) return users.filter((u) => where.id.in.includes(u.id)).map(asMember);
          return newest(users, (u) => u.createdAt, take).map((u) => ({ ...asMember(u), createdAt: u.createdAt }));
        },
      },
      verificationRequest: {
        findMany: async ({ where, take }: any) => {
          calls.push(`verification(take=${take})`);
          const ok = (seed.verifications ?? []).filter((v) => v.status === where.status && v.decidedAt);
          return newest(ok, (v) => v.decidedAt!, take).map((v) => ({ id: v.id, decidedAt: v.decidedAt, user: asMember(users.find((u) => u.id === v.userId)!) }));
        },
      },
      report: {
        findMany: async ({ take }: any) => {
          calls.push(`report(take=${take})`);
          return newest(seed.reports ?? [], (r) => r.createdAt, take);
        },
      },
      auditLog: {
        findMany: async ({ take }: any) => {
          calls.push(`audit(take=${take})`);
          return newest(seed.audits ?? [], (a) => a.createdAt, take).map((a) => ({
            ...a,
            metadata: a.metadata ?? {},
            admin: { email: (seed.admins ?? []).find((x) => x.id === a.adminId)?.email ?? null },
          }));
        },
      },
      adminUser: { findMany: async ({ where }: any) => (seed.admins ?? []).filter((a) => where.id.in.includes(a.id)) },
    } as any,
  };
}
const admin = (permissions: string[] = ALL): AuthenticatedAdmin => ({ adminId: 'a1', userId: 'u-admin', sessionId: 's', roleId: 'r', roleName: 'X', permissions });

const SEED = {
  users: [
    { id: 'u1', phoneNumber: '+919000000001', createdAt: t('08:00'), fullName: 'Meena Raj' },
    { id: 'u2', phoneNumber: '+919000000002', createdAt: t('11:00') },
  ],
  verifications: [
    { id: 'v1', userId: 'u1', status: 'SUCCEEDED', decidedAt: t('10:00') },
    { id: 'v2', userId: 'u2', status: 'FAILED', decidedAt: t('12:30') }, // not a verification
    { id: 'v3', userId: 'u2', status: 'PENDING', decidedAt: null },
  ],
  reports: [{ id: 'r1', targetType: 'PROFILE', status: 'OPEN', createdAt: t('09:00') }],
  audits: [
    { id: 'l1', adminId: 'a1', action: 'member.suspend', targetType: 'User', targetId: 'u1', createdAt: t('12:00') },
    { id: 'l2', adminId: 'a1', action: 'member.photo.remove', targetType: 'ProfilePhoto', targetId: 'p9', metadata: { userId: 'u2' }, createdAt: t('07:00') },
    { id: 'l3', adminId: 'a1', action: 'admin.create', targetType: 'AdminUser', targetId: 'a2', createdAt: t('06:00') },
  ],
  admins: [
    { id: 'a1', email: 'boss@example.com' },
    { id: 'a2', email: 'new@example.com' },
  ],
};

describe('recent activity feed', () => {
  it('interleaves every real source newest-first by its own timestamp', async () => {
    const { prisma } = db(SEED);
    const items = await loadRecentActivity(prisma, admin(), 20);
    expect(items.map((i) => `${i.at.slice(11, 16)} ${i.type}`)).toEqual([
      '12:00 admin_action',
      '11:00 registration',
      '10:00 verification',
      '09:00 report',
      '08:00 registration',
      '07:00 admin_action',
      '06:00 admin_action',
    ]);
  });

  it('describes admin actions from the audit log: action, actor, and the member or admin affected', async () => {
    const { prisma } = db(SEED);
    const items = await loadRecentActivity(prisma, admin(), 20);
    const byId = Object.fromEntries(items.map((i) => [i.id, i]));
    expect(byId['audit:l1']).toMatchObject({ action: 'member.suspend', actorEmail: 'boss@example.com', member: { userId: 'u1', fullName: 'Meena Raj' } });
    expect(byId['audit:l2']).toMatchObject({ action: 'member.photo.remove', member: { userId: 'u2', fullName: null, phoneNumber: '+919000000002' } });
    expect(byId['audit:l3']).toMatchObject({ action: 'admin.create', member: null, targetAdminEmail: 'new@example.com' });
  });

  it('includes reports filed and registrations with only list-level details', async () => {
    const { prisma } = db(SEED);
    const items = await loadRecentActivity(prisma, admin(), 20);
    expect(items.find((i) => i.type === 'report')).toEqual({ type: 'report', id: 'report:r1', at: t('09:00').toISOString(), targetType: 'PROFILE', status: 'OPEN' });
    expect(items.find((i) => i.id === 'user:u1')).toEqual({
      type: 'registration', id: 'user:u1', at: t('08:00').toISOString(), member: { userId: 'u1', fullName: 'Meena Raj', phoneNumber: '+919000000001' },
    });
  });

  it('counts a verification only when a request SUCCEEDED, at the moment it was decided', async () => {
    const { prisma } = db(SEED);
    const verifications = (await loadRecentActivity(prisma, admin(), 20)).filter((i) => i.type === 'verification');
    expect(verifications).toEqual([{ type: 'verification', id: 'verification:v1', at: t('10:00').toISOString(), member: { userId: 'u1', fullName: 'Meena Raj', phoneNumber: '+919000000001' } }]);
  });

  it('respects the limit, and reads only that many rows from each source', async () => {
    const { prisma, calls } = db(SEED);
    const items = await loadRecentActivity(prisma, admin(), 3);
    expect(items.map((i) => i.id)).toEqual(['audit:l1', 'user:u2', 'verification:v1']);
    expect(calls.filter((c) => !c.includes('ids'))).toEqual(['user(take=3)', 'verification(take=3)', 'report(take=3)', 'audit(take=3)']);
  });

  it('an empty platform returns an empty feed, not an error', async () => {
    const { prisma } = db({});
    await expect(loadRecentActivity(prisma, admin(), 20)).resolves.toEqual([]);
  });

  it('shows each source only to admins who can see it on its own page', async () => {
    const { prisma } = db(SEED);
    const moderatorNoAudit = await loadRecentActivity(prisma, admin([PERMISSIONS.MEMBERS_VIEW, PERMISSIONS.REPORTS_REVIEW]), 20);
    expect(new Set(moderatorNoAudit.map((i) => i.type))).toEqual(new Set(['registration', 'verification', 'report']));
    const membersOnly = await loadRecentActivity(prisma, admin([PERMISSIONS.MEMBERS_VIEW]), 20);
    expect(new Set(membersOnly.map((i) => i.type))).toEqual(new Set(['registration', 'verification']));
  });

  it('defaults the limit to 20 and caps it at 50', () => {
    expect(recentActivityQuerySchema.parse({})).toEqual({ limit: 20 });
    expect(recentActivityQuerySchema.safeParse({ limit: '51' }).success).toBe(false);
  });
});
