// One-off: sets the display names and feature lists of the three self-serve
// plans (Gold, Gold Plus, Gold Premium) in an existing database. Display copy
// only; prices, durations and limits are untouched. Admins can edit the same
// copy later under Plans in the admin app.
// Run from apps/api:  node --env-file=.env node_modules/tsx/dist/cli.mjs prisma/sync-plan-features.ts
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma/client.js';

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

const feature = (key: string, label: string, available = false) => ({ key, label, available });
const MESSAGES = feature('unlimitedMessages', 'Unlimited messages with your connections', true);
const VERIFIED_PROFILES = feature('verifiedProfiles', 'View verified profiles with photos', true);
const UNLIMITED_INTERESTS = feature('unlimitedInterests', 'Unlimited interests (no monthly limit)', true);
const HOROSCOPE = feature('horoscopeViews', 'Unlimited horoscope views');
const phones = (allowance: string) =>
  feature('phoneNumbers', `Unlock ${allowance} OTP-verified phone numbers of connected members who allow it`, true);
const SPOTLIGHT = feature('spotlight', 'Top-spot spotlight in search and browse', true);

const UPDATES = [
  {
    id: 'plan-gold-3m',
    name: 'Gold',
    features: [phones('up to 50'), MESSAGES, UNLIMITED_INTERESTS, HOROSCOPE, VERIFIED_PROFILES],
  },
  {
    id: 'plan-gold-plus-3m',
    name: 'Gold Plus',
    features: [
      phones('unlimited'),
      MESSAGES,
      UNLIMITED_INTERESTS,
      HOROSCOPE,
      feature('searchPriority', 'Priority placement in search and browse', true),
      feature('whatsappConnect', 'WhatsApp direct connect'),
    ],
  },
  {
    id: 'plan-gold-premium-12m',
    name: 'Gold Premium',
    features: [
      phones('unlimited'),
      MESSAGES,
      UNLIMITED_INTERESTS,
      HOROSCOPE,
      feature('relationshipManager', 'Dedicated relationship manager'),
      SPOTLIGHT,
      feature('whatsappPriority', 'Priority WhatsApp assistance'),
      feature('weeklyMatches', 'Handpicked weekly matches'),
    ],
  },
];

async function main() {
  for (const item of UPDATES) {
    await prisma.membershipPlan.update({
      where: { id: item.id },
      data: {
        name: item.name,
        entitlements: { features: item.features },
      },
    });
    console.log(`Updated features for ${item.id} (${item.name})`);
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
