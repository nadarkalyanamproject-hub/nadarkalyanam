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

const _tabs = {'all': 'All', 'unread': 'Unread', 'interests': 'Interests', 'profile': 'Profile views'};

// Where a notification leads (the web's notificationDestination); null
// when there's nothing to open any more.
String? _destination(AppNotification n) {
  if (!n.targetAvailable) return null;
  switch (n.type) {
    case 'INTEREST_RECEIVED':
      return '/interests';
    case 'INTEREST_ACCEPTED':
    case 'NEW_MESSAGE':
      return n.targetId == null ? '/messages' : '/messages/${n.targetId}';
    case 'PROFILE_VIEWED':
      return n.targetId == null ? null : '/member/${n.targetId}';
    case 'ADMIN_PHOTO_REMOVED':
    case 'ACCOUNT_SUSPENDED':
    case 'ACCOUNT_REINSTATED':
    case 'REMOVAL_SCHEDULED':
    case 'REMOVAL_CANCELLED':
      return '/me/profile';
    case 'PLAN_ACTIVATED':
    case 'PLAN_EXPIRED':
    case 'PLAN_CANCELLED':
    case 'PLAN_EXPIRING_SOON':
      return '/membership';
  }
  return null;
}

IconData _icon(String type) => switch (type) {
      'INTEREST_RECEIVED' || 'INTEREST_ACCEPTED' => Icons.favorite_rounded,
      'NEW_MESSAGE' => Icons.chat_bubble_rounded,
      'PROFILE_VIEWED' => Icons.visibility_rounded,
      'PLAN_ACTIVATED' || 'PLAN_EXPIRED' || 'PLAN_CANCELLED' || 'PLAN_EXPIRING_SOON' => Icons.workspace_premium_rounded,
      _ => Icons.info_rounded,
    };

class NotificationsScreen extends ConsumerStatefulWidget {
  const NotificationsScreen({super.key});

  @override
  ConsumerState<NotificationsScreen> createState() => _NotificationsScreenState();
}

