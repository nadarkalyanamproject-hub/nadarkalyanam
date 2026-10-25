import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:image_picker/image_picker.dart';

import '../../data/api.dart';
import '../../data/members.dart';
import '../../data/reference.dart';
import '../../state/session.dart';
import '../../theme.dart';
import '../../widgets/form.dart';
import '../../widgets/member.dart';

// The member's horoscope (jathagam): every detail optional, hidden until
// they choose who can see it. Birth time and place are shared only if
// they also turn that on.
class HoroscopeScreen extends ConsumerStatefulWidget {
  const HoroscopeScreen({super.key});

  @override
  ConsumerState<HoroscopeScreen> createState() => _HoroscopeScreenState();
}

class _HoroscopeScreenState extends ConsumerState<HoroscopeScreen> {
  MyHoroscope? h;
  bool loading = true;
  bool saving = false;
  bool uploading = false;
  String? error;
  final birthCity = TextEditingController();
  final birthCountry = TextEditingController();

  @override
  void initState() {
    super.initState();
    _load();
  }

  @override
  void dispose() {
    birthCity.dispose();
    birthCountry.dispose();
    super.dispose();
  }

  Future<void> _load() async {
    try {
      final saved = await ref.read(repoProvider).horoscope();
      if (!mounted) return;
      setState(() {
        h = saved ?? MyHoroscope(birthCountry: 'India');
        birthCity.text = h!.birthCity ?? '';
        birthCountry.text = h!.birthCountry ?? '';
      });
    } on ApiException catch (e) {
      if (mounted) setState(() => error = e.message);
    } finally {
      if (mounted) setState(() => loading = false);
    }
  }

  Future<void> _pickTime() async {
    final parts = h!.birthTime?.split(':');
    final picked = await showTimePicker(
      context: context,
      initialTime: parts == null ? const TimeOfDay(hour: 6, minute: 0) : TimeOfDay(hour: int.parse(parts[0]), minute: int.parse(parts[1])),
    );
    if (picked == null) return;
    String two(int v) => v.toString().padLeft(2, '0');
    setState(() => h!.birthTime = '${two(picked.hour)}:${two(picked.minute)}');
  }

  Future<void> _save() async {
    final x = h!;
    x.birthCity = birthCity.text.trim().isEmpty ? null : birthCity.text.trim();
    x.birthCountry = birthCountry.text.trim().isEmpty ? null : birthCountry.text.trim();
    if (x.nakshatraPada != null && x.nakshatra == null) return setState(() => error = 'Choose the nakshatra first.');
    if (x.birthState != null && x.birthCountry != null && x.birthCountry!.toLowerCase() != 'india') {
      return setState(() => error = 'State applies to India only.');
    }
    setState(() {
      saving = true;
      error = null;
    });
    try {
      await ref.read(repoProvider).saveHoroscope(x);
      if (!mounted) return;
      showSnack(context, 'Horoscope saved');
      context.pop();
    } on ApiException catch (e) {
      if (mounted) setState(() => error = e.message);
    } finally {
      if (mounted) setState(() => saving = false);
    }
  }

  Future<void> _uploadChart() async {
    final file = await ImagePicker().pickImage(source: ImageSource.gallery, maxWidth: 2000, maxHeight: 2000, imageQuality: 88);
    if (file == null) return;
    final name = file.name.toLowerCase();
    final type = file.mimeType ?? (name.endsWith('.png') ? 'image/png' : name.endsWith('.webp') ? 'image/webp' : 'image/jpeg');
    setState(() => uploading = true);
    try {
      // The chart hangs off a saved horoscope, so save the form first.
      await ref.read(repoProvider).saveHoroscope(h!);
      await ref.read(repoProvider).uploadHoroscopeChart(await file.readAsBytes(), type);
      if (!mounted) return;
      showSnack(context, 'Chart added. Our team will review it shortly.');
      setState(() => loading = true);
      await _load();
    } on ApiException catch (e) {
      if (mounted) showSnack(context, e.message);
    } finally {
      if (mounted) setState(() => uploading = false);
    }
  }

  Future<void> _deleteChart() async {
    try {
      await ref.read(repoProvider).deleteHoroscopeChart();
      if (!mounted) return;
      setState(() => loading = true);
      await _load();
    } on ApiException catch (e) {
      if (mounted) showSnack(context, e.message);
    }
  }

