import type { CreateProfileRequest, ProfileResponse } from '@nadar-kalyanam/schemas';
import type { BasicDetailsFormState } from '../components/profile-form-fields/basic-details-fields';
import type { PersonalReligiousFormState } from '../components/profile-form-fields/personal-religious-fields';
import type { LocationProfessionalFormState } from '../components/profile-form-fields/location-professional-fields';
import type { AdditionalDetailsFormState } from '../components/profile-form-fields/additional-details-fields';

// GET /profiles/me nests fields by storage shape (top-level scalars + a flat
// `details` blob). PATCH /profiles/me (like POST /profiles) expects them
// regrouped by wizard section. These helpers do that regrouping so the edit
// forms can reuse the exact same section schemas as onboarding.

// `profile.details` and its nested groups (location/education/additional) are
// typed as always-present, but that's only guaranteed for rows written by the
// current schema — GET /profiles/me returns whatever raw JSON is stored,
// unvalidated, so a pre-restructuring row can genuinely be missing any of
// these at runtime. Every access below is defensive against that: '' is the
// same "unselected" sentinel every edit form already uses for an empty
// dropdown/input, so a missing group just resumes as blank fields to fill in,
// not a fabricated value.

export function toCreateProfileRequest(profile: ProfileResponse): CreateProfileRequest {
  return {
    fullName: profile.fullName,
    gender: profile.gender,
    dateOfBirth: profile.dateOfBirth,
    motherTongue: profile.details?.motherTongue ?? '',
    email: profile.details?.email ?? '',
    personal: {
      height: profile.details?.height ?? '',
      physicalStatus: profile.details?.physicalStatus as CreateProfileRequest['personal']['physicalStatus'],
      maritalStatus: profile.details?.maritalStatus as CreateProfileRequest['personal']['maritalStatus'],
      religion: profile.details?.religion ?? '',
      casteCommunity: profile.details?.casteCommunity ?? '',
      dosham: profile.details?.dosham,
    },
    location: {
      city: profile.details?.location?.city ?? '',
      state: profile.details?.location?.state ?? '',
      country: profile.details?.location?.country ?? 'India',
      educationLevel: profile.details?.education?.educationLevel ?? '',
      educationDetail: profile.details?.education?.educationDetail ?? '',
      profession: profile.details?.education?.profession ?? '',
      employedIn: profile.details?.education?.employedIn ?? '',
      annualIncomeRange: profile.details?.education?.annualIncomeRange ?? '',
      annualIncomeCurrency: profile.details?.education?.annualIncomeCurrency ?? 'INR',
    },
    additional: {
      familyType: profile.details?.additional?.familyType as CreateProfileRequest['additional']['familyType'],
      about: profile.details?.additional?.about ?? '',
    },
  };
}

export function profileToBasicDetailsForm(profile: ProfileResponse): BasicDetailsFormState {
  return {
    fullName: profile.fullName,
    gender: profile.gender,
    dateOfBirth: profile.dateOfBirth,
    motherTongue: profile.details?.motherTongue ?? '',
    email: profile.details?.email ?? '',
  };
}

export function profileToPersonalReligiousForm(profile: ProfileResponse): PersonalReligiousFormState {
  return {
    height: profile.details?.height ?? '',
    physicalStatus: profile.details?.physicalStatus ?? '',
    maritalStatus: profile.details?.maritalStatus ?? '',
    religion: profile.details?.religion ?? '',
    casteCommunity: profile.details?.casteCommunity ?? '',
    dosham: profile.details?.dosham ?? '',
  };
}

export function profileToLocationProfessionalForm(profile: ProfileResponse): LocationProfessionalFormState {
  return {
    city: profile.details?.location?.city ?? '',
    state: profile.details?.location?.state ?? '',
    country: profile.details?.location?.country ?? 'India',
    educationLevel: profile.details?.education?.educationLevel ?? '',
    educationDetail: profile.details?.education?.educationDetail ?? '',
    profession: profile.details?.education?.profession ?? '',
    employedIn: profile.details?.education?.employedIn ?? '',
    annualIncomeRange: profile.details?.education?.annualIncomeRange ?? '',
    annualIncomeCurrency: profile.details?.education?.annualIncomeCurrency ?? 'INR',
  };
}

export function profileToAdditionalDetailsForm(profile: ProfileResponse): AdditionalDetailsFormState {
  return {
    familyType: profile.details?.additional?.familyType ?? '',
    about: profile.details?.additional?.about ?? '',
  };
}
