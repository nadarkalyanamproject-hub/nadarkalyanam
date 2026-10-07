// Reference lists shared by the web forms and the API's validation, so a
// partner preference can only name a value the profile form itself offers.
// Moved here unchanged from the web onboarding form components.

// Indian states and union territories (the onboarding State picker).
export const INDIA_STATES_AND_UTS = [
  'Andaman and Nicobar Islands',
  'Andhra Pradesh',
  'Arunachal Pradesh',
  'Assam',
  'Bihar',
  'Chandigarh',
  'Chhattisgarh',
  'Dadra and Nagar Haveli and Daman and Diu',
  'Delhi',
  'Goa',
  'Gujarat',
  'Haryana',
  'Himachal Pradesh',
  'Jammu and Kashmir',
  'Jharkhand',
  'Karnataka',
  'Kerala',
  'Ladakh',
  'Lakshadweep',
  'Madhya Pradesh',
  'Maharashtra',
  'Manipur',
  'Meghalaya',
  'Mizoram',
  'Nagaland',
  'Odisha',
  'Puducherry',
  'Punjab',
  'Rajasthan',
  'Sikkim',
  'Tamil Nadu',
  'Telangana',
  'Tripura',
  'Uttar Pradesh',
  'Uttarakhand',
  'West Bengal',
] as const;
export type IndiaState = (typeof INDIA_STATES_AND_UTS)[number];

// The onboarding Mother tongue picker.
export const MOTHER_TONGUES = [
  'Tamil',
  'Telugu',
  'Kannada',
  'Malayalam',
  'Hindi',
  'Marathi',
  'Gujarati',
  'Punjabi',
  'Bengali',
  'Odia',
  'Urdu',
  'English',
  'Other',
] as const;
export type MotherTongue = (typeof MOTHER_TONGUES)[number];
