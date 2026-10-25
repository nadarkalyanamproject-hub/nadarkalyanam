// Views over the JSON for other members and everything done with them:
// matches, search, interests, chat, notifications, plans (shapes:
// packages/schemas).

Map<String, dynamic> _map(Object? v) => v is Map<String, dynamic> ? v : v is Map ? Map<String, dynamic>.from(v) : <String, dynamic>{};
List<Map<String, dynamic>> _list(Object? v) => v is List ? v.map(_map).toList() : <Map<String, dynamic>>[];
String _s(Object? v) => v is String ? v : '';
String? _ns(Object? v) => v is String && v.isNotEmpty ? v : null;
int? _ni(Object? v) => v is num ? v.toInt() : null;
DateTime? _date(Object? v) => v is String ? DateTime.tryParse(v) : null;

// NONE | INTEREST_SENT | INTEREST_RECEIVED | CONNECTED
enum Relationship { none, sent, received, connected }

Relationship _relationship(Object? v) => switch (v) {
      'INTEREST_SENT' => Relationship.sent,
      'INTEREST_RECEIVED' => Relationship.received,
      'CONNECTED' => Relationship.connected,
      _ => Relationship.none,
    };

// One member on a card, whichever list they came from (matches, search,
// categories, shortlists, connections). Only real stored values; anything
// a member hasn't filled in is null.
class MemberCard {
  MemberCard({
    required this.profileId,
    required this.fullName,
    required this.age,
    this.city,
    this.state,
    this.profession,
    this.educationLevel,
    this.photoUrl,
    this.isVerified = false,
    this.relationship = Relationship.none,
    this.conversationId,
    this.score,
  });

  // Matches, search results and Matches-category cards share these keys.
  factory MemberCard.fromCard(Map<String, dynamic> j) => MemberCard(
        profileId: _s(j['profileId']),
        fullName: _s(j['fullName']),
        age: _ni(j['age']) ?? 0,
        city: _ns(j['city']),
        state: _ns(j['state']),
        profession: _ns(j['profession']),
        educationLevel: _ns(j['educationLevel']),
        photoUrl: _ns(j['primaryPhotoUrl']),
        isVerified: j['isVerified'] == true,
        relationship: _relationship(j['relationshipStatus']),
        conversationId: _ns(j['conversationId']),
        score: (j['score'] as num?)?.toDouble(),
      );

  // Browse / connections use the public profile summary shape.
  factory MemberCard.fromSummary(Map<String, dynamic> j) {
    final location = _map(j['location']);
    return MemberCard(
      profileId: _s(j['id']),
      fullName: _s(j['fullName']),
      age: _ni(j['age']) ?? 0,
      city: _ns(location['city']),
      state: _ns(location['state']),
      profession: _ns(j['profession']),
      photoUrl: _ns(j['primaryPhotoUrl']),
      relationship: _relationship(j['relationshipStatus']),
      conversationId: _ns(j['conversationId']),
    );
  }

  final String profileId;
  final String fullName;
  final int age;
  final String? city;
  final String? state;
  final String? profession;
  final String? educationLevel;
  final String? photoUrl;
  final bool isVerified;
  final Relationship relationship;
  final String? conversationId;
  final double? score;

  // "27 · Madurai"
  String get ageAndCity => [if (age > 0) '$age yrs', ?city].join(' · ');
  String? get work => profession ?? educationLevel;
  // "Madurai, Tamil Nadu", whichever parts are known.
  String? get place => city == null && state == null ? null : [?city, ?state].join(', ');
}

class MatchesPage {
  MatchesPage(this.json);
  final Map<String, dynamic> json;
  List<MemberCard> get items => _list(json['items']).map(MemberCard.fromCard).toList();
  Map<String, dynamic> get _prefs => _map(json['preferences']);
  bool get hasPreferences => _prefs['hasPreferences'] == true;
  int get hiddenByMustHave => _ni(_prefs['hiddenByMustHave']) ?? 0;
}

class SearchPage {
  SearchPage(this.json);
  final Map<String, dynamic> json;
  List<MemberCard> get items => _list(json['items']).map(MemberCard.fromCard).toList();
  String? get nextCursor => _ns(json['nextCursor']);
  int get total => _ni(json['total']) ?? 0;
}

// --- One member's full profile (GET /profiles/:id) -----------------------------

class PreferenceFit {
  PreferenceFit(this.json);
  final Map<String, dynamic> json;
  int get matched => _ni(json['matched']) ?? 0;
  int get total => _ni(json['total']) ?? 0;
  // key -> matched (null: the profile has no readable value for it)
  Map<String, bool?> get fields => {for (final f in _list(json['fields'])) _s(f['key']): f['matched'] as bool?};
}

