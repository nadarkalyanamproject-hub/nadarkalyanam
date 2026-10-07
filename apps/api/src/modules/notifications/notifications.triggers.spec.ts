import { NotFoundException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import { AdminService } from '../admin/admin.service.js';
import { InterestsService } from '../interests/interests.service.js';
import { MessagesService } from '../messages/messages.service.js';
import { ProfilesController } from '../profiles/profiles.controller.js';
import { NotificationsService } from './notifications.service.js';

// Each business flow calls notify() exactly once, for the right recipient
// and actor — and not at all for the paths that must stay silent.

const A = { userId: 'user-a', profileId: 'profile-a' };
const B = { userId: 'user-b', profileId: 'profile-b' };

const notifier = () => ({ notify: vi.fn(), markTargetRead: vi.fn().mockResolvedValue(0) });

function interestsService(interestRow: Record<string, unknown> | null = null) {
  const prisma = {
    profile: {
      findUnique: vi.fn().mockResolvedValue({ id: B.profileId, userId: B.userId, visibility: 'MEMBERS_ONLY' }),
    },
    block: { findFirst: vi.fn().mockResolvedValue(null) },
    interest: {
      findMany: vi.fn().mockResolvedValue([]),
      findFirst: vi.fn().mockResolvedValue(null),
      findUnique: vi.fn().mockResolvedValue(interestRow),
      create: vi.fn().mockResolvedValue({ id: 'interest-1', status: 'PENDING' }),
      update: vi.fn().mockImplementation(({ data }: { data: { status: string } }) => Promise.resolve({ id: 'interest-1', ...data })),
    },
    $transaction: vi.fn(async (fn: (tx: unknown) => unknown) =>
      fn({
        interest: { update: vi.fn().mockResolvedValue({ id: 'interest-1', status: 'ACCEPTED' }) },
        conversation: { create: vi.fn().mockResolvedValue({ id: 'conv-1' }) },
        conversationParticipant: { createMany: vi.fn().mockResolvedValue({ count: 2 }) },
      }),
    ),
  };
  const profilesService = { getOwnProfileOrThrow: vi.fn().mockResolvedValue({ id: A.profileId, userId: A.userId }) };
  const notifications = notifier();
  const service = new InterestsService(prisma as never, profilesService as never, {} as never, notifications as never, { getActivePlan: async () => ({ plan: { code: 'GOLD' } }), freeInterestsPerMonth: () => 5 } as never);
  return { service, notifications };
}

const pending = { id: 'interest-1', senderId: A.userId, targetId: B.userId, status: 'PENDING' };

describe('interest triggers', () => {
  it('sendInterest -> one INTEREST_RECEIVED for the recipient, actor = sender, target = the interest', async () => {
    const { service, notifications } = interestsService();

    await service.sendInterest(A.userId, B.profileId);

    expect(notifications.notify).toHaveBeenCalledTimes(1);
    expect(notifications.notify).toHaveBeenCalledWith({
      recipientUserId: B.userId,
      actorUserId: A.userId,
      type: 'INTEREST_RECEIVED',
      targetType: 'Interest',
      targetId: 'interest-1',
    });
  });

  it('a rejected sendInterest (e.g. already sent) notifies nobody', async () => {
    const { service, notifications } = interestsService();
    const svc = service as unknown as { prisma: { interest: { findFirst: ReturnType<typeof vi.fn> } } };
    svc.prisma.interest.findFirst.mockResolvedValueOnce({ id: 'x', status: 'PENDING' });

    await expect(service.sendInterest(A.userId, B.profileId)).rejects.toThrow();
    expect(notifications.notify).not.toHaveBeenCalled();
  });

  it('accept -> one INTEREST_ACCEPTED for the ORIGINAL SENDER only (not the accepter), target = the conversation', async () => {
    const { service, notifications } = interestsService(pending);

    await service.accept(B.userId, 'interest-1');

    expect(notifications.notify).toHaveBeenCalledTimes(1);
    expect(notifications.notify).toHaveBeenCalledWith({
      recipientUserId: A.userId,
      actorUserId: B.userId,
      type: 'INTEREST_ACCEPTED',
      targetType: 'Conversation',
      targetId: 'conv-1',
    });
  });

  it('decline and withdraw notify nobody', async () => {
    const declined = interestsService(pending);
    await declined.service.decline(B.userId, 'interest-1');
    const withdrawn = interestsService(pending);
    await withdrawn.service.withdraw(A.userId, 'interest-1');

    expect(declined.notifications.notify).not.toHaveBeenCalled();
    expect(withdrawn.notifications.notify).not.toHaveBeenCalled();
  });

  it('a notification failure never breaks the action: sendInterest still succeeds with the queue down', async () => {
    const queue = { add: vi.fn().mockRejectedValue(new Error('redis down')) };
    const realNotifications = new NotificationsService({} as never, queue as never, {} as never);
    const { service } = interestsService();
    (service as unknown as { notifications: NotificationsService }).notifications = realNotifications;

    await expect(service.sendInterest(A.userId, B.profileId)).resolves.toEqual({ id: 'interest-1', status: 'PENDING' });
    expect(queue.add).toHaveBeenCalledTimes(1);
  });
});

describe('profile view trigger', () => {
  const rawProfile = {
    id: B.profileId,
    userId: B.userId,
    fullName: 'B',
    gender: 'FEMALE',
    dateOfBirth: new Date('1998-01-01'),
    details: { location: { city: 'X', state: 'Y' }, education: {}, additional: {} },
  };
  function controller(getOtherProfile: ReturnType<typeof vi.fn>) {
    const profilesService = {
      getOtherProfile,
      getRelationshipStates: vi.fn().mockResolvedValue(new Map()),
      listOtherProfiles: vi.fn().mockResolvedValue({ profiles: [rawProfile], total: 1 }),
    };
    const notifications = notifier();
    const ctl = new ProfilesController(
      profilesService as never,
      { getPhotosForProfile: vi.fn().mockResolvedValue([]) } as never,
      notifications as never,
      {} as never,
      { findForUser: async () => null, fitForViewer: async () => null } as never,
      { findByProfileId: async () => null, viewFor: async () => ({ shared: false }) } as never,
    );
    return { ctl, notifications };
  }

  it('GET /profiles/:id -> one PROFILE_VIEWED for the owner, actor = viewer', async () => {
    const { ctl, notifications } = controller(vi.fn().mockResolvedValue(rawProfile));

    await ctl.getOne({ userId: A.userId, sessionId: 'session-test' }, B.profileId);

    expect(notifications.notify).toHaveBeenCalledTimes(1);
    expect(notifications.notify).toHaveBeenCalledWith({
      recipientUserId: B.userId,
      actorUserId: A.userId,
      type: 'PROFILE_VIEWED',
      targetType: 'Profile',
    });
  });

  it('no notification when the view is refused (own profile, hidden, or blocked pair all 404 in getOtherProfile)', async () => {
    const { ctl, notifications } = controller(vi.fn().mockRejectedValue(new NotFoundException('Profile not found')));

    await expect(ctl.getOne({ userId: A.userId, sessionId: 'session-test' }, B.profileId)).rejects.toBeInstanceOf(NotFoundException);
    expect(notifications.notify).not.toHaveBeenCalled();
  });

  it('the browse LIST never counts as a view', async () => {
    const { ctl, notifications } = controller(vi.fn());

    await ctl.list({ userId: A.userId, sessionId: 'session-test' });

    expect(notifications.notify).not.toHaveBeenCalled();
  });
});

describe('messages never create notifications', () => {
  function messages() {
    const prisma = {
      conversationParticipant: {
        findMany: vi.fn().mockResolvedValue([
          { userId: A.userId, conversationId: 'conv-1' },
          { userId: B.userId, conversationId: 'conv-1' },
        ]),
      },
      block: { findFirst: vi.fn().mockResolvedValue(null) },
      message: {
        create: vi.fn().mockResolvedValue({
          id: 'm-1', conversationId: 'conv-1', senderId: A.userId, body: 'hi', status: 'SENT', createdAt: new Date(),
        }),
      },
      notification: { create: vi.fn(), update: vi.fn(), updateMany: vi.fn() },
    };
    return { service: new MessagesService(prisma as never, {} as never), prisma };
  }

  it('sendMessage persists the message and writes no notification row', async () => {
    const { service, prisma } = messages();

    await service.sendMessage(A.userId, 'conv-1', 'hi');

    expect(prisma.message.create).toHaveBeenCalledTimes(1);
    expect(prisma.notification.create).not.toHaveBeenCalled();
    expect(prisma.notification.update).not.toHaveBeenCalled();
    expect(prisma.notification.updateMany).not.toHaveBeenCalled();
  });

  it('MessagesService no longer depends on NotificationsService at all', () => {
    expect(MessagesService.length).toBe(2);
  });
});

describe('admin action triggers (no actor)', () => {
  function admin(user: Record<string, unknown>) {
    const prisma = {
      user: {
        findUnique: vi.fn().mockResolvedValue({ id: 'member', adminUser: null, ...user }),
        update: vi.fn().mockImplementation(({ data }: { data: Record<string, unknown> }) => Promise.resolve({ id: 'member', ...data })),
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      },
    };
    const photos = { deletePhoto: vi.fn().mockResolvedValue({ id: 'p1', objectKey: 'k' }) };
    const notifications = notifier();
    const service = new AdminService(prisma as never, photos as never, { record: vi.fn() } as never, notifications as never);
    return { service, notifications };
  }
  const only = (n: { notify: ReturnType<typeof vi.fn> }) => {
    expect(n.notify).toHaveBeenCalledTimes(1);
    const arg = n.notify.mock.calls[0][0];
    expect(arg.recipientUserId).toBe('member');
    expect(arg.actorUserId).toBeUndefined();
    return arg.type;
  };

  it('suspend -> ACCOUNT_SUSPENDED', async () => {
    const x = admin({ status: 'ACTIVE' });
    await x.service.suspendMember('admin-1', 'member', 'spam');
    expect(only(x.notifications)).toBe('ACCOUNT_SUSPENDED');
  });

  it('reinstate -> ACCOUNT_REINSTATED', async () => {
    const x = admin({ status: 'SUSPENDED' });
    await x.service.reinstateMember('admin-1', 'member');
    expect(only(x.notifications)).toBe('ACCOUNT_REINSTATED');
  });

  it('remove -> REMOVAL_SCHEDULED with the (non-identifying) scheduled date', async () => {
    const x = admin({ status: 'ACTIVE' });
    await x.service.removeMember('admin-1', 'member', 'requested');
    expect(only(x.notifications)).toBe('REMOVAL_SCHEDULED');
    expect(x.notifications.notify.mock.calls[0][0].data).toEqual({ scheduledAt: expect.any(String) });
  });

  it('restore -> REMOVAL_CANCELLED', async () => {
    const x = admin({ status: 'PENDING_DELETION', deletionRequestedAt: new Date(Date.now() - 86_400_000) });
    await x.service.restoreMember('admin-1', 'member');
    expect(only(x.notifications)).toBe('REMOVAL_CANCELLED');
  });

  it('photo removal -> ADMIN_PHOTO_REMOVED', async () => {
    const x = admin({ status: 'ACTIVE' });
    await x.service.removeMemberPhoto('admin-1', 'member', 'p1', 'nudity');
    expect(only(x.notifications)).toBe('ADMIN_PHOTO_REMOVED');
  });

  it('a refused admin action (e.g. suspending a pending-deletion member) notifies nobody', async () => {
    const x = admin({ status: 'PENDING_DELETION' });
    await expect(x.service.suspendMember('admin-1', 'member', 'x')).rejects.toThrow();
    expect(x.notifications.notify).not.toHaveBeenCalled();
  });
});
