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
import 'categories.dart';

// Search: filters on real profile fields, or one of the categories.
class SearchScreen extends ConsumerStatefulWidget {
  const SearchScreen({super.key});

  @override
  ConsumerState<SearchScreen> createState() => _SearchScreenState();
}

class _SearchScreenState extends ConsumerState<SearchScreen> {
  final f = <String, String>{};
  final city = TextEditingController();
  bool usePreferences = false;
  bool loadingPrefs = false;

  void _put(String key, String? value) => value == null || value.isEmpty ? f.remove(key) : f[key] = value;
  void set(String key, String? value) => setState(() => _put(key, value));
  void toggle(String key, bool on) => set(key, on ? 'true' : null);

  @override
  void dispose() {
    city.dispose();
    super.dispose();
  }

  // As the web's searchFiltersFromPreferences: the saved preferences become
  // "any of" filters.
  Future<void> _togglePreferences(bool on) async {
    if (!on) return setState(() => usePreferences = false);
    setState(() => loadingPrefs = true);
    try {
      final p = await ref.read(repoProvider).partnerPreferences();
      if (!mounted) return;
      if (p == null) {
        showSnack(context, 'Set your partner preferences first.');
        return;
      }
      setState(() {
        usePreferences = true;
        String? s(num? v) => v == null ? null : (v % 1 == 0 ? '${v.toInt()}' : '$v');
        _put('ageMin', s(p.ageMin));
        _put('ageMax', s(p.ageMax));
        _put('heightMinCm', s(p.heightMinCm));
        _put('heightMaxCm', s(p.heightMaxCm));
        _put('incomeMinLakhs', s(p.incomeMinLakhs));
        _put('incomeMaxLakhs', s(p.incomeMaxLakhs));
        _put('dosham', switch (p.doshamPreference) { 'WITHOUT_DOSHAM' => 'NO', 'WITH_DOSHAM' => 'YES', _ => null });
        _put('maritalStatusIn', p.maritalStatuses.join(','));
        _put('stateIn', p.states.join(','));
        _put('cityIn', p.cities.join(','));
      });
    } on ApiException catch (e) {
      if (mounted) showSnack(context, e.message);
    } finally {
      if (mounted) setState(() => loadingPrefs = false);
    }
  }

  void _search() {
    final filters = {...f};
    if (city.text.trim().isNotEmpty) filters['city'] = city.text.trim();
    context.push('/search/results', extra: filters);
  }

