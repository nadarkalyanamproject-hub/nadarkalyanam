import { describe, expect, it } from 'vitest';
import {
  DEMO_RECEIVED_INTERESTS,
  DEMO_SENT_INTERESTS,
  formatInterestDate,
  type DisplayInterest,
} from '../app/interests/page';

describe('Interests UI Logic', () => {
  it('formats dates cleanly as DD MMM YYYY', () => {
    expect(formatInterestDate('2025-09-12T10:00:00.000Z')).toBe('12 Sep 2025');
    expect(formatInterestDate('2025-08-28T16:45:00.000Z')).toBe('28 Aug 2025');
  });

  it('contains expected demo profiles matching reference UI', () => {
    expect(DEMO_RECEIVED_INTERESTS.length).toBe(4);
    expect(DEMO_RECEIVED_INTERESTS[0].fullName).toBe('Sneha');
    expect(DEMO_RECEIVED_INTERESTS[0].age).toBe(22);
    expect(DEMO_RECEIVED_INTERESTS[0].status).toBe('PENDING');

    expect(DEMO_RECEIVED_INTERESTS[1].fullName).toBe('Anjali');
    expect(DEMO_RECEIVED_INTERESTS[1].status).toBe('ACCEPTED');

    expect(DEMO_RECEIVED_INTERESTS[2].fullName).toBe('Priya');
    expect(DEMO_RECEIVED_INTERESTS[2].status).toBe('DECLINED');

    expect(DEMO_RECEIVED_INTERESTS[3].fullName).toBe('Divya');
    expect(DEMO_RECEIVED_INTERESTS[3].status).toBe('ACCEPTED');

    expect(DEMO_SENT_INTERESTS.length).toBe(1);
    expect(DEMO_SENT_INTERESTS[0].fullName).toBe('Rahul');
    expect(DEMO_SENT_INTERESTS[0].status).toBe('PENDING');
  });

  it('filters items correctly by status', () => {
    function filter(items: DisplayInterest[], status: string) {
      if (status === 'ALL') return items;
      return items.filter((i) => i.status === status);
    }

    expect(filter(DEMO_RECEIVED_INTERESTS, 'ALL').length).toBe(4);
    expect(filter(DEMO_RECEIVED_INTERESTS, 'PENDING').length).toBe(1);
    expect(filter(DEMO_RECEIVED_INTERESTS, 'ACCEPTED').length).toBe(2);
    expect(filter(DEMO_RECEIVED_INTERESTS, 'DECLINED').length).toBe(1);
  });
});
