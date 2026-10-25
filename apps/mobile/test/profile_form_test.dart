import 'package:flutter_test/flutter_test.dart';
import 'package:nadar_kalyanam/data/models.dart';
import 'package:nadar_kalyanam/data/reference.dart';
import 'package:nadar_kalyanam/features/onboarding/profile_form.dart';

ProfileForm filled() => ProfileForm()
  ..fullName = 'Meena Kumari'
  ..gender = 'FEMALE'
  ..dateOfBirth = '1998-04-12'
  ..religion = 'Hindu'
  ..casteCommunity = 'Gramani'
  ..email = 'meena@example.com'
  ..height = heights[10]
  ..maritalStatus = 'NEVER_MARRIED'
  ..city = 'Chennai'
  ..state = 'Tamil Nadu'
  ..educationLevel = 'Bachelors'
  ..profession = 'Teacher'
  ..familyType = 'Upper Middle Class'
  ..about = 'I am a teacher who loves music and family. Looking for a kind partner.';

void main() {
  test('a fully filled form passes every step', () {
    final form = filled();
    for (final step in ProfileStep.values) {
      expect(form.validate(step), isEmpty, reason: step.name);
    }
  });

  test('each step reports its own missing fields, as the API would', () {
    final form = ProfileForm();
    expect(form.validate(ProfileStep.basic).keys, containsAll(['fullName', 'gender', 'dateOfBirth', 'religion', 'casteCommunity', 'email']));
    expect(form.validate(ProfileStep.personal).keys, containsAll(['height', 'maritalStatus']));
    expect(form.validate(ProfileStep.location).keys, containsAll(['state', 'city', 'educationLevel', 'profession']));
    expect(form.validate(ProfileStep.additional).keys, containsAll(['familyType', 'about']));
  });

  test('values outside the lists are refused (religion, subcategory)', () {
    final form = filled()
      ..religion = 'Other'
      ..casteCommunity = 'Nadar';
    expect(form.validate(ProfileStep.basic).keys, containsAll(['religion', 'casteCommunity']));
  });

  test('the request drops follow-up details that no longer apply, and empty optionals', () {
    final form = filled()
      ..previousMarriageDetails = 'old text'
      ..dosham = 'NO'
      ..doshamDetails = 'Rahu Dosham';
    final req = form.toRequest();
    final personal = req['personal'] as Map;
    expect(personal['previousMarriageDetails'], '');
    expect(personal['doshamDetails'], '');
    expect(personal.containsKey('complexion'), isFalse);
    expect((req['location'] as Map)['country'], 'India');
    expect(req.containsKey('lifestyle'), isFalse);

    form.lifestyle = Lifestyle(diet: 'Vegetarian', hobbies: ['Music']);
    expect(form.toRequest()['lifestyle'], {'diet': 'Vegetarian', 'hobbies': ['Music']});
  });

  test('a profile round-trips into the edit form and back to the same request', () {
    final req = filled().toRequest();
    final profile = Profile({
      'fullName': req['fullName'],
      'gender': req['gender'],
      'dateOfBirth': req['dateOfBirth'],
      'details': {
        'religion': req['religion'],
        'casteCommunity': req['casteCommunity'],
        'email': req['email'],
        ...(req['personal'] as Map),
        'location': {'city': 'Chennai', 'state': 'Tamil Nadu', 'country': 'India'},
        'education': {'educationLevel': 'Bachelors', 'educationDetail': '', 'profession': 'Teacher', 'employedIn': '', 'annualIncomeRange': '', 'annualIncomeCurrency': 'INR'},
        'additional': req['additional'],
      },
    });
    expect(ProfileForm.fromProfile(profile).toRequest(), req);
    expect(profile.toUpdateRequest(), req);
  });

  test('"Write it for me" builds from what is filled in, and is long enough to save', () {
    final draft = filled().aboutDraft(DateTime(2026, 10, 24));
    expect(draft, startsWith("I'm Meena, 28, a teacher from Chennai, Tamil Nadu."));
    expect(draft, contains('upper-middle-class Hindu Gramani Nadar family and have studied Bachelors'));
    final form = filled()..about = draft;
    expect(form.validate(ProfileStep.additional), isEmpty);
  });

  test('a profile made for a sister is labelled and written about her', () {
    final form = filled()..profileFor = 'SISTER';
    expect(form.label('Occupation'), "Sister's occupation");
    expect(aboutLabel('SISTER'), 'A few words about my sister');
    expect(filled().label('Occupation'), 'Occupation');
    expect(form.aboutDraft(DateTime(2026, 10, 24)), startsWith('My sister Meena is 28, works as a teacher and lives in Chennai, Tamil Nadu. She comes from'));
    expect(form.toRequest()['profileFor'], 'SISTER');
  });

  test('net worth is sent only for a Rich / Affluent (Elite) family', () {
    final form = filled()..netWorth = 'Above ₹25 Crore';
    expect((form.toRequest()['additional'] as Map).containsKey('netWorth'), isFalse);
    form.familyType = netWorthFamilyStatus;
    expect((form.toRequest()['additional'] as Map)['netWorth'], 'Above ₹25 Crore');
  });

  test('profile-for implies a gender only where it is certain', () {
    expect(genderFor('Son'), 'MALE');
    expect(genderFor('Sister'), 'FEMALE');
    expect(genderFor('Myself'), isNull);
    expect(genderFor('Friend'), isNull);
  });

  test('heights match the website format', () {
    expect(heights.first, '4\'6" (137 cm)');
    expect(heights.last, '6\'6" (198 cm)');
    expect(heights, hasLength(25));
  });
}
