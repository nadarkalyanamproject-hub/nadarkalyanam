import { describe, expect, it } from 'vitest';
import { DEMO_SEED_PROFILES, DemoSeedRefusedError, seedDemo } from './demo-seed.js';
import { seedEssential } from './essential-seed.js';

/* eslint-disable @typescript-eslint/no-explicit-any */
// Records every prisma.<model>.<method>(args) call and returns a plausible
// row, so the tests see exactly what each seed would write.
function recordingPrisma() {
  const calls: { model: string; method: string; args: any }[] = [];
  const prisma = new Proxy(
    {},
    {
      get: (_, model: string) =>
        new Proxy(
          {},
          {
            get: (__, method: string) => async (args: any) => {
              calls.push({ model, method, args });
              if (method === 'findFirst') return null;
              return { id: `${model}-${calls.length}` };
            },
          },
        ),
    },
  );
  const of = (model: string, method?: string) => calls.filter((c) => c.model === model && (!method || c.method === method));
  return { prisma: prisma as any, calls, of };
}
const quiet = () => {};

describe('essential seed', () => {
  it('writes permissions, roles, plans and the one admin — and never a member profile', async () => {
    const { prisma, of } = recordingPrisma();
    await seedEssential(prisma, quiet);

    expect(of('permission', 'upsert').length).toBeGreaterThan(0);
    expect(of('role', 'upsert').length).toBeGreaterThan(0);
    expect(of('rolePermission', 'upsert').length).toBeGreaterThan(0);
    expect(of('membershipPlan', 'upsert')).toHaveLength(4);
    expect(of('adminUser', 'upsert')).toHaveLength(1);
    // The only User it touches is the admin's own account.
    expect(of('user', 'upsert').map((c) => c.args.where.phoneNumber)).toEqual(['+919876543200']);
    expect(of('profile')).toHaveLength(0);
    expect(of('profilePhoto')).toHaveLength(0);
  });
});

describe('demo seed', () => {
  it('refuses to run in production and writes nothing', async () => {
    const { prisma, calls } = recordingPrisma();
    await expect(seedDemo(prisma, 'production', quiet)).rejects.toBeInstanceOf(DemoSeedRefusedError);
    expect(calls).toHaveLength(0);
  });

  it('outside production, creates the demo members with a computed (not hardcoded) completion score', async () => {
    const { prisma, of } = recordingPrisma();
    await seedDemo(prisma, 'development', quiet);

    const profiles = of('profile', 'upsert');
    expect(profiles).toHaveLength(DEMO_SEED_PROFILES.length);
    // Every demo member has all 21 fields plus a photo except those that
    // leave a field blank, so scores are real values, not a flat 90.
    for (const call of profiles) {
      expect(call.args.create.completionScore).toBe(call.args.update.completionScore);
      expect(call.args.create.completionScore).not.toBe(90);
    }
  });
});
