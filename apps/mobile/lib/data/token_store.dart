import 'dart:convert';

import 'package:flutter_secure_storage/flutter_secure_storage.dart';

// The member's tokens, in the phone's secure storage (Keychain on iOS,
// Keystore-backed on Android). They stay until the member logs out, so the
// app opens straight into their account.
class TokenStore {
  static const _storage = FlutterSecureStorage();
  static const _access = 'nk.accessToken';
  static const _refresh = 'nk.refreshToken';

  String? accessToken;
  String? refreshToken;

  bool get hasSession => refreshToken != null && refreshToken!.isNotEmpty;

  // The member's user id: the access token's `sub` (only used to tell their
  // own chat messages apart, never trusted for anything else).
  String? get userId {
    final parts = accessToken?.split('.');
    if (parts == null || parts.length != 3) return null;
    try {
      final payload = jsonDecode(utf8.decode(base64Url.decode(base64Url.normalize(parts[1]))));
      return payload is Map ? payload['sub'] as String? : null;
    } catch (_) {
      return null;
    }
  }

  Future<void> load() async {
    accessToken = await _storage.read(key: _access);
    refreshToken = await _storage.read(key: _refresh);
  }

  Future<void> save(String access, String refresh) async {
    accessToken = access;
    refreshToken = refresh;
    await _storage.write(key: _access, value: access);
    await _storage.write(key: _refresh, value: refresh);
  }

  Future<void> clear() async {
    accessToken = null;
    refreshToken = null;
    await _storage.delete(key: _access);
    await _storage.delete(key: _refresh);
  }
}
