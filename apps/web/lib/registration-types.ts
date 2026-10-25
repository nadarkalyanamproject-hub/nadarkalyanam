import type {
  AdditionalDetails,
  BasicDetails,
  ProfileFor,
  LocationProfessional,
  PersonalReligious,
} from '@nadar-kalyanam/schemas';

// 'lifestyle' is the optional Lifestyle & Habits part of step 4; it only ever
// lives in stepInputs (hobbies joined with '|'), since it's sent with step 4.
export type WizardStepKey = 'basicDetails' | 'personal' | 'location' | 'additional' | 'lifestyle';

export interface RegistrationDraft {
  phoneNumber?: string;
  fullNamePrefill?: string;
  genderPrefill?: 'MALE' | 'FEMALE';
  // Who the profile is for, picked on the landing page; saved with the profile.
  profileForPrefill?: ProfileFor;
  devOtp?: string;
  accessToken?: string;
  refreshToken?: string;
  userId?: string;
  hasProfile?: boolean;
  basicDetails?: BasicDetails;
  personal?: PersonalReligious;
  location?: LocationProfessional;
  additional?: AdditionalDetails;
  // Raw, UNVALIDATED form values per step, exactly as typed — saved on every
  // edit and on Back, so Back / browser Back / reload never lose input.
  // Kept apart from the validated keys above on purpose: those are only
  // written by a successful Next, and they're what the additional-details
  // guard and createProfile rely on, so a half-filled step never looks
  // "done" to them.
  stepInputs?: Partial<Record<WizardStepKey, Record<string, string>>>;
}

export const REGISTRATION_STORAGE_KEY = 'nk-registration-draft';
