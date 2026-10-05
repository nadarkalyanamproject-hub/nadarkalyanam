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

  // Plan display copy. `available` is whether the product delivers that
  // feature TODAY: only messaging your connections and viewing verified
  // profiles exist; everything else is shown as Coming Soon. Limits are
  // typed columns (phoneUnlockLimit: null = unlimited), never parsed from
  // this copy.
  const feature = (key: string, label: string, available = false) => ({ key, label, available });
  const MESSAGES = feature('unlimitedMessages', 'Unlimited messages with your connections', true);
  const VERIFIED_PROFILES = feature('verifiedProfiles', 'View verified profiles with photos', true);
  const HOROSCOPE = feature('horoscopeViews', 'Unlimited horoscope views');
  const UNLIMITED_PHONES = feature('phoneNumbers', 'Unlimited phone numbers');

  const MEMBERSHIP_PLANS = [
    {
      id: 'plan-gold-3m',
      code: 'GOLD',
      name: 'Gold',
      priceInPaise: 149900,
      durationDays: 90,
      sortOrder: 1,
      phoneUnlockLimit: 50,
      isAssisted: false,
      features: [feature('phoneNumbers', '50 verified phone numbers'), MESSAGES, HOROSCOPE, VERIFIED_PROFILES],
    },
    {
      id: 'plan-gold-plus-3m',
      code: 'GOLD_PLUS',
      name: 'Gold Plus',
      priceInPaise: 229900,
      durationDays: 90,
      sortOrder: 2,
      phoneUnlockLimit: null,
      isAssisted: false,
      features: [
        UNLIMITED_PHONES,
        MESSAGES,
        HOROSCOPE,
        feature('searchPriority', 'Priority placement in search'),
        feature('whatsappConnect', 'WhatsApp direct connect'),
      ],
    },
    {
      id: 'plan-gold-premium-12m',
      code: 'GOLD_PREMIUM',
      name: 'Gold Premium',
      priceInPaise: 599900,
      durationDays: 365,
      sortOrder: 3,
      phoneUnlockLimit: null,
      isAssisted: false,
      features: [
        UNLIMITED_PHONES,
        MESSAGES,
        HOROSCOPE,
        feature('relationshipManager', 'Dedicated relationship manager'),
        feature('spotlight', 'Top-spot spotlight'),
        feature('whatsappPriority', 'Priority WhatsApp assistance'),
        feature('weeklyMatches', 'Handpicked weekly matches'),
      ],
    },
    {
      id: 'plan-vip-assisted-6m',
      code: 'VIP_ASSISTED',
      name: 'VIP Assisted',
      priceInPaise: 1499900,
      durationDays: 180,
      sortOrder: 4,
      phoneUnlockLimit: 75,
      isAssisted: true,
      features: [
        feature('assistedContacts', '75 verified contacts handled on your behalf'),
        feature('seniorMatchmaker', 'Personal senior matchmaker'),
        feature('familyCoordination', 'Family call and meeting coordination'),
        feature('preScreenedMatches', 'Pre-screened, handpicked matches'),
        feature('vipWhatsappDesk', 'VIP WhatsApp desk'),
        feature('confidentiality', 'Confidential search'),
      ],
    },
  ];

  for (const { features, ...plan } of MEMBERSHIP_PLANS) {
    const data = { ...plan, entitlements: { features }, isActive: true };
    await prisma.membershipPlan.upsert({
      where: { id: plan.id },
      update: data,
      create: data,
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
