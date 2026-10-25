import 'dart:async';

import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../data/repository.dart';
import 'session.dart';

// The tab-bar badges: unread messages, unread notifications and the "new
// interests" dot. Polled like the website's header (every 45 s) and
// refreshed straight away after a screen marks something read.
class Badges extends ChangeNotifier {
  Badges(this.repo);
  final Repository repo;

  int messages = 0;
  int notifications = 0;
  bool newInterests = false;
  Timer? _timer;

  void start() {
    _timer ??= Timer.periodic(const Duration(seconds: 45), (_) => refresh());
    refresh();
  }

  void stop() {
    _timer?.cancel();
    _timer = null;
  }

  Future<void> refresh() async {
    // Each badge on its own: one failing (e.g. matching closed before
    // launch) never hides the others.
    final results = await Future.wait([
      repo.unreadMessages().then<int?>((v) => v).catchError((_) => null),
      repo.unreadNotifications().then<int?>((v) => v).catchError((_) => null),
      repo.hasNewInterests().then<bool?>((v) => v).catchError((_) => null),
    ]);
    messages = (results[0] as int?) ?? messages;
    notifications = (results[1] as int?) ?? notifications;
    newInterests = (results[2] as bool?) ?? newInterests;
    notifyListeners();
  }

  @override
  void dispose() {
    stop();
    super.dispose();
  }
}

final badgesProvider = ChangeNotifierProvider((ref) => Badges(ref.watch(repoProvider)));

String? badgeText(int count) => count <= 0 ? null : (count > 9 ? '9+' : '$count');
