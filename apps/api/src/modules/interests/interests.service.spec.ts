import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Prisma } from '../../generated/prisma/client.js';
import { InterestsService } from './interests.service.js';

const CALLER_USER_ID = 'user-caller';
const CALLER_PROFILE_ID = 'profile-caller';
const TARGET_USER_ID = 'user-target';
const TARGET_PROFILE_ID = 'profile-target';

interface TxMock {
  interest: { update: ReturnType<typeof vi.fn> };
  conversation: { create: ReturnType<typeof vi.fn> };
  conversationParticipant: { createMany: ReturnType<typeof vi.fn> };
}

function buildService(overrides?: {
  targetProfile?: unknown;
  callerProfile?: unknown;
  blockingInterest?: unknown;
  block?: unknown;
  createError?: unknown;
  txOverride?: (tx: TxMock) => void;
}) {
  const tx: TxMock = {
    interest: {
      update: vi.fn().mockResolvedValue({
        id: 'interest-1',
        senderId: CALLER_USER_ID,
        targetId: TARGET_USER_ID,
        status: 'ACCEPTED',
      }),
    },
    conversation: {
      create: vi.fn().mockResolvedValue({ id: 'conversation-1', interestId: 'interest-1' }),
    },
    conversationParticipant: {
      createMany: vi.fn().mockResolvedValue({ count: 2 }),
    },
  };
  overrides?.txOverride?.(tx);

  const prisma = {
    profile: {
      findUnique: vi.fn().mockResolvedValue(
        overrides?.targetProfile !== undefined
          ? overrides.targetProfile
          : { id: TARGET_PROFILE_ID, userId: TARGET_USER_ID, visibility: 'MEMBERS_ONLY' },
      ),
      findMany: vi.fn().mockResolvedValue([]),
    },
    block: {
      findFirst: vi.fn().mockResolvedValue(overrides?.block ?? null),
    },
    interest: {
      findUnique: vi.fn().mockResolvedValue(null),
      findFirst: vi.fn().mockResolvedValue(overrides?.blockingInterest ?? null),
      create:
        overrides?.createError !== undefined
          ? vi.fn().mockRejectedValue(overrides.createError)
          : vi.fn().mockResolvedValue({ id: 'interest-1', status: 'PENDING' }),
      update: vi.fn().mockImplementation(({ data }: { data: { status: string } }) =>
        Promise.resolve({ id: 'interest-1', status: data.status }),
      ),
      findMany: vi.fn().mockResolvedValue([]),
    },
    $transaction: vi.fn(async (callback: (tx: TxMock) => unknown) => callback(tx)),
  };

  const profilesService = {
    getOwnProfileOrThrow: vi.fn().mockResolvedValue(
      overrides?.callerProfile !== undefined
        ? overrides.callerProfile
        : { id: CALLER_PROFILE_ID, userId: CALLER_USER_ID },
    ),
  };

  const photosService = {
    getPhotosForProfile: vi.fn().mockResolvedValue([]),
  };

  const service = new InterestsService(prisma as never, profilesService as never, photosService as never);
  return { service, prisma, profilesService, photosService, tx };
}

