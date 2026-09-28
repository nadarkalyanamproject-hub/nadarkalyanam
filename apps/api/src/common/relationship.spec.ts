import { describe, expect, it, vi } from 'vitest';
import {
  deriveRelationshipStates,
  getRelationshipStates,
  legacyHasSentInterest,
  relationshipFields,
} from './relationship.js';

const A = 'user-a';
const B = 'user-b';
const C = 'user-c';

const row = (senderId: string, targetId: string, status: string, conversationId: string | null = null) => ({
  senderId,
  targetId,
  status,
  conversation: conversationId ? { id: conversationId } : null,
});

describe('deriveRelationshipStates', () => {
  it('the reported bug: A sends, B accepts -> BOTH sides see CONNECTED, with the conversation id', () => {
    const rows = [row(A, B, 'ACCEPTED', 'conv-ab')];

    expect(deriveRelationshipStates(B, rows).get(A)).toEqual({ status: 'CONNECTED', conversationId: 'conv-ab' });
    expect(deriveRelationshipStates(A, rows).get(B)).toEqual({ status: 'CONNECTED', conversationId: 'conv-ab' });
  });

  it('my PENDING row is INTEREST_SENT; theirs to me is INTEREST_RECEIVED; no conversation id for either', () => {
    const rows = [row(A, B, 'PENDING')];

    expect(deriveRelationshipStates(A, rows).get(B)).toEqual({ status: 'INTEREST_SENT', conversationId: null });
    expect(deriveRelationshipStates(B, rows).get(A)).toEqual({ status: 'INTEREST_RECEIVED', conversationId: null });
  });

  it('DECLINED and WITHDRAWN history never counts as a relationship (NONE = absent from the map)', () => {
    const rows = [row(A, B, 'DECLINED'), row(A, C, 'WITHDRAWN'), row(C, A, 'DECLINED')];

    const states = deriveRelationshipStates(A, rows);

    expect(states.has(B)).toBe(false);
    expect(states.has(C)).toBe(false);
  });

  it('precedence with rows in both directions: CONNECTED > INTEREST_RECEIVED > INTEREST_SENT', () => {
    // Order of rows must not matter.
    expect(deriveRelationshipStates(A, [row(A, B, 'PENDING'), row(B, A, 'ACCEPTED', 'conv')]).get(B)?.status).toBe(
      'CONNECTED',
    );
    expect(deriveRelationshipStates(A, [row(B, A, 'ACCEPTED', 'conv'), row(A, B, 'PENDING')]).get(B)?.status).toBe(
      'CONNECTED',
    );
    expect(deriveRelationshipStates(A, [row(A, B, 'PENDING'), row(B, A, 'PENDING')]).get(B)?.status).toBe(
      'INTEREST_RECEIVED',
    );
    expect(deriveRelationshipStates(A, [row(B, A, 'PENDING'), row(A, B, 'PENDING')]).get(B)?.status).toBe(
      'INTEREST_RECEIVED',
    );
  });

  it('keeps each other user separate', () => {
    const states = deriveRelationshipStates(A, [row(A, B, 'ACCEPTED', 'conv-ab'), row(C, A, 'PENDING')]);

    expect(states.get(B)?.status).toBe('CONNECTED');
    expect(states.get(C)?.status).toBe('INTEREST_RECEIVED');
  });
});

describe('getRelationshipStates', () => {
  it('uses ONE query covering both directions and only PENDING/ACCEPTED rows, selecting the conversation id', async () => {
    const prisma = { interest: { findMany: vi.fn().mockResolvedValue([row(B, A, 'ACCEPTED', 'conv')]) } };

    const states = await getRelationshipStates(prisma as never, A, [B, C]);

    expect(prisma.interest.findMany).toHaveBeenCalledTimes(1);
    expect(prisma.interest.findMany).toHaveBeenCalledWith({
      where: {
        status: { in: ['PENDING', 'ACCEPTED'] },
        OR: [
          { senderId: A, targetId: { in: [B, C] } },
          { targetId: A, senderId: { in: [B, C] } },
        ],
      },
      select: { senderId: true, targetId: true, status: true, conversation: { select: { id: true } } },
    });
    expect(states.get(B)?.status).toBe('CONNECTED');
    expect(states.has(C)).toBe(false);
  });

  it('skips the query entirely for an empty list', async () => {
    const prisma = { interest: { findMany: vi.fn() } };

    expect((await getRelationshipStates(prisma as never, A, [])).size).toBe(0);
    expect(prisma.interest.findMany).not.toHaveBeenCalled();
  });
});

describe('response field helpers', () => {
  it('defaults a missing state to NONE / null', () => {
    expect(relationshipFields(undefined)).toEqual({ relationshipStatus: 'NONE', conversationId: null });
  });

  it('legacy hasSentInterest is true only for INTEREST_SENT and CONNECTED', () => {
    expect(legacyHasSentInterest(undefined)).toBe(false);
    expect(legacyHasSentInterest({ status: 'INTEREST_SENT', conversationId: null })).toBe(true);
    expect(legacyHasSentInterest({ status: 'CONNECTED', conversationId: 'c' })).toBe(true);
    expect(legacyHasSentInterest({ status: 'INTEREST_RECEIVED', conversationId: null })).toBe(false);
  });
});
