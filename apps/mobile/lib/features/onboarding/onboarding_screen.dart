import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../data/api.dart';
import '../../state/session.dart';
import '../../theme.dart';
import '../../widgets/form.dart';
import '../photos/photos_manager.dart';
import 'profile_form.dart';
import 'step_fields.dart';

// Four steps, then the profile is created, then photos.
class OnboardingScreen extends ConsumerStatefulWidget {
  const OnboardingScreen({super.key});

  @override
  ConsumerState<OnboardingScreen> createState() => _OnboardingScreenState();
}

const _titles = ['Basic details', 'Personal & religious', 'Location & career', 'Family & about you', 'Add your photos'];
const _subtitles = [
  'Who this profile is for',
  'A little more about them',
  'Where they live and work',
  'Family, a few words, and lifestyle',
  'Profiles with photos get far more interest',
];

class _OnboardingScreenState extends ConsumerState<OnboardingScreen> {
  final form = ProfileForm();
  int step = 0;
  Map<String, String> errors = {};
  String? formError;
  bool busy = false;
  final _scroll = ScrollController();

  bool get _identityLocked => ref.read(sessionProvider).identity?.verified == true && ref.read(sessionProvider).identity?.name != null;

  @override
  void initState() {
    super.initState();
    final session = ref.read(sessionProvider);
    final identity = session.identity;
    form.fullName = identity?.name ?? session.prefillName ?? '';
    form.dateOfBirth = identity?.dateOfBirth?.substring(0, 10) ?? '';
    form.gender = session.prefillGender ?? '';
    form.profileFor = session.prefillProfileFor;
  }

  @override
  void dispose() {
    _scroll.dispose();
    super.dispose();
  }

  void _toTop() {
    if (_scroll.hasClients) _scroll.jumpTo(0);
  }

  Future<void> _next() async {
    final errs = form.validate(ProfileStep.values[step]);
    setState(() {
      errors = errs;
      formError = errs.isEmpty ? null : 'Please check the highlighted fields.';
    });
    if (errs.isNotEmpty) return;
    if (step < 3) {
      setState(() => step++);
      _toTop();
      return;
    }
    // Step 4 done: create the profile.
    setState(() => busy = true);
    try {
      final session = ref.read(sessionProvider);
      await session.repo.createProfile(form.toRequest());
      await session.refreshProfile();
      setState(() {
        step = 4;
        formError = null;
      });
      _toTop();
    } on ApiException catch (e) {
      setState(() => formError = e.message);
    } finally {
      if (mounted) setState(() => busy = false);
    }
  }

  void _back() {
    if (step > 0 && step < 4) {
      setState(() {
        step--;
        errors = {};
        formError = null;
      });
      _toTop();
    }
  }

  Widget _fields() {
    void changed() => setState(() {});
    return switch (step) {
      0 => BasicFields(form: form, errors: errors, onChanged: changed, identityLocked: _identityLocked),
      1 => PersonalFields(form: form, errors: errors, onChanged: changed),
      2 => LocationFields(form: form, errors: errors, onChanged: changed),
      3 => Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            AdditionalFields(form: form, errors: errors, onChanged: changed),
            const SizedBox(height: 8),
            const Divider(),
            const SizedBox(height: 18),
            const Text('Lifestyle & habits', style: TextStyle(fontSize: 17, fontWeight: FontWeight.w700)),
            const SizedBox(height: 4),
            const Text('Optional. You can add or change these later.', style: TextStyle(fontSize: 13, color: NK.muted)),
            const SizedBox(height: 16),
            LifestyleFields(form: form, onChanged: changed),
          ],
        ),
      _ => PhotosManager(onDone: () => ref.read(sessionProvider).resolve()),
    };
  }

  @override
  Widget build(BuildContext context) {
    return PopScope(
      canPop: step == 0,
      onPopInvokedWithResult: (didPop, _) {
        if (!didPop) _back();
      },
      child: Scaffold(
        appBar: AppBar(
          backgroundColor: NK.ivory,
          shape: const Border(),
          leading: step > 0 && step < 4 ? IconButton(icon: const Icon(Icons.arrow_back_rounded), onPressed: _back) : null,
          automaticallyImplyLeading: false,
          title: Text('Step ${step + 1} of 5', style: const TextStyle(fontSize: 14, color: NK.muted, fontWeight: FontWeight.w600)),
          actions: [
            if (step == 0)
              TextButton(onPressed: () => ref.read(sessionProvider).signOut(), child: const Text('Log out')),
          ],
          bottom: PreferredSize(
            preferredSize: const Size.fromHeight(4),
            child: TweenAnimationBuilder<double>(
              tween: Tween(end: (step + 1) / 5),
              duration: const Duration(milliseconds: 350),
              builder: (_, v, _) => LinearProgressIndicator(value: v, minHeight: 4, color: NK.gold, backgroundColor: NK.line),
            ),
          ),
        ),
        body: SafeArea(
          child: ListView(
            controller: _scroll,
            padding: const EdgeInsets.fromLTRB(22, 20, 22, 32),
            children: [
              Text(_titles[step], style: serif(30, color: NK.maroon)),
              const SizedBox(height: 4),
              Text(_subtitles[step], style: const TextStyle(fontSize: 14.5, color: NK.muted)),
              const SizedBox(height: 24),
              if (formError != null) ErrorBanner(formError!),
              _fields(),
              if (step < 4) ...[
                const SizedBox(height: 10),
                BusyButton(
                  label: step == 3 ? 'Create my profile' : 'Continue',
                  icon: step == 3 ? null : Icons.arrow_forward_rounded,
                  busy: busy,
                  onPressed: _next,
                ),
              ],
            ],
          ),
        ),
      ),
    );
  }
}