describe('InterestsService.sendInterest', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('creates a pending interest for a valid target', async () => {
    const { service, prisma } = buildService();

    const result = await service.sendInterest(CALLER_USER_ID, TARGET_PROFILE_ID);

    expect(prisma.interest.create).toHaveBeenCalledWith({
      data: { senderId: CALLER_USER_ID, targetId: TARGET_USER_ID },
    });
    expect(result).toEqual({ id: 'interest-1', status: 'PENDING' });
  });

  it('rejects sending an interest to your own profile', async () => {
    const { service, prisma } = buildService({
      targetProfile: { id: CALLER_PROFILE_ID, userId: CALLER_USER_ID, visibility: 'MEMBERS_ONLY' },
    });

    await expect(service.sendInterest(CALLER_USER_ID, CALLER_PROFILE_ID)).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(prisma.interest.create).not.toHaveBeenCalled();
  });

  it('rejects a duplicate interest while a prior one is still pending', async () => {
    const { service, prisma } = buildService({
      blockingInterest: { id: 'interest-existing', status: 'PENDING' },
    });

    await expect(service.sendInterest(CALLER_USER_ID, TARGET_PROFILE_ID)).rejects.toBeInstanceOf(
      ConflictException,
    );
    await expect(service.sendInterest(CALLER_USER_ID, TARGET_PROFILE_ID)).rejects.toThrow(
      'You have already sent an interest to this profile',
    );
    expect(prisma.interest.create).not.toHaveBeenCalled();
  });

  it('rejects a duplicate interest while a prior one is already accepted', async () => {
    const { service, prisma } = buildService({
      blockingInterest: { id: 'interest-existing', status: 'ACCEPTED' },
    });

    await expect(service.sendInterest(CALLER_USER_ID, TARGET_PROFILE_ID)).rejects.toBeInstanceOf(
      ConflictException,
    );
    expect(prisma.interest.create).not.toHaveBeenCalled();
  });

  it('rejects with a decline-specific message when a prior interest was declined', async () => {
    const { service, prisma } = buildService({
      blockingInterest: { id: 'interest-existing', status: 'DECLINED' },
    });

    await expect(service.sendInterest(CALLER_USER_ID, TARGET_PROFILE_ID)).rejects.toBeInstanceOf(
      ConflictException,
    );
    await expect(service.sendInterest(CALLER_USER_ID, TARGET_PROFILE_ID)).rejects.toThrow(
      'This person has already declined your interest',
    );
    expect(prisma.interest.create).not.toHaveBeenCalled();
  });

  it('allows sending again after a prior interest to the same target was withdrawn', async () => {
    // The withdrawn row is excluded from the partial unique index and from
    // this app-level check (findFirst is scoped to status IN
    // PENDING/ACCEPTED/DECLINED) -- it simply doesn't come back as blocking.
    const { service, prisma } = buildService({ blockingInterest: null });

    const result = await service.sendInterest(CALLER_USER_ID, TARGET_PROFILE_ID);

    expect(prisma.interest.findFirst).toHaveBeenCalledWith({
      where: {
        senderId: CALLER_USER_ID,
        targetId: TARGET_USER_ID,
        status: { in: ['PENDING', 'ACCEPTED', 'DECLINED'] },
      },
    });
    expect(prisma.interest.create).toHaveBeenCalledWith({
      data: { senderId: CALLER_USER_ID, targetId: TARGET_USER_ID },
    });
    expect(result).toEqual({ id: 'interest-1', status: 'PENDING' });
  });

  it('concurrency backstop: converts a DB-level unique-constraint violation from a near-simultaneous send into the same clean rejection', async () => {
    // Simulates two requests racing past the findFirst check above before
    // either commits -- the app-level check alone can't prevent this under
    // concurrency; the partial unique index is what actually does, and
    // Prisma surfaces its violation as P2002 regardless of whether the index
    // is declared in schema.prisma (it isn't) or added by hand in the
    // migration SQL (it is) -- Postgres doesn't know the difference either.
    const raceError = new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
      code: 'P2002',
      clientVersion: 'test',
    });
    const { service, prisma } = buildService({ createError: raceError });

    await expect(service.sendInterest(CALLER_USER_ID, TARGET_PROFILE_ID)).rejects.toBeInstanceOf(
      ConflictException,
    );
    await expect(service.sendInterest(CALLER_USER_ID, TARGET_PROFILE_ID)).rejects.toThrow(
      'You have already sent an interest to this profile',
    );
    expect(prisma.interest.create).toHaveBeenCalled();
  });

  it('does not mask an unrelated database error as a duplicate-interest rejection', async () => {
    const { service } = buildService({ createError: new Error('connection reset') });

    await expect(service.sendInterest(CALLER_USER_ID, TARGET_PROFILE_ID)).rejects.toThrow(
      'connection reset',
    );
  });

  it('rejects when the caller has blocked the target, or vice versa', async () => {
    const { service, prisma } = buildService({ block: { id: 'block-1' } });

    await expect(service.sendInterest(CALLER_USER_ID, TARGET_PROFILE_ID)).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(prisma.interest.create).not.toHaveBeenCalled();
  });

  it('rejects a target profile that does not exist', async () => {
    const { service, prisma } = buildService({ targetProfile: null });

    await expect(service.sendInterest(CALLER_USER_ID, 'no-such-profile')).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(prisma.interest.create).not.toHaveBeenCalled();
  });

  it('rejects a hidden target profile the same way as a nonexistent one', async () => {
    const { service } = buildService({
      targetProfile: { id: TARGET_PROFILE_ID, userId: TARGET_USER_ID, visibility: 'HIDDEN' },
    });

    await expect(service.sendInterest(CALLER_USER_ID, TARGET_PROFILE_ID)).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });
});