class HoroscopeView {
  HoroscopeView(this.json);
  final Map<String, dynamic> json;
  bool get shared => json['shared'] == true;
  String? get rasi => _ns(json['rasi']);
  String? get nakshatra => _ns(json['nakshatra']);
  int? get nakshatraPada => _ni(json['nakshatraPada']);
  String? get lagnam => _ns(json['lagnam']);
  String? get sevvaiDosham => _ns(json['sevvaiDosham']);
  String? get raguKethuDosham => _ns(json['raguKethuDosham']);
  String? get birthTime => _ns(json['birthTime']);
  String? get birthPlace {
    final p = _map(json['birthPlace']);
    final parts = [_ns(p['city']), _ns(p['state']), _ns(p['country'])].whereType<String>();
    return parts.isEmpty ? null : parts.join(', ');
  }

  String? get chartImageUrl => _ns(json['chartImageUrl']);
}

class MemberProfile {
  MemberProfile(this.json);
  final Map<String, dynamic> json;

  String get id => _s(json['id']);
  String get fullName => _s(json['fullName']);
  int get age => _ni(json['age']) ?? 0;
  String get gender => _s(json['gender']);
  String? get city => _ns(_map(json['location'])['city']);
  String? get state => _ns(_map(json['location'])['state']);
  String? get religion => _ns(json['religion']);
  String? get casteCommunity => _ns(json['casteCommunity']);
  String? get profession => _ns(json['profession']);
  String? get maritalStatus => _ns(json['maritalStatus']);
  String? get height => _ns(json['height']);
  String? get physicalStatus => _ns(json['physicalStatus']);
  String? get complexion => _ns(json['complexion']);
  String? get dosham => _ns(json['dosham']);
  Map<String, dynamic> get education => _map(json['education']);
  Map<String, dynamic> get additional => _map(json['additional']);
  Map<String, dynamic>? get lifestyle => json['lifestyle'] == null ? null : _map(json['lifestyle']);
  String? get primaryPhotoUrl => _ns(json['primaryPhotoUrl']);
  List<String> get photoUrls {
    final photos = _list(json['photos']);
    photos.sort((a, b) => (b['isPrimary'] == true ? 1 : 0) - (a['isPrimary'] == true ? 1 : 0));
    return photos.map((p) => _s(p['url'])).where((u) => u.isNotEmpty).toList();
  }

  Relationship get relationship => _relationship(json['relationshipStatus']);
  String? get conversationId => _ns(json['conversationId']);
  bool get isVerified => json['isVerified'] == true;
  PreferenceFit? get preferenceFit => json['preferenceFit'] == null ? null : PreferenceFit(_map(json['preferenceFit']));
  Map<String, dynamic>? get theirPreferences =>
      json['theirPreferences'] == null ? null : _map(_map(json['theirPreferences'])['preferences']);
  PreferenceFit? get theirFit =>
      json['theirPreferences'] == null ? null : PreferenceFit(_map(_map(json['theirPreferences'])['fit']));
  HoroscopeView get horoscope => HoroscopeView(_map(json['horoscope']));
}

// GET /profiles/:id/phone-status (and the unlock response, with the number).
class PhoneStatus {
  PhoneStatus(this.json);
  final Map<String, dynamic> json;
  String get state => _s(json['state']);
  int? get limit => _ni(json['limit']);
  int? get remaining => _ni(json['remaining']);
  String? get phoneNumber => _ns(json['phoneNumber']);
}

// --- Interests ------------------------------------------------------------------

class Interest {
  Interest(this.json, {required this.received});
  final Map<String, dynamic> json;
  final bool received;

  String get id => _s(json['id']);
  // PENDING | ACCEPTED | DECLINED | WITHDRAWN
  String get status => _s(json['status']);
  DateTime? get createdAt => _date(json['createdAt']);
  Map<String, dynamic> get _party => _map(received ? json['sender'] : json['target']);
  MemberCard get member => MemberCard(
        profileId: _s(_party['profileId']),
        fullName: _s(_party['fullName']),
        age: _ni(_party['age']) ?? 0,
        city: _ns(_party['city']),
        state: _ns(_party['state']),
        profession: _ns(_party['profession']),
        educationLevel: _ns(_party['educationLevel']),
        photoUrl: _ns(_party['primaryPhotoUrl']),
      );
}

// --- Messages -------------------------------------------------------------------

