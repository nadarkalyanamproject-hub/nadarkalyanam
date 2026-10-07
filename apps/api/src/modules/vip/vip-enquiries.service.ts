import { BadRequestException, ConflictException, HttpException, HttpStatus, Inject, Injectable, NotFoundException } from '@nestjs/common';
import type { MyVipEnquiryResponse, UpdateVipEnquiryRequest, VipEnquiryResponse, VipEnquiryStatus } from '@nadar-kalyanam/schemas';
import type { Redis } from 'ioredis';
import { PERMISSIONS } from '../../common/permissions.js';
import { Prisma, type VipEnquiry } from '../../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { REDIS_CLIENT } from '../redis/redis.constants.js';

// An enquiry is open while NEW or CONTACTED; ONBOARDED and CLOSED are final.
export const OPEN_VIP_STATUSES: VipEnquiryStatus[] = ['NEW', 'CONTACTED'];

// The status flow admins can move an enquiry along. Final states stay final
// (a member who asks again opens a new enquiry).
export const VIP_STATUS_FLOW: Record<VipEnquiryStatus, VipEnquiryStatus[]> = {
  NEW: ['CONTACTED', 'CLOSED'],
  CONTACTED: ['ONBOARDED', 'CLOSED'],
  ONBOARDED: [],
  CLOSED: [],
};

// Abuse guard on POST /vip-enquiries.
const RATE = { max: 5, windowSeconds: 3600 };

function toResponse(enquiry: VipEnquiry): VipEnquiryResponse {
  return {
    id: enquiry.id,
    status: enquiry.status,
    message: enquiry.message,
    createdAt: enquiry.createdAt.toISOString(),
    updatedAt: enquiry.updatedAt.toISOString(),
  };
}

function isUniqueViolation(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002';
}

