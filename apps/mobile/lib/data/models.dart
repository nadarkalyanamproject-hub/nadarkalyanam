// Thin, read-only views over the API's JSON (shapes: packages/schemas).

Map<String, dynamic> _map(Object? v) => v is Map<String, dynamic> ? v : v is Map ? Map<String, dynamic>.from(v) : <String, dynamic>{};
String _s(Object? v) => v is String ? v : '';
String? _ns(Object? v) => v is String && v.isNotEmpty ? v : null;

class Photo {
  Photo(this.json);
  final Map<String, dynamic> json;
  String get id => _s(json['id']);
  String get url => _s(json['url']);
  bool get isPrimary => json['isPrimary'] == true;
  String get status => _s(json['status']); // PENDING | APPROVED | REJECTED
  String? get rejectionReason => _ns(json['rejectionReason']);
}

class Lifestyle {
  Lifestyle({this.diet, this.smoking, this.drinking, List<String>? hobbies}) : hobbies = hobbies ?? [];
  factory Lifestyle.fromJson(Object? v) {
    final m = _map(v);
    return Lifestyle(
      diet: _ns(m['diet']),
      smoking: _ns(m['smoking']),
      drinking: _ns(m['drinking']),
      hobbies: (m['hobbies'] as List?)?.whereType<String>().toList(),
    );
  }
  String? diet;
  String? smoking;
  String? drinking;
  List<String> hobbies;

  bool get isEmpty => diet == null && smoking == null && drinking == null && hobbies.isEmpty;

  Map<String, dynamic> toJson() => {
        if (diet != null) 'diet': diet,
        if (smoking != null) 'smoking': smoking,
        if (drinking != null) 'drinking': drinking,
        'hobbies': hobbies,
      };
}

class Profile {
  Profile(this.json);
  final Map<String, dynamic> json;

  String get id => _s(json['id']);
  String get fullName => _s(json['fullName']);
  String get gender => _s(json['gender']);
  String get dateOfBirth => _s(json['dateOfBirth']);
  int get completionScore => (json['completionScore'] as num?)?.toInt() ?? 0;
  List<String> get completionMissing => (json['completionMissing'] as List?)?.whereType<String>().toList() ?? [];
  String get visibility => _s(json['visibility']);
  String get phoneVisibility => _s(json['phoneVisibility']);
  bool get isVerified => json['isVerified'] == true;
  Map<String, dynamic> get details => _map(json['details']);
  Map<String, dynamic> get location => _map(details['location']);
  Map<String, dynamic> get education => _map(details['education']);
  Map<String, dynamic> get additional => _map(details['additional']);
  Lifestyle get lifestyle => Lifestyle.fromJson(details['lifestyle']);
  List<Photo> get photos => (json['photos'] as List? ?? []).map((p) => Photo(_map(p))).toList();
  Photo? get primaryPhoto {
    final all = photos;
    if (all.isEmpty) return null;
    return all.firstWhere((p) => p.isPrimary, orElse: () => all.first);
  }

  int? get age {
    final dob = DateTime.tryParse(dateOfBirth);
    if (dob == null) return null;
    final now = DateTime.now();
    var years = now.year - dob.year;
    if (now.month < dob.month || (now.month == dob.month && now.day < dob.day)) years--;
    return years;
  }

  // The full PATCH /profiles/me body, as the web's toCreateProfileRequest:
  // every section resent so saving one never clears another.
  Map<String, dynamic> toUpdateRequest() => {
        'fullName': fullName,
        'gender': gender,
        'dateOfBirth': dateOfBirth,
        'religion': _s(details['religion']),
        'casteCommunity': _s(details['casteCommunity']),
        'email': _s(details['email']),
        'personal': {
          'height': _s(details['height']),
          'physicalStatus': details['physicalStatus'],
          if (_ns(details['complexion']) != null) 'complexion': details['complexion'],
          'maritalStatus': details['maritalStatus'],
          if (_ns(details['dosham']) != null) 'dosham': details['dosham'],
          'previousMarriageDetails': _s(details['previousMarriageDetails']),
          'doshamDetails': _s(details['doshamDetails']),
        },
        'location': {
          'city': _s(location['city']),
          'state': _s(location['state']),
          'country': _ns(location['country']) ?? 'India',
          'educationLevel': _s(education['educationLevel']),
          'educationDetail': _s(education['educationDetail']),
          'profession': _s(education['profession']),
          'employedIn': _s(education['employedIn']),
          'annualIncomeRange': _s(education['annualIncomeRange']),
          'annualIncomeCurrency': _ns(education['annualIncomeCurrency']) ?? 'INR',
        },
        'additional': {
          'familyType': additional['familyType'],
          if (_ns(additional['netWorth']) != null) 'netWorth': additional['netWorth'],
          'about': _s(additional['about']),
        },
        if (!lifestyle.isEmpty) 'lifestyle': lifestyle.toJson(),
      };
}

class LaunchOffer {
  LaunchOffer(this.json);
  final Map<String, dynamic> json;
  String get planName => _s(json['planName']);
  DateTime? get qualifyBy => DateTime.tryParse(_s(json['qualifyBy']));
  DateTime? get startsAt => DateTime.tryParse(_s(json['startsAt']));
  DateTime? get endsAt => DateTime.tryParse(_s(json['endsAt']));
  bool get earned => json['earned'] == true;
  bool get needsProfile => _map(json['needs'])['profile'] == true;
  bool get needsPhoto => _map(json['needs'])['photo'] == true;
}

class Membership {
  Membership(this.json);
  final Map<String, dynamic> json;
  String? get planName => _ns(_map(json['plan'])['name']);
  bool get isActive => json['status'] == 'ACTIVE';
  DateTime? get expiresAt => DateTime.tryParse(_s(json['expiresAt']));
  DateTime? get opensAt => json['preLaunch'] == null ? null : DateTime.tryParse(_s(_map(json['preLaunch'])['opensAt']));
  LaunchOffer? get launchOffer => json['launchOffer'] == null ? null : LaunchOffer(_map(json['launchOffer']));
}

class IdentityStatus {
  IdentityStatus(this.json);
  final Map<String, dynamic> json;
  bool get verified => json['verified'] == true;
  bool get required => json['required'] == true;
  String get status => _s(json['status']);
  String? get name => _ns(_map(json['identity'])['name']);
  String? get dateOfBirth => _ns(_map(json['identity'])['dateOfBirth']);
}

class AccountStatus {
  AccountStatus(this.json);
  final Map<String, dynamic> json;
  String get status => _s(json['status']);
  DateTime? get deletionScheduledAt => DateTime.tryParse(_s(json['deletionScheduledAt']));
  bool get pendingDeletion => status == 'PENDING_DELETION';
}
