import 'package:flutter/foundation.dart';

// Build-time settings. Override with --dart-define, e.g.
//   flutter run --dart-define=API_BASE_URL=https://api.nadarkalyanam.com/api/v1
class AppConfig {
  static const _apiFromEnv = String.fromEnvironment('API_BASE_URL');
  static const _webFromEnv = String.fromEnvironment('WEB_BASE_URL');

  // The API, ending in /api/v1. Local defaults: the Android emulator reaches
  // the PC as 10.0.2.2; the iOS simulator and the browser use localhost.
  static String get apiBaseUrl {
    if (_apiFromEnv.isNotEmpty) return _apiFromEnv;
    if (!kIsWeb && defaultTargetPlatform == TargetPlatform.android) return 'http://10.0.2.2:4000/api/v1';
    return 'http://localhost:4000/api/v1';
  }

  // The website, for the privacy policy, terms and anything not in the app yet.
  static String get webBaseUrl => _webFromEnv.isNotEmpty ? _webFromEnv : 'https://nadarkalyanam.com';
}