@Injectable()
export class VipEnquiriesService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(REDIS_CLIENT) private readonly redis: Pick<Redis, 'set' | 'incr' | 'ttl'>,
  ) {}

  // A member asks to be contacted. Name and phone are copied from their own
  // profile and account (never taken from the request). At most one open
  // enquiry per member: asking again returns the open one.
  async create(userId: string, message: string | undefined): Promise<VipEnquiryResponse & { existing: boolean }> {
    const open = await this.findOpen(userId);
    if (open) return { ...toResponse(open), existing: true };

    const key = `vip:rl:${userId}`;
    await this.redis.set(key, '0', 'EX', RATE.windowSeconds, 'NX');
    if ((await this.redis.incr(key)) > RATE.max) {
      throw new HttpException(
        { statusCode: 429, message: 'Too many enquiries. Please try again later.', errorCode: 'VIP_ENQUIRY_RATE_LIMITED' },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { phoneNumber: true, profile: { select: { fullName: true } } },
    });
    if (!user?.profile) throw new BadRequestException('Complete your profile before enquiring');
    try {
      const enquiry = await this.prisma.vipEnquiry.create({
        data: { userId, name: user.profile.fullName, phone: user.phoneNumber, message: message?.trim() || null },
      });
      return { ...toResponse(enquiry), existing: false };
    } catch (error) {
      // Two submissions at once: the one-open-per-member index stops the second.
      if (isUniqueViolation(error)) {
        const existing = await this.findOpen(userId);
        if (existing) return { ...toResponse(existing), existing: true };
      }
      throw error;
    }
  }

  // The member's most recent enquiry, open or not.
  async mine(userId: string): Promise<MyVipEnquiryResponse> {
    const latest = await this.prisma.vipEnquiry.findFirst({ where: { userId }, orderBy: { createdAt: 'desc' } });
    return { enquiry: latest ? toResponse(latest) : null };
  }

  private findOpen(userId: string) {
    return this.prisma.vipEnquiry.findFirst({ where: { userId, status: { in: OPEN_VIP_STATUSES } } });
  }

  // --- Admin --------------------------------------------------------------

  // assignee: 'me' (the calling admin), 'unassigned', or an admin id.
  async list(
    filters: { status?: VipEnquiryStatus; assignee?: string; callerAdminId?: string },
    offset: number,
    limit: number,
  ) {
    const where: Prisma.VipEnquiryWhereInput = {};
    if (filters.status) where.status = filters.status;
    if (filters.assignee === 'unassigned') where.assignedAdminId = null;
    else if (filters.assignee === 'me') where.assignedAdminId = filters.callerAdminId ?? '__none__';
    else if (filters.assignee) where.assignedAdminId = filters.assignee;
    const [rows, total] = await Promise.all([
      this.prisma.vipEnquiry.findMany({ where, orderBy: { createdAt: 'desc' }, skip: offset, take: limit }),
      this.prisma.vipEnquiry.count({ where }),
    ]);
    return { items: await this.toAdminViews(rows), total };
  }

  // One enquiry with its internal notes and status/assignment history
  // (oldest first). Admin-only.
  async getForAdmin(id: string) {
    const row = await this.prisma.vipEnquiry.findUnique({
      where: { id },
      include: { notes: { orderBy: { createdAt: 'asc' } }, events: { orderBy: { createdAt: 'asc' } } },
    });
    if (!row) throw new NotFoundException('Enquiry not found');
    const [view] = await this.toAdminViews([row]);
    const emails = await this.adminEmails([
      ...row.notes.map((n) => n.authorAdminId),
      ...row.events.flatMap((e) => [e.adminId, e.kind === 'ASSIGNMENT' ? e.fromValue : null, e.kind === 'ASSIGNMENT' ? e.toValue : null]),
    ]);
    const who = (id: string | null) => (id ? (emails.get(id) ?? 'Former admin') : null);
    return {
      ...view!,
      notes: row.notes.map((n) => ({
        id: n.id,
        body: n.body,
        authorEmail: n.authorAdminId ? who(n.authorAdminId)! : 'Earlier note (author not recorded)',
        createdAt: n.createdAt.toISOString(),
      })),
      history: row.events.map((e) => ({
        kind: e.kind as 'STATUS' | 'ASSIGNMENT',
        fromValue: e.kind === 'ASSIGNMENT' ? who(e.fromValue) : e.fromValue,
        toValue: e.kind === 'ASSIGNMENT' ? who(e.toValue) : e.toValue,
        byEmail: who(e.adminId)!,
        createdAt: e.createdAt.toISOString(),
      })),
    };
  }

  private async adminEmails(ids: (string | null)[]): Promise<Map<string, string>> {
    const unique = [...new Set(ids.filter((id): id is string => Boolean(id)))];
    if (unique.length === 0) return new Map();
    const admins = await this.prisma.adminUser.findMany({ where: { id: { in: unique } }, select: { id: true, email: true } });
    return new Map(admins.map((a) => [a.id, a.email]));
  }

  // The admin list view: the member's name and registered phone (an admin
  // needs it to call them back), with the assignee's email and note count.
  private async toAdminViews(rows: VipEnquiry[]) {
    const emails = await this.adminEmails(rows.map((r) => r.assignedAdminId));
    const counts = rows.length
      ? await this.prisma.vipEnquiryNote.groupBy({ by: ['enquiryId'], where: { enquiryId: { in: rows.map((r) => r.id) } }, _count: { _all: true } })
      : [];
    const noteCount = new Map(counts.map((c) => [c.enquiryId, c._count._all]));
    return rows.map((r) => ({
      ...toResponse(r),
      userId: r.userId,
      name: r.name,
      phone: r.phone,
      assignedAdminId: r.assignedAdminId,
      assignedAdminEmail: r.assignedAdminId ? (emails.get(r.assignedAdminId) ?? null) : null,
      noteCount: noteCount.get(r.id) ?? 0,
    }));
  }

  // Active admins whose role can work VIP enquiries: who an enquiry may be
  // assigned to.
  async assignees() {
    const admins = await this.prisma.adminUser.findMany({
      where: { isActive: true, role: { permissions: { some: { permission: { code: PERMISSIONS.VIP_MANAGE } } } } },
      select: { id: true, email: true },
      orderBy: { email: 'asc' },
    });
    return { items: admins };
  }

  // Status and/or assignment change, each recorded in the enquiry's history
  // with who did it. Returns what changed, for the audit entries.
  async update(adminId: string, id: string, change: UpdateVipEnquiryRequest) {
    const enquiry = await this.prisma.vipEnquiry.findUnique({ where: { id } });
    if (!enquiry) throw new NotFoundException('Enquiry not found');
    const data: Prisma.VipEnquiryUpdateInput = {};
    const events: { kind: 'STATUS' | 'ASSIGNMENT'; fromValue: string | null; toValue: string | null }[] = [];
    if (change.status !== undefined && change.status !== enquiry.status) {
      if (!VIP_STATUS_FLOW[enquiry.status].includes(change.status)) {
        throw new ConflictException(`An enquiry cannot move from ${enquiry.status} to ${change.status}`);
      }
      data.status = change.status;
      events.push({ kind: 'STATUS', fromValue: enquiry.status, toValue: change.status });
    }
    if (change.assignedAdminId !== undefined && change.assignedAdminId !== enquiry.assignedAdminId) {
      if (change.assignedAdminId !== null) {
        const ok = (await this.assignees()).items.some((a) => a.id === change.assignedAdminId);
        if (!ok) throw new BadRequestException('That admin cannot be assigned VIP enquiries');
      }
      data.assignedAdminId = change.assignedAdminId;
      events.push({ kind: 'ASSIGNMENT', fromValue: enquiry.assignedAdminId, toValue: change.assignedAdminId });
    }
    if (events.length === 0) return { enquiry, events };
    const updated = await this.prisma.$transaction(async (tx) => {
      const row = await tx.vipEnquiry.update({ where: { id }, data });
      await tx.vipEnquiryEvent.createMany({ data: events.map((e) => ({ ...e, enquiryId: id, adminId })) });
      return row;
    });
    return { enquiry: updated, events };
  }

  // Internal note, append-only (no edit or delete).
  async addNote(adminId: string, id: string, body: string) {
    const enquiry = await this.prisma.vipEnquiry.findUnique({ where: { id }, select: { id: true, userId: true } });
    if (!enquiry) throw new NotFoundException('Enquiry not found');
    const note = await this.prisma.vipEnquiryNote.create({ data: { enquiryId: id, authorAdminId: adminId, body: body.trim() } });
    return { enquiry, note };
  }
}
