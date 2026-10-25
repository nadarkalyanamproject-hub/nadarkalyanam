import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../data/api.dart';
import '../../state/session.dart';
import '../../theme.dart';
import '../../widgets/form.dart';
import '../onboarding/profile_form.dart';
import '../onboarding/step_fields.dart';

// Edit one section of My Profile with the onboarding fields. Lifestyle saves
// on its own route; every other section resends the whole profile, as the
// website does, so nothing else changes.
class EditSectionScreen extends ConsumerStatefulWidget {
  const EditSectionScreen({super.key, required this.section});
  final String section; // basic | personal | location | additional | lifestyle

  @override
  ConsumerState<EditSectionScreen> createState() => _EditSectionScreenState();
}

class _EditSectionScreenState extends ConsumerState<EditSectionScreen> {
  late final ProfileForm form = ProfileForm.fromProfile(ref.read(sessionProvider).profile!);
  Map<String, String> errors = {};
  String? error;
  bool busy = false;

  static const _titles = {
    'basic': 'Basic details',
    'personal': 'Personal & religious',
    'location': 'Location & career',
    'additional': 'Family & about',
    'lifestyle': 'Lifestyle & habits',
  };

  ProfileStep? get _step => switch (widget.section) {
        'basic' => ProfileStep.basic,
        'personal' => ProfileStep.personal,
        'location' => ProfileStep.location,
        'additional' => ProfileStep.additional,
        _ => null,
      };

  Future<void> _save() async {
    final step = _step;
    final errs = step == null ? <String, String>{} : form.validate(step);
    setState(() {
      errors = errs;
      error = errs.isEmpty ? null : 'Please check the highlighted fields.';
    });
    if (errs.isNotEmpty) return;
    setState(() => busy = true);
    final session = ref.read(sessionProvider);
    try {
      final updated = step == null ? await session.repo.updateLifestyle(form.lifestyle) : await session.repo.updateProfile(form.toRequest());
      session.setProfile(updated);
      if (mounted) {
        showSnack(context, 'Saved');
        context.pop();
      }
    } on ApiException catch (e) {
      setState(() => error = e.message);
    } finally {
      if (mounted) setState(() => busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final session = ref.watch(sessionProvider);
    final locked = session.profile?.isVerified == true;
    void changed() => setState(() {});
    final fields = switch (widget.section) {
      'basic' => BasicFields(form: form, errors: errors, onChanged: changed, identityLocked: locked),
      'personal' => PersonalFields(form: form, errors: errors, onChanged: changed),
      'location' => LocationFields(form: form, errors: errors, onChanged: changed),
      'additional' => AdditionalFields(form: form, errors: errors, onChanged: changed),
      _ => LifestyleFields(form: form, onChanged: changed),
    };
    return Scaffold(
      appBar: AppBar(title: Text(_titles[widget.section] ?? 'Edit')),
      body: SafeArea(
        child: ListView(
          padding: const EdgeInsets.fromLTRB(20, 20, 20, 32),
          children: [
            if (error != null) ErrorBanner(error!),
            fields,
            const SizedBox(height: 8),
            BusyButton(label: 'Save', busy: busy, onPressed: _save),
            const SizedBox(height: 10),
            TextButton(onPressed: () => context.pop(), child: const Text('Cancel', style: TextStyle(color: NK.muted))),
          ],
        ),
      ),
    );
  }
}
