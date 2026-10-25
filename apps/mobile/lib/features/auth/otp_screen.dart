import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../data/api.dart';
import '../../state/session.dart';
import '../../theme.dart';
import '../../widgets/form.dart';
import 'phone_screen.dart';

class OtpScreen extends ConsumerStatefulWidget {
  const OtpScreen({super.key, required this.args});
  final OtpArgs args;

  @override
  ConsumerState<OtpScreen> createState() => _OtpScreenState();
}

class _OtpScreenState extends ConsumerState<OtpScreen> {
  final _code = TextEditingController();
  final _focus = FocusNode();
  String? _error;
  bool _notFound = false;
  bool _busy = false;
  String? _devOtp;
  int _resendIn = 30;
  Timer? _timer;

  @override
  void initState() {
    super.initState();
    _devOtp = widget.args.devOtp;
    _startTimer();
  }

  void _startTimer() {
    _timer?.cancel();
    setState(() => _resendIn = 30);
    _timer = Timer.periodic(const Duration(seconds: 1), (t) {
      if (_resendIn <= 1) t.cancel();
      if (mounted) setState(() => _resendIn--);
    });
  }

  @override
  void dispose() {
    _timer?.cancel();
    _code.dispose();
    _focus.dispose();
    super.dispose();
  }

  Future<void> _verify() async {
    if (_code.text.length != 6) {
      setState(() => _error = 'Enter the 6-digit code');
      return;
    }
    setState(() {
      _busy = true;
      _error = null;
      _notFound = false;
    });
    final session = ref.read(sessionProvider);
    try {
      await session.repo.verifyOtp(widget.args.e164, _code.text, login: widget.args.login);
      await session.resolve(); // the router moves on from here
    } on ApiException catch (e) {
      setState(() {
        _error = e.message;
        _notFound = e.code == 'ACCOUNT_NOT_FOUND';
      });
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _resend() async {
    try {
      final dev = await ref.read(sessionProvider).repo.requestOtp(widget.args.e164);
      setState(() => _devOtp = dev);
      _startTimer();
      if (mounted) showSnack(context, 'A new code has been sent');
    } on ApiException catch (e) {
      setState(() => _error = e.message);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(backgroundColor: NK.ivory, shape: const Border(), title: const SizedBox.shrink()),
      body: SafeArea(
        child: ListView(
          padding: const EdgeInsets.fromLTRB(24, 4, 24, 32),
          children: [
            Text('Enter your code', style: serif(34, color: NK.maroon)),
            const SizedBox(height: 6),
            Text.rich(
              TextSpan(
                text: 'We sent a 6-digit code to ',
                children: [TextSpan(text: '+91 ${widget.args.phone}', style: const TextStyle(fontWeight: FontWeight.w700, color: NK.ink))],
              ),
              style: const TextStyle(fontSize: 15, color: NK.muted),
            ),
            TextButton(
              style: TextButton.styleFrom(padding: EdgeInsets.zero, alignment: Alignment.centerLeft),
              onPressed: () => context.pop(),
              child: const Text('Change number'),
            ),
            const SizedBox(height: 18),
            if (_error != null) ErrorBanner(_error!),
            if (_notFound)
              Padding(
                padding: const EdgeInsets.only(bottom: 16),
                child: OutlinedButton(onPressed: () => context.go('/register'), child: const Text('Create a free profile instead')),
              ),
            _CodeBoxes(controller: _code, focus: _focus, onCompleted: _verify),
            if (_devOtp != null)
              Padding(
                padding: const EdgeInsets.only(top: 12),
                child: Text('Development code: $_devOtp', style: const TextStyle(fontSize: 12.5, color: NK.goldText, fontWeight: FontWeight.w600)),
              ),
            const SizedBox(height: 24),
            BusyButton(label: widget.args.login ? 'Verify & log in' : 'Verify & continue', busy: _busy, onPressed: _verify),
            const SizedBox(height: 16),
            Center(
              child: _resendIn > 0
                  ? Text('Resend code in ${_resendIn}s', style: const TextStyle(color: NK.muted))
                  : TextButton(onPressed: _resend, child: const Text('Resend code')),
            ),
          ],
        ),
      ),
    );
  }
}

// Six boxes over one hidden field, so paste and SMS autofill just work.
class _CodeBoxes extends StatelessWidget {
  const _CodeBoxes({required this.controller, required this.focus, required this.onCompleted});
  final TextEditingController controller;
  final FocusNode focus;
  final VoidCallback onCompleted;

  @override
  Widget build(BuildContext context) {
    return Stack(
      children: [
        Opacity(
          opacity: 0,
          child: TextField(
            controller: controller,
            focusNode: focus,
            autofocus: true,
            keyboardType: TextInputType.number,
            autofillHints: const [AutofillHints.oneTimeCode],
            maxLength: 6,
            inputFormatters: [FilteringTextInputFormatter.digitsOnly],
            onChanged: (v) {
              if (v.length == 6) onCompleted();
            },
          ),
        ),
        GestureDetector(
          onTap: () => focus.requestFocus(),
          child: ValueListenableBuilder(
            valueListenable: controller,
            builder: (context, value, _) {
              final digits = value.text;
              return Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  for (var i = 0; i < 6; i++)
                    Container(
                      width: 48,
                      height: 58,
                      alignment: Alignment.center,
                      decoration: BoxDecoration(
                        color: Colors.white,
                        borderRadius: BorderRadius.circular(14),
                        border: Border.all(color: i == digits.length ? NK.gold : NK.line, width: i == digits.length ? 1.6 : 1),
                      ),
                      child: Text(i < digits.length ? digits[i] : '', style: const TextStyle(fontSize: 24, fontWeight: FontWeight.w700)),
                    ),
                ],
              );
            },
          ),
        ),
      ],
    );
  }
}
