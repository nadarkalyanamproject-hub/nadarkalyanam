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
// profile's casteCommunity. The client's list, in their order (25-10-2026).
export const NADAR_SUBCATEGORIES = [
  'Shanar',
  'Gramani',
  'Iluvar',
  'Nattathi',
  'Nelamaikkarar',
  'Thiyyas',
  'Chovan',
  'Billava',
  'Gowdas',
  'Poojary',
  'Ediga',
  'Bhandari',
  'Ahluwalia',
  'Pasi',
  'Nayanar',
  'Nattar',
  'Moopper',
] as const;
export type NadarSubcategory = (typeof NADAR_SUBCATEGORIES)[number];

// The office address, one line per entry (Contact page and footer).
export const OFFICE_ADDRESS = [
  'Nadar Kalyanam',
  'Old No. 18/20, New No. 23, 29th Street, Thirunagar',
  'Villivakkam',
  'Chennai - 600 049',
] as const;

// Complexion (optional, step 2), saved as the label itself.
export const COMPLEXIONS = ['Fair', 'Wheatish', 'Wheatish Brown', 'Dusky'] as const;
export type Complexion = (typeof COMPLEXIONS)[number];

// Who the profile is for, chosen when registering. Anyone other than MYSELF
// means a parent, sibling, relative or friend is filling it in, and the form
// labels say so ("Sister's occupation").
export const PROFILE_FOR = ['MYSELF', 'SON', 'DAUGHTER', 'BROTHER', 'SISTER', 'RELATIVE', 'FRIEND'] as const;
export type ProfileFor = (typeof PROFILE_FOR)[number];
export const PROFILE_FOR_LABELS: Record<ProfileFor, string> = {
  MYSELF: 'Myself',
  SON: 'Son',
  DAUGHTER: 'Daughter',
  BROTHER: 'Brother',
  SISTER: 'Sister',
  RELATIVE: 'Relative',
  FRIEND: 'Friend',
};

// A form label worded for whoever the profile is about: "Occupation" stays
// as it is for MYSELF and becomes "Sister's occupation" for SISTER.
export function subjectLabel(profileFor: ProfileFor | null | undefined, label: string): string {
  if (!profileFor || profileFor === 'MYSELF') return label;
  return `${PROFILE_FOR_LABELS[profileFor]}'s ${label.charAt(0).toLowerCase()}${label.slice(1)}`;
}

// The About box's label: "About you", or "A few words about my sister".
export function aboutLabel(profileFor: ProfileFor | null | undefined): string {
  if (!profileFor || profileFor === 'MYSELF') return 'About you';
  return `A few words about my ${PROFILE_FOR_LABELS[profileFor].toLowerCase()}`;
}

// Family net worth (optional, step 4; asked only of NET_WORTH_FAMILY_STATUS).
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

// Lifestyle & Habits (optional, edited from My Profile), saved as the labels.
export const DIETS = ['Vegetarian', 'Eggetarian', 'Non-Vegetarian', 'Vegan'] as const;
export const HABIT_FREQUENCIES = ['No', 'Occasionally', 'Yes'] as const;
export const HOBBIES = [
  'Music',
  'Reading',
  'Cooking',
  'Travel',
  'Movies',
  'Sports',
  'Fitness & Yoga',
  'Dance',
  'Art & Craft',
  'Gardening',
  'Photography',
  'Spiritual activities',
  'Social service',
  'Pets',
] as const;
export const MAX_HOBBIES = 8;

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
