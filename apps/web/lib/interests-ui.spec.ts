import { describe, expect, it } from 'vitest';
import type { InterestResponse } from '@nadar-kalyanam/schemas';
import { ageAndCity, formatInterestDate, mapApiInterestToDisplay, placeLine } from '../app/interests/page';

const interest: InterestResponse = {
  id: 'int_123',
  status: 'PENDING',
  createdAt: '2025-09-12T10:00:00.000Z',
  respondedAt: null,
  sender: {
    profileId: 'prof_sender',
    fullName: 'Meena Raj',
    age: 27,
    primaryPhotoUrl: null,
    city: 'Madurai',
    state: 'Tamil Nadu',
    educationLevel: 'Bachelors',
    profession: 'Teacher',
  },
  // An older response without the card fields still maps.
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

  it('maps a received interest to the sender with the real interest id and profile details', () => {
    const row = mapApiInterestToDisplay(interest, true);
    expect(row).toEqual({
      id: 'int_123',
      profileId: 'prof_sender',
      fullName: 'Meena',
      age: 27,
      city: 'Madurai',
      state: 'Tamil Nadu',
      occupation: 'Teacher',
      primaryPhotoUrl: null,
      status: 'PENDING',
      createdAt: '2025-09-12T10:00:00.000Z',
    });
  });

  it('maps a sent interest to the target and never invents missing fields', () => {
    const row = mapApiInterestToDisplay(interest, false);
    expect(row.profileId).toBe('prof_target');
    expect(row.primaryPhotoUrl).toBe('https://cdn.example.com/k.jpg');
    expect(row.city).toBeNull();
    expect(row.state).toBeNull();
    expect(row.occupation).toBeNull();
  });

  it('falls back to education when there is no profession', () => {
    const noJob = { ...interest, sender: { ...interest.sender, profession: null } };
    expect(mapApiInterestToDisplay(noJob, true).occupation).toBe('Bachelors');
  });

  it('builds the age · city and city, state lines from whatever is known', () => {
    expect(ageAndCity({ age: 27, city: 'Madurai' })).toBe('27 · Madurai');
    expect(ageAndCity({ age: 27, city: null })).toBe('27');
    expect(placeLine({ city: 'Madurai', state: 'Tamil Nadu' })).toBe('Madurai, Tamil Nadu');
    expect(placeLine({ city: null, state: 'Kerala' })).toBe('Kerala');
    expect(placeLine({ city: null, state: null })).toBeNull();
  });
});
