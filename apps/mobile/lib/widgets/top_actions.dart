import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../state/badges.dart';
import '../theme.dart';

// Search and the notifications bell, on the main tabs' app bars.
class TopActions extends ConsumerWidget {
  const TopActions({super.key, this.showSearch = true});
  final bool showSearch;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final unread = badgeText(ref.watch(badgesProvider).notifications);
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        if (showSearch)
          IconButton(tooltip: 'Search', onPressed: () => context.push('/search'), icon: const Icon(Icons.search_rounded)),
        IconButton(
          tooltip: unread == null ? 'Notifications' : '$unread unread notifications',
          onPressed: () => context.push('/notifications'),
          icon: Badge(
            isLabelVisible: unread != null,
            label: Text(unread ?? ''),
            backgroundColor: NK.maroon,
            child: const Icon(Icons.notifications_none_rounded),
          ),
        ),
        const SizedBox(width: 4),
      ],
    );
  }
}
