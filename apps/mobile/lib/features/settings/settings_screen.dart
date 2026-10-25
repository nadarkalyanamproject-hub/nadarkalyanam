import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../config.dart';
import '../../data/api.dart';
import '../../data/reference.dart';
import '../../state/session.dart';
import '../../theme.dart';
import '../../widgets/form.dart';

final _sessionsProvider = FutureProvider.autoDispose<int>((ref) => ref.watch(repoProvider).activeSessions());
final _supportProvider = FutureProvider.autoDispose((ref) => ref.watch(repoProvider).supportContact());

class SettingsScreen extends ConsumerStatefulWidget {
  const SettingsScreen({super.key});

  @override
  ConsumerState<SettingsScreen> createState() => _SettingsScreenState();
}

class _SettingsScreenState extends ConsumerState<SettingsScreen> {
  bool _saving = false;

  Future<void> _run(Future<void> Function() action, {String? done}) async {
    setState(() => _saving = true);
    try {
      await action();
      if (done != null && mounted) showSnack(context, done);
    } on ApiException catch (e) {
      if (mounted) showSnack(context, e.message);
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  Future<bool> _confirm(String title, String body, String action, {bool danger = false}) async {
    final ok = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: Text(title),
        content: Text(body),
        actions: [
          TextButton(onPressed: () => Navigator.pop(context, false), child: const Text('Cancel')),
          FilledButton(
            style: FilledButton.styleFrom(minimumSize: const Size(0, 44), backgroundColor: danger ? NK.error : NK.maroon),
            onPressed: () => Navigator.pop(context, true),
            child: Text(action),
          ),
        ],
      ),
    );
    return ok == true;
  }

  @override
  Widget build(BuildContext context) {
    final session = ref.watch(sessionProvider);
    final p = session.profile;
    final sessions = ref.watch(_sessionsProvider);
    final support = ref.watch(_supportProvider);

    return Scaffold(
      appBar: AppBar(title: const Text('Settings')),
      body: AbsorbPointer(
        absorbing: _saving,
        child: ListView(
          padding: const EdgeInsets.fromLTRB(16, 18, 16, 40),
          children: [
            const _Heading('Privacy'),
            NkCard(
              padding: EdgeInsets.zero,
              child: Column(
                children: [
                  SwitchListTile(
                    activeThumbColor: NK.maroon,
                    title: const Text('Show my profile', style: TextStyle(fontWeight: FontWeight.w600)),
                    subtitle: const Text('Turn off to hide from browse, search and matches.'),
                    value: p?.visibility != 'HIDDEN',
                    onChanged: p == null
                        ? null
                        : (on) => _run(() async => session.setProfile(await session.repo.setVisibility(on ? 'PUBLIC' : 'HIDDEN'))),
                  ),
                  const Divider(indent: 16, endIndent: 16),
                  SwitchListTile(
                    activeThumbColor: NK.maroon,
                    title: const Text('Share my phone number', style: TextStyle(fontWeight: FontWeight.w600)),
                    subtitle: const Text('Only with members you are connected with (both sides accepted an interest).'),
                    value: p?.phoneVisibility == 'CONNECTED',
                    onChanged: p == null
                        ? null
                        : (on) => _run(() async => session.setProfile(await session.repo.setPhoneVisibility(on ? 'CONNECTED' : 'NEVER'))),
                  ),
                ],
              ),
            ),
            const _Heading('Signed-in devices'),
            NkCard(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Text('You stay signed in on this phone until you log out.', style: TextStyle(color: NK.muted)),
                  const SizedBox(height: 10),
                  sessions.when(
                    loading: () => const Text('Loading…'),
                    error: (e, _) => Text('$e', style: const TextStyle(color: NK.error)),
                    data: (count) {
                      final others = count - 1;
                      return Column(
                        crossAxisAlignment: CrossAxisAlignment.stretch,
                        children: [
                          Text(
                            others <= 0 ? 'Only this device is signed in.' : 'This phone and $others other ${others == 1 ? 'device' : 'devices'} are signed in.',
                            style: const TextStyle(fontWeight: FontWeight.w600),
                          ),
                          if (others > 0) ...[
                            const SizedBox(height: 12),
                            OutlinedButton(
                              onPressed: _saving
                                  ? null
                                  : () => _run(() async {
                                        final sent = await session.repo.requestLogoutOthersOtp();
                                        if (!context.mounted) return;
                                        final n = await showDialog<int>(
                                          context: context,
                                          builder: (_) => _LogoutOthersDialog(sentTo: sent.sentTo, devOtp: sent.devOtp),
                                        );
                                        if (n == null) return;
                                        ref.invalidate(_sessionsProvider);
                                        if (context.mounted) showSnack(context, 'Logged out of $n other ${n == 1 ? 'device' : 'devices'}');
                                      }),
                              child: const Text('Log out of all other devices'),
                            ),
                          ],
                        ],
                      );
                    },
                  ),
                ],
              ),
            ),
            const _Heading('Help'),
            NkCard(
              padding: EdgeInsets.zero,
              child: Column(
                children: [
                  ...support.maybeWhen(
                    data: (c) => [
                      if (c.whatsapp != null)
                        ListTile(
                          leading: const Icon(Icons.chat_outlined, color: NK.maroon),
                          title: const Text('WhatsApp us'),
                          subtitle: Text('+${c.whatsapp}'),
                          onTap: () => launchUrl(Uri.parse('https://wa.me/${c.whatsapp}'), mode: LaunchMode.externalApplication),
                        ),
                      if (c.email != null)
                        ListTile(
                          leading: const Icon(Icons.mail_outline_rounded, color: NK.maroon),
                          title: const Text('Email us'),
                          subtitle: Text(c.email!),
                          onTap: () => launchUrl(Uri.parse('mailto:${c.email}')),
                        ),
                    ],
                    orElse: () => const <Widget>[],
                  ),
                  ListTile(
                    leading: const Icon(Icons.place_outlined, color: NK.maroon),
                    title: const Text('Our office'),
                    subtitle: Text(officeAddress.skip(1).join('\n')),
                    isThreeLine: true,
                    onTap: () => launchUrl(
                      Uri.parse('https://www.google.com/maps/search/?api=1&query=${Uri.encodeComponent(officeAddress.skip(1).join(', '))}'),
                      mode: LaunchMode.externalApplication,
                    ),
                  ),
                  ListTile(
                    leading: const Icon(Icons.privacy_tip_outlined, color: NK.maroon),
                    title: const Text('Privacy policy'),
                    onTap: () => launchUrl(Uri.parse('${AppConfig.webBaseUrl}/privacy'), mode: LaunchMode.externalApplication),
                  ),
                  ListTile(
                    leading: const Icon(Icons.description_outlined, color: NK.maroon),
                    title: const Text('Terms & conditions'),
                    onTap: () => launchUrl(Uri.parse('${AppConfig.webBaseUrl}/terms'), mode: LaunchMode.externalApplication),
                  ),
                ],
              ),
            ),
            const _Heading('Account'),
            NkCard(
              padding: EdgeInsets.zero,
              child: Column(
                children: [
                  ListTile(
                    leading: const Icon(Icons.logout_rounded, color: NK.maroon),
                    title: const Text('Log out'),
                    onTap: () async {
                      if (await _confirm('Log out?', 'You can log back in any time with your mobile number.', 'Log out')) {
                        await session.signOut();
                      }
                    },
                  ),
                  const Divider(indent: 16, endIndent: 16),
                  ListTile(
                    leading: const Icon(Icons.delete_outline_rounded, color: NK.error),
                    title: const Text('Delete my account', style: TextStyle(color: NK.error)),
                    subtitle: const Text('Hidden at once, permanently deleted after 14 days.'),
                    onTap: () async {
                      final ok = await _confirm(
                        'Delete your account?',
                        'Your profile will be hidden from everyone straight away and you will be logged out on all devices. '
                            'Everything is permanently deleted after 14 days. Until then you can log in and keep your account.',
                        'Delete account',
                        danger: true,
                      );
                      if (!ok || !context.mounted) return;
                      // The snack outlives this screen (signing out leaves it).
                      final messenger = ScaffoldMessenger.of(context);
                      await _run(() async {
                        final status = await session.repo.deleteAccount();
                        final when = status.deletionScheduledAt;
                        if (when != null) {
                          messenger.showSnackBar(SnackBar(
                            content: Text('Your account will be deleted on ${DateFormat('dd-MM-yyyy').format(when.toLocal())}'),
                          ));
                        }
                        await session.signOut();
                      });
                    },
                  ),
                ],
              ),
            ),
            const SizedBox(height: 24),
            const Center(child: Text('Nadar Kalyanam · Strictly for matrimonial purposes', style: TextStyle(fontSize: 12, color: NK.subtle))),
          ],
        ),
      ),
    );
  }
}

