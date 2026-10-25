import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../data/members.dart';
import '../../state/session.dart';
import '../../theme.dart';
import '../../widgets/member.dart';
import '../../widgets/top_actions.dart';

final _matchesProvider = FutureProvider.autoDispose<({List<MemberCard> connected, MatchesPage matches})>((ref) async {
  final repo = ref.watch(repoProvider);
  final results = await Future.wait([repo.connections(), repo.matches()]);
  return (connected: results[0] as List<MemberCard>, matches: results[1] as MatchesPage);
});

// As the website's Matches page: the members you're connected with, then
// your best matches (connected members aren't repeated there).
class MatchesScreen extends ConsumerWidget {
  const MatchesScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final data = ref.watch(_matchesProvider);
    void reload() => ref.invalidate(_matchesProvider);

    return Scaffold(
      appBar: AppBar(title: const Text('Matches'), actions: const [TopActions()]),
      body: RefreshIndicator(
        color: NK.maroon,
        onRefresh: () => ref.refresh(_matchesProvider.future),
        child: ListView(
          padding: const EdgeInsets.only(bottom: 32),
          children: [
            data.when(
              loading: () => loadingSpinner,
              error: (e, _) => LoadError(error: e, onRetry: reload),
              data: (d) {
                final top = d.matches.items.where((m) => m.relationship != Relationship.connected).toList();
                return Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    SectionTitle(
                      d.connected.isEmpty ? 'Connected members' : 'Connected members (${d.connected.length})',
                      subtitle: 'Accepted interests. You can message them.',
                    ),
                    if (d.connected.isEmpty)
                      const Padding(
                        padding: EdgeInsets.symmetric(horizontal: 18),
                        child: Text(
                          'No connections yet. When someone accepts your interest, or you accept theirs, they appear here.',
                          style: TextStyle(color: NK.muted, height: 1.5),
                        ),
                      )
                    else
                      MemberStrip(members: d.connected, onChanged: reload),
                    SectionTitle('Your top matches', subtitle: 'Ranked by your partner preferences, best first.'),
                    if (!d.matches.hasPreferences)
                      _Hint(
                        text: 'Set your partner preferences to get better-ranked matches.',
                        action: 'Set preferences',
                        onTap: () => context.push('/me/preferences'),
                      ),
                    if (d.matches.hiddenByMustHave > 0)
                      _Hint(
                        text: '${d.matches.hiddenByMustHave} more members are hidden by your must-have preferences.',
                        action: 'Edit',
                        onTap: () => context.push('/me/preferences'),
                      ),
                    if (top.isEmpty)
                      const EmptyState(
                        icon: Icons.favorite_border_rounded,
                        title: 'No matches yet',
                        message: 'No matches are available for your profile right now. Check back as new members join.',
                      )
                    else
                      Padding(
                        padding: const EdgeInsets.symmetric(horizontal: 16),
                        child: MemberGrid(
                          members: top,
                          onChanged: reload,
                          // The score can pass 100 (fit and listing bonus on top); never show more.
                          badgeFor: (m) => m.score == null ? null : '${m.score!.round().clamp(0, 100)}% match',
                        ),
                      ),
                  ],
                );
              },
            ),
          ],
        ),
      ),
    );
  }
}

class _Hint extends StatelessWidget {
  const _Hint({required this.text, required this.action, required this.onTap});
  final String text;
  final String action;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.fromLTRB(16, 0, 16, 12),
      padding: const EdgeInsets.fromLTRB(14, 6, 6, 6),
      decoration: BoxDecoration(color: NK.butter, borderRadius: BorderRadius.circular(14)),
      child: Row(
        children: [
          const Icon(Icons.tune_rounded, color: NK.goldText, size: 20),
          const SizedBox(width: 10),
          Expanded(child: Text(text, style: const TextStyle(fontSize: 13.5))),
          TextButton(onPressed: onTap, child: Text(action)),
        ],
      ),
    );
  }
}
