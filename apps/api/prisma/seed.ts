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

  console.log('Seeded roles and permissions.');
}

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
