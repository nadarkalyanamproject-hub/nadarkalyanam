import { describe, expect, it } from 'vitest';
import type { InterestResponse } from '@nadar-kalyanam/schemas';
import { formatInterestDate, mapApiInterestToDisplay } from '../app/interests/page';

const interest: InterestResponse = {
  id: 'int_123',
  status: 'PENDING',
  createdAt: '2025-09-12T10:00:00.000Z',
  respondedAt: null,
  sender: { profileId: 'prof_sender', fullName: 'Meena Raj', age: 27, primaryPhotoUrl: null },
  target: {
    profileId: 'prof_target',
    fullName: 'Karthik',
    age: 30,
    primaryPhotoUrl: 'https://cdn.example.com/k.jpg',
  },
};

describe('Interests UI Logic', () => {
  it('formats dates cleanly as DD MMM YYYY', () => {
    expect(formatInterestDate('2025-09-12T10:00:00.000Z')).toBe('12 Sep 2025');
    expect(formatInterestDate('2025-08-28T16:45:00.000Z')).toBe('28 Aug 2025');
  });

  it('maps a received interest to the sender with the real interest id', () => {
    const row = mapApiInterestToDisplay(interest, true);
    expect(row).toEqual({
      id: 'int_123',
      profileId: 'prof_sender',
      fullName: 'Meena',
      age: 27,
      location: null,
      education: null,
      primaryPhotoUrl: null,
      status: 'PENDING',
      createdAt: '2025-09-12T10:00:00.000Z',
    });
  });

  it('maps a sent interest to the target and never invents missing fields', () => {
    const row = mapApiInterestToDisplay(interest, false);
    expect(row.profileId).toBe('prof_target');
    expect(row.primaryPhotoUrl).toBe('https://cdn.example.com/k.jpg');
    expect(row.location).toBeNull();
    expect(row.education).toBeNull();
  });
});
