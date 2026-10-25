import 'api.dart';
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
  Future<({String? email, String? whatsapp})> supportContact() async {
    final res = await api.get('/support/contact') as Map<String, dynamic>;
    return (email: res['email'] as String?, whatsapp: res['whatsappNumber'] as String?);
  }
}
