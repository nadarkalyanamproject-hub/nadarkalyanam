import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../data/api.dart';
import '../../data/members.dart';
import '../../state/badges.dart';
import '../../state/session.dart';
import '../../theme.dart';
import '../../widgets/form.dart';
import '../../widgets/member.dart';
import '../../widgets/top_actions.dart';

final _interestsProvider = FutureProvider.autoDispose((ref) async {
  final repo = ref.watch(repoProvider);
  final result = await repo.interests();
  // Opening the page is what clears the "new interests" dot.
  repo.markInterestsViewed().then((_) => ref.read(badgesProvider).refresh()).catchError((_) {});
  return result;
});

const _filters = {'ALL': 'All', 'PENDING': 'Pending', 'ACCEPTED': 'Accepted', 'DECLINED': 'Declined'};

class InterestsScreen extends ConsumerStatefulWidget {
  const InterestsScreen({super.key});

  @override
  ConsumerState<InterestsScreen> createState() => _InterestsScreenState();
}

class _InterestsScreenState extends ConsumerState<InterestsScreen> {
  String filter = 'ALL';

  @override
  Widget build(BuildContext context) {
    final data = ref.watch(_interestsProvider);
    return DefaultTabController(
      length: 2,
      child: Scaffold(
        appBar: AppBar(
          title: const Text('Interests'),
          actions: const [TopActions()],
          bottom: const TabBar(
            labelColor: NK.maroon,
            indicatorColor: NK.maroon,
            unselectedLabelColor: NK.muted,
            tabs: [Tab(text: 'Received'), Tab(text: 'Sent')],
          ),
        ),
        body: Column(
          children: [
            SizedBox(
              height: 54,
              child: ListView(
                scrollDirection: Axis.horizontal,
                padding: const EdgeInsets.fromLTRB(16, 10, 16, 6),
                children: [
                  for (final e in _filters.entries)
                    Padding(
                      padding: const EdgeInsets.only(right: 8),
                      child: ChoiceChip(
                        label: Text(e.value),
                        selected: filter == e.key,
                        showCheckmark: false,
                        selectedColor: NK.maroon,
                        labelStyle: TextStyle(color: filter == e.key ? Colors.white : NK.ink, fontWeight: FontWeight.w600),
                        backgroundColor: Colors.white,
                        side: BorderSide(color: filter == e.key ? NK.maroon : NK.line),
                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(999)),
                        onSelected: (_) => setState(() => filter = e.key),
                      ),
                    ),
                ],
              ),
            ),
            Expanded(
              child: data.when(
                loading: () => loadingSpinner,
                error: (e, _) => ListView(children: [LoadError(error: e, onRetry: () => ref.invalidate(_interestsProvider))]),
                data: (d) => TabBarView(
                  children: [
                    _InterestList(items: d.received, filter: filter, received: true),
                    _InterestList(items: d.sent, filter: filter, received: false),
                  ],
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _InterestList extends ConsumerWidget {
  const _InterestList({required this.items, required this.filter, required this.received});
  final List<Interest> items;
  final String filter;
  final bool received;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    // Withdrawn interests aren't shown; the filter narrows by status.
    final shown = items.where((i) => i.status != 'WITHDRAWN' && (filter == 'ALL' || i.status == filter)).toList();
    return RefreshIndicator(
      color: NK.maroon,
      onRefresh: () => ref.refresh(_interestsProvider.future),
      child: shown.isEmpty
          ? ListView(
              children: [
                EmptyState(
                  icon: received ? Icons.inbox_outlined : Icons.outbox_outlined,
                  title: received ? 'No interests received' : 'No interests sent',
                  message: received
                      ? 'When a member sends you an interest, it appears here for you to accept or decline.'
                      : 'Send an interest from a member\'s profile and it appears here.',
                  action: received ? null : OutlinedButton(onPressed: () => context.go('/matches'), child: const Text('See your matches')),
                ),
              ],
            )
          : ListView.separated(
              padding: const EdgeInsets.fromLTRB(16, 8, 16, 32),
              itemCount: shown.length,
              separatorBuilder: (_, _) => const SizedBox(height: 10),
              itemBuilder: (_, i) => _InterestTile(interest: shown[i]),
            ),
    );
  }
}

class _InterestTile extends ConsumerStatefulWidget {
  const _InterestTile({required this.interest});
  final Interest interest;

  @override
  ConsumerState<_InterestTile> createState() => _InterestTileState();
}

class _InterestTileState extends ConsumerState<_InterestTile> {
  bool busy = false;

  Future<void> _act(Future<void> Function() action, String done) async {
    setState(() => busy = true);
    try {
      await action();
      if (!mounted) return;
      showSnack(context, done);
      ref.invalidate(_interestsProvider);
      ref.read(badgesProvider).refresh();
    } on ApiException catch (e) {
      if (mounted) showSnack(context, e.message);
    } finally {
      if (mounted) setState(() => busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final i = widget.interest;
    final m = i.member;
    final repo = ref.read(repoProvider);
    final place = [?m.city, ?m.state].join(', ');
    final (statusLabel, statusColor) = switch (i.status) {
      'ACCEPTED' => ('Accepted', NK.success),
      'DECLINED' => ('Declined', NK.error),
      _ => (i.received ? 'Waiting for you' : 'Waiting for reply', NK.goldText),
    };

    return NkCard(
      padding: const EdgeInsets.all(14),
      onTap: () => context.push('/member/${m.profileId}'),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              MemberAvatar(url: m.photoUrl, radius: 30),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(firstName(m.fullName), style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 16)),
                    Text(
                      [if (m.age > 0) '${m.age} yrs', if (place.isNotEmpty) place].join(' · '),
                      style: const TextStyle(color: NK.muted, fontSize: 13),
                    ),
                    if (m.work != null) Text(m.work!, style: const TextStyle(color: NK.subtle, fontSize: 12.5)),
                  ],
                ),
              ),
              Column(
                crossAxisAlignment: CrossAxisAlignment.end,
                children: [
                  Text(statusLabel, style: TextStyle(color: statusColor, fontWeight: FontWeight.w700, fontSize: 12)),
                  if (i.createdAt != null)
                    Text(displayDate(i.createdAt!), style: const TextStyle(color: NK.subtle, fontSize: 11.5)),
                ],
              ),
            ],
          ),
          if (i.status == 'PENDING' && i.received) ...[
            const SizedBox(height: 12),
            Row(
              children: [
                Expanded(
                  child: OutlinedButton(
                    style: OutlinedButton.styleFrom(minimumSize: const Size.fromHeight(42)),
                    onPressed: busy ? null : () => _act(() => repo.declineInterest(i.id), 'Interest declined'),
                    child: const Text('Decline'),
                  ),
                ),
                const SizedBox(width: 10),
                Expanded(
                  child: FilledButton(
                    style: FilledButton.styleFrom(minimumSize: const Size.fromHeight(42)),
                    onPressed: busy ? null : () => _act(() => repo.acceptInterest(i.id), 'Accepted. You can now message each other.'),
                    child: const Text('Accept'),
                  ),
                ),
              ],
            ),
          ],
          if (i.status == 'PENDING' && !i.received) ...[
            const SizedBox(height: 8),
            Align(
              alignment: Alignment.centerRight,
              child: TextButton(
                onPressed: busy ? null : () => _act(() => repo.withdrawInterest(i.id), 'Interest withdrawn'),
                child: const Text('Withdraw'),
              ),
            ),
          ],
          if (i.status == 'ACCEPTED') ...[
            const SizedBox(height: 10),
            OutlinedButton.icon(
              style: OutlinedButton.styleFrom(minimumSize: const Size.fromHeight(42)),
              onPressed: () => context.go('/messages'),
              icon: const Icon(Icons.chat_bubble_outline_rounded, size: 18),
              label: const Text('Go to messages'),
            ),
          ],
        ],
      ),
    );
  }
}
