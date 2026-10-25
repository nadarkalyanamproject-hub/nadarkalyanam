import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../data/api.dart';
import '../../state/session.dart';
import '../../theme.dart';
import '../../widgets/form.dart';

// DigiLocker check before registration (accounts created after
// IDENTITY_VERIFICATION_REQUIRED_FROM). The provider's page opens in the
// browser; when the member comes back to the app we check the result.
class IdentityScreen extends ConsumerStatefulWidget {
  const IdentityScreen({super.key});

  @override
  ConsumerState<IdentityScreen> createState() => _IdentityScreenState();
}

class _IdentityScreenState extends ConsumerState<IdentityScreen> with WidgetsBindingObserver {
  bool _busy = false;
  bool _waitingForReturn = false;
  String? _error;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    super.dispose();
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.resumed && _waitingForReturn) {
      _waitingForReturn = false;
      _check();
    }
  }

  Future<void> _check() async {
    final session = ref.read(sessionProvider);
    final status = await session.repo.identityStatus();
    if (status.verified) {
      await session.resolve();
    } else if (mounted) {
      setState(() => _error = status.status == 'FAILED'
          ? 'DigiLocker could not confirm your identity. Please try again.'
          : 'We have not received a result from DigiLocker yet. Please try again.');
    }
  }

  Future<void> _start() async {
    setState(() {
      _busy = true;
      _error = null;
    });
    final session = ref.read(sessionProvider);
    try {
      final redirect = await session.repo.startIdentity();
      if (redirect.startsWith('/')) {
        // The development stub: it hands back its own reference to confirm.
        final reference = Uri.parse(redirect).queryParameters['reference'];
        if (reference == null) throw ApiException('Could not start the check.');
        await session.repo.completeIdentity(reference);
        await session.resolve();
      } else {
        _waitingForReturn = true;
        await launchUrl(Uri.parse(redirect), mode: LaunchMode.externalApplication);
      }
    } on ApiException catch (e) {
      setState(() => _error = e.message);
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: SafeArea(
        child: ListView(
          padding: const EdgeInsets.fromLTRB(24, 32, 24, 32),
          children: [
            Container(
              width: 64,
              height: 64,
              decoration: BoxDecoration(color: NK.butter, borderRadius: BorderRadius.circular(20), border: Border.all(color: NK.lineGold)),
              child: const Icon(Icons.verified_user_outlined, color: NK.maroon, size: 32),
            ),
            const SizedBox(height: 22),
            Text('Verify your identity', style: serif(34, color: NK.maroon)),
            const SizedBox(height: 10),
            const Text(
              'Every member confirms who they are with DigiLocker before creating a profile. It keeps Nadar Kalyanam safe for every family.',
              style: TextStyle(fontSize: 15, height: 1.55, color: NK.muted),
            ),
            const SizedBox(height: 22),
            const _Point(icon: Icons.badge_outlined, text: 'Your name and date of birth come from your ID, so they can’t be faked.'),
            const _Point(icon: Icons.lock_outline_rounded, text: 'We keep only your name and date of birth. Never your Aadhaar number or documents.'),
            const _Point(icon: Icons.timer_outlined, text: 'It takes about a minute.'),
            const SizedBox(height: 26),
            if (_error != null) ErrorBanner(_error!),
            BusyButton(label: 'Verify with DigiLocker', busy: _busy, onPressed: _start),
            const SizedBox(height: 12),
            TextButton(onPressed: () => ref.read(sessionProvider).signOut(), child: const Text('Log out')),
          ],
        ),
      ),
    );
  }
}

class _Point extends StatelessWidget {
  const _Point({required this.icon, required this.text});
  final IconData icon;
  final String text;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 14),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Icon(icon, size: 22, color: NK.gold),
          const SizedBox(width: 12),
          Expanded(child: Text(text, style: const TextStyle(fontSize: 14.5, height: 1.45))),
        ],
      ),
    );
  }
}
