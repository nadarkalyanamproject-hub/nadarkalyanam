import { describe, expect, it } from 'vitest';
import { aboutLabel, subjectLabel } from '@nadar-kalyanam/schemas';
import { buildAboutDraft } from './about-draft';

const NOW = new Date('2026-10-25T12:00:00');
const KAVITHA = {
  fullName: 'Kavitha Raj',
  dateOfBirth: '1997-05-15',
  religion: 'Hindu',
  casteCommunity: 'Gramani',
  profession: 'Teacher',
  educationLevel: 'B.Ed',
  city: 'Madurai',
  state: 'Tamil Nadu',
  familyType: 'Middle Class',
};

describe('form labels for the person the profile is about', () => {
  it('leaves labels alone for the member themselves', () => {
    expect(subjectLabel('MYSELF', 'Occupation')).toBe('Occupation');
    expect(subjectLabel(undefined, 'Occupation')).toBe('Occupation');
    expect(aboutLabel('MYSELF')).toBe('About you');
  });

  it('names the relation for anyone else', () => {
    expect(subjectLabel('SISTER', 'Educational details')).toBe("Sister's educational details");
    expect(subjectLabel('FRIEND', 'Complexion (optional)')).toBe("Friend's complexion (optional)");
    expect(aboutLabel('SISTER')).toBe('A few words about my sister');
  });
});

describe('Write it for me', () => {
  it('writes in the first person for the member themselves', () => {
    expect(buildAboutDraft({ ...KAVITHA, profileFor: 'MYSELF', gender: 'FEMALE' }, NOW)).toMatch(
      /^I'm Kavitha, 29, a teacher from Madurai, Tamil Nadu\. I come from a middle-class Hindu Gramani Nadar family/,
    );
  });

  it('writes about a sister in the third person', () => {
    const draft = buildAboutDraft({ ...KAVITHA, profileFor: 'SISTER', gender: 'FEMALE' }, NOW);
    expect(draft).toBe(
      'My sister Kavitha is 29, works as a teacher and lives in Madurai, Tamil Nadu. ' +
        'She comes from a middle-class Hindu Gramani Nadar family and has studied B.Ed.\n' +
        'She values family, honesty and our traditions, and we are looking for a kind, understanding partner for her.',
    );
  });

  it('uses he/him for a son and leaves out what is missing', () => {
    const draft = buildAboutDraft({ fullName: 'Arun', religion: 'Christian', profileFor: 'SON', gender: 'MALE' }, NOW);
    expect(draft).toBe(
      'He comes from a Christian Nadar family.\n' +
        'He values family, honesty and our traditions, and we are looking for a kind, understanding partner for him.',
    );
  });
});