class Conversation {
  Conversation(this.json);
  final Map<String, dynamic> json;
  String get id => _s(json['id']);
  Map<String, dynamic> get _other => _map(json['otherParticipant']);
  String get otherUserId => _s(_other['userId']);
  String? get otherProfileId => _ns(_other['profileId']);
  String get otherName => _s(_other['fullName']);
  String? get otherPhotoUrl => _ns(_other['primaryPhotoUrl']);
  // Only on GET /conversations/:id: false when the other member is gone.
  bool get otherAvailable => _other['available'] != false;
  String? get lastBody => _ns(_map(json['lastMessage'])['body']);
  String? get lastSenderId => _ns(_map(json['lastMessage'])['senderId']);
  int get unreadCount => _ni(json['unreadCount']) ?? 0;
  DateTime? get lastActivityAt => _date(json['lastActivityAt']);
}

class Message {
  Message(this.json);
  final Map<String, dynamic> json;
  String get id => _s(json['id']);
  String get senderId => _s(json['senderId']);
  String get body => _s(json['body']);
  // SENT | DELIVERED | READ
  String get status => _s(json['status']);
  DateTime? get createdAt => _date(json['createdAt']);
}

// --- Notifications ----------------------------------------------------------------

class AppNotification {
  AppNotification(this.json);
  final Map<String, dynamic> json;
  String get id => _s(json['id']);
  String get type => _s(json['type']);
  String get message => _s(json['message']);
  String get actorName => _s(_map(json['actor'])['name']);
  String? get actorPhotoUrl => _ns(_map(json['actor'])['photoUrl']);
  String? get targetId => _ns(json['targetId']);
  bool get targetAvailable => json['targetAvailable'] != false;
  bool get isRead => json['isRead'] == true;
  DateTime? get createdAt => _date(json['createdAt']);
}

class NotificationsPage {
  NotificationsPage(this.json);
  final Map<String, dynamic> json;
  List<AppNotification> get items => _list(json['items']).map(AppNotification.new).toList();
  int get unreadCount => _ni(json['unreadCount']) ?? 0;
  int? get nextOffset => _ni(json['nextOffset']);
}

// --- Plans & contacts ---------------------------------------------------------------

class PlanFeature {
  PlanFeature(this.json);
  final Map<String, dynamic> json;
  String get label => _s(json['label']);
  bool get available => json['available'] == true;
}

class Plan {
  Plan(this.json);
  final Map<String, dynamic> json;
  String get id => _s(json['id']);
  String get code => _s(json['code']);
  String get name => _s(json['name']);
  String? get description => _ns(json['description']);
  int get priceInPaise => _ni(json['priceInPaise']) ?? 0;
  int? get originalPriceInPaise => _ni(json['originalPriceInPaise']);
  int get durationDays => _ni(json['durationDays']) ?? 0;
  int? get phoneUnlockLimit => _ni(json['phoneUnlockLimit']);
  bool get isAssisted => json['isAssisted'] == true;
  List<PlanFeature> get features => _list(json['features']).map(PlanFeature.new).toList();
}

class PlansResponse {
  PlansResponse(this.json);
  final Map<String, dynamic> json;
  List<Plan> get items => _list(json['items']).map(Plan.new).toList();
  int get freeInterestsPerMonth => _ni(json['freeInterestsPerMonth']) ?? 0;
  bool get requirePaidPlan => json['requirePaidPlan'] == true;
}

class UnlockedContact {
  UnlockedContact(this.json);
  final Map<String, dynamic> json;
  MemberCard get member => MemberCard(
        profileId: _s(json['profileId']),
        fullName: _s(json['fullName']),
        age: _ni(json['age']) ?? 0,
        city: _ns(json['city']),
        state: _ns(json['state']),
        photoUrl: _ns(json['primaryPhotoUrl']),
      );
  DateTime? get unlockedAt => _date(json['unlockedAt']);
}

class BlockedMember {
  BlockedMember(this.json);
  final Map<String, dynamic> json;
  String get userId => _s(json['userId']);
  String get fullName => _s(json['fullName']);
  String? get photoUrl => _ns(json['primaryPhotoUrl']);
  DateTime? get blockedAt => _date(json['blockedAt']);
}

// --- My partner preferences and horoscope --------------------------------------------

class PartnerPreferences {
  PartnerPreferences({
    this.ageMin,
    this.ageMax,
    this.heightMinCm,
    this.heightMaxCm,
    List<String>? maritalStatuses,
    List<String>? motherTongues,
    List<String>? states,
    List<String>? cities,
    this.incomeMinLakhs,
    this.incomeMaxLakhs,
    this.doshamPreference = 'DOESNT_MATTER',
    this.mustHaveAge = false,
    this.mustHaveMaritalStatus = false,
    this.mustHaveLocation = false,
  })  : maritalStatuses = maritalStatuses ?? [],
        motherTongues = motherTongues ?? [],
        states = states ?? [],
        cities = cities ?? [];

