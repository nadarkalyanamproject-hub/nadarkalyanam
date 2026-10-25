import '../../data/models.dart';
import '../../data/reference.dart';

enum ProfileStep { basic, personal, location, additional }

// Everything onboarding collects, as plain strings ('' = not given), with
// the same rules as packages/schemas/src/profile.ts. Also used to edit a
// section of an existing profile.
class ProfileForm {
  String fullName = '';
  String gender = '';
  String dateOfBirth = ''; // yyyy-mm-dd
  String religion = '';
  String casteCommunity = '';
  String email = '';
  // Who the profile is for (PROFILE_FOR); null when not known.
  String? profileFor;

  String height = '';
  String physicalStatus = 'NORMAL';
  String complexion = '';
  String maritalStatus = '';
  String dosham = '';
  String previousMarriageDetails = '';
  String doshamDetails = '';

  String city = '';
  String state = '';
  String educationLevel = '';
  String educationDetail = '';
  String profession = '';
  String employedIn = '';
  String annualIncomeRange = '';

  String familyType = '';
  String netWorth = '';
  String about = '';

  Lifestyle lifestyle = Lifestyle();

  ProfileForm();

  factory ProfileForm.fromProfile(Profile p) {
    final d = p.details;
    String s(Object? v) => v is String ? v : '';
    return ProfileForm()
      ..fullName = p.fullName
      ..gender = p.gender
      ..dateOfBirth = p.dateOfBirth
      ..religion = s(d['religion'])
      ..casteCommunity = s(d['casteCommunity'])
      ..email = s(d['email'])
      ..profileFor = s(d['profileFor']).isEmpty ? null : s(d['profileFor'])
      ..height = s(d['height'])
      ..physicalStatus = s(d['physicalStatus']).isEmpty ? 'NORMAL' : s(d['physicalStatus'])
      ..complexion = s(d['complexion'])
      ..maritalStatus = s(d['maritalStatus'])
      ..dosham = s(d['dosham'])
      ..previousMarriageDetails = s(d['previousMarriageDetails'])
      ..doshamDetails = s(d['doshamDetails'])
      ..city = s(p.location['city'])
      ..state = s(p.location['state'])
      ..educationLevel = s(p.education['educationLevel'])
      ..educationDetail = s(p.education['educationDetail'])
      ..profession = s(p.education['profession'])
      ..employedIn = s(p.education['employedIn'])
      ..annualIncomeRange = s(p.education['annualIncomeRange'])
      ..familyType = s(p.additional['familyType'])
      ..netWorth = s(p.additional['netWorth'])
      ..about = s(p.additional['about'])
      ..lifestyle = p.lifestyle;
  }

  Map<String, String> validate(ProfileStep step) {
    final e = <String, String>{};
    switch (step) {
      case ProfileStep.basic:
        if (fullName.trim().length < 2) e['fullName'] = 'Enter at least 2 characters';
        if (gender.isEmpty) e['gender'] = 'Choose a gender';
        if (!RegExp(r'^\d{4}-\d{2}-\d{2}$').hasMatch(dateOfBirth)) e['dateOfBirth'] = 'Choose a date of birth';
        if (!religions.contains(religion)) e['religion'] = 'Select your religion';
        if (!nadarSubcategories.contains(casteCommunity)) e['casteCommunity'] = 'Select your Nadar subcategory';
        if (!RegExp(r'^[^@\s]+@[^@\s]+\.[^@\s]+$').hasMatch(email.trim())) e['email'] = 'Enter a valid email address';
      case ProfileStep.personal:
        if (height.isEmpty) e['height'] = 'Height is required';
        if (maritalStatus.isEmpty) e['maritalStatus'] = 'Choose a marital status';
        if (previousMarriageDetails.length > 500) e['previousMarriageDetails'] = 'Keep it under 500 characters';
      case ProfileStep.location:
        if (state.isEmpty) e['state'] = 'State is required';
        if (city.trim().isEmpty) e['city'] = 'City is required';
        if (educationLevel.trim().isEmpty) e['educationLevel'] = 'Education level is required';
        if (profession.trim().isEmpty) e['profession'] = 'Occupation is required';
      case ProfileStep.additional:
        if (familyType.isEmpty) e['familyType'] = 'Choose your family status';
        final aboutLength = about.trim().length;
        if (aboutLength < 50) e['about'] = 'Write at least 50 characters (${50 - aboutLength} more)';
        if (aboutLength > 1000) e['about'] = 'Keep it under 1000 characters';
    }
    return e;
  }

