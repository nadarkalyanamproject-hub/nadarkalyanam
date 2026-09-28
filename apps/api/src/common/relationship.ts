import type { RelationshipFields, RelationshipStatus } from '@nadar-kalyanam/schemas';
import type { PrismaService } from '../modules/prisma/prisma.service.js';

export interface RelationshipState {
  status: RelationshipStatus;
  conversationId: string | null;
}

export const NO_RELATIONSHIP: RelationshipState = { status: 'NONE', conversationId: null };

interface PairInterestRow {
  senderId: string;
  targetId: string;
  status: string;
  conversation: { id: string } | null;
}

const PRECEDENCE: Record<RelationshipStatus, number> = {
  NONE: 0,
  INTEREST_SENT: 1,
  INTEREST_RECEIVED: 2,
  CONNECTED: 3,
};

// Pure: turns the interest rows between the caller and others (either
// direction) into one state per other user. An ACCEPTED row makes the pair
// CONNECTED no matter who sent it — the bug this fixes was only ever
// looking at rows the caller sent. Only PENDING/ACCEPTED rows matter;
// DECLINED/WITHDRAWN rows are ignored here (they're history, not a
// relationship). Precedence: CONNECTED > INTEREST_RECEIVED > INTEREST_SENT.
export function deriveRelationshipStates(
  callerUserId: string,
  rows: PairInterestRow[],
): Map<string, RelationshipState> {
  const states = new Map<string, RelationshipState>();
  for (const row of rows) {
    const outgoing = row.senderId === callerUserId;
    const otherUserId = outgoing ? row.targetId : row.senderId;
    let status: RelationshipStatus;
    if (row.status === 'ACCEPTED') status = 'CONNECTED';
    else if (row.status === 'PENDING') status = outgoing ? 'INTEREST_SENT' : 'INTEREST_RECEIVED';
    else continue;

    const current = states.get(otherUserId);
    if (!current || PRECEDENCE[status] > PRECEDENCE[current.status]) {
      states.set(otherUserId, {
        status,
        conversationId: status === 'CONNECTED' ? (row.conversation?.id ?? null) : null,
      });
    }
  }
  return states;
}

// One batched query for any number of other users — call it once per page,
// never once per profile. The conversation id comes back with the same
// query (Interest -> Conversation is 1:1, created by accept()).
export async function getRelationshipStates(
  prisma: PrismaService,
  callerUserId: string,
  otherUserIds: string[],
): Promise<Map<string, RelationshipState>> {
  if (otherUserIds.length === 0) return new Map();
  const rows = await prisma.interest.findMany({
    where: {
      status: { in: ['PENDING', 'ACCEPTED'] },
      OR: [
        { senderId: callerUserId, targetId: { in: otherUserIds } },
        { targetId: callerUserId, senderId: { in: otherUserIds } },
      ],
    },
    select: { senderId: true, targetId: true, status: true, conversation: { select: { id: true } } },
  });
  return deriveRelationshipStates(callerUserId, rows);
}

// The response fields for one member. hasSentInterest is the legacy flag
// (public profile responses only): true once the caller no longer needs to
// send one — INTEREST_SENT or CONNECTED.
export function relationshipFields(state: RelationshipState | undefined): RelationshipFields {
  const resolved = state ?? NO_RELATIONSHIP;
  return { relationshipStatus: resolved.status, conversationId: resolved.conversationId };
}

export function legacyHasSentInterest(state: RelationshipState | undefined): boolean {
  const status = (state ?? NO_RELATIONSHIP).status;
  return status === 'INTEREST_SENT' || status === 'CONNECTED';
}
