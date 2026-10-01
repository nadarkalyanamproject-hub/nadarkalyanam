import { PERMISSIONS } from '../common/permissions.js';
import { ROLE_PERMISSIONS } from '../common/role-permissions.js';
import type { PrismaClient } from '../generated/prisma/client.js';

// ESSENTIAL seed: what every environment needs, production included —
// permissions, roles, membership plans and the first admin account. Safe to
// re-run (every write is an upsert), e.g. after new permissions are added.
// It creates no member profiles; demo members live in demo-seed.ts and are
// never part of this.
export async function seedEssential(prisma: PrismaClient, log: (message: string) => void = console.log): Promise<void> {
  for (const code of Object.values(PERMISSIONS)) {
    await prisma.permission.upsert({ where: { code }, update: {}, create: { code } });
  }

  for (const [roleName, permissionCodes] of Object.entries(ROLE_PERMISSIONS)) {
    const role = await prisma.role.upsert({ where: { name: roleName }, update: {}, create: { name: roleName } });
    for (const code of permissionCodes) {
      const permission = await prisma.permission.findUniqueOrThrow({ where: { code } });
      await prisma.rolePermission.upsert({
        where: { roleId_permissionId: { roleId: role.id, permissionId: permission.id } },
        update: {},
        create: { roleId: role.id, permissionId: permission.id },
      });
    }
  }

  const MEMBERSHIP_PLANS = [
    {
      id: 'plan-gold-3m',
      name: 'Gold - 3 months',
      priceInPaise: 149900,
      durationDays: 90,
      entitlements: {
        phoneNumbers: 50,
        unlimitedMessages: true,
        unlimitedHoroscopes: true,
        verifiedProfilesWithPhotos: true,
      },
    },
    {
      id: 'plan-gold-plus-3m',
      name: 'Gold + - 3 months',
      priceInPaise: 229900,
      durationDays: 90,
      entitlements: {
        phoneNumbers: 'Unlimited',
        newPhoneNumbersQuota: 75,
        unlimitedMessages: true,
        unlimitedHoroscopes: true,
        verifiedProfilesWithPhotos: true,
        priorityListing: true,
      },
    },
    {
      id: 'plan-gold-premium-12m',
      name: 'Gold Premium - 12 months',
      priceInPaise: 599900,
      durationDays: 365,
      entitlements: {
        phoneNumbers: 'Unlimited',
        newPhoneNumbersQuota: 200,
        unlimitedMessages: true,
        unlimitedHoroscopes: true,
        verifiedProfilesWithPhotos: true,
        dedicatedManager: true,
        prioritySpotlight: true,
      },
    },
    {
      id: 'plan-vip-assisted-6m',
      name: 'VIP Assisted - 6 months',
      priceInPaise: 1499900,
      durationDays: 180,
      entitlements: {
        phoneNumbers: 75,
        unlimitedMessages: true,
        unlimitedHoroscopes: true,
        verifiedProfilesWithPhotos: true,
        dedicatedRelationshipManager: true,
        familyAssistance: true,
        confidentialSearch: true,
      },
    },
  ];

  for (const plan of MEMBERSHIP_PLANS) {
    await prisma.membershipPlan.upsert({
      where: { id: plan.id },
      update: {
        name: plan.name,
        priceInPaise: plan.priceInPaise,
        durationDays: plan.durationDays,
        entitlements: plan.entitlements,
        isActive: true,
      },
      create: {
        id: plan.id,
        name: plan.name,
        priceInPaise: plan.priceInPaise,
        durationDays: plan.durationDays,
        entitlements: plan.entitlements,
        isActive: true,
      },
    });
  }

  log('Seeded roles, permissions, and membership plans.');

  // First admin account — the bootstrap for admin access. Further admins
  // are added by a SUPER_ADMIN from the admin app's Admins page
  // (POST /admin/admins). Logs in through the exact same phone/OTP flow as
  // a regular member (POST /auth/otp/request, then POST /auth/otp/verify with
  // intent: 'login') using ADMIN_PHONE_NUMBER below. Because a linked
  // AdminUser row exists for that User, auth.service.ts's verifyOtp() issues
  // an admin-scoped (typ: 'admin') token instead of a normal member token —
  // no separate admin credential or endpoint exists.
  const ADMIN_PHONE_NUMBER = '+919876543200';
  const ADMIN_EMAIL = 'admin@nadarkalyanam.dev';
  const ADMIN_ROLE_NAME = 'SUPER_ADMIN';

  const adminAccountUser = await prisma.user.upsert({
    where: { phoneNumber: ADMIN_PHONE_NUMBER },
    update: { status: 'ACTIVE' },
    create: { phoneNumber: ADMIN_PHONE_NUMBER, status: 'ACTIVE' },
  });
  const superAdminRole = await prisma.role.findUniqueOrThrow({ where: { name: ADMIN_ROLE_NAME } });
  await prisma.adminUser.upsert({
    where: { userId: adminAccountUser.id },
    update: { roleId: superAdminRole.id, isActive: true },
    create: { userId: adminAccountUser.id, email: ADMIN_EMAIL, roleId: superAdminRole.id },
  });

  log(`Seeded first admin account (phone: ${ADMIN_PHONE_NUMBER}, role: ${ADMIN_ROLE_NAME}).`);
}