  @override
  Widget build(BuildContext context) {
    final x = h;
    return Scaffold(
      appBar: AppBar(title: const Text('Horoscope')),
      body: loading
          ? loadingSpinner
          : x == null
              ? ListView(children: [EmptyState(icon: Icons.cloud_off_rounded, title: 'Could not load', message: error)])
              : ListView(
                  padding: const EdgeInsets.fromLTRB(16, 18, 16, 32),
                  children: [
                    if (error != null) ErrorBanner(error!),
                    NkCard(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          NkPicker(
                            label: 'Who can see it',
                            value: x.visibility,
                            options: horoscopeVisibilities,
                            onChanged: (v) => setState(() => x.visibility = v ?? 'HIDDEN'),
                          ),
                          SwitchListTile(
                            contentPadding: EdgeInsets.zero,
                            activeThumbColor: NK.maroon,
                            value: x.shareBirthDetails,
                            onChanged: (v) => setState(() => x.shareBirthDetails = v),
                            title: const Text('Also share birth time and place', style: TextStyle(fontWeight: FontWeight.w600)),
                            subtitle: const Text('Off: members see your stars but not when or where you were born.'),
                          ),
                        ],
                      ),
                    ),
                    const SizedBox(height: 12),
                    NkCard(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          NkPicker(label: 'Rasi', optional: true, value: x.rasi, options: rasis, onChanged: (v) => setState(() => x.rasi = v)),
                          NkPicker(
                            label: 'Nakshatra',
                            optional: true,
                            value: x.nakshatra,
                            options: nakshatras,
                            onChanged: (v) => setState(() {
                              x.nakshatra = v;
                              if (v == null) x.nakshatraPada = null;
                            }),
                          ),
                          NkPicker(
                            label: 'Pada',
                            optional: true,
                            enabled: x.nakshatra != null,
                            value: x.nakshatraPada?.toString(),
                            options: const {'1': '1', '2': '2', '3': '3', '4': '4'},
                            onChanged: (v) => setState(() => x.nakshatraPada = v == null ? null : int.parse(v)),
                          ),
                          NkPicker(label: 'Lagnam', optional: true, value: x.lagnam, options: rasis, onChanged: (v) => setState(() => x.lagnam = v)),
                          NkPicker(
                            label: 'Sevvai dosham',
                            optional: true,
                            value: x.sevvaiDosham,
                            options: doshamOptions,
                            onChanged: (v) => setState(() => x.sevvaiDosham = v),
                          ),
                          NkPicker(
                            label: 'Ragu/Kethu dosham',
                            optional: true,
                            value: x.raguKethuDosham,
                            options: doshamOptions,
                            onChanged: (v) => setState(() => x.raguKethuDosham = v),
                          ),
                        ],
                      ),
                    ),
                    const SizedBox(height: 12),
                    NkCard(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          FieldShell(
                            label: 'Birth time',
                            optional: true,
                            child: InkWell(
                              borderRadius: BorderRadius.circular(14),
                              onTap: _pickTime,
                              child: InputDecorator(
                                isEmpty: x.birthTime == null,
                                decoration: InputDecoration(
                                  hintText: 'Select',
                                  suffixIcon: x.birthTime == null
                                      ? const Icon(Icons.schedule_rounded, color: NK.muted)
                                      : IconButton(onPressed: () => setState(() => x.birthTime = null), icon: const Icon(Icons.close_rounded)),
                                ),
                                child: x.birthTime == null ? null : Text(x.birthTime!, style: const TextStyle(fontSize: 16)),
                              ),
                            ),
                          ),
                          NkTextField(label: 'Birth city', optional: true, controller: birthCity),
                          NkPicker(
                            label: 'Birth state',
                            optional: true,
                            value: x.birthState,
                            options: NkPicker.same(indiaStates),
                            onChanged: (v) => setState(() => x.birthState = v),
                          ),
                          NkTextField(label: 'Birth country', optional: true, controller: birthCountry),
                        ],
                      ),
                    ),
                    const SizedBox(height: 12),
                    NkCard(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          const Text('Horoscope chart', style: TextStyle(fontWeight: FontWeight.w700, fontSize: 16, color: NK.maroon)),
                          const SizedBox(height: 6),
                          const Text('A photo of your jathagam chart. Our team checks it before others can see it.',
                              style: TextStyle(color: NK.muted, height: 1.4)),
                          if (x.chartUrl != null) ...[
                            const SizedBox(height: 12),
                            ClipRRect(borderRadius: BorderRadius.circular(12), child: Image.network(x.chartUrl!)),
                            const SizedBox(height: 8),
                            Text(
                              switch (x.chartStatus) {
                                'APPROVED' => 'Approved',
                                'REJECTED' => 'Rejected${x.chartRejectionReason == null ? '' : ': ${x.chartRejectionReason}'}',
                                _ => 'Waiting for review',
                              },
                              style: TextStyle(
                                fontWeight: FontWeight.w700,
                                color: x.chartStatus == 'APPROVED' ? NK.success : x.chartStatus == 'REJECTED' ? NK.error : NK.goldText,
                              ),
                            ),
                            TextButton(onPressed: _deleteChart, child: const Text('Remove chart')),
                          ],
                          const SizedBox(height: 10),
                          OutlinedButton.icon(
                            onPressed: uploading ? null : _uploadChart,
                            icon: uploading
                                ? const SizedBox(width: 18, height: 18, child: CircularProgressIndicator(strokeWidth: 2))
                                : const Icon(Icons.upload_rounded),
                            label: Text(x.chartUrl == null ? 'Upload chart' : 'Replace chart'),
                          ),
                        ],
                      ),
                    ),
                    const SizedBox(height: 18),
                    BusyButton(label: 'Save horoscope', busy: saving, onPressed: _save),
                  ],
                ),
    );
  }
}
