import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../data/models.dart';
import '../../data/reference.dart';
import '../../state/session.dart';
import '../../theme.dart';
import '../../widgets/form.dart';
import '../../widgets/section_icons.dart';

class ProfileScreen extends ConsumerWidget {
  const ProfileScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final session = ref.watch(sessionProvider);
    final p = session.profile;
    if (p == null) return const Scaffold(body: Center(child: CircularProgressIndicator(color: NK.maroon)));
    String v(Object? x) => x is String && x.isNotEmpty ? x : '';
    final d = p.details;
    final l = p.lifestyle;

    return Scaffold(
      appBar: AppBar(title: const Text('My profile')),
      body: RefreshIndicator(
        color: NK.maroon,
        onRefresh: session.refreshProfile,
        child: ListView(
          padding: const EdgeInsets.fromLTRB(16, 18, 16, 32),
          children: [
            _Header(profile: p),
            const SizedBox(height: 18),
            _Section(
              icon: 'basic',
              title: 'Basic details',
              onEdit: () => context.push('/profile/edit/basic'),
              rows: {
                'Name': p.fullName,
                'Gender': genders[p.gender] ?? '',
                'Religion': v(d['religion']),
                'Nadar subcategory': v(d['casteCommunity']),
                'Email': v(d['email']),
              },
            ),
            _Section(
              icon: 'personal',
              title: 'Personal & religious',
              onEdit: () => context.push('/profile/edit/personal'),
              rows: {
                'Height': v(d['height']),
                'Physical status': physicalStatuses[d['physicalStatus']] ?? '',
                'Marital status': maritalStatuses[d['maritalStatus']] ?? '',
                'Complexion': v(d['complexion']),
                'Dosham': doshamOptions[d['dosham']] ?? '',
              },
            ),
            _Section(
              icon: 'education',
              title: 'Education & career',
              onEdit: () => context.push('/profile/edit/location'),
              rows: {
                'Education': v(p.education['educationLevel']),
                'Detail': v(p.education['educationDetail']),
                'Occupation': v(p.education['profession']),
                'Employment': v(p.education['employedIn']),
                'Annual income': v(p.education['annualIncomeRange']),
              },
            ),
            _Section(
              icon: 'location',
              title: 'Location',
              onEdit: () => context.push('/profile/edit/location'),
              rows: {'City': v(p.location['city']), 'State': v(p.location['state']), 'Country': v(p.location['country'])},
            ),
            _Section(
              icon: 'family',
              title: 'Family & about',
              onEdit: () => context.push('/profile/edit/additional'),
              rows: {'Family status': v(p.additional['familyType']), 'Net worth': v(p.additional['netWorth'])},
              footer: v(p.additional['about']),
            ),
            _Section(
              icon: 'lifestyle',
              title: 'Lifestyle & habits',
              badge: l.isEmpty ? 'Optional' : null,
              onEdit: () => context.push('/profile/edit/lifestyle'),
              rows: {'Diet': l.diet ?? '', 'Smoking': l.smoking ?? '', 'Drinking': l.drinking ?? '', 'Hobbies': l.hobbies.join(', ')},
            ),
          ],
        ),
      ),
    );
  }
}

class _Header extends StatelessWidget {
  const _Header({required this.profile});
  final Profile profile;

  @override
  Widget build(BuildContext context) {
    final photo = profile.primaryPhoto;
    final city = profile.location['city'];
    return NkCard(
      child: Column(
        children: [
          Row(
            children: [
              GestureDetector(
                onTap: () => context.push('/photos'),
                child: CircleAvatar(
                  radius: 38,
                  backgroundColor: NK.butter,
                  foregroundImage: photo == null ? null : NetworkImage(photo.url),
                  child: const Icon(Icons.person_outline_rounded, color: NK.maroon, size: 34),
                ),
              ),
              const SizedBox(width: 16),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        Flexible(child: Text(profile.fullName, style: serif(24, color: NK.ink), overflow: TextOverflow.ellipsis)),
                        if (profile.isVerified) ...[const SizedBox(width: 6), const Icon(Icons.verified_rounded, color: NK.gold, size: 20)],
                      ],
                    ),
                    const SizedBox(height: 2),
                    Text(
                      [if (profile.age != null) '${profile.age} yrs', if (city is String && city.isNotEmpty) city].join(' · '),
                      style: const TextStyle(color: NK.muted),
                    ),
                  ],
                ),
              ),
            ],
          ),
          const SizedBox(height: 16),
          Row(
            children: [
              Expanded(
                child: ClipRRect(
                  borderRadius: BorderRadius.circular(99),
                  child: LinearProgressIndicator(
                    value: profile.completionScore / 100,
                    minHeight: 8,
                    color: NK.gold,
                    backgroundColor: NK.line,
                  ),
                ),
              ),
              const SizedBox(width: 12),
              Text('${profile.completionScore}% complete', style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 13)),
            ],
          ),
          const SizedBox(height: 14),
          OutlinedButton.icon(
            onPressed: () => context.push('/photos'),
            icon: const Icon(Icons.photo_library_outlined),
            label: Text('Photos (${profile.photos.length})'),
          ),
        ],
      ),
    );
  }
}

class _Section extends StatelessWidget {
  const _Section({required this.icon, required this.title, required this.rows, required this.onEdit, this.footer, this.badge});
  final String icon;
  final String title;
  final Map<String, String> rows;
  final VoidCallback onEdit;
  final String? footer;
  final String? badge;

  @override
  Widget build(BuildContext context) {
    final filled = rows.entries.where((e) => e.value.isNotEmpty).toList();
    return Padding(
      padding: const EdgeInsets.only(bottom: 12),
      child: NkCard(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                SectionIcon(icon, size: 40),
                const SizedBox(width: 12),
                Expanded(child: Text(title, style: const TextStyle(fontSize: 16.5, fontWeight: FontWeight.w700, color: NK.maroon))),
                if (badge != null)
                  Container(
                    margin: const EdgeInsets.only(right: 4),
                    padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                    decoration: BoxDecoration(color: NK.butter, borderRadius: BorderRadius.circular(999)),
                    child: Text(badge!, style: const TextStyle(fontSize: 11.5, fontWeight: FontWeight.w700, color: NK.goldText)),
                  ),
                IconButton(
                  tooltip: 'Edit $title',
                  onPressed: onEdit,
                  icon: const Icon(Icons.edit_outlined, color: NK.maroon, size: 20),
                ),
              ],
            ),
            if (filled.isEmpty && (footer ?? '').isEmpty)
              const Padding(
                padding: EdgeInsets.only(top: 8),
                child: Text('Not added yet. Tap the pencil to add.', style: TextStyle(color: NK.muted)),
              ),
            for (final e in filled)
              Padding(
                padding: const EdgeInsets.only(top: 10),
                child: Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    SizedBox(width: 128, child: Text(e.key, style: const TextStyle(color: NK.muted, fontSize: 13.5))),
                    Expanded(child: Text(e.value, style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 14))),
                  ],
                ),
              ),
            if ((footer ?? '').isNotEmpty) ...[
              const SizedBox(height: 12),
              Text(footer!, style: const TextStyle(height: 1.5, fontSize: 14)),
            ],
          ],
        ),
      ),
    );
  }
}
