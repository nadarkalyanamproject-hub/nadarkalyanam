import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../data/api.dart';
import '../../state/session.dart';
import '../../theme.dart';
import '../../widgets/form.dart';
import '../../widgets/member.dart';
import '../../widgets/top_actions.dart';

// The member's own corner: their profile and everything about their account.
class MeScreen extends ConsumerWidget {
  const MeScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final p = ref.watch(sessionProvider).profile;
    final city = p?.location['city'];
    return Scaffold(
      appBar: AppBar(title: const Text('Me'), actions: const [TopActions(showSearch: false)]),
      body: ListView(
        padding: const EdgeInsets.fromLTRB(16, 18, 16, 32),
        children: [
          NkCard(
            onTap: () => context.push('/me/profile'),
            child: Row(
              children: [
                MemberAvatar(url: p?.primaryPhoto?.url, radius: 32),
                const SizedBox(width: 14),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(p?.fullName ?? '', style: serif(22, color: NK.ink)),
                      Text(
                        [if (p?.age != null) '${p!.age} yrs', if (city is String && city.isNotEmpty) city].join(' · '),
                        style: const TextStyle(color: NK.muted),
                      ),
                      const SizedBox(height: 4),
                      Text('${p?.completionScore ?? 0}% complete · View and edit', style: const TextStyle(color: NK.maroon, fontWeight: FontWeight.w600, fontSize: 13)),
                    ],
                  ),
                ),
                const Icon(Icons.chevron_right_rounded, color: NK.muted),
              ],
            ),
          ),
          const SizedBox(height: 14),
          _Menu(items: [
            _Item(Icons.person_outline_rounded, 'My profile', '/me/profile'),
            _Item(Icons.photo_library_outlined, 'My photos', '/photos'),
            _Item(Icons.tune_rounded, 'Partner preferences', '/me/preferences'),
            _Item(Icons.auto_awesome_outlined, 'Horoscope', '/me/horoscope'),
          ]),
          const SizedBox(height: 14),
          _Menu(items: [
            _Item(Icons.workspace_premium_outlined, 'Membership', '/membership'),
            _Item(Icons.contact_phone_outlined, 'Unlocked contacts', '/me/contacts'),
            _Item(Icons.search_rounded, 'Search members', '/search'),
            _Item(Icons.notifications_none_rounded, 'Notifications', '/notifications'),
          ]),
          const SizedBox(height: 14),
          _Menu(items: [
            _Item(Icons.block_rounded, 'Blocked members', '/me/blocked'),
            _Item(Icons.settings_outlined, 'Settings & help', '/me/settings'),
          ]),
        ],
      ),
    );
  }
}

class _Item {
  const _Item(this.icon, this.label, this.path);
  final IconData icon;
  final String label;
  final String path;
}

class _Menu extends StatelessWidget {
  const _Menu({required this.items});
  final List<_Item> items;

  @override
  Widget build(BuildContext context) {
    return NkCard(
      padding: EdgeInsets.zero,
      child: Column(
        children: [
          for (var i = 0; i < items.length; i++) ...[
            if (i > 0) const Divider(indent: 56),
            ListTile(
              leading: Icon(items[i].icon, color: NK.maroon),
              title: Text(items[i].label, style: const TextStyle(fontWeight: FontWeight.w600)),
              trailing: const Icon(Icons.chevron_right_rounded, color: NK.muted),
              onTap: () => context.push(items[i].path),
            ),
          ],
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
