import { describe, expect, it } from 'vitest';
import type { Connection, MatchResult } from '@nadar-kalyanam/schemas';
import { connectionCard, topMatchCards } from './matches-page';

const match = (profileId: string, relationshipStatus: MatchResult['relationshipStatus'] = 'NONE'): MatchResult => ({
  profileId,
  fullName: `Member ${profileId}`,
  age: 27,
  city: 'Chennai',
  primaryPhotoUrl: null,
  isVerified: false,
  profession: 'Engineer',
  religion: 'Hindu',
  score: 80,
  relationshipStatus,
  conversationId: relationshipStatus === 'CONNECTED' ? `conv-${profileId}` : null,
});

describe('topMatchCards', () => {
  it('leaves connected members out, then takes the top N, so the row stays full', () => {
    const ranked = [match('c1', 'CONNECTED'), match('p1'), match('c2', 'CONNECTED'), match('p2', 'INTEREST_SENT'), match('p3'), match('p4')];
    expect(topMatchCards(ranked, 3).map((c) => c.profileId)).toEqual(['p1', 'p2', 'p3']);
  });

  it('keeps the ranking order and the score, and handles short or all-connected lists', () => {
    const cards = topMatchCards([match('p1'), match('p2')], 8);
    expect(cards.map((c) => c.profileId)).toEqual(['p1', 'p2']);
    expect(cards[0]).toMatchObject({ score: 80, relationshipStatus: 'NONE', city: 'Chennai', profession: 'Engineer' });
    expect(topMatchCards([match('c1', 'CONNECTED')], 8)).toEqual([]);
    expect(topMatchCards([], 8)).toEqual([]);
  });
});

describe('connectionCard', () => {
  const connection: Connection = {
    id: 'p9',
    fullName: 'Meena R',
    age: 26,
    gender: 'FEMALE',
    location: { city: 'Madurai', state: 'Tamil Nadu' },
    religion: 'Hindu',
    profession: '',
    maritalStatus: 'NEVER_MARRIED',
    primaryPhotoUrl: null,
    hasSentInterest: true,
    relationshipStatus: 'CONNECTED',
    conversationId: 'conv-9',
    connectedAt: '2026-10-01T00:00:00Z',
  };

  it('keeps the conversation (for the Message link) and the Connected status', () => {
    expect(connectionCard(connection)).toMatchObject({ profileId: 'p9', relationshipStatus: 'CONNECTED', conversationId: 'conv-9', city: 'Madurai', state: 'Tamil Nadu' });
  });

  it('leaves out blank details instead of showing them empty', () => {
    expect(connectionCard(connection).profession).toBeNull();
    expect(connectionCard({ ...connection, location: { city: '', state: '' } })).toMatchObject({ city: null, state: null });
  });
});
