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

// Religions offered at registration (step 1).
export const RELIGIONS = ['Hindu', 'Christian'] as const;
export type Religion = (typeof RELIGIONS)[number];

// The Nadar sub-community picker at registration (step 1), stored as the
// profile's casteCommunity. To be confirmed with the client.
export const NADAR_SUBCATEGORIES = [
  'Gramani',
  'Jaishwal',
  'Muppar',
  'Nattathi',
  'Kodikkal',
  'Karukku Pattayathar',
  'Mel Nadar',
  'Mara Nadar',
  'Shanar',
  'Other',
] as const;
export type NadarSubcategory = (typeof NADAR_SUBCATEGORIES)[number];

// Family net worth (optional, step 4).
export const NET_WORTH_RANGES = [
  'Below ₹50 Lakh',
  '₹50 Lakh – ₹1 Crore',
  '₹1 Crore – ₹5 Crore',
  '₹5 Crore – ₹10 Crore',
  '₹10 Crore – ₹25 Crore',
  'Above ₹25 Crore',
  'Prefer not to say',
] as const;
export type NetWorthRange = (typeof NET_WORTH_RANGES)[number];

// "Dosham details" picker, shown when the member answers Dosham = Yes.
// Saved as text in doshamDetails (older profiles may hold free text).
export const DOSHAM_TYPES = [
  'Sevvai (Chevvai) Dosham',
  'Rahu Dosham',
  'Ketu Dosham',
  'Rahu-Ketu Dosham',
  'Kala Sarpa Dosham',
  'Naga Dosham',
  'Shani Dosham',
  'Pitru Dosham',
  'Nadi Dosham',
  'Bhakoot Dosham',
  'Other',
] as const;

// Mother tongue: no longer asked at registration; kept for partner
// preferences, search and profiles saved before it was dropped.
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
