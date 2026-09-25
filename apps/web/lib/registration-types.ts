import type {
  AdditionalDetails,
  BasicDetails,
  LocationProfessional,
  PersonalReligious,
} from '@nadar-kalyanam/schemas';

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
}

export const REGISTRATION_STORAGE_KEY = 'nk-registration-draft';
