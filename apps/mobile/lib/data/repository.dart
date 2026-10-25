import 'api.dart';
import 'members.dart';
import 'models.dart';

// Every API call the app makes, in one place.
class Repository {
  Repository(this.api);
  final Api api;

  // --- Sign-in --------------------------------------------------------------
  // Returns the dev-only code when the API includes one (never in production).
  Future<String?> requestOtp(String e164) async {
    final res = await api.post('/auth/otp/request', {'phoneNumber': e164}) as Map<String, dynamic>;
    return res['devOtp'] as String?;
  }

  // intent 'login' fails with ACCOUNT_NOT_FOUND for an unknown number.
  Future<({bool hasProfile})> verifyOtp(String e164, String otp, {required bool login}) async {
    final res = await api.post('/auth/otp/verify', {'phoneNumber': e164, 'otp': otp, 'intent': login ? 'login' : 'register'})
        as Map<String, dynamic>;
    await api.tokens.save(res['accessToken'] as String, res['refreshToken'] as String);
    return (hasProfile: (res['user'] as Map)['hasProfile'] == true);
  }

  Future<void> logout() async {
    try {
      await api.post('/auth/logout');
    } catch (_) {
      // Signing out locally still happens.
    }
    await api.tokens.clear();
  }

  Future<int> activeSessions() async => ((await api.get('/auth/sessions')) as Map)['activeSessions'] as int;
  // "Log out of all other devices" needs a code sent to the registered
  // number; sentTo is that number, masked.
  Future<({String sentTo, String? devOtp})> requestLogoutOthersOtp() async {
    final sent = (await api.post('/auth/logout-others/otp')) as Map;
    return (sentTo: sent['sentTo'] as String, devOtp: sent['devOtp'] as String?);
  }

  Future<int> logoutOtherDevices(String otp) async =>
      ((await api.post('/auth/logout-others', {'otp': otp})) as Map)['loggedOut'] as int;

  Future<AccountStatus> account() async => AccountStatus((await api.get('/auth/account')) as Map<String, dynamic>);
  Future<AccountStatus> deleteAccount() async => AccountStatus((await api.post('/auth/account/delete')) as Map<String, dynamic>);
  Future<AccountStatus> cancelDeletion() async =>
      AccountStatus((await api.post('/auth/account/cancel-deletion')) as Map<String, dynamic>);

  // --- DigiLocker -------------------------------------------------------------
  Future<IdentityStatus> identityStatus() async =>
      IdentityStatus((await api.get('/verification/status')) as Map<String, dynamic>);
  Future<String> startIdentity() async => ((await api.post('/verification/initiate')) as Map)['redirectUrl'] as String;
  Future<void> completeIdentity(String reference) => api.post('/verification/callback', {'reference': reference});

  // --- Profile ----------------------------------------------------------------
  Future<Profile> myProfile() async => Profile((await api.get('/profiles/me')) as Map<String, dynamic>);
  Future<void> createProfile(Map<String, dynamic> body) => api.post('/profiles', body);
  Future<Profile> updateProfile(Map<String, dynamic> body) async =>
      Profile((await api.patch('/profiles/me', body)) as Map<String, dynamic>);
  Future<Profile> updateLifestyle(Lifestyle lifestyle) async =>
      Profile((await api.patch('/profiles/me/lifestyle', lifestyle.toJson())) as Map<String, dynamic>);
  Future<Profile> setVisibility(String visibility) async =>
      Profile((await api.patch('/profiles/me/visibility', {'visibility': visibility})) as Map<String, dynamic>);
  Future<Profile> setPhoneVisibility(String value) async =>
      Profile((await api.patch('/profiles/me/phone-visibility', {'phoneVisibility': value})) as Map<String, dynamic>);

  // --- Photos -----------------------------------------------------------------
  Future<void> uploadPhoto(List<int> bytes, String contentType) async {
    final res = await api.post('/profiles/me/photos/upload-url', {'contentType': contentType}) as Map<String, dynamic>;
    await api.uploadToStorage(res['uploadUrl'] as String, bytes, contentType);
    await api.post('/profiles/me/photos/confirm', {'objectKey': res['objectKey']});
  }