class _Heading extends StatelessWidget {
  const _Heading(this.text);
  final String text;

  @override
  Widget build(BuildContext context) => Padding(
        padding: const EdgeInsets.fromLTRB(4, 18, 4, 10),
        child: Text(text.toUpperCase(), style: const TextStyle(fontSize: 12, letterSpacing: 1.6, fontWeight: FontWeight.w700, color: NK.goldText)),
      );
}

// Asks for the code sent to the registered number, then logs out every other
// device. Pops with how many were logged out, or null when cancelled.
class _LogoutOthersDialog extends ConsumerStatefulWidget {
  const _LogoutOthersDialog({required this.sentTo, this.devOtp});
  final String sentTo;
  final String? devOtp;

  @override
  ConsumerState<_LogoutOthersDialog> createState() => _LogoutOthersDialogState();
}

class _LogoutOthersDialogState extends ConsumerState<_LogoutOthersDialog> {
  final _code = TextEditingController();
  String? _error;
  bool _busy = false;

  @override
  void dispose() {
    _code.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      final n = await ref.read(repoProvider).logoutOtherDevices(_code.text);
      if (mounted) Navigator.pop(context, n);
    } on ApiException catch (e) {
      // A wrong or expired code keeps the dialog open to try again.
      if (mounted) setState(() => _error = e.message);
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return AlertDialog(
      title: const Text('Log out other devices?'),
      content: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text('Enter the 6-digit code sent to ${widget.sentTo}. You will stay signed in on this phone.'),
          if (widget.devOtp != null) ...[
            const SizedBox(height: 6),
            Text('Development code: ${widget.devOtp}', style: const TextStyle(fontSize: 12.5, color: NK.goldText, fontWeight: FontWeight.w600)),
          ],
          const SizedBox(height: 12),
          TextField(
            controller: _code,
            autofocus: true,
            keyboardType: TextInputType.number,
            maxLength: 6,
            decoration: InputDecoration(hintText: '6-digit code', counterText: '', errorText: _error),
            onChanged: (_) => setState(() {}),
          ),
        ],
      ),
      actions: [
        TextButton(onPressed: _busy ? null : () => Navigator.pop(context), child: const Text('Cancel')),
        FilledButton(
          style: FilledButton.styleFrom(minimumSize: const Size(0, 44), backgroundColor: NK.maroon),
          onPressed: _busy || _code.text.length != 6 ? null : _submit,
          child: Text(_busy ? 'Please wait…' : 'Log them out'),
        ),
      ],
    );
  }
}
