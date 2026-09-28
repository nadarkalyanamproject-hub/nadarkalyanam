import type {
  AdditionalDetails,
  BasicDetails,
  LocationProfessional,
  PersonalReligious,
} from '@nadar-kalyanam/schemas';

export type WizardStepKey = 'basicDetails' | 'personal' | 'location' | 'additional';

export interface RegistrationDraft {
  phoneNumber?: string;
  fullNamePrefill?: string;
  genderPrefill?: 'MALE' | 'FEMALE';
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
