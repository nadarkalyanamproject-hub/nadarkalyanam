// A Prisma stand-in for code that only asks "does this member have a plan?"
// (findActiveSubscription): every caller has an active plan, or none.
export function memberPrisma(member = true) {
  const startedAt = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
  return {
    subscription: {
      findMany: async () => (member ? [{ id: 'sub', startedAt, expiresAt, cancelledAt: null, plan: { code: 'GOLD' } }] : []),
    },
  };
}
