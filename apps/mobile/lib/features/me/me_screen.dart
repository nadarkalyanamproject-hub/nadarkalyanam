import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../data/api.dart';
import '../../state/session.dart';
import '../../theme.dart';
import '../../widgets/form.dart';
import '../../widgets/hero.dart';
import '../../widgets/member.dart';
import '../../widgets/top_actions.dart';

// The member's own corner: their profile and everything about their account.
class MeScreen extends ConsumerWidget {
  const MeScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final p = ref.watch(sessionProvider).profile;
    final city = p?.location['city'];
    final score = p?.completionScore ?? 0;
    final top = MediaQuery.of(context).padding.top;
    return AnnotatedRegion<SystemUiOverlayStyle>(
      value: SystemUiOverlayStyle.light,
      child: Scaffold(
        body: ListView(
          padding: const EdgeInsets.only(bottom: 32),
          children: [
            HeroBackdrop(
              padding: EdgeInsets.fromLTRB(20, top + 6, 8, 26),
              child: Column(
                children: [
                  Row(
                    children: [
                      Text('My account', style: serif(24, color: Colors.white)),
                      const Spacer(),
                      const IconTheme(data: IconThemeData(color: Colors.white), child: TopActions(showSearch: false)),
                    ],
                  ),
                  const SizedBox(height: 18),
                  Padding(
                    padding: const EdgeInsets.only(right: 12),
                    child: Row(
                      children: [
                        GestureDetector(
                          onTap: () => context.push('/me/profile'),
                          child: MemberAvatar(url: p?.primaryPhoto?.url, radius: 38, ring: true),
                        ),
                        const SizedBox(width: 16),
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(p?.fullName ?? '', maxLines: 2, overflow: TextOverflow.ellipsis, style: serif(27, color: Colors.white)),
                              const SizedBox(height: 3),
                              Text(
                                [if (p?.age != null) '${p!.age} yrs', if (city is String && city.isNotEmpty) city].join(' · '),
                                style: TextStyle(color: Colors.white.withValues(alpha: 0.8), fontSize: 14),
                              ),
                            ],
                          ),
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(height: 18),
                  Padding(
                    padding: const EdgeInsets.only(right: 12),
                    child: Row(
                      children: [
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text('Profile $score% complete',
                                  style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w700, fontSize: 13)),
                              const SizedBox(height: 6),
                              ClipRRect(
                                borderRadius: BorderRadius.circular(99),
                                child: LinearProgressIndicator(
                                  value: score / 100,
                                  minHeight: 6,
                                  color: NK.goldLight,
                                  backgroundColor: Colors.white.withValues(alpha: 0.18),
                                ),
                              ),
                            ],
                          ),
                        ),
                        const SizedBox(width: 14),
                        _HeroButton(label: 'View & edit', onTap: () => context.push('/me/profile')),
                      ],
                    ),
                  ),
                ],
              ),
            ),
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 22, 16, 0),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  _Menu(title: 'PROFILE', items: [
                    _Item(Icons.person_outline_rounded, 'My profile', '/me/profile'),
                    _Item(Icons.photo_library_outlined, 'My photos', '/photos'),
                    _Item(Icons.tune_rounded, 'Partner preferences', '/me/preferences'),
                    _Item(Icons.auto_awesome_outlined, 'Horoscope', '/me/horoscope'),
                  ]),
                  _Menu(title: 'MEMBERSHIP', items: [
                    _Item(Icons.workspace_premium_outlined, 'Membership', '/membership', gold: true),
                    _Item(Icons.contact_phone_outlined, 'Unlocked contacts', '/me/contacts'),
                    _Item(Icons.search_rounded, 'Search members', '/search'),
                    _Item(Icons.notifications_none_rounded, 'Notifications', '/notifications'),
                  ]),
                  _Menu(title: 'ACCOUNT', items: [
                    _Item(Icons.block_rounded, 'Blocked members', '/me/blocked'),
                    _Item(Icons.settings_outlined, 'Settings & help', '/me/settings'),
                  ]),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _HeroButton extends StatelessWidget {
  const _HeroButton({required this.label, required this.onTap});
  final String label;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Material(
      shape: const StadiumBorder(),
      clipBehavior: Clip.antiAlias,
      child: Ink(
        decoration: const BoxDecoration(gradient: NK.goldGradient),
        child: InkWell(
          onTap: onTap,
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
            child: Text(label, style: const TextStyle(color: NK.maroonDeep, fontWeight: FontWeight.w800, fontSize: 13)),
          ),
        ),
      ),
    );
  }
}

