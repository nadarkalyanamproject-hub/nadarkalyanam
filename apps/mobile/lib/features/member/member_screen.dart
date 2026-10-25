import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../data/api.dart';
import '../../data/members.dart';
import '../../data/reference.dart';
import '../../state/session.dart';
import '../../theme.dart';
import '../../widgets/form.dart';
import '../../widgets/member.dart';
import '../../widgets/section_icons.dart';

final memberProvider = FutureProvider.autoDispose.family<MemberProfile, String>((ref, id) => ref.watch(repoProvider).member(id));

// Another member's profile (the website's /browse/:id).
class MemberScreen extends ConsumerWidget {
  const MemberScreen({super.key, required this.profileId});
  final String profileId;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final data = ref.watch(memberProvider(profileId));
    return data.when(
      loading: () => Scaffold(appBar: AppBar(), body: loadingSpinner),
      error: (e, _) => Scaffold(
        appBar: AppBar(),
        body: ListView(children: [LoadError(error: e, onRetry: () => ref.invalidate(memberProvider(profileId)))]),
      ),
      data: (m) => _MemberView(member: m),
    );
  }
}

class _MemberView extends ConsumerWidget {
  const _MemberView({required this.member});
  final MemberProfile member;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final m = member;
    void reload() => ref.invalidate(memberProvider(m.id));
    final his = m.gender == 'FEMALE' ? 'Her' : m.gender == 'MALE' ? 'His' : 'Their';
    String? v(Object? x) => x is String && x.isNotEmpty ? x : null;
    final lifestyle = m.lifestyle;
    final hobbies = (lifestyle?['hobbies'] as List?)?.whereType<String>().join(', ');