  Future<void> setPrimaryPhoto(String id) => api.patch('/profiles/me/photos/$id/primary');
  Future<void> deletePhoto(String id) => api.delete('/profiles/me/photos/$id');

  // --- Membership & support ------------------------------------------------------
  Future<Membership> membership() async => Membership((await api.get('/me/membership')) as Map<String, dynamic>);
  Future<PlansResponse> plans() async => PlansResponse((await api.get('/membership-plans')) as Map<String, dynamic>);
  Future<List<UnlockedContact>> unlockedContacts() async {
    final res = await api.get('/me/phone-unlocks', query: {'limit': '100'}) as Map<String, dynamic>;
    return _items(res).map(UnlockedContact.new).toList();
  }

  // VIP Assisted is arranged by a call from the team, not bought: the
  // member's open request (status NEW | CONTACTED | ONBOARDED | CLOSED).
  Future<String?> vipEnquiryStatus() async {
    final e = ((await api.get('/vip-enquiries/me')) as Map)['enquiry'];
    return e is Map ? e['status'] as String? : null;
  }

  Future<void> requestVipCall(String message) => api.post('/vip-enquiries', {if (message.isNotEmpty) 'message': message});

  Future<({String? email, String? whatsapp})> supportContact() async {
    final res = await api.get('/support/contact') as Map<String, dynamic>;
    return (email: res['email'] as String?, whatsapp: res['whatsappNumber'] as String?);
  }

  // --- Matches & search -------------------------------------------------------------
  Future<MatchesPage> matches({int limit = 50}) async =>
      MatchesPage((await api.get('/matches', query: {'limit': '$limit'})) as Map<String, dynamic>);

  // newly-joined | nearby | with-photos | viewed-me | viewed-by-me
  Future<List<MemberCard>> category(String name) async =>
      _items(await api.get('/match-categories/$name')).map(MemberCard.fromCard).toList();

  Future<List<MemberCard>> shortlisted() async => _items(await api.get('/shortlists')).map(MemberCard.fromCard).toList();
  Future<List<MemberCard>> shortlistedMe() async =>
      _items(await api.get('/shortlists/shortlisted-me')).map(MemberCard.fromCard).toList();

  Future<SearchPage> search(Map<String, String> filters, {String? cursor}) async => SearchPage(
        (await api.get('/search/profiles', query: {...filters, 'cursor': ?cursor, 'limit': '20'})) as Map<String, dynamic>,
      );

  Future<List<MemberCard>> connections() async {
    final res = await api.get('/interests/connections', query: {'limit': '100'});
    return _items(res).map(MemberCard.fromSummary).toList();
  }

  // --- Another member ----------------------------------------------------------------
  Future<MemberProfile> member(String profileId) async =>
      MemberProfile((await api.get('/profiles/$profileId')) as Map<String, dynamic>);
  Future<PhoneStatus> phoneStatus(String profileId) async =>
      PhoneStatus((await api.get('/profiles/$profileId/phone-status')) as Map<String, dynamic>);
  Future<PhoneStatus> unlockPhone(String profileId) async =>
      PhoneStatus((await api.post('/profiles/$profileId/phone-unlock')) as Map<String, dynamic>);

  Future<bool> isShortlisted(String profileId) async =>
      ((await api.get('/shortlists/by-profile/$profileId')) as Map)['shortlisted'] == true;
  Future<void> shortlist(String profileId) => api.post('/shortlists', {'profileId': profileId});
  Future<void> unshortlist(String profileId) => api.delete('/shortlists/by-profile/$profileId');

  Future<void> blockProfile(String profileId) => api.post('/blocks', {'targetProfileId': profileId});
  Future<void> blockUser(String userId) => api.post('/blocks', {'targetUserId': userId});
  Future<void> unblock(String userId) => api.delete('/blocks/$userId');
  Future<List<BlockedMember>> blocked() async => _items(await api.get('/blocks')).map(BlockedMember.new).toList();
  // targetType PROFILE (a profile id) or MESSAGE (a message id).
  Future<void> report(String targetType, String targetId, String reason) =>
      api.post('/reports', {'targetType': targetType, 'targetId': targetId, 'reason': reason});

