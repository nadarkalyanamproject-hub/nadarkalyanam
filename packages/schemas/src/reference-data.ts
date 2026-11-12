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

// Ancestral origins (Step 4 of profile registration)
export const ANCESTRAL_ORIGINS = [
  'Tirunelveli',
  'Thoothukudi (Tuticorin)',
  'Virudhunagar',
  'Madurai',
  'Kanyakumari',
  'Ramanathapuram',
  'Tenkasi',
  'Sivakasi',
  'Chennai',
  'Coimbatore',
  'Others',
] as const;
export type AncestralOrigin = (typeof ANCESTRAL_ORIGINS)[number];

// Cities grouped by Indian State / UT for registration (Step 3).
export const INDIA_CITIES_BY_STATE: Record<string, readonly string[]> = {
  'Tamil Nadu': [
    'Chennai',
    'Coimbatore',
    'Madurai',
    'Tiruchirappalli (Trichy)',
    'Salem',
    'Tirunelveli',
    'Thoothukudi (Tuticorin)',
    'Tiruppur',
    'Erode',
    'Vellore',
    'Dindigul',
    'Thanjavur',
    'Sivakasi',
    'Nagercoil',
    'Kanyakumari',
    'Tenkasi',
    'Virudhunagar',
    'Rajapalayam',
    'Ramanathapuram',
    'Karur',
    'Hosur',
    'Cuddalore',
    'Kanchipuram',
    'Kumbakonam',
    'Tiruvannamalai',
    'Pollachi',
    'Pudukkottai',
    'Theni',
    'Viluppuram',
    'Nagapattinam',
    'Neyveli',
    'Ambur',
    'Udhagamandalam (Ooty)',
    'Karaikudi',
    'Namakkal',
    'Srivilliputhur',
    'Kovilpatti',
    'Aruppukottai',
    'Mayiladuthurai',
    'Others',
  ],
  'Andhra Pradesh': [
    'Nellore',
    'Visakhapatnam',
    'Vijayawada',
    'Guntur',
    'Tirupati',
    'Kurnool',
    'Rajahmundry',
    'Kakinada',
    'Kadapa',
    'Anantapur',
    'Vizianagaram',
    'Eluru',
    'Ongole',
    'Nandyal',
    'Machilipatnam',
    'Chittoor',
    'Hindupur',
    'Bhimavaram',
    'Proddatur',
    'Others',
  ],
  'Karnataka': [
    'Bengaluru',
    'Mysuru (Mysore)',
    'Mangaluru (Mangalore)',
    'Hubballi-Dharwad',
    'Belagavi (Belgaum)',
    'Kalaburagi (Gulbarga)',
    'Davanagere',
    'Ballari (Bellary)',
    'Shivamogga (Shimoga)',
    'Tumakuru (Tumkur)',
    'Udupi',
    'Bidar',
    'Hospet',
    'Others',
  ],
  'Kerala': [
    'Thiruvananthapuram (Trivandrum)',
    'Kochi (Cochin)',
    'Kozhikode (Calicut)',
    'Kollam (Quilon)',
    'Thrissur',
    'Alappuzha (Alleppey)',
    'Palakkad',
    'Malappuram',
    'Kannur',
    'Kottayam',
    'Kasaragod',
    'Pathanamthitta',
    'Others',
  ],
  'Telangana': [
    'Hyderabad',
    'Secunderabad',
    'Warangal',
    'Nizamabad',
    'Khammam',
    'Karimnagar',
    'Ramagundam',
    'Mahbubnagar',
    'Nalgonda',
    'Adilabad',
    'Suryapet',
    'Siddipet',
    'Others',
  ],
  'Maharashtra': [
    'Mumbai',
    'Pune',
    'Nagpur',
    'Thane',
    'Nashik',
    'Navi Mumbai',
    'Aurangabad (Chhatrapati Sambhajinagar)',
    'Solapur',
    'Kolhapur',
    'Amravati',
    'Nanded',
    'Sangli',
    'Jalgaon',
    'Others',
  ],
  'Delhi': [
    'Delhi',
    'New Delhi',
    'Central Delhi',
    'North Delhi',
    'South Delhi',
    'West Delhi',
    'East Delhi',
    'Noida (NCR)',
    'Gurgaon / Gurugram (NCR)',
    'Faridabad (NCR)',
    'Ghaziabad (NCR)',
    'Others',
  ],
  'Gujarat': [
    'Ahmedabad',
    'Surat',
    'Vadodara',
    'Rajkot',
    'Bhavnagar',
    'Jamnagar',
    'Gandhinagar',
    'Junagadh',
    'Anand',
    'Others',
  ],
  'West Bengal': [
    'Kolkata',
    'Howrah',
    'Durgapur',
    'Asansol',
    'Siliguri',
    'Kharagpur',
    'Others',
  ],
  'Puducherry': [
    'Puducherry',
    'Karaikal',
    'Mahe',
    'Yanam',
    'Others',
  ],
};

export const DEFAULT_POPULAR_CITIES = [
  'Chennai',
  'Coimbatore',
  'Madurai',
  'Tirunelveli',
  'Thoothukudi',
  'Bengaluru',
  'Hyderabad',
  'Mumbai',
  'Delhi / NCR',
  'Nellore',
  'Vijayawada',
  'Visakhapatnam',
  'Kochi',
  'Thiruvananthapuram',
  'Kolkata',
  'Pune',
  'Others',
] as const;