  factory PartnerPreferences.fromJson(Map<String, dynamic> j) => PartnerPreferences(
        ageMin: _ni(j['ageMin']),
        ageMax: _ni(j['ageMax']),
        heightMinCm: _ni(j['heightMinCm']),
        heightMaxCm: _ni(j['heightMaxCm']),
        maritalStatuses: (j['maritalStatuses'] as List?)?.whereType<String>().toList(),
        motherTongues: (j['motherTongues'] as List?)?.whereType<String>().toList(),
        states: (j['states'] as List?)?.whereType<String>().toList(),
        cities: (j['cities'] as List?)?.whereType<String>().toList(),
        incomeMinLakhs: (j['incomeMinLakhs'] as num?)?.toDouble(),
        incomeMaxLakhs: (j['incomeMaxLakhs'] as num?)?.toDouble(),
        doshamPreference: _ns(j['doshamPreference']) ?? 'DOESNT_MATTER',
        mustHaveAge: j['mustHaveAge'] == true,
        mustHaveMaritalStatus: j['mustHaveMaritalStatus'] == true,
        mustHaveLocation: j['mustHaveLocation'] == true,
      );

  int? ageMin;
  int? ageMax;
  int? heightMinCm;
  int? heightMaxCm;
  List<String> maritalStatuses;
  // No longer asked in the app (mother tongue was dropped); saved values
  // are sent back unchanged.
  List<String> motherTongues;
  List<String> states;
  List<String> cities;
  double? incomeMinLakhs;
  double? incomeMaxLakhs;
  String doshamPreference;
  bool mustHaveAge;
  bool mustHaveMaritalStatus;
  bool mustHaveLocation;

  Map<String, dynamic> toJson() => {
        'ageMin': ageMin,
        'ageMax': ageMax,
        'heightMinCm': heightMinCm,
        'heightMaxCm': heightMaxCm,
        'maritalStatuses': maritalStatuses,
        'motherTongues': motherTongues,
        'states': states,
        'cities': cities,
        'incomeMinLakhs': incomeMinLakhs,
        'incomeMaxLakhs': incomeMaxLakhs,
        'doshamPreference': doshamPreference,
        'mustHaveAge': mustHaveAge,
        'mustHaveMaritalStatus': mustHaveMaritalStatus,
        'mustHaveLocation': mustHaveLocation,
      };
}

class MyHoroscope {
  MyHoroscope({
    this.birthTime,
    this.birthCity,
    this.birthState,
    this.birthCountry,
    this.rasi,
    this.nakshatra,
    this.nakshatraPada,
    this.lagnam,
    this.sevvaiDosham,
    this.raguKethuDosham,
    this.visibility = 'HIDDEN',
    this.shareBirthDetails = false,
    this.chartUrl,
    this.chartStatus,
    this.chartRejectionReason,
  });

  factory MyHoroscope.fromJson(Map<String, dynamic> j) {
    final chart = j['chart'] == null ? null : _map(j['chart']);
    return MyHoroscope(
      birthTime: _ns(j['birthTime']),
      birthCity: _ns(j['birthCity']),
      birthState: _ns(j['birthState']),
      birthCountry: _ns(j['birthCountry']),
      rasi: _ns(j['rasi']),
      nakshatra: _ns(j['nakshatra']),
      nakshatraPada: _ni(j['nakshatraPada']),
      lagnam: _ns(j['lagnam']),
      sevvaiDosham: _ns(j['sevvaiDosham']),
      raguKethuDosham: _ns(j['raguKethuDosham']),
      visibility: _ns(j['visibility']) ?? 'HIDDEN',
      shareBirthDetails: j['shareBirthDetails'] == true,
      chartUrl: chart == null ? null : _ns(chart['url']),
      chartStatus: chart == null ? null : _ns(chart['status']),
      chartRejectionReason: chart == null ? null : _ns(chart['rejectionReason']),
    );
  }

  String? birthTime;
  String? birthCity;
  String? birthState;
  String? birthCountry;
  String? rasi;
  String? nakshatra;
  int? nakshatraPada;
  String? lagnam;
  String? sevvaiDosham;
  String? raguKethuDosham;
  String visibility;
  bool shareBirthDetails;
  final String? chartUrl;
  final String? chartStatus;
  final String? chartRejectionReason;

  Map<String, dynamic> toJson() => {
        'birthTime': birthTime,
        'birthCity': birthCity,
        'birthState': birthState,
        'birthCountry': birthCountry,
        'rasi': rasi,
        'nakshatra': nakshatra,
        'nakshatraPada': nakshatraPada,
        'lagnam': lagnam,
        'sevvaiDosham': sevvaiDosham,
        'raguKethuDosham': raguKethuDosham,
        'visibility': visibility,
        'shareBirthDetails': shareBirthDetails,
      };
}
