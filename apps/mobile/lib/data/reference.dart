// Option lists, mirroring packages/schemas/src/reference-data.ts and the web
// forms. Keep them in step with the API, which rejects anything else.

const profileForOptions = ['Myself', 'Son', 'Daughter', 'Brother', 'Sister', 'Relative', 'Friend'];

// The API value (PROFILE_FOR) for each choice above.
const profileForKeys = {
  'Myself': 'MYSELF',
  'Son': 'SON',
  'Daughter': 'DAUGHTER',
  'Brother': 'BROTHER',
  'Sister': 'SISTER',
  'Relative': 'RELATIVE',
  'Friend': 'FRIEND',
};

// "Sister" for SISTER; null for MYSELF or an unknown value.
String? profileForRelation(String? profileFor) {
  if (profileFor == null || profileFor == 'MYSELF') return null;
  for (final e in profileForKeys.entries) {
    if (e.value == profileFor) return e.key;
  }
  return null;
}

// Form labels worded for whoever the profile is about, as the schemas'
// subjectLabel / aboutLabel: "Occupation" -> "Sister's occupation".
String subjectLabel(String? profileFor, String label) {
  final relation = profileForRelation(profileFor);
  if (relation == null) return label;
  return "$relation's ${label[0].toLowerCase()}${label.substring(1)}";
}

String aboutLabel(String? profileFor) {
  final relation = profileForRelation(profileFor);
  return relation == null ? 'About you' : 'A few words about my ${relation.toLowerCase()}';
}

// The gender a "profile created for" choice implies (null: ask).
String? genderFor(String profileFor) => switch (profileFor) {
      'Son' || 'Brother' => 'MALE',
      'Daughter' || 'Sister' => 'FEMALE',
      _ => null,
    };

const genders = {'MALE': 'Male', 'FEMALE': 'Female', 'OTHER': 'Other'};
const religions = ['Hindu', 'Christian'];
const nadarSubcategories = [
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
];

// 4'6" to 6'6", saved exactly as the web saves it.
final heights = [
  for (var inches = 54; inches <= 78; inches++) '${inches ~/ 12}\'${inches % 12}" (${(inches * 2.54).round()} cm)',
];

const physicalStatuses = {'NORMAL': 'Normal', 'PHYSICALLY_CHALLENGED': 'Physically challenged'};
const complexions = ['Fair', 'Wheatish', 'Wheatish Brown', 'Dusky'];
const maritalStatuses = {
  'NEVER_MARRIED': 'Never married',
  'DIVORCED': 'Divorced',
  'WIDOWED': 'Widowed',
  'AWAITING_DIVORCE': 'Awaiting divorce',
};
const priorMarriageStatuses = ['DIVORCED', 'WIDOWED', 'AWAITING_DIVORCE'];
const doshamOptions = {'NO': 'No', 'YES': 'Yes', 'DONT_KNOW': "Don't know"};
const doshamTypes = [
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
];

const indiaStates = [
  'Andaman and Nicobar Islands', 'Andhra Pradesh', 'Arunachal Pradesh', 'Assam', 'Bihar', 'Chandigarh',
  'Chhattisgarh', 'Dadra and Nagar Haveli and Daman and Diu', 'Delhi', 'Goa', 'Gujarat', 'Haryana',
  'Himachal Pradesh', 'Jammu and Kashmir', 'Jharkhand', 'Karnataka', 'Kerala', 'Ladakh', 'Lakshadweep',
  'Madhya Pradesh', 'Maharashtra', 'Manipur', 'Meghalaya', 'Mizoram', 'Nagaland', 'Odisha', 'Puducherry',
  'Punjab', 'Rajasthan', 'Sikkim', 'Tamil Nadu', 'Telangana', 'Tripura', 'Uttar Pradesh', 'Uttarakhand',
  'West Bengal',
];

const familyStatuses = ['Middle Class', 'Upper Middle Class', 'Rich / Affluent (Elite)'];
// Net worth is asked, and kept, only for this family status.
const netWorthFamilyStatus = 'Rich / Affluent (Elite)';
const netWorthRanges = [
  'Below ₹50 Lakh',
  '₹50 Lakh – ₹1 Crore',
  '₹1 Crore – ₹5 Crore',
  '₹5 Crore – ₹10 Crore',
  '₹10 Crore – ₹25 Crore',
  'Above ₹25 Crore',
  'Prefer not to say',
];

const diets = ['Vegetarian', 'Eggetarian', 'Non-Vegetarian', 'Vegan'];
const habitFrequencies = ['No', 'Occasionally', 'Yes'];
const hobbies = [
  'Music', 'Reading', 'Cooking', 'Travel', 'Movies', 'Sports', 'Fitness & Yoga', 'Dance', 'Art & Craft',
  'Gardening', 'Photography', 'Spiritual activities', 'Social service', 'Pets',
];
const maxHobbies = 8;

const profileVisibilities = {
  'PUBLIC': 'Visible to members',
  'MEMBERS_ONLY': 'Signed-in members only',
  'HIDDEN': 'Hidden',
};