export function getCitiesForState(state: string | undefined): readonly string[] {
  if (!state) return DEFAULT_POPULAR_CITIES;
  return INDIA_CITIES_BY_STATE[state] ?? DEFAULT_POPULAR_CITIES;
}

// Educational details / level (Step 3)
export const EDUCATION_LEVELS = [
  'Bachelors',
  'Masters',
  'Doctorate',
  'B.E. / B.Tech',
  'B.Com',
  'B.Sc',
  'B.A',
  'BBA / BBM',
  'BCA',
  'M.E. / M.Tech',
  'MBA / PGDM',
  'M.Com',
  'M.Sc',
  'MCA',
  'M.A',
  'MBBS / MD / MS',
  'BDS / MDS',
  'Chartered Accountant (CA)',
  'Law (LLB / LLM)',
  'Pharmacy (B.Pharm / M.Pharm)',
  'Diploma / Polytechnic',
  'Higher Secondary (12th)',
  'Secondary School (10th)',
  'Other',
] as const;
export type EducationLevel = (typeof EDUCATION_LEVELS)[number];

// Education detail / Specialization (Step 3)
export const EDUCATION_DETAILS = [
  'Computer Science & Engineering',
  'Information Technology',
  'Computer Applications',
  'Electronics & Communication (ECE)',
  'Electrical & Electronics (EEE)',
  'Mechanical Engineering',
  'Civil Engineering',
  'Biotechnology / Biomedical',
  'Chemical Engineering',
  'Artificial Intelligence & Data Science',
  'Commerce & Accounting',
  'Business Administration & Management',
  'Finance & Banking',
  'Marketing & Human Resources',
  'Economics & Statistics',
  'General Medicine (MBBS / MD)',
  'Pediatrics / Surgery / Gynecology',
  'Dental Surgery (BDS / MDS)',
  'Pharmacy & Healthcare',
  'Chartered Accountancy (CA)',
  'Corporate & Cyber Law',
  'Arts & English Literature',
  'Physics / Chemistry / Mathematics',
  'Architecture & Interior Design',
  'Other',
] as const;
export type EducationDetail = (typeof EDUCATION_DETAILS)[number];

// Employment type (Step 3)
export const EMPLOYMENT_TYPES = [
  'Private Sector',
  'Government / Public Sector',
  'Business / Self-Employed',
  'IT / Software Professional',
  'Banking & Financial Services',
  'Civil Services / Defense',
  'Healthcare & Medical',
  'Education & Academic',
  'Not Working',
  'Other',
] as const;
export type EmploymentType = (typeof EMPLOYMENT_TYPES)[number];

// Occupation (Step 3)
export const OCCUPATIONS = [
  'Software Engineer / Developer',
  'IT Professional / Systems Analyst',
  'Data Scientist / AI Specialist',
  'Doctor / Surgeon / Medical Specialist',
  'Chartered Accountant (CA) / Auditor',
  'Business Owner / Entrepreneur',
  'Manager / Executive / Director',
  'Civil / Mechanical / Electrical Engineer',
  'Banker / Financial Analyst',
  'Teacher / Professor / Lecturer',
  'Civil Services (IAS / IPS / IRS / Group 1)',
  'Lawyer / Advocate / Legal Advisor',
  'Architect / Interior Designer',
  'Pharmacist / Healthcare Professional',
  'Government Employee / Officer',
  'Defense Personnel / Police',
  'Marketing / Sales Professional',
  'HR / Talent Acquisition Specialist',
  'Scientist / Researcher',
  'Real Estate / Builder / Contractor',
  'Agriculture / Farming / Agro Business',
  'Consultant / Advisor',
  'Homemaker',
  'Not Working',
  'Other',
] as const;
export type Occupation = (typeof OCCUPATIONS)[number];

// Annual Income Ranges (Step 3)
export const ANNUAL_INCOME_RANGES = [
  'Less than ₹3 Lakhs',
  '₹3 - ₹5 Lakhs (3 - 5 LPA)',
  '₹5 - ₹7 Lakhs (5 - 7 LPA)',
  '₹7 - ₹10 Lakhs (7 - 10 LPA)',
  '₹10 - ₹15 Lakhs (10 - 15 LPA)',
  '₹15 - ₹20 Lakhs (15 - 20 LPA)',
  '₹20 - ₹30 Lakhs (20 - 30 LPA)',
  '₹30 - ₹50 Lakhs (30 - 50 LPA)',
  '₹50 - ₹75 Lakhs (50 - 75 LPA)',
  '₹75 Lakhs - ₹1 Crore (75 LPA - 1 Cr)',
  'Above ₹1 Crore (1 Cr+)',
  'No Income',
  'Other',
] as const;
export type AnnualIncomeRange = (typeof ANNUAL_INCOME_RANGES)[number];

// Annual Income Currencies (Step 3)
export const ANNUAL_INCOME_CURRENCIES = [
  { code: 'INR', label: 'INR - Indian Rupee (₹)' },
  { code: 'USD', label: 'USD - US Dollar ($)' },
  { code: 'EUR', label: 'EUR - Euro (€)' },
  { code: 'GBP', label: 'GBP - British Pound (£)' },
  { code: 'AED', label: 'AED - UAE Dirham (د.إ)' },
  { code: 'SGD', label: 'SGD - Singapore Dollar (S$)' },
  { code: 'CAD', label: 'CAD - Canadian Dollar (C$)' },
  { code: 'AUD', label: 'AUD - Australian Dollar (A$)' },
] as const;