    return Scaffold(
      body: RefreshIndicator(
        color: NK.maroon,
        onRefresh: () => ref.refresh(memberProvider(m.id).future),
        child: CustomScrollView(
          slivers: [
            SliverAppBar(
              pinned: true,
              expandedHeight: MediaQuery.of(context).size.width * 1.05,
              backgroundColor: NK.butter,
              actions: [_MoreMenu(member: m)],
              flexibleSpace: FlexibleSpaceBar(background: _Photos(urls: m.photoUrls)),
            ),
            SliverPadding(
              padding: const EdgeInsets.fromLTRB(16, 18, 16, 40),
              sliver: SliverList.list(
                children: [
                  Row(
                    children: [
                      Flexible(child: Text(m.fullName, style: serif(28, color: NK.ink))),
                      if (m.isVerified) ...[const SizedBox(width: 6), const Icon(Icons.verified_rounded, color: NK.gold)],
                    ],
                  ),
                  const SizedBox(height: 4),
                  Text(
                    [if (m.age > 0) '${m.age} yrs', ?m.height?.split(' (').first, ?m.city, ?m.state].join(' · '),
                    style: const TextStyle(color: NK.muted, fontSize: 15),
                  ),
                  if (m.profession != null) ...[
                    const SizedBox(height: 2),
                    Text(m.profession!, style: const TextStyle(color: NK.muted, fontSize: 15)),
                  ],
                  if (m.preferenceFit != null && m.preferenceFit!.total > 0) ...[
                    const SizedBox(height: 12),
                    _FitLine(fit: m.preferenceFit!, label: 'of your preferences match'),
                  ],
                  const SizedBox(height: 16),
                  RelationshipButton(profileId: m.id, relationship: m.relationship, conversationId: m.conversationId, onChanged: reload),
                  const SizedBox(height: 10),
                  _ShortlistButton(profileId: m.id),
                  const SizedBox(height: 18),
                  _PhoneCard(profileId: m.id),
                  if (v(m.additional['about']) != null)
                    _Block(icon: 'family', title: 'About', text: v(m.additional['about'])),
                  _Block(
                    icon: 'personal',
                    title: 'Personal & religious',
                    rows: {
                      'Height': m.height,
                      'Physical status': physicalStatuses[m.physicalStatus],
                      'Complexion': m.complexion,
                      'Marital status': maritalStatuses[m.maritalStatus],
                      'Religion': m.religion,
                      'Nadar subcategory': m.casteCommunity,
                      'Dosham': doshamOptions[m.dosham],
                    },
                  ),
                  _Block(
                    icon: 'education',
                    title: 'Education & career',
                    rows: {
                      'Education': v(m.education['educationLevel']),
                      'Detail': v(m.education['educationDetail']),
                      'Occupation': v(m.education['profession']),
                      'Employed in': v(m.education['employedIn']),
                      'Annual income': v(m.education['annualIncomeRange']),
                    },
                  ),
                  _Block(
                    icon: 'location',
                    title: 'Location & family',
                    rows: {
                      'City': m.city,
                      'State': m.state,
                      'Family status': v(m.additional['familyType']),
                      'Net worth': v(m.additional['netWorth']),
                    },
                  ),
                  if (lifestyle != null)
                    _Block(
                      icon: 'lifestyle',
                      title: 'Lifestyle & habits',
                      rows: {
                        'Diet': v(lifestyle['diet']),
                        'Smoking': v(lifestyle['smoking']),
                        'Drinking': v(lifestyle['drinking']),
                        'Hobbies': hobbies == null || hobbies.isEmpty ? null : hobbies,
                      },
                    ),
                  _HoroscopeBlock(h: m.horoscope),
                  if (m.theirPreferences != null) _TheirPreferences(prefs: m.theirPreferences!, fit: m.theirFit, his: his),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _Photos extends StatefulWidget {
  const _Photos({required this.urls});
  final List<String> urls;

  @override
  State<_Photos> createState() => _PhotosState();
}

class _PhotosState extends State<_Photos> {
  int index = 0;

  @override
  Widget build(BuildContext context) {
    if (widget.urls.isEmpty) return const MemberPhoto(url: null, iconSize: 96);
    return Stack(
      fit: StackFit.expand,
      children: [
        PageView.builder(
          itemCount: widget.urls.length,
          onPageChanged: (i) => setState(() => index = i),
          itemBuilder: (_, i) => GestureDetector(
            onTap: () => _openFull(context, i),
            child: MemberPhoto(url: widget.urls[i], iconSize: 96),
          ),
        ),
        if (widget.urls.length > 1)
          Positioned(
            bottom: 14,
            left: 0,
            right: 0,
            child: Row(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                for (var i = 0; i < widget.urls.length; i++)
                  AnimatedContainer(
                    duration: const Duration(milliseconds: 200),
                    margin: const EdgeInsets.symmetric(horizontal: 3),
                    width: i == index ? 18 : 7,
                    height: 7,
                    decoration: BoxDecoration(
                      color: i == index ? Colors.white : Colors.white.withValues(alpha: 0.6),
                      borderRadius: BorderRadius.circular(99),
                    ),
                  ),
              ],
            ),
          ),
      ],
    );
  }

  void _openFull(BuildContext context, int start) {
    Navigator.of(context).push(MaterialPageRoute(
      fullscreenDialog: true,
      builder: (_) => Scaffold(
        backgroundColor: Colors.black,
        appBar: AppBar(backgroundColor: Colors.black, foregroundColor: Colors.white, shape: const Border()),
        body: PageView.builder(
          controller: PageController(initialPage: start),
          itemCount: widget.urls.length,
          itemBuilder: (_, i) => InteractiveViewer(child: Center(child: Image.network(widget.urls[i], fit: BoxFit.contain))),
        ),
      ),
    ));
  }
}

class _FitLine extends StatelessWidget {
  const _FitLine({required this.fit, required this.label});
  final PreferenceFit fit;
  final String label;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 9),
      decoration: BoxDecoration(color: NK.butter, borderRadius: BorderRadius.circular(12)),
      child: Row(
        children: [
          const Icon(Icons.favorite_rounded, color: NK.maroon, size: 18),
          const SizedBox(width: 8),
          Expanded(
            child: Text('${fit.matched} of ${fit.total} $label', style: const TextStyle(fontWeight: FontWeight.w600)),
          ),
        ],
      ),
    );
  }
}

class _ShortlistButton extends ConsumerStatefulWidget {
  const _ShortlistButton({required this.profileId});
  final String profileId;

  @override
  ConsumerState<_ShortlistButton> createState() => _ShortlistButtonState();
}

class _ShortlistButtonState extends ConsumerState<_ShortlistButton> {
  bool? on;
  bool busy = false;

  @override
  void initState() {
    super.initState();
    ref.read(repoProvider).isShortlisted(widget.profileId).then((v) {
      if (mounted) setState(() => on = v);
    }).catchError((_) {});
  }

  Future<void> _toggle() async {
    final repo = ref.read(repoProvider);
    setState(() => busy = true);
    try {
      if (on == true) {
        await repo.unshortlist(widget.profileId);
      } else {
        await repo.shortlist(widget.profileId);
      }
      if (!mounted) return;
      setState(() => on = !(on ?? false));
      showSnack(context, on! ? 'Added to your shortlist' : 'Removed from your shortlist');
    } on ApiException catch (e) {
      if (mounted) showSnack(context, e.message);
    } finally {
      if (mounted) setState(() => busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final saved = on == true;
    return OutlinedButton.icon(
      onPressed: on == null || busy ? null : _toggle,
      icon: Icon(saved ? Icons.bookmark_rounded : Icons.bookmark_border_rounded),
      label: Text(saved ? 'Shortlisted' : 'Shortlist'),
    );
  }
}

// What the viewer can do about this member's phone number (the web's
// phoneUnlockView).
class _PhoneCard extends ConsumerStatefulWidget {
  const _PhoneCard({required this.profileId});
  final String profileId;

  @override
  ConsumerState<_PhoneCard> createState() => _PhoneCardState();
}

class _PhoneCardState extends ConsumerState<_PhoneCard> {
  PhoneStatus? status;
  String? number;
  bool busy = false;

  @override
  void initState() {
    super.initState();
    ref.read(repoProvider).phoneStatus(widget.profileId).then((s) {
      if (mounted) setState(() => status = s);
    }).catchError((_) {});
  }

  Future<void> _unlock() async {
    final s = status!;
    if (s.state == 'AVAILABLE' && s.limit != null) {
      final ok = await showDialog<bool>(
        context: context,
        builder: (context) => AlertDialog(
          title: const Text('Unlock this number?'),
          content: Text(
            'This uses 1 of your ${s.limit} unlocks (${s.remaining} left). Unlocking the same member again later is free.',
          ),
          actions: [
            TextButton(onPressed: () => Navigator.pop(context, false), child: const Text('Cancel')),
            TextButton(onPressed: () => Navigator.pop(context, true), child: const Text('Unlock')),
          ],
        ),
      );
      if (ok != true) return;
    }
    setState(() => busy = true);
    try {
      final res = await ref.read(repoProvider).unlockPhone(widget.profileId);
      if (mounted) setState(() => number = res.phoneNumber);
    } on ApiException catch (e) {
      if (mounted) showSnack(context, e.message);
    } finally {
      if (mounted) setState(() => busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final s = status;
    if (s == null) return const SizedBox.shrink();
    final (message, action) = switch (s.state) {
      'NOT_CONNECTED' => ("Available only after you're connected (an accepted interest).", null),
      'HIDDEN_BY_MEMBER' => ("This member hasn't chosen to share their phone number.", null),
      'QUOTA_EXHAUSTED' => ("You've used all ${s.limit} phone number unlocks in your current plan.", null),
      'NO_PLAN' => ('Unlocking an OTP-verified phone number needs a paid plan.', 'See plans'),
      'UNLOCKED' => ("You've unlocked this number before.", 'Show number'),
      _ => ('OTP-verified mobile number (confirmed by a one-time code, not an ID check).', 'Unlock number'),
    };
    return Padding(
      padding: const EdgeInsets.only(bottom: 12),
      child: NkCard(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Row(
              children: [
                Icon(Icons.phone_outlined, color: NK.maroon),
                SizedBox(width: 10),
                Text('Phone number', style: TextStyle(fontWeight: FontWeight.w700, fontSize: 16, color: NK.maroon)),
              ],
            ),
            const SizedBox(height: 8),
            if (number != null) ...[
              SelectableText(number!, style: const TextStyle(fontSize: 20, fontWeight: FontWeight.w800, letterSpacing: 0.5)),
              const SizedBox(height: 10),
              FilledButton.icon(
                onPressed: () => launchUrl(Uri.parse('tel:$number')),
                icon: const Icon(Icons.call_rounded),
                label: const Text('Call'),
              ),
            ] else ...[
              Text(message, style: const TextStyle(color: NK.muted, height: 1.45)),
              if (s.state == 'AVAILABLE' && s.limit != null) ...[
                const SizedBox(height: 4),
                Text('${s.remaining} of ${s.limit} unlocks left in your plan', style: const TextStyle(fontSize: 12.5, color: NK.goldText)),
              ],
              if (action != null) ...[
                const SizedBox(height: 12),
                s.state == 'NO_PLAN'
                    ? OutlinedButton(onPressed: () => context.push('/membership'), child: Text(action))
                    : BusyButton(label: action, busy: busy, onPressed: _unlock),
              ],
            ],
          ],
        ),
      ),
    );
  }
}

// A titled card of label/value rows; empty values are left out, and a
// section with nothing in it isn't shown.
class _Block extends StatelessWidget {
  const _Block({required this.icon, required this.title, this.rows = const {}, this.text, this.child});
  final String icon;
  final String title;
  final Map<String, String?> rows;
  final String? text;
  final Widget? child;

  @override
  Widget build(BuildContext context) {
    final filled = rows.entries.where((e) => e.value != null && e.value!.isNotEmpty).toList();
    if (filled.isEmpty && text == null && child == null) return const SizedBox.shrink();
    return Padding(
      padding: const EdgeInsets.only(bottom: 12),
      child: NkCard(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                SectionIcon(icon, size: 36),
                const SizedBox(width: 12),
                Expanded(child: Text(title, style: const TextStyle(fontSize: 16.5, fontWeight: FontWeight.w700, color: NK.maroon))),
              ],
            ),
            if (text != null) ...[const SizedBox(height: 12), Text(text!, style: const TextStyle(height: 1.55))],
            for (final e in filled)
              Padding(
                padding: const EdgeInsets.only(top: 10),
                child: Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    SizedBox(width: 128, child: Text(e.key, style: const TextStyle(color: NK.muted, fontSize: 13.5))),
                    Expanded(child: Text(e.value!, style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 14))),
                  ],
                ),
              ),
            ?child,
          ],
        ),
      ),
    );
  }
}