class _NotificationsScreenState extends ConsumerState<NotificationsScreen> {
  String tab = 'all';
  final items = <AppNotification>[];
  int? nextOffset;
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
      final page = await ref.read(repoProvider).notifications(category: tab, offset: reset ? 0 : (nextOffset ?? 0));
      if (!mounted) return;
      setState(() {
        if (reset) items.clear();
        items.addAll(page.items);
        nextOffset = page.nextOffset;
      });
    } catch (e) {
      if (mounted) setState(() => error = e);
    } finally {
      if (mounted) setState(() => loading = false);
    }
  }

  Future<void> _open(AppNotification n) async {
    final repo = ref.read(repoProvider);
    if (!n.isRead) {
      repo.markNotificationRead(n.id).then((_) => ref.read(badgesProvider).refresh()).catchError((_) {});
      setState(() => n.json['isRead'] = true);
    }
    final to = _destination(n);
    if (to == null) {
      showSnack(context, n.targetAvailable ? 'There is nothing more to open for this notification.' : 'This profile is no longer available.');
      return;
    }
    if (to == '/interests' || to == '/messages') {
      context.go(to);
    } else {
      context.push(to);
    }
  }

  Future<void> _all(Future<void> Function() action) async {
    try {
      await action();
      await _load(reset: true);
      ref.read(badgesProvider).refresh();
    } on ApiException catch (e) {
      if (mounted) showSnack(context, e.message);
    }
  }

  @override
  Widget build(BuildContext context) {
    final repo = ref.read(repoProvider);
    return Scaffold(
      appBar: AppBar(
        title: const Text('Notifications'),
        actions: [
          PopupMenuButton<String>(
            onSelected: (v) async {
              if (v == 'read') return _all(repo.markAllNotificationsRead);
              final ok = await showDialog<bool>(
                context: context,
                builder: (context) => AlertDialog(
                  title: const Text('Clear all notifications?'),
                  content: const Text('This removes every notification from this list.'),
                  actions: [
                    TextButton(onPressed: () => Navigator.pop(context, false), child: const Text('Cancel')),
                    TextButton(onPressed: () => Navigator.pop(context, true), child: const Text('Clear all')),
                  ],
                ),
              );
              if (ok == true) await _all(repo.clearNotifications);
            },
            itemBuilder: (_) => const [
              PopupMenuItem(value: 'read', child: Text('Mark all as read')),
              PopupMenuItem(value: 'clear', child: Text('Clear all')),
            ],
          ),
        ],
      ),
      body: Column(
        children: [
          SizedBox(
            height: 54,
            child: ListView(
              scrollDirection: Axis.horizontal,
              padding: const EdgeInsets.fromLTRB(16, 10, 16, 6),
              children: [
                for (final e in _tabs.entries)
                  Padding(
                    padding: const EdgeInsets.only(right: 8),
                    child: ChoiceChip(
                      label: Text(e.value),
                      selected: tab == e.key,
                      showCheckmark: false,
                      selectedColor: NK.maroon,
                      labelStyle: TextStyle(color: tab == e.key ? Colors.white : NK.ink, fontWeight: FontWeight.w600),
                      backgroundColor: Colors.white,
                      side: BorderSide(color: tab == e.key ? NK.maroon : NK.line),
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(999)),
                      onSelected: (_) {
                        setState(() => tab = e.key);
                        _load(reset: true);
                      },
                    ),
                  ),
              ],
            ),
          ),
          Expanded(
            child: RefreshIndicator(
              color: NK.maroon,
              onRefresh: () => _load(reset: true),
              child: error != null && items.isEmpty
                  ? ListView(children: [LoadError(error: error!, onRetry: () => _load(reset: true))])
                  : loading && items.isEmpty
                      ? ListView(children: const [loadingSpinner])
                      : items.isEmpty
                          ? ListView(
                              children: const [
                                EmptyState(
                                  icon: Icons.notifications_none_rounded,
                                  title: 'Nothing here',
                                  message: 'Interests, profile views and plan updates show up here.',
                                ),
                              ],
                            )
                          : ListView.builder(
                              itemCount: items.length + (nextOffset != null ? 1 : 0),
                              itemBuilder: (_, i) {
                                if (i == items.length) {
                                  return Padding(
                                    padding: const EdgeInsets.all(16),
                                    child: OutlinedButton(
                                      onPressed: loading ? null : () => _load(),
                                      child: Text(loading ? 'Loading…' : 'Load more'),
                                    ),
                                  );
                                }
                                final n = items[i];
                                return Material(
                                  color: n.isRead ? Colors.transparent : NK.butter.withValues(alpha: 0.6),
                                  child: ListTile(
                                    contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 6),
                                    leading: Stack(
                                      clipBehavior: Clip.none,
                                      children: [
                                        MemberAvatar(url: n.actorPhotoUrl, radius: 24),
                                        Positioned(
                                          right: -4,
                                          bottom: -4,
                                          child: CircleAvatar(
                                            radius: 11,
                                            backgroundColor: Colors.white,
                                            child: Icon(_icon(n.type), size: 13, color: NK.maroon),
                                          ),
                                        ),
                                      ],
                                    ),
                                    title: Text(n.message, style: TextStyle(fontWeight: n.isRead ? FontWeight.w500 : FontWeight.w700, fontSize: 14.5)),
                                    subtitle: n.createdAt == null ? null : Text(relativeTime(n.createdAt!), style: const TextStyle(fontSize: 12)),
                                    trailing: n.isRead ? null : const CircleAvatar(radius: 4, backgroundColor: NK.maroon),
                                    onTap: () => _open(n),
                                  ),
                                );
                              },
                            ),
            ),
          ),
        ],
      ),
    );
  }
}
