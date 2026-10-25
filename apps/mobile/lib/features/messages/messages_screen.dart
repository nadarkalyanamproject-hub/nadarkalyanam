import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';

import '../../data/api.dart';
import '../../data/members.dart';
import '../../state/badges.dart';
import '../../state/session.dart';
import '../../theme.dart';
import '../../widgets/form.dart';
import '../../widgets/member.dart';
import '../../widgets/top_actions.dart';
import '../member/member_screen.dart';

final _conversationsProvider = FutureProvider.autoDispose((ref) => ref.watch(repoProvider).conversations());

class MessagesScreen extends ConsumerWidget {
  const MessagesScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final data = ref.watch(_conversationsProvider);
    final me = ref.watch(tokenStoreProvider).userId;
    return Scaffold(
      appBar: AppBar(title: const Text('Messages'), actions: const [TopActions()]),
      body: RefreshIndicator(
        color: NK.maroon,
        onRefresh: () {
          ref.read(badgesProvider).refresh();
          return ref.refresh(_conversationsProvider.future);
        },
        child: data.when(
          loading: () => ListView(children: const [loadingSpinner]),
          error: (e, _) => ListView(children: [LoadError(error: e, onRetry: () => ref.invalidate(_conversationsProvider))]),
          data: (items) => items.isEmpty
              ? ListView(
                  children: [
                    EmptyState(
                      icon: Icons.chat_bubble_outline_rounded,
                      title: 'No conversations yet',
                      message: 'When an interest is accepted, either way, you can message each other here.',
                      action: OutlinedButton(onPressed: () => context.go('/interests'), child: const Text('See your interests')),
                    ),
                  ],
                )
              : ListView.separated(
                  padding: const EdgeInsets.symmetric(vertical: 6),
                  itemCount: items.length,
                  separatorBuilder: (_, _) => const Divider(indent: 84),
                  itemBuilder: (_, i) {
                    final c = items[i];
                    final unread = c.unreadCount > 0;
                    final mine = c.lastSenderId != null && c.lastSenderId == me;
                    return ListTile(
                      contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 6),
                      leading: MemberAvatar(url: c.otherPhotoUrl, radius: 28),
                      title: Text(c.otherName, style: TextStyle(fontWeight: unread ? FontWeight.w800 : FontWeight.w600)),
                      subtitle: Text(
                        c.lastBody == null ? 'Say hello' : '${mine ? 'You: ' : ''}${c.lastBody}',
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: TextStyle(color: unread ? NK.ink : NK.muted, fontWeight: unread ? FontWeight.w600 : FontWeight.w400),
                      ),
                      trailing: Column(
                        mainAxisAlignment: MainAxisAlignment.center,
                        crossAxisAlignment: CrossAxisAlignment.end,
                        children: [
                          if (c.lastActivityAt != null)
                            Text(relativeTime(c.lastActivityAt!), style: const TextStyle(fontSize: 11.5, color: NK.subtle)),
                          if (unread) ...[
                            const SizedBox(height: 4),
                            Badge(label: Text(badgeText(c.unreadCount)!), backgroundColor: NK.maroon),
                          ],
                        ],
                      ),
                      onTap: () async {
                        await context.push('/messages/${c.id}');
                        ref.invalidate(_conversationsProvider);
                        ref.read(badgesProvider).refresh();
                      },
                    );
                  },
                ),
        ),
      ),
    );
  }
}

// One conversation. Like the website, new messages arrive by polling every
// 4 seconds while it is open; opening it marks the other side's messages read.
class ThreadScreen extends ConsumerStatefulWidget {
  const ThreadScreen({super.key, required this.conversationId});
  final String conversationId;

  @override
  ConsumerState<ThreadScreen> createState() => _ThreadScreenState();
}

class _ThreadScreenState extends ConsumerState<ThreadScreen> {
  final input = TextEditingController();
  final scroll = ScrollController();
  Conversation? header;
  List<Message>? messages;
  Object? error;
  bool sending = false;
  Timer? timer;

  @override
  void initState() {
    super.initState();
    _loadHeader();
    _fetch();
    timer = Timer.periodic(const Duration(seconds: 4), (_) => _fetch());
  }