class _HoroscopeBlock extends StatelessWidget {
  const _HoroscopeBlock({required this.h});
  final HoroscopeView h;

  @override
  Widget build(BuildContext context) {
    if (!h.shared) {
      return const _Block(
        icon: 'horoscope',
        title: 'Horoscope',
        text: "This member's horoscope isn't shared with you.",
      );
    }
    return _Block(
      icon: 'horoscope',
      title: 'Horoscope',
      rows: {
        'Rasi': rasis[h.rasi],
        'Nakshatra': h.nakshatra == null ? null : [nakshatras[h.nakshatra], if (h.nakshatraPada != null) 'pada ${h.nakshatraPada}'].join(', '),
        'Lagnam': rasis[h.lagnam],
        'Sevvai dosham': doshamOptions[h.sevvaiDosham],
        'Ragu/Kethu dosham': doshamOptions[h.raguKethuDosham],
        'Birth time': h.birthTime,
        'Birth place': h.birthPlace,
      },
      child: h.chartImageUrl == null
          ? null
          : Padding(
              padding: const EdgeInsets.only(top: 14),
              child: ClipRRect(borderRadius: BorderRadius.circular(12), child: Image.network(h.chartImageUrl!)),
            ),
    );
  }
}

class _TheirPreferences extends StatelessWidget {
  const _TheirPreferences({required this.prefs, required this.fit, required this.his});
  final Map<String, dynamic> prefs;
  final PreferenceFit? fit;
  final String his;

