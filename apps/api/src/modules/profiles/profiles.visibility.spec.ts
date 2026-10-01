import 'reflect-metadata';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { updateProfileVisibilitySchema } from '@nadar-kalyanam/schemas';
import { describe, expect, it, vi } from 'vitest';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe.js';
import { ProfilesController } from './profiles.controller.js';
import { ProfilesService } from './profiles.service.js';

/* eslint-disable @typescript-eslint/no-explicit-any */
function setup(initial: string | null = 'MEMBERS_ONLY') {
  const row = initial
    ? { id: 'profile-1', userId: 'user-1', fullName: 'Meena Raj', gender: 'FEMALE', dateOfBirth: new Date('1996-01-01'), completionScore: 76, visibility: initial, details: {} }
    : null;
  const prisma = {
    profile: {
      findUnique: vi.fn(async () => row),
      update: vi.fn(async ({ data }: any) => Object.assign(row!, data)),
    },
  };
  const service = new ProfilesService(prisma as never);
  const controller = new ProfilesController(service, { getPhotosForProfile: async () => [] } as never, {} as never);
  return { prisma, controller, row };
}
const me = { userId: 'user-1', sessionId: 'session-test' };
const pipe = new ZodValidationPipe(updateProfileVisibilitySchema);

describe('PATCH /profiles/me/visibility', () => {
  it('saves the chosen visibility, writes nothing else, and returns it', async () => {
    const { prisma, controller, row } = setup();

    const response = await controller.updateMyVisibility(me, pipe.transform({ visibility: 'HIDDEN' }) as any);

    expect(prisma.profile.update).toHaveBeenCalledWith({ where: { userId: 'user-1' }, data: { visibility: 'HIDDEN' } });
    expect(row!.visibility).toBe('HIDDEN');
    expect(response.visibility).toBe('HIDDEN');
  });

  it.each(['PUBLIC', 'MEMBERS_ONLY', 'HIDDEN'])('accepts %s', (visibility) => {
    expect(pipe.transform({ visibility })).toEqual({ visibility });
  });

  it.each([
    [{ visibility: 'PREMIUM_ONLY' }],
    [{ visibility: 'hidden' }],
    [{}],
    [{ visibility: 'HIDDEN', phoneNumber: 'Visible to all members' }],
  ])('rejects %j', (body) => {
    expect(() => pipe.transform(body)).toThrow(BadRequestException);
  });

  it('404s when the member has no profile yet', async () => {
    const { controller } = setup(null);
    await expect(controller.updateMyVisibility(me, { visibility: 'HIDDEN' })).rejects.toBeInstanceOf(NotFoundException);
  });

  it('GET /profiles/me reports the stored visibility', async () => {
    const { controller } = setup('PUBLIC');
    expect((await controller.getMe(me)).visibility).toBe('PUBLIC');
  });
});
