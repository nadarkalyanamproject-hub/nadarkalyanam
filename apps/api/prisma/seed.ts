import { PrismaPg } from '@prisma/adapter-pg';
import { PERMISSIONS } from '../src/common/permissions.js';
import { PrismaClient } from '../src/generated/prisma/client.js';

// SRS §2.3's six admin roles, seeded as data (Role rows) rather than an
// enum — the RBAC authority principle. Permission grants here are a
// reasonable starting mapping, not an approved one; Product + Technical
// Lead own the final admin role/permission matrix (SRS §8.4).
const ROLE_PERMISSIONS: Record<string, string[]> = {
  SUPER_ADMIN: Object.values(PERMISSIONS),
  OPERATIONS_ADMIN: [PERMISSIONS.MEMBERS_SUSPEND, PERMISSIONS.MEMBERS_REINSTATE, PERMISSIONS.REPORTS_REVIEW],
  MODERATOR: [PERMISSIONS.MEMBERS_SUSPEND, PERMISSIONS.MEMBERS_REINSTATE, PERMISSIONS.REPORTS_REVIEW],
  VERIFICATION_AGENT: [PERMISSIONS.VERIFICATION_REVIEW],
  FINANCE_ADMIN: [PERMISSIONS.PAYMENTS_REFUND, PERMISSIONS.FINANCE_DASHBOARD_VIEW],
  CONTENT_ADMIN: [PERMISSIONS.CMS_MANAGE],
};

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

async function main() {
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
        phoneNumbers: 'Unlimited*',
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
        phoneNumbers: 'Unlimited*',
        unlimitedMessages: true,
        unlimitedHoroscopes: true,
        verifiedProfilesWithPhotos: true,
        dedicatedManager: true,
        prioritySpotlight: true,
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

  console.log('Seeded roles, permissions, and membership plans.');
}

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