  String? _range(Object? min, Object? max, String Function(num) f) {
    if (min is! num && max is! num) return null;
    if (min is num && max is num) return '${f(min)} to ${f(max)}';
    return min is num ? '${f(min)} or more' : 'Up to ${f(max as num)}';
  }

  @override
  Widget build(BuildContext context) {
    List<String> list(Object? v) => (v as List?)?.whereType<String>().toList() ?? [];
    final marital = list(prefs['maritalStatuses']).map((s) => maritalStatuses[s] ?? s).join(', ');
    final places = [...list(prefs['states']), ...list(prefs['cities'])].join(', ');
    String lakhs(num l) => l >= 100 ? '₹${(l / 100).toStringAsFixed(l % 100 == 0 ? 0 : 1)} Cr' : '₹${l.toStringAsFixed(l % 1 == 0 ? 0 : 1)} L';
    final f = fit;
    return _Block(
      icon: 'preferences',
      title: '$his partner preferences',
      rows: {
        'Age': _range(prefs['ageMin'], prefs['ageMax'], (a) => '${a.toInt()} yrs'),
        'Height': _range(prefs['heightMinCm'], prefs['heightMaxCm'], (c) => '${c.toInt()} cm'),
        'Marital status': marital.isEmpty ? null : marital,
        'Location': places.isEmpty ? null : places,
        'Income': _range(prefs['incomeMinLakhs'], prefs['incomeMaxLakhs'], lakhs),
        'Dosham': prefs['doshamPreference'] == 'DOESNT_MATTER' ? null : doshamPreferences[prefs['doshamPreference']],
      },
      child: f == null || f.total == 0
          ? null
          : Padding(padding: const EdgeInsets.only(top: 14), child: _FitLine(fit: f, label: '${his.toLowerCase()} preferences match you')),
    );
  }
}

