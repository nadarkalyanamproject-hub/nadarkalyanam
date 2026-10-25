import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../data/api.dart';
import '../../data/reference.dart';
import '../../state/session.dart';
import '../../theme.dart';
import '../../widgets/form.dart';
import '../../widgets/logo.dart';

// What the code screen needs to finish signing in.
class OtpArgs {
  OtpArgs({required this.phone, required this.login, this.devOtp});
  final String phone; // 10 digits, India
  final bool login;
  final String? devOtp;
  String get e164 => '+91$phone';
}

// Register (who the profile is for, their name, the mobile number) or log in
// (just the number). Both continue to the code screen.
class PhoneScreen extends ConsumerStatefulWidget {
  const PhoneScreen({super.key, required this.login});
  final bool login;

  @override
  ConsumerState<PhoneScreen> createState() => _PhoneScreenState();
}

class _PhoneScreenState extends ConsumerState<PhoneScreen> {
  final _phone = TextEditingController();
  final _name = TextEditingController();
  String? _profileFor;
  String? _gender;
  final _errors = <String, String>{};
  String? _formError;
  bool _busy = false;

  bool get _asksGender => _profileFor != null && genderFor(_profileFor!) == null;

  @override
  void dispose() {
    _phone.dispose();
    _name.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    final errors = <String, String>{};
    if (!widget.login) {
      if (_profileFor == null) errors['profileFor'] = 'Choose who this profile is for';
      if (_name.text.trim().length < 2) errors['name'] = 'Enter at least 2 characters';
      if (_asksGender && _gender == null) errors['gender'] = 'Choose a gender';
    }
    if (!RegExp(r'^[6-9]\d{9}$').hasMatch(_phone.text)) errors['phone'] = 'Enter a valid 10-digit mobile number';
    setState(() {
      _errors
        ..clear()
        ..addAll(errors);
      _formError = null;
    });
    if (errors.isNotEmpty) return;

    setState(() => _busy = true);
    try {
      final session = ref.read(sessionProvider);
      final devOtp = await session.repo.requestOtp('+91${_phone.text}');
      if (!widget.login) {
        session.prefillName = _name.text.trim();
        session.prefillGender = _gender ?? genderFor(_profileFor!);
        session.prefillProfileFor = profileForKeys[_profileFor!];
      }
      if (!mounted) return;
      context.push('/otp', extra: OtpArgs(phone: _phone.text, login: widget.login, devOtp: devOtp));
    } on ApiException catch (e) {
      setState(() => _formError = e.message);
    } finally {
      if (mounted) setState(() => _busy = false);
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
            const Align(alignment: Alignment.centerLeft, child: LogoMark(height: 52)),
            const SizedBox(height: 18),
            Text(widget.login ? 'Log in' : 'Create your profile', style: serif(34, color: NK.maroon)),
            const SizedBox(height: 6),
            Text(
              widget.login
                  ? 'Use the mobile number you registered with.'
                  : 'Free to register. It takes a few minutes.',
              style: const TextStyle(fontSize: 15, color: NK.muted),
            ),
            const SizedBox(height: 28),
            if (_formError != null) ErrorBanner(_formError!),
            if (!widget.login) ...[
              FieldShell(
                label: 'This profile is for',
                error: _errors['profileFor'],
                child: Wrap(
                  spacing: 8,
                  runSpacing: 8,
                  children: [
                    for (final option in profileForOptions)
                      ChoiceChip(
                        label: Text(option),
                        selected: _profileFor == option,
                        showCheckmark: false,
                        onSelected: (_) => setState(() {
                          _profileFor = option;
                          _gender = null;
                        }),
                        labelStyle: TextStyle(
                          color: _profileFor == option ? Colors.white : NK.ink,
                          fontWeight: FontWeight.w600,
                        ),
                        selectedColor: NK.maroon,
                        backgroundColor: Colors.white,
                        side: BorderSide(color: _profileFor == option ? NK.maroon : NK.line),
                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(999)),
                      ),
                  ],
                ),
              ),
              if (_asksGender)
                NkPicker(
                  label: 'Gender',
                  value: _gender,
                  options: const {'MALE': 'Male', 'FEMALE': 'Female'},
                  error: _errors['gender'],
                  onChanged: (v) => setState(() => _gender = v),
                ),
              NkTextField(
                label: _profileFor == null || _profileFor == 'Myself' ? 'Your full name' : 'Their full name',
                controller: _name,
                hintText: 'Full name',
                error: _errors['name'],
              ),
            ],
            NkTextField(
              label: 'Mobile number',
              controller: _phone,
              hintText: '10-digit mobile number',
              keyboardType: TextInputType.phone,
              maxLength: 10,
              inputFormatters: [FilteringTextInputFormatter.digitsOnly],
              error: _errors['phone'],
              hint: "We'll send a one-time code. No password needed.",
              prefix: const Padding(
                padding: EdgeInsets.only(left: 14, right: 8),
                child: Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Text('🇮🇳', style: TextStyle(fontSize: 18)),
                    SizedBox(width: 6),
                    Text('+91', style: TextStyle(fontSize: 16, fontWeight: FontWeight.w600, color: NK.ink)),
                  ],
                ),
              ),
            ),
            const SizedBox(height: 6),
            BusyButton(label: 'Send code', icon: Icons.arrow_forward_rounded, busy: _busy, onPressed: _submit),
            const SizedBox(height: 20),
            Center(
              child: TextButton(
                onPressed: () => context.pushReplacement(widget.login ? '/register' : '/login'),
                child: Text(widget.login ? 'New here? Create a free profile' : 'Already registered? Log in'),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