class _Item {
  const _Item(this.icon, this.label, this.path, {this.gold = false});
  final IconData icon;
  final String label;
  final String path;
  final bool gold;
}

class _Menu extends StatelessWidget {
  const _Menu({required this.title, required this.items});
  final String title;
  final List<_Item> items;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 20),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Padding(padding: const EdgeInsets.only(left: 6, bottom: 8), child: Text(title, style: eyebrow())),
          NkCard(
            padding: const EdgeInsets.symmetric(vertical: 4),
            child: Column(
              children: [
                for (var i = 0; i < items.length; i++) ...[
                  if (i > 0) const Divider(indent: 68, endIndent: 16),
                  ListTile(
                    contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 2),
                    leading: Container(
                      width: 38,
                      height: 38,
                      decoration: BoxDecoration(
                        borderRadius: BorderRadius.circular(12),
                        gradient: items[i].gold
                            ? NK.goldGradient
                            : const LinearGradient(colors: [NK.butter, NK.goldPale], begin: Alignment.topLeft, end: Alignment.bottomRight),
                      ),
                      child: Icon(items[i].icon, color: items[i].gold ? NK.maroonDeep : NK.maroon, size: 20),
                    ),
                    title: Text(items[i].label, style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 15)),
                    trailing: const Icon(Icons.chevron_right_rounded, color: NK.subtle),
                    onTap: () => context.push(items[i].path),
                  ),
                ],
              ],
            ),
          ),
        ],
      ),
    );
  }
}

final _blockedProvider = FutureProvider.autoDispose((ref) => ref.watch(repoProvider).blocked());

class BlockedScreen extends ConsumerWidget {
  const BlockedScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final data = ref.watch(_blockedProvider);
    return Scaffold(
      appBar: AppBar(title: const Text('Blocked members')),
      body: data.when(
        loading: () => loadingSpinner,
        error: (e, _) => ListView(children: [LoadError(error: e, onRetry: () => ref.invalidate(_blockedProvider))]),
        data: (items) => items.isEmpty
            ? ListView(
                children: const [
                  EmptyState(
                    icon: Icons.block_rounded,
                    title: 'Nobody blocked',
                    message: "Members you block can't see you, send you interests or message you.",
                  ),
                ],
              )
            : ListView.separated(
                padding: const EdgeInsets.symmetric(vertical: 8),
                itemCount: items.length,
                separatorBuilder: (_, _) => const Divider(indent: 84),
                itemBuilder: (_, i) {
                  final b = items[i];
                  return ListTile(
                    contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 4),
                    leading: MemberAvatar(url: b.photoUrl, radius: 26),
                    title: Text(b.fullName, style: const TextStyle(fontWeight: FontWeight.w700)),
                    subtitle: b.blockedAt == null ? null : Text('Blocked ${displayDate(b.blockedAt!)}'),
                    trailing: TextButton(
                      onPressed: () async {
                        try {
                          await ref.read(repoProvider).unblock(b.userId);
                          ref.invalidate(_blockedProvider);
                          if (context.mounted) showSnack(context, '${b.fullName} is unblocked');
                        } on ApiException catch (e) {
                          if (context.mounted) showSnack(context, e.message);
                        }
                      },
                      child: const Text('Unblock'),
                    ),
                  );
                },
              ),
      ),
    );
  }
}
