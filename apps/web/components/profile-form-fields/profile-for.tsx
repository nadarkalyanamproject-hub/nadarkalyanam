'use client';

import { createContext, useContext } from 'react';
import { aboutLabel, subjectLabel, type ProfileFor } from '@nadar-kalyanam/schemas';
import { useRegistration } from '../../app/providers/registration-provider';

// Who the profile being edited is for. My Profile provides the saved value
// (null for a profile saved before it was recorded); during registration
// nothing provides it, so the landing page choice in the draft is used.
const ProfileForContext = createContext<ProfileFor | null | undefined>(undefined);
export const ProfileForProvider = ProfileForContext.Provider;

function useProfileFor(): ProfileFor | null | undefined {
  const provided = useContext(ProfileForContext);
  const { data } = useRegistration();
  return provided === undefined ? data.profileForPrefill : provided;
}

// Form labels worded for that person: "Occupation" -> "Sister's occupation".
export function useSubjectLabels() {
  const profileFor = useProfileFor();
  return {
    label: (text: string) => subjectLabel(profileFor, text),
    about: aboutLabel(profileFor),
  };
}