class _MoreMenu extends ConsumerWidget {
  const _MoreMenu({required this.member});
  final MemberProfile member;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return PopupMenuButton<String>(
      icon: const CircleAvatar(backgroundColor: Colors.white70, child: Icon(Icons.more_vert_rounded, color: NK.ink)),
      onSelected: (choice) async {
        if (choice == 'report') {
          await showReportSheet(context, ref, targetType: 'PROFILE', targetId: member.id, name: member.fullName);
        } else if (choice == 'block') {
          final ok = await confirmBlock(context, member.fullName);
          if (ok != true || !context.mounted) return;
          try {
            await ref.read(repoProvider).blockProfile(member.id);
            if (!context.mounted) return;
            showSnack(context, '${member.fullName} is blocked');
            context.pop();
          } on ApiException catch (e) {
            if (context.mounted) showSnack(context, e.message);
          }
        }
      },
      itemBuilder: (_) => const [
        PopupMenuItem(value: 'report', child: Text('Report profile')),
        PopupMenuItem(value: 'block', child: Text('Block member')),
      ],
    );
  }
}

Future<bool?> confirmBlock(BuildContext context, String name) => showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: Text('Block $name?'),
        content: const Text(
          "You won't see each other in matches or search, and neither of you can send interests or messages. You can unblock them later in Settings.",
        ),
        actions: [
          TextButton(onPressed: () => Navigator.pop(context, false), child: const Text('Cancel')),
          TextButton(onPressed: () => Navigator.pop(context, true), child: const Text('Block')),
        ],
      ),
    );

Future<void> showReportSheet(BuildContext context, WidgetRef ref, {required String targetType, required String targetId, required String name}) {
  return showModalBottomSheet(
    context: context,
    isScrollControlled: true,
    backgroundColor: Colors.white,
    shape: const RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(24))),
    builder: (_) => _ReportSheet(targetType: targetType, targetId: targetId, name: name),
  );
}

class _ReportSheet extends ConsumerStatefulWidget {
  const _ReportSheet({required this.targetType, required this.targetId, required this.name});
  final String targetType;
  final String targetId;
  final String name;

  @override
  ConsumerState<_ReportSheet> createState() => _ReportSheetState();
}

class _ReportSheetState extends ConsumerState<_ReportSheet> {
  final reason = TextEditingController();
  bool busy = false;
  String? error;

  @override
  void dispose() {
    reason.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    if (reason.text.trim().isEmpty) return setState(() => error = 'Tell us what is wrong');
    setState(() {
      busy = true;
      error = null;
    });
    try {
      await ref.read(repoProvider).report(widget.targetType, widget.targetId, reason.text.trim());
      if (!mounted) return;
      Navigator.pop(context);
      showSnack(context, 'Report submitted. Thank you.');
    } on ApiException catch (e) {
      if (mounted) setState(() => error = e.message);
    } finally {
      if (mounted) setState(() => busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: EdgeInsets.fromLTRB(20, 20, 20, MediaQuery.of(context).viewInsets.bottom + 20),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Text(widget.targetType == 'MESSAGE' ? 'Report this message' : 'Report ${widget.name}', style: serif(24)),
          const SizedBox(height: 6),
          const Text('Our team reviews every report. The member is not told who reported them.', style: TextStyle(color: NK.muted)),
          const SizedBox(height: 16),
          NkTextField(label: 'Why are you reporting this?', controller: reason, maxLines: 4, maxLength: 500, error: error),
          BusyButton(label: 'Submit report', busy: busy, onPressed: _submit),
        ],
      ),
    );
  }
}
