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
    reason: 'Members can now add horoscope details, but they’re private unless each member chooses to share them, so searching by star isn’t offered yet.',
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
} as const;

export type ComingSoonKey = keyof typeof COMING_SOON;
