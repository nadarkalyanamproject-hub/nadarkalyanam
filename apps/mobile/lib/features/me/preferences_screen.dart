import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../data/api.dart';
import '../../data/members.dart';
import '../../data/reference.dart';
import '../../state/session.dart';
import '../../theme.dart';
import '../../widgets/form.dart';
import '../../widgets/member.dart';

// What the member is looking for. Every preference ranks Matches; age,
// marital status and location can also be made must-haves, which filter.
class PreferencesScreen extends ConsumerStatefulWidget {
  const PreferencesScreen({super.key});

  @override
  ConsumerState<PreferencesScreen> createState() => _PreferencesScreenState();
}

class _PreferencesScreenState extends ConsumerState<PreferencesScreen> {
  PartnerPreferences? p;
  bool hadSaved = false;
  bool loading = true;
  bool saving = false;
  String? error;
  final cityInput = TextEditingController();

  @override
  void initState() {
    super.initState();
    _load();
  }

  @override
  void dispose() {
    cityInput.dispose();
    super.dispose();
  }

  Future<void> _load() async {
    try {
      final saved = await ref.read(repoProvider).partnerPreferences();
      if (!mounted) return;
      setState(() {
        hadSaved = saved != null;
        p = saved ?? PartnerPreferences();
      });
    } on ApiException catch (e) {
      if (mounted) setState(() => error = e.message);
    } finally {
      if (mounted) setState(() => loading = false);
    }
  }

  String? _check(PartnerPreferences p) {
    bool bad(num? a, num? b) => a != null && b != null && a > b;
    if (bad(p.ageMin, p.ageMax)) return 'Age: the minimum is more than the maximum.';
    if (bad(p.heightMinCm, p.heightMaxCm)) return 'Height: the minimum is more than the maximum.';
    if (bad(p.incomeMinLakhs, p.incomeMaxLakhs)) return 'Income: the minimum is more than the maximum.';
    if (p.mustHaveAge && p.ageMin == null && p.ageMax == null) return 'Set an age range to make it a must-have.';
    if (p.mustHaveMaritalStatus && p.maritalStatuses.isEmpty) return 'Choose a marital status to make it a must-have.';
    if (p.mustHaveLocation && p.states.isEmpty && p.cities.isEmpty) return 'Choose a state or city to make location a must-have.';
    return null;
  }

  Future<void> _save() async {
    final prefs = p!;
    final problem = _check(prefs);
    if (problem != null) return setState(() => error = problem);
    setState(() {
      saving = true;
      error = null;
    });
    try {
      await ref.read(repoProvider).savePartnerPreferences(prefs);
      if (!mounted) return;
      showSnack(context, 'Partner preferences saved');
      context.pop();
    } on ApiException catch (e) {
      if (mounted) setState(() => error = e.message);
    } finally {
      if (mounted) setState(() => saving = false);
    }
  }

