import 'dart:async';
import 'dart:convert';

import 'package:http/http.dart' as http;

import '../config.dart';
import 'token_store.dart';

class ApiException implements Exception {
  ApiException(this.message, {this.status, this.code});
  final String message;
  final int? status;
  final String? code;

  @override
  String toString() => message;
}

// One client for the whole app. Requests carry the access token; a 401 is
// answered by one silent refresh and a retry, so members stay signed in.
// Only a refresh the server itself rejects signs the member out (onSignedOut);
// no network, or a server error, never does.
class Api {
  Api(this.tokens, {http.Client? client}) : _http = client ?? http.Client();

  final TokenStore tokens;
  final http.Client _http;
  void Function()? onSignedOut;
  Future<bool>? _refreshing;

  Uri _uri(String path, [Map<String, String>? query]) =>
      Uri.parse('${AppConfig.apiBaseUrl}$path').replace(queryParameters: query);

  Future<dynamic> get(String path, {Map<String, String>? query}) => _send('GET', path, query: query);
  Future<dynamic> post(String path, [Object? body]) => _send('POST', path, body: body);
  Future<dynamic> put(String path, [Object? body]) => _send('PUT', path, body: body);
  Future<dynamic> patch(String path, [Object? body]) => _send('PATCH', path, body: body);
  Future<dynamic> delete(String path) => _send('DELETE', path);

  Future<dynamic> _send(String method, String path, {Object? body, Map<String, String>? query, bool retried = false}) async {
    final headers = <String, String>{'Content-Type': 'application/json', 'Accept': 'application/json'};
    final token = tokens.accessToken;
    if (token != null) headers['Authorization'] = 'Bearer $token';

    final request = http.Request(method, _uri(path, query))..headers.addAll(headers);
    if (body != null) request.body = jsonEncode(body);

    late http.Response response;
    try {
      response = await http.Response.fromStream(await _http.send(request).timeout(const Duration(seconds: 30)));
    } on TimeoutException {
      throw ApiException('The connection timed out. Please try again.');
    } catch (_) {
      throw ApiException('No connection. Check your internet and try again.');
    }

    if (response.statusCode == 401 && token != null && !retried) {
      if (await _refresh()) return _send(method, path, body: body, query: query, retried: true);
    }
    if (response.statusCode >= 400) throw _errorFrom(response);
    if (response.statusCode == 204 || response.body.isEmpty) return null;
    return jsonDecode(response.body);
  }

  // One refresh at a time; concurrent 401s share it.
  Future<bool> _refresh() {
    return _refreshing ??= _doRefresh().whenComplete(() => _refreshing = null);
  }

  Future<bool> _doRefresh() async {
    final refresh = tokens.refreshToken;
    if (refresh == null) {
      _signOut();
      return false;
    }
    try {
      final response = await _http
          .post(_uri('/auth/refresh'), headers: {'Content-Type': 'application/json'}, body: jsonEncode({'refreshToken': refresh}))
          .timeout(const Duration(seconds: 30));
      if (response.statusCode == 401 || response.statusCode == 400) {
        _signOut();
        return false;
      }
      if (response.statusCode >= 400) return false;
      final data = jsonDecode(response.body) as Map<String, dynamic>;
      await tokens.save(data['accessToken'] as String, data['refreshToken'] as String);
      return true;
    } catch (_) {
      // Offline or the server is down: keep the session, fail this request.
      return false;
    }
  }

  void _signOut() {
    tokens.clear();
    onSignedOut?.call();
  }

  ApiException _errorFrom(http.Response response) {
    String message = 'Something went wrong. Please try again.';
    String? code;
    try {
      final body = jsonDecode(response.body);
      if (body is Map) {
        code = body['errorCode'] as String?;
        final raw = body['message'];
        if (raw is String) {
          message = raw;
        } else if (raw is List && raw.isNotEmpty) {
          final first = raw.first;
          message = first is Map ? (first['message'] ?? message).toString() : first.toString();
        }
      }
    } catch (_) {}
    return ApiException(message, status: response.statusCode, code: code);
  }

  // Photo bytes go straight to storage through the signed URL the API gives.
  Future<void> uploadToStorage(String uploadUrl, List<int> bytes, String contentType) async {
    final response = await _http.put(Uri.parse(uploadUrl), headers: {'Content-Type': contentType}, body: bytes);
    if (response.statusCode >= 300) throw ApiException('The photo could not be uploaded. Please try again.');
  }
}
