import { z } from 'zod';

export const genderEnum = z.enum(['MALE', 'FEMALE', 'OTHER']);
export type Gender = z.infer<typeof genderEnum>;

export const maritalStatusEnum = z.enum([
  'NEVER_MARRIED',
  'DIVORCED',
  'WIDOWED',
  'AWAITING_DIVORCE',
]);
export type MaritalStatus = z.infer<typeof maritalStatusEnum>;

export const physicalStatusEnum = z.enum(['NORMAL', 'PHYSICALLY_CHALLENGED']);
export type PhysicalStatus = z.infer<typeof physicalStatusEnum>;

export const doshamEnum = z.enum(['NO', 'YES', 'DONT_KNOW']);
export type Dosham = z.infer<typeof doshamEnum>;

export const familyStatusEnum = z.enum(['Middle Class', 'Upper Middle Class', 'Rich / Affluent (Elite)']);
export type FamilyStatus = z.infer<typeof familyStatusEnum>;

// --- Step 1: basic details ---------------------------------------------------

export const basicDetailsSchema = z.object({
  fullName: z.string().trim().min(2, 'Enter at least 2 characters').max(120),
  gender: genderEnum,
  dateOfBirth: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD'),
  motherTongue: z.string().trim().min(1, 'Mother tongue is required'),
  email: z.string().trim().toLowerCase().email('Enter a valid email address'),
});
export type BasicDetails = z.infer<typeof basicDetailsSchema>;

// --- Step 2: personal & religious details ------------------------------------

export const personalReligiousSchema = z.object({
  height: z.string().trim().min(1, 'Height is required'),
  physicalStatus: physicalStatusEnum,
  maritalStatus: maritalStatusEnum,
  religion: z.string().trim().min(1, 'Religion is required'),
  casteCommunity: z.string().trim().min(1, 'Community is required'),
  dosham: z.preprocess((value) => (value === '' ? undefined : value), doshamEnum.optional()),
});
export type PersonalReligious = z.infer<typeof personalReligiousSchema>;

// --- Step 3: location & professional details ---------------------------------

export const locationProfessionalSchema = z.object({
  city: z.string().trim().min(1, 'City is required'),
  state: z.string().trim().min(1, 'State is required'),
  country: z.string().trim().max(60).optional().default('India'),
  educationLevel: z.string().trim().min(1, 'Education level is required'),
  educationDetail: z.string().trim().max(200).optional().default(''),
  profession: z.string().trim().min(1, 'Profession is required'),
  employedIn: z.string().trim().max(120).optional().default(''),
  annualIncomeRange: z.string().trim().max(60).optional().default(''),
  annualIncomeCurrency: z.string().trim().max(10).optional().default('INR'),
});
export type LocationProfessional = z.infer<typeof locationProfessionalSchema>;

// --- Step 4: additional details -----------------------------------------------

export const additionalDetailsSchema = z.object({
  familyType: familyStatusEnum,
  about: z.string().trim().min(50, 'Write at least 50 characters').max(1000),
});
export type AdditionalDetails = z.infer<typeof additionalDetailsSchema>;

// --- Final submit: create profile ---------------------------------------------

export const createProfileSchema = basicDetailsSchema.extend({
  personal: personalReligiousSchema,
  location: locationProfessionalSchema,
  additional: additionalDetailsSchema,
});
export type CreateProfileRequest = z.infer<typeof createProfileSchema>;

export const createProfileResponseSchema = z.object({
  id: z.string(),
  completionScore: z.number(),
});
export type CreateProfileResponse = z.infer<typeof createProfileResponseSchema>;