  Future<void> _reset() async {
    final ok = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Clear your preferences?'),
        content: const Text('Matches will no longer be ranked by them.'),
        actions: [
          TextButton(onPressed: () => Navigator.pop(context, false), child: const Text('Cancel')),
          TextButton(onPressed: () => Navigator.pop(context, true), child: const Text('Clear')),
        ],
      ),
    );
    if (ok != true) return;
    try {
      await ref.read(repoProvider).resetPartnerPreferences();
      if (!mounted) return;
      setState(() {
        p = PartnerPreferences();
        hadSaved = false;
      });
      showSnack(context, 'Preferences cleared');
    } on ApiException catch (e) {
      if (mounted) showSnack(context, e.message);
    }
  }

  void _addCity() {
    final name = cityInput.text.trim().replaceAll(RegExp(r'\s+'), ' ');
    if (name.isEmpty || p!.cities.length >= 10) return;
    setState(() {
      if (!p!.cities.any((c) => c.toLowerCase() == name.toLowerCase())) p!.cities = [...p!.cities, name];
      cityInput.clear();
    });
  }

  @override
  Widget build(BuildContext context) {
    final prefs = p;
    String? n(num? v) => v == null ? null : (v % 1 == 0 ? '${v.toInt()}' : '$v');
    return Scaffold(
      appBar: AppBar(
        title: const Text('Partner preferences'),
        actions: [if (hadSaved) TextButton(onPressed: _reset, child: const Text('Clear'))],
      ),
      body: loading
          ? loadingSpinner
          : prefs == null
              ? ListView(children: [EmptyState(icon: Icons.cloud_off_rounded, title: 'Could not load', message: error)])
              : ListView(
                  padding: const EdgeInsets.fromLTRB(16, 18, 16, 32),
                  children: [
                    const Text(
                      'Tell us what you are looking for. Your matches are ranked by these, and members see how well they fit. Nobody else sees your preferences.',
                      style: TextStyle(color: NK.muted, height: 1.45),
                    ),
                    const SizedBox(height: 18),
                    if (error != null) ErrorBanner(error!),
                    _Group(
                      title: 'Age',
                      mustHave: prefs.mustHaveAge,
                      onMustHave: (v) => setState(() => prefs.mustHaveAge = v),
                      child: Row(
                        children: [
                          Expanded(
                            child: NkPicker(
                              label: 'From',
                              optional: true,
                              value: n(prefs.ageMin),
                              options: ageOptions,
                              onChanged: (v) => setState(() => prefs.ageMin = v == null ? null : int.parse(v)),
                            ),
                          ),
                          const SizedBox(width: 10),
                          Expanded(
                            child: NkPicker(
                              label: 'To',
                              optional: true,
                              value: n(prefs.ageMax),
                              options: ageOptions,
                              onChanged: (v) => setState(() => prefs.ageMax = v == null ? null : int.parse(v)),
                            ),
                          ),
                        ],
                      ),
                    ),
                    _Group(
                      title: 'Height',
                      child: Row(
                        children: [
                          Expanded(
                            child: NkPicker(
                              label: 'From',
                              optional: true,
                              value: n(prefs.heightMinCm),
                              options: heightCmOptions,
                              onChanged: (v) => setState(() => prefs.heightMinCm = v == null ? null : int.parse(v)),
                            ),
                          ),
                          const SizedBox(width: 10),
                          Expanded(
                            child: NkPicker(
                              label: 'To',
                              optional: true,
                              value: n(prefs.heightMaxCm),
                              options: heightCmOptions,
                              onChanged: (v) => setState(() => prefs.heightMaxCm = v == null ? null : int.parse(v)),
                            ),
                          ),
                        ],
                      ),
                    ),
                    _Group(
                      title: 'Marital status',
                      mustHave: prefs.mustHaveMaritalStatus,
                      onMustHave: (v) => setState(() => prefs.mustHaveMaritalStatus = v),
                      child: Padding(
                        padding: const EdgeInsets.only(bottom: 12),
                        child: ChoiceChips(
                          options: maritalStatuses.values.toList(),
                          selected: prefs.maritalStatuses.map((s) => maritalStatuses[s]!).toList(),
                          onChanged: (labels) => setState(() => prefs.maritalStatuses = [
                                for (final e in maritalStatuses.entries)
                                  if (labels.contains(e.value)) e.key,
                              ]),
                        ),
                      ),
                    ),
                    _Group(
                      title: 'Location',
                      mustHave: prefs.mustHaveLocation,
                      onMustHave: (v) => setState(() => prefs.mustHaveLocation = v),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          NkPicker(
                            label: 'Add a state',
                            optional: true,
                            value: null,
                            options: NkPicker.same(indiaStates.where((s) => !prefs.states.contains(s))),
                            onChanged: (v) => setState(() => prefs.states = [...prefs.states, ?v]),
                          ),
                          Row(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Expanded(
                                child: NkTextField(
                                  label: 'Add a city',
                                  optional: true,
                                  controller: cityInput,
                                  hintText: 'e.g. Tirunelveli',
                                  hint: 'Up to 10 cities',
                                ),
                              ),
                              Padding(
                                padding: const EdgeInsets.only(top: 30, left: 6),
                                child: IconButton.filledTonal(onPressed: _addCity, icon: const Icon(Icons.add_rounded)),
                              ),
                            ],
                          ),
                          if (prefs.states.isEmpty && prefs.cities.isEmpty)
                            const Padding(
                              padding: EdgeInsets.only(bottom: 12),
                              child: Text('None chosen: anywhere.', style: TextStyle(color: NK.muted)),
                            ),
                          Wrap(
                            spacing: 8,
                            runSpacing: 8,
                            children: [
                              for (final s in prefs.states)
                                InputChip(label: Text(s), onDeleted: () => setState(() => prefs.states = prefs.states.where((x) => x != s).toList())),
                              for (final c in prefs.cities)
                                InputChip(label: Text(c), onDeleted: () => setState(() => prefs.cities = prefs.cities.where((x) => x != c).toList())),
                            ],
                          ),
                          const SizedBox(height: 12),
                        ],
                      ),
                    ),
                    _Group(
                      title: 'Annual income',
                      child: Row(
                        children: [
                          Expanded(
                            child: NkPicker(
                              label: 'From',
                              optional: true,
                              value: n(prefs.incomeMinLakhs),
                              options: incomeLakhOptions,
                              onChanged: (v) => setState(() => prefs.incomeMinLakhs = v == null ? null : double.parse(v)),
                            ),
                          ),
                          const SizedBox(width: 10),
                          Expanded(
                            child: NkPicker(
                              label: 'To',
                              optional: true,
                              value: n(prefs.incomeMaxLakhs),
                              options: incomeLakhOptions,
                              onChanged: (v) => setState(() => prefs.incomeMaxLakhs = v == null ? null : double.parse(v)),
                            ),
                          ),
                        ],
                      ),
                    ),
                    _Group(
                      title: 'Dosham',
                      child: NkPicker(
                        label: 'Their dosham',
                        value: prefs.doshamPreference,
                        options: doshamPreferences,
                        onChanged: (v) => setState(() => prefs.doshamPreference = v ?? 'DOESNT_MATTER'),
                      ),
                    ),
                    const SizedBox(height: 8),
                    BusyButton(label: 'Save preferences', busy: saving, onPressed: _save),
                  ],
                ),
    );
  }
}

class _Group extends StatelessWidget {
  const _Group({required this.title, required this.child, this.mustHave, this.onMustHave});
  final String title;
  final Widget child;
  final bool? mustHave;
  final ValueChanged<bool>? onMustHave;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 12),
      child: NkCard(
        padding: const EdgeInsets.fromLTRB(16, 12, 16, 4),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Expanded(child: Text(title, style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 16, color: NK.maroon))),
                if (mustHave != null) ...[
                  const Text('Must-have', style: TextStyle(fontSize: 12.5, color: NK.muted)),
                  Switch(value: mustHave!, activeThumbColor: NK.maroon, onChanged: onMustHave),
                ],
              ],
            ),
            const SizedBox(height: 6),
            child,
          ],
        ),
      ),
    );
  }
}