  // POST /profiles (and PATCH /profiles/me) body.
  Map<String, dynamic> toRequest() => {
        'fullName': fullName.trim(),
        'gender': gender,
        'dateOfBirth': dateOfBirth,
        'religion': religion,
        'casteCommunity': casteCommunity,
        'email': email.trim(),
        if (profileFor != null) 'profileFor': profileFor,
        'personal': {
          'height': height,
          'physicalStatus': physicalStatus,
          if (complexion.isNotEmpty) 'complexion': complexion,
          'maritalStatus': maritalStatus,
          if (dosham.isNotEmpty) 'dosham': dosham,
          'previousMarriageDetails': priorMarriageStatuses.contains(maritalStatus) ? previousMarriageDetails.trim() : '',
          'doshamDetails': dosham == 'YES' ? doshamDetails : '',
        },
        'location': {
          'city': city.trim(),
          'state': state,
          'country': 'India',
          'educationLevel': educationLevel.trim(),
          'educationDetail': educationDetail.trim(),
          'profession': profession.trim(),
          'employedIn': employedIn.trim(),
          'annualIncomeRange': annualIncomeRange.trim(),
          'annualIncomeCurrency': 'INR',
        },
        'additional': {
          'familyType': familyType,
          if (familyType == netWorthFamilyStatus && netWorth.isNotEmpty) 'netWorth': netWorth,
          'about': about.trim(),
        },
        if (!lifestyle.isEmpty) 'lifestyle': lifestyle.toJson(),
      };

  // A form label worded for whoever the profile is about.
  String label(String text) => subjectLabel(profileFor, text);

  // "Write it for me" (the website's lib/about-draft.ts): a starting point
  // from what's already filled in, for the member to edit.
  String aboutDraft([DateTime? now]) {
    now ??= DateTime.now();
    String clean(String v) => v.trim();
    String article(String w) => RegExp(r'^[aeiou]', caseSensitive: false).hasMatch(w) ? 'an' : 'a';
    String asWord(String v) => RegExp(r'^[A-Z][a-z]+(\s[a-z]+)*$').hasMatch(v) ? v.toLowerCase() : v;
    const familyWords = {
      'Middle Class': 'middle-class',
      'Upper Middle Class': 'upper-middle-class',
      'Rich / Affluent (Elite)': 'well-established',
    };

    final firstName = clean(fullName).split(RegExp(r'\s+')).first;
    int? age;
    final dob = DateTime.tryParse(dateOfBirth);
    if (dob != null) {
      var years = now.year - dob.year;
      if (now.month < dob.month || (now.month == dob.month && now.day < dob.day)) years--;
      if (years > 0) age = years;
    }
    final job = asWord(clean(profession));
    final place = [clean(city), clean(state)].where((s) => s.isNotEmpty).join(', ');
    final sub = clean(casteCommunity);
    final community = sub.isNotEmpty && sub != 'Other' ? '$sub Nadar' : 'Nadar';
    final family = familyWords[clean(familyType)] ?? '';
    final background = [family, clean(religion), community].where((s) => s.isNotEmpty).join(' ');

    // A profile made for someone else is written about them, not as "I":
    // "My sister Kavitha is 29, works as a teacher and lives in Madurai."
    final relation = profileForRelation(profileFor)?.toLowerCase();
    if (relation != null) {
      final (they, them, s, has) = switch (gender) {
        'FEMALE' => ('She', 'her', 's', 'has'),
        'MALE' => ('He', 'him', 's', 'has'),
        _ => ('They', 'them', '', 'have'),
      };
      final doing = [
        if (age != null) 'is $age',
        if (job.isNotEmpty) 'works as ${article(job)} $job',
        if (place.isNotEmpty) 'lives in $place',
      ];
      final list = doing.length < 2 ? doing.join() : '${doing.sublist(0, doing.length - 1).join(', ')} and ${doing.last}';
      final first = doing.isEmpty ? '' : 'My $relation${firstName.isEmpty ? '' : ' $firstName'} $list.';
      final studiedOther = clean(educationLevel).isEmpty ? '' : ' and $has studied ${clean(educationLevel)}';
      final rootsOther = '$they come$s from ${article(background)} $background family$studiedOther.';
      final values = '$they value$s family, honesty and our traditions, and we are looking for a kind, understanding partner for $them.';
      return '${[first, rootsOther].where((x) => x.isNotEmpty).join(' ')}\n$values';
    }

    final parts = [firstName, if (age != null) '$age', if (job.isNotEmpty) '${article(job)} $job'].where((s) => s.isNotEmpty).toList();
    var line1 = parts.isEmpty ? '' : "I'm ${parts.join(', ')}";
    if (place.isNotEmpty) line1 = line1.isEmpty ? "I'm from $place" : '$line1 from $place';
    if (line1.isNotEmpty) line1 += '.';
    final studied = clean(educationLevel).isEmpty ? '' : ' and have studied ${clean(educationLevel)}';
    final roots = 'I come from ${article(background)} $background family$studied.';
    const line2 =
        'I value family, honesty and our traditions, and I am looking for a kind, understanding partner to build a happy life together.';
    return '${[line1, roots].where((s) => s.isNotEmpty).join(' ')}\n$line2';
  }
}