  // --- Interests ------------------------------------------------------------------------
  Future<void> sendInterest(String profileId) => api.post('/interests', {'targetProfileId': profileId});
  Future<({List<Interest> sent, List<Interest> received})> interests() async {
    final res = await api.get('/interests') as Map<String, dynamic>;
    return (
      sent: (res['sent'] as List? ?? []).map((i) => Interest(Map<String, dynamic>.from(i as Map), received: false)).toList(),
      received: (res['received'] as List? ?? []).map((i) => Interest(Map<String, dynamic>.from(i as Map), received: true)).toList(),
    );
  }

  Future<void> acceptInterest(String id) => api.patch('/interests/$id/accept');
  Future<void> declineInterest(String id) => api.patch('/interests/$id/decline');
  Future<void> withdrawInterest(String id) => api.delete('/interests/$id');
  Future<bool> hasNewInterests() async => ((await api.get('/interests/has-unread')) as Map)['hasUnread'] == true;
  Future<void> markInterestsViewed() => api.post('/interests/viewed');

  // --- Messages ----------------------------------------------------------------------------
  Future<List<Conversation>> conversations() async => _items(await api.get('/conversations')).map(Conversation.new).toList();
  Future<Conversation> conversation(String id) async => Conversation((await api.get('/conversations/$id')) as Map<String, dynamic>);

  // Oldest first. Opening (or polling) a thread marks the other side's
  // messages read.
  Future<List<Message>> messages(String conversationId) async {
    final all = <Message>[];
    int? offset = 0;
    while (offset != null) {
      final res = await api.get('/conversations/$conversationId/messages', query: {'offset': '$offset', 'limit': '200'}) as Map;
      all.addAll(_items(res).map(Message.new));
      offset = (res['nextOffset'] as num?)?.toInt();
    }
    return all;
  }

  Future<Message> sendMessage(String conversationId, String body) async =>
      Message((await api.post('/conversations/$conversationId/messages', {'body': body})) as Map<String, dynamic>);
  Future<int> unreadMessages() async => ((await api.get('/messages/unread-count')) as Map)['unreadCount'] as int;

  // --- Notifications ---------------------------------------------------------------------------
  // category: all | unread | profile | interests
  Future<NotificationsPage> notifications({String category = 'all', int offset = 0}) async => NotificationsPage(
        (await api.get('/notifications', query: {'category': category, 'offset': '$offset', 'limit': '30'})) as Map<String, dynamic>,
      );
  Future<int> unreadNotifications() async => ((await api.get('/notifications/unread-count')) as Map)['unreadCount'] as int;
  Future<void> markNotificationRead(String id) => api.patch('/notifications/$id/read');
  Future<void> markAllNotificationsRead() => api.post('/notifications/read-all');
  Future<void> clearNotifications() => api.delete('/notifications');

  // --- Partner preferences & horoscope ------------------------------------------------------------
  Future<PartnerPreferences?> partnerPreferences() async {
    final p = ((await api.get('/me/partner-preferences')) as Map)['preferences'];
    return p == null ? null : PartnerPreferences.fromJson(Map<String, dynamic>.from(p as Map));
  }

  Future<void> savePartnerPreferences(PartnerPreferences p) => api.put('/me/partner-preferences', p.toJson());
  Future<void> resetPartnerPreferences() => api.delete('/me/partner-preferences');

  Future<MyHoroscope?> horoscope() async {
    final h = ((await api.get('/me/horoscope')) as Map)['horoscope'];
    return h == null ? null : MyHoroscope.fromJson(Map<String, dynamic>.from(h as Map));
  }

  Future<void> saveHoroscope(MyHoroscope h) => api.put('/me/horoscope', h.toJson());
  Future<void> uploadHoroscopeChart(List<int> bytes, String contentType) async {
    final res = await api.post('/me/horoscope/chart/upload-url', {'contentType': contentType}) as Map<String, dynamic>;
    await api.uploadToStorage(res['uploadUrl'] as String, bytes, contentType);
    await api.post('/me/horoscope/chart/confirm', {'objectKey': res['objectKey']});
  }

  Future<void> deleteHoroscopeChart() => api.delete('/me/horoscope/chart');

  List<Map<String, dynamic>> _items(Object? res) =>
      ((res as Map)['items'] as List? ?? []).map((i) => Map<String, dynamic>.from(i as Map)).toList();
}
