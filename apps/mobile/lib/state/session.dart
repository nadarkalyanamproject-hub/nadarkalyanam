import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../data/api.dart';
import '../data/models.dart';
import '../data/repository.dart';
import '../data/token_store.dart';

enum Phase { booting, signedOut, deletionPending, needsIdentity, needsProfile, ready }

// Where the member is in the app's flow; the router follows `phase`.
class Session extends ChangeNotifier {
  Session(this.repo) {
    repo.api.onSignedOut = _handleSignedOut;
  }

  final Repository repo;
  Phase phase = Phase.booting;
  Profile? profile;
  AccountStatus? account;
  IdentityStatus? identity;
  bool splashDone = false;

  // From the register screen, prefilled into onboarding step 1.
  String? prefillName;
  String? prefillGender;
  String? prefillProfileFor;

  Future<void> boot() async {
    await repo.api.tokens.load();
    if (!repo.api.tokens.hasSession) {
      _set(Phase.signedOut);
      return;
    }
    await resolve();
  }

  void finishSplash() {
    splashDone = true;
    notifyListeners();
  }

  // Works out the next screen for a signed-in member.
  Future<void> resolve() async {
    try {
      account = await repo.account();
      if (account!.pendingDeletion) return _set(Phase.deletionPending);
      identity = await repo.identityStatus();
      if (identity!.required && !identity!.verified) return _set(Phase.needsIdentity);
      try {
        profile = await repo.myProfile();
        _set(Phase.ready);
      } on ApiException catch (e) {
        if (e.status == 404) return _set(Phase.needsProfile);
        rethrow;
      }
    } on ApiException catch (e) {
      if (!repo.api.tokens.hasSession) return _set(Phase.signedOut);
      // Offline at start-up: open on the profile we can't refresh yet rather
      // than signing out. Home shows the error and a retry.
      bootError = e.message;
      _set(profile == null ? Phase.needsProfile : Phase.ready);
    }
  }

  String? bootError;

  Future<void> refreshProfile() async {
    profile = await repo.myProfile();
    notifyListeners();
  }

  void setProfile(Profile p) {
    profile = p;
    notifyListeners();
  }

  Future<void> signOut() async {
    await repo.logout();
    _clear();
  }

  void _handleSignedOut() => _clear();

  void _clear() {
    profile = null;
    account = null;
    identity = null;
    prefillName = null;
    prefillGender = null;
    prefillProfileFor = null;
    _set(Phase.signedOut);
  }

  void _set(Phase next) {
    phase = next;
    notifyListeners();
  }
}

final tokenStoreProvider = Provider((_) => TokenStore());
final apiProvider = Provider((ref) => Api(ref.watch(tokenStoreProvider)));
final repoProvider = Provider((ref) => Repository(ref.watch(apiProvider)));
final sessionProvider = ChangeNotifierProvider((ref) => Session(ref.watch(repoProvider)));