describe('InterestsService.accept', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  function pendingInterest() {
    return {
      id: 'interest-1',
      senderId: CALLER_USER_ID,
      targetId: TARGET_USER_ID,
      status: 'PENDING',
    };
  }

  it('atomically updates the interest, creates the conversation, and creates both participant rows', async () => {
    const { service, prisma, tx } = buildService();
    prisma.interest.findUnique.mockResolvedValueOnce(pendingInterest());

    const result = await service.accept(TARGET_USER_ID, 'interest-1');

    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(tx.interest.update).toHaveBeenCalledWith({
      where: { id: 'interest-1' },
      data: { status: 'ACCEPTED', respondedAt: expect.any(Date) },
    });
    expect(tx.conversation.create).toHaveBeenCalledWith({ data: { interestId: 'interest-1' } });
    expect(tx.conversationParticipant.createMany).toHaveBeenCalledWith({
      data: [
        { conversationId: 'conversation-1', userId: CALLER_USER_ID },
        { conversationId: 'conversation-1', userId: TARGET_USER_ID },
      ],
    });
    expect(result.conversationId).toBe('conversation-1');
  });

  it('rolls back and propagates the error if a step partway through the transaction fails', async () => {
    const { service, prisma } = buildService({
      txOverride: (tx) => {
        tx.conversationParticipant.createMany.mockRejectedValue(new Error('simulated DB failure'));
      },
    });
    prisma.interest.findUnique.mockResolvedValueOnce(pendingInterest());

    // Prisma's $transaction guarantees atomicity for every write issued
    // through the `tx` client passed to the callback — if the callback
    // throws partway, none of the tx.* writes it already issued are
    // committed. This test's mock intentionally doesn't re-implement that
    // guarantee (it's Prisma's, exercised elsewhere in this codebase via
    // the identical pattern in PhotosService.setPrimaryPhoto); what it does
    // verify is that InterestsService lets the failure propagate rather
    // than swallowing it and reporting a false success.
    await expect(service.accept(TARGET_USER_ID, 'interest-1')).rejects.toThrow('simulated DB failure');
  });

  it('rejects when the caller is not the interest recipient', async () => {
    const { service, prisma } = buildService();
    prisma.interest.findUnique.mockResolvedValueOnce(pendingInterest());

    await expect(service.accept(CALLER_USER_ID, 'interest-1')).rejects.toBeInstanceOf(ForbiddenException);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('rejects accepting an interest that is no longer pending', async () => {
    const { service, prisma } = buildService();
    prisma.interest.findUnique.mockResolvedValueOnce({ ...pendingInterest(), status: 'DECLINED' });

    await expect(service.accept(TARGET_USER_ID, 'interest-1')).rejects.toBeInstanceOf(ConflictException);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('rejects accepting an interest that does not exist', async () => {
    const { service, prisma } = buildService();
    prisma.interest.findUnique.mockResolvedValueOnce(null);

    await expect(service.accept(TARGET_USER_ID, 'no-such-interest')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });
});

describe('InterestsService.decline', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('updates status to DECLINED and never creates a conversation', async () => {
    const { service, prisma } = buildService();
    prisma.interest.findUnique.mockResolvedValueOnce({
      id: 'interest-1',
      senderId: CALLER_USER_ID,
      targetId: TARGET_USER_ID,
      status: 'PENDING',
    });

    const result = await service.decline(TARGET_USER_ID, 'interest-1');

    expect(prisma.interest.update).toHaveBeenCalledWith({
      where: { id: 'interest-1' },
      data: { status: 'DECLINED', respondedAt: expect.any(Date) },
    });
    expect(prisma.$transaction).not.toHaveBeenCalled();
    expect(result.status).toBe('DECLINED');
  });

  it('rejects when the caller is not the recipient', async () => {
    const { service, prisma } = buildService();
    prisma.interest.findUnique.mockResolvedValueOnce({
      id: 'interest-1',
      senderId: CALLER_USER_ID,
      targetId: TARGET_USER_ID,
      status: 'PENDING',
    });

    await expect(service.decline(CALLER_USER_ID, 'interest-1')).rejects.toBeInstanceOf(ForbiddenException);
  });
});

describe('InterestsService.withdraw', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('withdraws a pending interest sent by the caller', async () => {
    const { service, prisma } = buildService();
    prisma.interest.findUnique.mockResolvedValueOnce({
      id: 'interest-1',
      senderId: CALLER_USER_ID,
      targetId: TARGET_USER_ID,
      status: 'PENDING',
    });

    const result = await service.withdraw(CALLER_USER_ID, 'interest-1');

    expect(prisma.interest.update).toHaveBeenCalledWith({
      where: { id: 'interest-1' },
      data: { status: 'WITHDRAWN', respondedAt: expect.any(Date) },
    });
    expect(result.status).toBe('WITHDRAWN');
  });

  it('rejects withdrawing when the caller is not the sender', async () => {
    const { service, prisma } = buildService();
    prisma.interest.findUnique.mockResolvedValueOnce({
      id: 'interest-1',
      senderId: CALLER_USER_ID,
      targetId: TARGET_USER_ID,
      status: 'PENDING',
    });

    await expect(service.withdraw(TARGET_USER_ID, 'interest-1')).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it('rejects withdrawing an interest that is no longer pending', async () => {
    const { service, prisma } = buildService();
    prisma.interest.findUnique.mockResolvedValueOnce({
      id: 'interest-1',
      senderId: CALLER_USER_ID,
      targetId: TARGET_USER_ID,
      status: 'ACCEPTED',
    });

    await expect(service.withdraw(CALLER_USER_ID, 'interest-1')).rejects.toBeInstanceOf(
      ConflictException,
    );
  });
});

describe('InterestsService.listForUser', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('includes each party\'s computed age, matching the Browse Profiles summary shape', async () => {
    const { service, prisma } = buildService();
    prisma.interest.findMany
      .mockResolvedValueOnce([
        {
          id: 'interest-1',
          senderId: CALLER_USER_ID,
          targetId: TARGET_USER_ID,
          status: 'PENDING',
          createdAt: new Date('2026-01-01T00:00:00.000Z'),
          respondedAt: null,
        },
      ])
      .mockResolvedValueOnce([]);
    prisma.profile.findMany.mockImplementation(({ where }: { where: { userId: { in: string[] } } }) => {
      const dateOfBirth = new Date('1998-06-15T00:00:00.000Z');
      return Promise.resolve(
        where.userId.in
          .filter((id: string) => id === TARGET_USER_ID || id === CALLER_USER_ID)
          .map((id: string) => ({
            id: id === TARGET_USER_ID ? TARGET_PROFILE_ID : CALLER_PROFILE_ID,
            userId: id,
            fullName: id === TARGET_USER_ID ? 'Target Person' : 'Caller Person',
            dateOfBirth,
          })),
      );
    });

    const result = await service.listForUser(CALLER_USER_ID);

    expect(result.sent).toHaveLength(1);
    expect(typeof result.sent[0].sender.age).toBe('number');
    expect(typeof result.sent[0].target.age).toBe('number');
    expect(result.sent[0].target.fullName).toBe('Target Person');
  });
});
