// Dev only: move the launch-offer trials through time so the whole flow can
// be tested without waiting for real dates. Refuses to run in production.
//
//   pnpm dev:trial status   list every trial and its dates
//   pnpm dev:trial launch   queued trials start now (same length): "launch day"
//   pnpm dev:trial end      running trials end now: "the trial ran out"
//
// The pre-launch gate itself follows LAUNCH_DATE in .env, so set that too
// (the script prints what to set) and restart the API.
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma/client.js';

if (process.env.NODE_ENV === 'production') {
  console.error('dev-trial refuses to run with NODE_ENV=production.');
  process.exit(1);
}

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) });
const istDay = (d: Date) => new Date(d.getTime() + 330 * 60 * 1000).toISOString().slice(0, 10);
const fmt = (d: Date) => d.toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', dateStyle: 'medium', timeStyle: 'short' });

async function list(): Promise<void> {
  const now = new Date();
  const trials = await prisma.subscription.findMany({
    where: { source: 'TRIAL' },
    include: { plan: { select: { name: true } }, user: { select: { phoneNumber: true, profile: { select: { fullName: true } } } } },
    orderBy: { createdAt: 'asc' },
  });
  if (trials.length === 0) {
    console.log('No trials yet. A trial is given when a campaign sign-up has a profile and a photo before LAUNCH_DATE.');
    return;
  }
  for (const t of trials) {
    const state = t.cancelledAt ? 'CANCELLED' : t.expiresAt <= now ? 'ENDED' : t.startedAt > now ? 'QUEUED' : 'RUNNING';
    console.log(`${state.padEnd(9)} ${t.plan.name} · ${t.user.profile?.fullName ?? '(no profile)'} ${t.user.phoneNumber} · ${fmt(t.startedAt)} → ${fmt(t.expiresAt)}`);
  }
}

async function launch(): Promise<void> {
  const now = new Date();
  const queued = await prisma.subscription.findMany({ where: { source: 'TRIAL', cancelledAt: null, startedAt: { gt: now } } });
  for (const t of queued) {
    const length = t.expiresAt.getTime() - t.startedAt.getTime();
    await prisma.subscription.update({ where: { id: t.id }, data: { startedAt: now, expiresAt: new Date(now.getTime() + length), status: 'ACTIVE' } });
  }
  console.log(`${queued.length} queued trial(s) now start ${fmt(now)}.`);
  console.log(`Now set LAUNCH_DATE=${istDay(now)} in apps/api/.env and restart the API, so matching opens too.`);
}

async function end(): Promise<void> {
  const now = new Date();
  const result = await prisma.subscription.updateMany({
    where: { source: 'TRIAL', cancelledAt: null, startedAt: { lte: now }, expiresAt: { gt: now } },
    data: { expiresAt: now },
  });
  console.log(`${result.count} running trial(s) ended at ${fmt(now)}. With REQUIRE_PAID_PLAN=true those members are now asked to choose a plan.`);
}

const command = process.argv[2] ?? 'status';
const run = { status: list, launch, end }[command];
if (!run) {
  console.error('Usage: pnpm dev:trial status|launch|end');
  process.exit(1);
}
run()
  .then(() => command !== 'status' && list())
  .finally(() => prisma.$disconnect());
