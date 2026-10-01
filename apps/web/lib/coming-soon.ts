// One explanation per missing feature, shared by every page that shows it
// (Search filters, the Profile page), so the same gap is never described two
// different ways. Each states what isn't collected, so there's nothing to show.
export const COMING_SOON = {
  profileCreatedBy: {
    label: 'Profile created by',
    reason: 'Registration asks who the profile is for, but the answer isn’t saved on profiles yet.',
  },
  star: {
    label: 'Star / Horoscope',
    reason: 'Profiles don’t record a birth star or horoscope yet, so there’s nothing to match on.',
  },
  institution: {
    label: 'Institution',
    reason: 'Profiles record education level and detail, not the college or university attended.',
  },
  citizenship: {
    label: 'Citizenship',
    reason: 'Profiles record the country members live in, not their citizenship.',
  },
  habits: {
    label: 'Eating, smoking & drinking habits',
    reason: 'Lifestyle habits aren’t part of the profile form yet.',
  },
  hobbies: {
    label: 'Mutual hobbies',
    reason: 'Members can’t list hobbies on their profile yet.',
  },
  familyValue: {
    label: 'Family value',
    reason: 'Profiles record family status, not family values (traditional, moderate, liberal).',
  },
  partnerPreferences: {
    label: 'Partner preferences',
    reason: 'Partner preferences aren’t collected yet, so there’s no preferred age, height, education or location to show.',
  },
} as const;

export type ComingSoonKey = keyof typeof COMING_SOON;