  void _clear() => setState(() {
        f.clear();
        city.clear();
        usePreferences = false;
      });

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Search'),
        actions: [if (f.isNotEmpty || city.text.isNotEmpty) TextButton(onPressed: _clear, child: const Text('Clear'))],
      ),
      body: ListView(
        padding: const EdgeInsets.fromLTRB(16, 16, 16, 32),
        children: [
          NkCard(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                SwitchListTile(
                  contentPadding: EdgeInsets.zero,
                  activeThumbColor: NK.maroon,
                  value: usePreferences,
                  onChanged: loadingPrefs ? null : _togglePreferences,
                  title: const Text('Use my partner preferences', style: TextStyle(fontWeight: FontWeight.w700)),
                  subtitle: const Text('Fill the filters from what you are looking for.'),
                ),
                const SizedBox(height: 8),
                _Range(
                  label: 'Age',
                  options: ageOptions,
                  min: f['ageMin'],
                  max: f['ageMax'],
                  onMin: (v) => set('ageMin', v),
                  onMax: (v) => set('ageMax', v),
                ),
                _Range(
                  label: 'Height',
                  options: heightCmOptions,
                  min: f['heightMinCm'],
                  max: f['heightMaxCm'],
                  onMin: (v) => set('heightMinCm', v),
                  onMax: (v) => set('heightMaxCm', v),
                ),
                NkPicker(
                  label: 'Marital status',
                  optional: true,
                  value: f['maritalStatus'],
                  options: maritalStatuses,
                  onChanged: (v) => set('maritalStatus', v),
                ),
                NkPicker(
                  label: 'Religion',
                  optional: true,
                  value: f['religion'],
                  options: NkPicker.same(religions),
                  onChanged: (v) => set('religion', v),
                ),
                NkPicker(
                  label: 'Nadar subcategory',
                  optional: true,
                  value: f['casteCommunity'],
                  options: NkPicker.same(nadarSubcategories),
                  onChanged: (v) => set('casteCommunity', v),
                ),
                NkPicker(label: 'Dosham', optional: true, value: f['dosham'], options: doshamOptions, onChanged: (v) => set('dosham', v)),
                NkTextField(label: 'City', optional: true, controller: city, hintText: 'e.g. Madurai'),
                NkPicker(
                  label: 'Family status',
                  optional: true,
                  value: f['familyType'],
                  options: NkPicker.same(familyStatuses),
                  onChanged: (v) => set('familyType', v),
                ),
                _Range(
                  label: 'Annual income',
                  options: incomeLakhOptions,
                  min: f['incomeMinLakhs'],
                  max: f['incomeMaxLakhs'],
                  onMin: (v) => set('incomeMinLakhs', v),
                  onMax: (v) => set('incomeMaxLakhs', v),
                ),
                NkPicker(label: 'Diet', optional: true, value: f['diet'], options: NkPicker.same(diets), onChanged: (v) => set('diet', v)),
                NkPicker(
                  label: 'Smoking',
                  optional: true,
                  value: f['smoking'],
                  options: NkPicker.same(habitFrequencies),
                  onChanged: (v) => set('smoking', v),
                ),
                NkPicker(
                  label: 'Joined',
                  optional: true,
                  value: f['joinedWithinDays'],
                  options: const {'1': 'In the last day', '3': 'In the last 3 days', '7': 'In the last week', '30': 'In the last 30 days'},
                  onChanged: (v) => set('joinedWithinDays', v),
                ),
                _Check(label: 'With photos only', value: f['withPhoto'] == 'true', onChanged: (v) => toggle('withPhoto', v)),
                _Check(label: 'Near me (my city or state)', value: f['nearby'] == 'true', onChanged: (v) => toggle('nearby', v)),
                _Check(label: 'Verified members only', value: f['verified'] == 'true', onChanged: (v) => toggle('verified', v)),
                _Check(
                  label: 'Hide members I shortlisted',
                  value: f['excludeShortlisted'] == 'true',
                  onChanged: (v) => toggle('excludeShortlisted', v),
                ),
                if ((f['diet'] ?? f['smoking']) != null)
                  const Padding(
                    padding: EdgeInsets.only(top: 4, bottom: 8),
                    child: Text(
                      'Only members who added their diet or smoking habits can match these filters.',
                      style: TextStyle(color: NK.muted, fontSize: 12.5),
                    ),
                  ),
                const SizedBox(height: 8),
                FilledButton.icon(onPressed: _search, icon: const Icon(Icons.search_rounded), label: const Text('Show members')),
              ],
            ),
          ),
          for (final group in categoryGroups.entries) ...[
            SectionTitle(group.value, padding: const EdgeInsets.fromLTRB(2, 24, 2, 10)),
            for (final c in searchCategories.where((c) => c.group == group.key))
              Padding(
                padding: const EdgeInsets.only(bottom: 10),
                child: NkCard(
                  padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
                  onTap: () => context.push('/search/category/${c.slug}'),
                  child: Row(
                    children: [
                      Container(
                        width: 42,
                        height: 42,
                        decoration: BoxDecoration(color: NK.butter, borderRadius: BorderRadius.circular(12)),
                        child: Icon(c.icon, color: NK.maroon),
                      ),
                      const SizedBox(width: 12),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(c.title, style: const TextStyle(fontWeight: FontWeight.w700)),
                            Text(c.subtitle, style: const TextStyle(color: NK.muted, fontSize: 13)),
                          ],
                        ),
                      ),
                      if (c.comingSoon != null)
                        const Text('Coming soon', style: TextStyle(color: NK.goldText, fontSize: 12, fontWeight: FontWeight.w700))
                      else
                        const Icon(Icons.chevron_right_rounded, color: NK.muted),
                    ],
                  ),
                ),
              ),
          ],
        ],
      ),
    );
  }
}

class _Range extends StatelessWidget {
  const _Range({required this.label, required this.options, this.min, this.max, required this.onMin, required this.onMax});
  final String label;
  final Map<String, String> options;
  final String? min;
  final String? max;
  final ValueChanged<String?> onMin;
  final ValueChanged<String?> onMax;

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        Expanded(child: NkPicker(label: '$label from', optional: true, value: min, options: options, onChanged: onMin)),
        const SizedBox(width: 10),
        Expanded(child: NkPicker(label: 'to', optional: true, value: max, options: options, onChanged: onMax)),
      ],
    );
  }
}

class _Check extends StatelessWidget {
  const _Check({required this.label, required this.value, required this.onChanged});
  final String label;
  final bool value;
  final ValueChanged<bool> onChanged;

  @override
  Widget build(BuildContext context) {
    return CheckboxListTile(
      contentPadding: EdgeInsets.zero,
      dense: true,
      controlAffinity: ListTileControlAffinity.leading,
      activeColor: NK.maroon,
      value: value,
      onChanged: (v) => onChanged(v ?? false),
      title: Text(label, style: const TextStyle(fontSize: 14.5)),
    );
  }
}

// GET /search/profiles, a page of 20 at a time.
class SearchResultsScreen extends ConsumerStatefulWidget {
  const SearchResultsScreen({super.key, required this.filters, this.title = 'Search results', this.note});
  final Map<String, String> filters;
  final String title;
  final String? note;

  @override
  ConsumerState<SearchResultsScreen> createState() => _SearchResultsScreenState();
}