  @override
  void dispose() {
    timer?.cancel();
    input.dispose();
    scroll.dispose();
    super.dispose();
  }

  Future<void> _loadHeader() async {
    try {
      final c = await ref.read(repoProvider).conversation(widget.conversationId);
      if (mounted) setState(() => header = c);
    } catch (_) {}
  }

  Future<void> _fetch() async {
    try {
      final list = await ref.read(repoProvider).messages(widget.conversationId);
      if (!mounted) return;
      final grew = list.length != (messages?.length ?? 0);
      setState(() {
        messages = list;
        error = null;
      });
      if (grew) ref.read(badgesProvider).refresh();
    } catch (e) {
      if (mounted && messages == null) setState(() => error = e);
    }
  }

  Future<void> _send() async {
    final text = input.text.trim();
    if (text.isEmpty) return;
    setState(() => sending = true);
    try {
      final sent = await ref.read(repoProvider).sendMessage(widget.conversationId, text);
      if (!mounted) return;
      input.clear();
      setState(() => messages = [...?messages, sent]);
    } on ApiException catch (e) {
      if (mounted) showSnack(context, e.message);
    } finally {
      if (mounted) setState(() => sending = false);
    }
  }

  Future<void> _block() async {
    final h = header;
    if (h == null) return;
    final ok = await confirmBlock(context, h.otherName);
    if (ok != true || !mounted) return;
    try {
      await ref.read(repoProvider).blockUser(h.otherUserId);
      if (!mounted) return;
      showSnack(context, '${h.otherName} is blocked');
      context.pop();
    } on ApiException catch (e) {
      if (mounted) showSnack(context, e.message);
    }
  }

  @override
  Widget build(BuildContext context) {
    final h = header;
    final me = ref.watch(tokenStoreProvider).userId;
    final list = messages;
    return Scaffold(
      appBar: AppBar(
        titleSpacing: 0,
        title: InkWell(
          onTap: h?.otherProfileId == null || !h!.otherAvailable ? null : () => context.push('/member/${h.otherProfileId}'),
          child: Row(
            children: [
              MemberAvatar(url: h?.otherPhotoUrl, radius: 18),
              const SizedBox(width: 10),
              Flexible(child: Text(h?.otherName ?? '', overflow: TextOverflow.ellipsis)),
            ],
          ),
        ),
        actions: [
          if (h != null && h.otherAvailable)
            PopupMenuButton<String>(
              onSelected: (v) {
                if (v == 'profile' && h.otherProfileId != null) context.push('/member/${h.otherProfileId}');
                if (v == 'block') _block();
              },
              itemBuilder: (_) => [
                if (h.otherProfileId != null) const PopupMenuItem(value: 'profile', child: Text('View profile')),
                const PopupMenuItem(value: 'block', child: Text('Block member')),
              ],
            ),
        ],
      ),
      body: Column(
        children: [
          Expanded(
            child: error != null
                ? ListView(children: [LoadError(error: error!, onRetry: _fetch)])
                : list == null
                    ? loadingSpinner
                    : list.isEmpty
                        ? ListView(
                            children: const [
                              EmptyState(
                                icon: Icons.waving_hand_outlined,
                                title: 'Start the conversation',
                                message: 'Say hello and introduce yourself or your family.',
                              ),
                            ],
                          )
                        : ListView.builder(
                            controller: scroll,
                            reverse: true,
                            padding: const EdgeInsets.fromLTRB(12, 12, 12, 12),
                            itemCount: list.length,
                            itemBuilder: (_, i) {
                              final idx = list.length - 1 - i;
                              final msg = list[idx];
                              final prev = idx > 0 ? list[idx - 1] : null;
                              final showDay = msg.createdAt != null &&
                                  (prev?.createdAt == null || !_sameDay(prev!.createdAt!, msg.createdAt!));
                              return Column(
                                children: [
                                  if (showDay) _DayChip(date: msg.createdAt!),
                                  _Bubble(
                                    message: msg,
                                    mine: msg.senderId == me,
                                    onReport: () => showReportSheet(context, ref, targetType: 'MESSAGE', targetId: msg.id, name: h?.otherName ?? ''),
                                  ),
                                ],
                              );
                            },
                          ),
          ),
          if (h != null && !h.otherAvailable)
            const Padding(
              padding: EdgeInsets.all(16),
              child: Text('This member is no longer available.', style: TextStyle(color: NK.muted)),
            )
          else
            SafeArea(
              top: false,
              child: Container(
                padding: const EdgeInsets.fromLTRB(12, 8, 8, 8),
                decoration: const BoxDecoration(color: Colors.white, border: Border(top: BorderSide(color: NK.line))),
                child: Row(
                  crossAxisAlignment: CrossAxisAlignment.end,
                  children: [
                    Expanded(
                      child: TextField(
                        controller: input,
                        minLines: 1,
                        maxLines: 5,
                        maxLength: 2000,
                        textCapitalization: TextCapitalization.sentences,
                        decoration: const InputDecoration(hintText: 'Type a message', counterText: ''),
                      ),
                    ),
                    const SizedBox(width: 6),
                    IconButton.filled(
                      style: IconButton.styleFrom(backgroundColor: NK.maroon, minimumSize: const Size(50, 50)),
                      onPressed: sending ? null : _send,
                      icon: sending
                          ? const SizedBox(width: 20, height: 20, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
                          : const Icon(Icons.send_rounded, color: Colors.white),
                    ),
                  ],
                ),
              ),
            ),
        ],
      ),
    );
  }

  static bool _sameDay(DateTime a, DateTime b) {
    final x = a.toLocal(), y = b.toLocal();
    return x.year == y.year && x.month == y.month && x.day == y.day;
  }
}

class _DayChip extends StatelessWidget {
  const _DayChip({required this.date});
  final DateTime date;

