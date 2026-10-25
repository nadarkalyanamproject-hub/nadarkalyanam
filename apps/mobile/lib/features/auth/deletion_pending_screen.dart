import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';

import '../../data/api.dart';
import '../../state/session.dart';
import '../../theme.dart';
import '../../widgets/form.dart';

// Shown to a member who asked to delete their account and signs in again
// within the 14 days: keep it deleted, or cancel and come back.
class DeletionPendingScreen extends ConsumerStatefulWidget {
  const DeletionPendingScreen({super.key});

  @override
  ConsumerState<DeletionPendingScreen> createState() => _DeletionPendingScreenState();
}

class _DeletionPendingScreenState extends ConsumerState<DeletionPendingScreen> {
  bool _busy = false;
  String? _error;

  Future<void> _cancel() async {
    setState(() => _busy = true);
    final session = ref.read(sessionProvider);
    try {
      await session.repo.cancelDeletion();
      await session.resolve();
    } on ApiException catch (e) {
      setState(() => _error = e.message);
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final session = ref.watch(sessionProvider);
    final when = session.account?.deletionScheduledAt;
    return Scaffold(
      body: SafeArea(
        child: ListView(
          padding: const EdgeInsets.fromLTRB(24, 40, 24, 32),
          children: [
            const Icon(Icons.event_busy_outlined, size: 44, color: NK.maroon),
            const SizedBox(height: 18),
            Text('Your account is being deleted', style: serif(32, color: NK.maroon)),
            const SizedBox(height: 10),
            Text(
              when == null
                  ? 'You asked us to delete your account. Your profile is hidden from everyone.'
                  : 'You asked us to delete your account. Your profile is hidden from everyone, and everything will be permanently deleted on ${DateFormat('dd-MM-yyyy').format(when.toLocal())}.',
              style: const TextStyle(fontSize: 15, height: 1.55, color: NK.muted),
            ),
            const SizedBox(height: 26),
            if (_error != null) ErrorBanner(_error!),
            BusyButton(label: 'Keep my account', busy: _busy, onPressed: _cancel),
            const SizedBox(height: 12),
            OutlinedButton(onPressed: () => session.signOut(), child: const Text('Log out')),
          ],
        ),
      ),
    );
  }
}