class _SearchResultsScreenState extends ConsumerState<SearchResultsScreen> {
  final items = <MemberCard>[];
  String? cursor;
  int total = 0;
  bool loading = true;
  Object? error;

  @override
  void initState() {
    super.initState();
    _load(reset: true);
  }

  Future<void> _load({bool reset = false}) async {
    setState(() {
      loading = true;
      error = null;
    });
    try {
      final page = await ref.read(repoProvider).search(widget.filters, cursor: reset ? null : cursor);
      if (!mounted) return;
      setState(() {
        if (reset) items.clear();
        items.addAll(page.items);
        cursor = page.nextCursor;
        total = page.total;
      });
    } catch (e) {
      if (mounted) setState(() => error = e);
    } finally {
      if (mounted) setState(() => loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: Text(widget.title)),
      body: RefreshIndicator(
        color: NK.maroon,
        onRefresh: () => _load(reset: true),
        child: ListView(
          padding: const EdgeInsets.fromLTRB(16, 14, 16, 32),
          children: [
            if (widget.note != null)
              Padding(padding: const EdgeInsets.only(bottom: 10), child: Text(widget.note!, style: const TextStyle(color: NK.muted))),
            if (error != null && items.isEmpty)
              LoadError(error: error!, onRetry: () => _load(reset: true))
            else if (loading && items.isEmpty)
              loadingSpinner
            else if (items.isEmpty)
              const EmptyState(
                icon: Icons.search_off_rounded,
                title: 'No members found',
                message: 'Try fewer filters or a wider range.',
              )
            else ...[
              Padding(
                padding: const EdgeInsets.only(bottom: 12),
                child: Text('$total ${total == 1 ? 'member' : 'members'}', style: const TextStyle(fontWeight: FontWeight.w700)),
              ),
              MemberGrid(members: items),
              if (cursor != null)
                Padding(
                  padding: const EdgeInsets.only(top: 16),
                  child: OutlinedButton(onPressed: loading ? null : () => _load(), child: Text(loading ? 'Loading…' : 'Load more')),
                ),
            ],
          ],
        ),
      ),
    );
  }
}

// One Search category, from its own endpoint.
class CategoryScreen extends ConsumerStatefulWidget {
  const CategoryScreen({super.key, required this.slug});
  final String slug;

  @override
  ConsumerState<CategoryScreen> createState() => _CategoryScreenState();
}

class _CategoryScreenState extends ConsumerState<CategoryScreen> {
  late Future<List<MemberCard>?> future = _load();

  // null: location preference needs saved states/cities first.
  Future<List<MemberCard>?> _load() async {
    final repo = ref.read(repoProvider);
    final c = findCategory(widget.slug)!;
    switch (c.source) {
      case 'shortlisted-by-you':
        return repo.shortlisted();
      case 'shortlisted-you':
        return repo.shortlistedMe();
      case 'matches':
        return (await repo.matches()).items;
      case 'location-preference':
        final p = await repo.partnerPreferences();
        if (p == null || (p.states.isEmpty && p.cities.isEmpty)) return null;
        final page = await repo.search({'stateIn': p.states.join(','), 'cityIn': p.cities.join(',')});
        return page.items;
      default:
        return repo.category(c.source!);
    }
  }

  void _reload() => setState(() => future = _load());

  @override
  Widget build(BuildContext context) {
    final c = findCategory(widget.slug);
    if (c == null) return const Scaffold(body: EmptyState(icon: Icons.help_outline_rounded, title: 'Not found'));
    return Scaffold(
      appBar: AppBar(title: Text(c.title)),
      body: RefreshIndicator(
        color: NK.maroon,
        onRefresh: () async => _reload(),
        child: ListView(
          padding: const EdgeInsets.fromLTRB(16, 14, 16, 32),
          children: [
            if (c.comingSoon != null)
              EmptyState(icon: c.icon, title: 'Coming soon', message: c.comingSoon)
            else ...[
              Text(c.description!, style: const TextStyle(color: NK.muted, height: 1.45)),
              const SizedBox(height: 14),
              FutureBuilder<List<MemberCard>?>(
                future: future,
                builder: (context, snap) {
                  if (snap.hasError) return LoadError(error: snap.error!, onRetry: _reload);
                  if (snap.connectionState != ConnectionState.done) return loadingSpinner;
                  final items = snap.data;
                  if (items == null) {
                    return EmptyState(
                      icon: Icons.map_outlined,
                      title: 'Choose your preferred places',
                      message: 'Add preferred states or cities in your partner preferences to see members there.',
                      action: FilledButton(onPressed: () => context.push('/me/preferences'), child: const Text('Set preferences')),
                    );
                  }
                  if (items.isEmpty) return EmptyState(icon: c.icon, title: 'Nobody here yet', message: c.emptyMessage);
                  return MemberGrid(members: items, onChanged: _reload);
                },
              ),
            ],
          ],
        ),
      ),
    );
  }
}