  @override
  Widget build(BuildContext context) {
    final d = date.toLocal();
    final now = DateTime.now();
    final today = DateTime(now.year, now.month, now.day);
    final day = DateTime(d.year, d.month, d.day);
    final label = day == today ? 'Today' : day == today.subtract(const Duration(days: 1)) ? 'Yesterday' : displayDate(d);
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 10),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 4),
        decoration: BoxDecoration(color: NK.butter, borderRadius: BorderRadius.circular(999)),
        child: Text(label, style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: NK.goldText)),
      ),
    );
  }
}

class _Bubble extends StatelessWidget {
  const _Bubble({required this.message, required this.mine, required this.onReport});
  final Message message;
  final bool mine;
  final VoidCallback onReport;

  @override
  Widget build(BuildContext context) {
    final time = message.createdAt == null ? '' : DateFormat('h:mm a').format(message.createdAt!.toLocal());
    return Align(
      alignment: mine ? Alignment.centerRight : Alignment.centerLeft,
      child: GestureDetector(
        onLongPress: mine
            ? null
            : () => showModalBottomSheet(
                  context: context,
                  builder: (sheet) => SafeArea(
                    child: ListTile(
                      leading: const Icon(Icons.flag_outlined),
                      title: const Text('Report this message'),
                      onTap: () {
                        Navigator.pop(sheet);
                        onReport();
                      },
                    ),
                  ),
                ),
        child: Container(
          constraints: BoxConstraints(maxWidth: MediaQuery.of(context).size.width * 0.78),
          margin: const EdgeInsets.symmetric(vertical: 3),
          padding: const EdgeInsets.fromLTRB(14, 9, 12, 7),
          decoration: BoxDecoration(
            color: mine ? NK.maroon : Colors.white,
            border: mine ? null : Border.all(color: NK.line),
            borderRadius: BorderRadius.only(
              topLeft: const Radius.circular(18),
              topRight: const Radius.circular(18),
              bottomLeft: Radius.circular(mine ? 18 : 4),
              bottomRight: Radius.circular(mine ? 4 : 18),
            ),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.end,
            children: [
              Text(message.body, style: TextStyle(color: mine ? Colors.white : NK.ink, fontSize: 15, height: 1.35)),
              const SizedBox(height: 3),
              Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Text(time, style: TextStyle(fontSize: 11, color: mine ? Colors.white70 : NK.subtle)),
                  if (mine) ...[
                    const SizedBox(width: 4),
                    Icon(
                      message.status == 'READ' ? Icons.done_all_rounded : Icons.done_rounded,
                      size: 14,
                      color: message.status == 'READ' ? NK.goldLight : Colors.white70,
                    ),
                  ],
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }
}
