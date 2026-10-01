import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma/client.js';
import { seedDemo } from '../src/seed/demo-seed.js';

// `pnpm prisma:seed:demo`: adds the 10 made-up demo members for local
// development. Refuses to run when NODE_ENV=production.
const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

seedDemo(prisma, process.env.NODE_ENV)
  .catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
