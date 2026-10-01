import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma/client.js';
import { backfillCompletionScores } from '../src/seed/backfill-completion.js';

// `pnpm profiles:backfill-completion`: one-off recompute of every profile's
// completionScore. Run once after deploying the real completion score.
const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

backfillCompletionScores(prisma)
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
