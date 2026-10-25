import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';

import '../data/api.dart';
import '../data/members.dart';
import '../state/session.dart';
import '../theme.dart';
import 'form.dart';

// Dates as the website shows them: dd-mm-yyyy, India time on the device.
String displayDate(DateTime d) => DateFormat('dd-MM-yyyy').format(d.toLocal());

// "Just now", "5 min ago", "3 h ago", "Yesterday", then the date.
String relativeTime(DateTime d) {
  final diff = DateTime.now().difference(d.toLocal());
  if (diff.inMinutes < 1) return 'Just now';
  if (diff.inHours < 1) return '${diff.inMinutes} min ago';
  if (diff.inDays < 1) return '${diff.inHours} h ago';
  if (diff.inDays == 1) return 'Yesterday';
  if (diff.inDays < 7) return '${diff.inDays} days ago';
  return displayDate(d);
}

String firstName(String fullName) => fullName.split(' ').first;

class MemberAvatar extends StatelessWidget {
  const MemberAvatar({super.key, required this.url, this.radius = 26});
  final String? url;
  final double radius;

  @override
  Widget build(BuildContext context) => CircleAvatar(
        radius: radius,
        backgroundColor: NK.butter,
        foregroundImage: url == null ? null : NetworkImage(url!),
        child: Icon(Icons.person_outline_rounded, color: NK.maroon, size: radius),
      );
}

// A member's photo filling its box, with a soft placeholder when they have
// none (or it fails to load).
class MemberPhoto extends StatelessWidget {
  const MemberPhoto({super.key, required this.url, this.iconSize = 48});
  final String? url;
  final double iconSize;

  @override
  Widget build(BuildContext context) {
    final placeholder = Container(
      color: NK.butter,
      alignment: Alignment.center,
      child: Icon(Icons.person_outline_rounded, color: NK.gold, size: iconSize),
    );
    if (url == null) return placeholder;
    return Image.network(
      url!,
      fit: BoxFit.cover,
      errorBuilder: (_, _, _) => placeholder,
      loadingBuilder: (_, child, progress) => progress == null ? child : placeholder,
    );
  }
}

// The two-column photo card used on every member list.
class MemberGridCard extends StatelessWidget {
  const MemberGridCard({super.key, required this.member, this.onChanged, this.badge});
  final MemberCard member;
  // Called after an interest is sent from the card, so the list can reload.
  final VoidCallback? onChanged;
  final String? badge;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: Colors.white,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(18), side: const BorderSide(color: NK.lineGold)),
      clipBehavior: Clip.antiAlias,
      child: InkWell(
        onTap: () => context.push('/member/${member.profileId}'),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Expanded(
              child: Stack(
                fit: StackFit.expand,
                children: [
                  MemberPhoto(url: member.photoUrl),
                  if (badge != null)
                    Positioned(
                      left: 8,
                      top: 8,
                      child: Container(
                        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                        decoration: BoxDecoration(color: NK.maroon, borderRadius: BorderRadius.circular(999)),
                        child: Text(badge!, style: const TextStyle(color: Colors.white, fontSize: 11, fontWeight: FontWeight.w700)),
                      ),
                    ),
                ],
              ),
            ),
            Padding(
              padding: const EdgeInsets.fromLTRB(10, 8, 10, 2),
              child: Row(
                children: [
                  Flexible(
                    child: Text(firstName(member.fullName),
                        maxLines: 1, overflow: TextOverflow.ellipsis, style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 15)),
                  ),
                  if (member.isVerified) ...[const SizedBox(width: 4), const Icon(Icons.verified_rounded, color: NK.gold, size: 16)],
                ],
              ),
            ),
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 10),
              child: Text(member.ageAndCity, maxLines: 1, overflow: TextOverflow.ellipsis, style: const TextStyle(color: NK.muted, fontSize: 12.5)),
            ),
            Padding(
              padding: const EdgeInsets.fromLTRB(10, 0, 10, 6),
              child: Text(member.work ?? ' ', maxLines: 1, overflow: TextOverflow.ellipsis, style: const TextStyle(color: NK.subtle, fontSize: 12)),
            ),
            Padding(
              padding: const EdgeInsets.fromLTRB(8, 0, 8, 8),
              child: RelationshipButton(
                profileId: member.profileId,
                relationship: member.relationship,
                conversationId: member.conversationId,
                compact: true,
                onChanged: onChanged,
              ),
            ),
          ],
        ),
      ),
    );
  }
}

// The one interest action for a member, from the relationship the API
// returns (as the web's relationshipActionView): send, sent, respond, or
// message once connected.
class RelationshipButton extends ConsumerStatefulWidget {
  const RelationshipButton({
    super.key,
    required this.profileId,
    required this.relationship,
    this.conversationId,
    this.compact = false,
    this.onChanged,
  });
  final String profileId;
  final Relationship relationship;
  final String? conversationId;
  final bool compact;
  final VoidCallback? onChanged;

  @override
  ConsumerState<RelationshipButton> createState() => _RelationshipButtonState();
}

class _RelationshipButtonState extends ConsumerState<RelationshipButton> {
  bool busy = false;
  Relationship? sentNow;

  Relationship get current => sentNow ?? widget.relationship;

  Future<void> _send() async {
    setState(() => busy = true);
    try {
      await ref.read(repoProvider).sendInterest(widget.profileId);
      if (!mounted) return;
      setState(() => sentNow = Relationship.sent);
      showSnack(context, 'Interest sent');
      widget.onChanged?.call();
    } on ApiException catch (e) {
      if (mounted) showSnack(context, e.message);
    } finally {
      if (mounted) setState(() => busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final height = widget.compact ? 38.0 : 52.0;
    final text = TextStyle(fontSize: widget.compact ? 13 : 16, fontWeight: FontWeight.w700);
    final size = Size.fromHeight(height);
    switch (current) {
      case Relationship.connected:
        return FilledButton.icon(
          style: FilledButton.styleFrom(minimumSize: size, textStyle: text, backgroundColor: NK.success),
          onPressed: () =>
              widget.conversationId == null ? context.go('/messages') : context.push('/messages/${widget.conversationId}'),
          icon: Icon(Icons.chat_bubble_outline_rounded, size: widget.compact ? 16 : 20),
          label: const Text('Message'),
        );
      case Relationship.received:
        return FilledButton(
          style: FilledButton.styleFrom(minimumSize: size, textStyle: text, backgroundColor: NK.goldText),
          onPressed: () => context.go('/interests'),
          child: const Text('Respond'),
        );
      case Relationship.sent:
        return OutlinedButton.icon(
          style: OutlinedButton.styleFrom(minimumSize: size, textStyle: text, foregroundColor: NK.muted, side: const BorderSide(color: NK.line)),
          onPressed: null,
          icon: Icon(Icons.check_rounded, size: widget.compact ? 16 : 20),
          label: const Text('Interest sent'),
        );
      case Relationship.none:
        return FilledButton.icon(
          style: FilledButton.styleFrom(minimumSize: size, textStyle: text),
          onPressed: busy ? null : _send,
          icon: busy
              ? const SizedBox(width: 16, height: 16, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
              : Icon(Icons.favorite_border_rounded, size: widget.compact ? 16 : 20),
          label: Text(widget.compact ? 'Interest' : 'Send interest'),
        );
    }
  }
}

// A grid of member cards that sizes itself inside a scroll view.
class MemberGrid extends StatelessWidget {
  const MemberGrid({super.key, required this.members, this.onChanged, this.badgeFor});
  final List<MemberCard> members;
  final VoidCallback? onChanged;
  final String? Function(MemberCard)? badgeFor;

  @override
  Widget build(BuildContext context) {
    return GridView.builder(
      shrinkWrap: true,
      physics: const NeverScrollableScrollPhysics(),
      padding: EdgeInsets.zero,
      gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
        crossAxisCount: 2,
        mainAxisSpacing: 12,
        crossAxisSpacing: 12,
        childAspectRatio: 0.58,
      ),
      itemCount: members.length,
      itemBuilder: (_, i) => MemberGridCard(member: members[i], onChanged: onChanged, badge: badgeFor?.call(members[i])),
    );
  }
}

// A horizontal strip of member cards (Home sections).
class MemberStrip extends StatelessWidget {
  const MemberStrip({super.key, required this.members, this.onChanged});
  final List<MemberCard> members;
  final VoidCallback? onChanged;

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      height: 290,
      child: ListView.separated(
        scrollDirection: Axis.horizontal,
        padding: const EdgeInsets.symmetric(horizontal: 18),
        itemCount: members.length,
        separatorBuilder: (_, _) => const SizedBox(width: 12),
        itemBuilder: (_, i) => SizedBox(width: 168, child: MemberGridCard(member: members[i], onChanged: onChanged)),
      ),
    );
  }
}

class EmptyState extends StatelessWidget {
  const EmptyState({super.key, required this.icon, required this.title, this.message, this.action});
  final IconData icon;
  final String title;
  final String? message;
  final Widget? action;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 28, vertical: 48),
      child: Column(
        children: [
          Container(
            width: 72,
            height: 72,
            decoration: const BoxDecoration(color: NK.butter, shape: BoxShape.circle),
            child: Icon(icon, color: NK.gold, size: 34),
          ),
          const SizedBox(height: 16),
          Text(title, textAlign: TextAlign.center, style: serif(22, color: NK.ink)),
          if (message != null) ...[
            const SizedBox(height: 8),
            Text(message!, textAlign: TextAlign.center, style: const TextStyle(color: NK.muted, height: 1.5)),
          ],
          if (action != null) ...[const SizedBox(height: 18), action!],
        ],
      ),
    );
  }
}

// What a list shows when its request fails. Matching is closed before
// launch day and, when plans are required, to members without one: the API
// says so with PRE_LAUNCH / PLAN_REQUIRED and the screen explains instead
// of showing a bare error.
class LoadError extends StatelessWidget {
  const LoadError({super.key, required this.error, required this.onRetry});
  final Object error;
  final VoidCallback onRetry;

  @override
  Widget build(BuildContext context) {
    final code = error is ApiException ? (error as ApiException).code : null;
    if (code == 'PRE_LAUNCH') {
      return EmptyState(
        icon: Icons.hourglass_top_rounded,
        title: 'Matching opens soon',
        message: '$error',
        action: OutlinedButton(onPressed: () => context.go('/home'), child: const Text('See the launch offer')),
      );
    }
    if (code == 'PLAN_REQUIRED') {
      return EmptyState(
        icon: Icons.workspace_premium_outlined,
        title: 'A plan is needed',
        message: '$error',
        action: FilledButton(onPressed: () => context.push('/membership'), child: const Text('See plans')),
      );
    }
    return EmptyState(
      icon: Icons.cloud_off_rounded,
      title: 'Could not load this',
      message: '$error',
      action: OutlinedButton(onPressed: onRetry, child: const Text('Try again')),
    );
  }
}

class SectionTitle extends StatelessWidget {
  const SectionTitle(this.title, {super.key, this.subtitle, this.onMore, this.padding = const EdgeInsets.fromLTRB(18, 24, 8, 10)});
  final String title;
  final String? subtitle;
  final VoidCallback? onMore;
  final EdgeInsets padding;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: padding,
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.end,
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(title, style: serif(22, color: NK.maroon)),
                if (subtitle != null) ...[
                  const SizedBox(height: 2),
                  Text(subtitle!, style: const TextStyle(color: NK.muted, fontSize: 13)),
                ],
              ],
            ),
          ),
          if (onMore != null) TextButton(onPressed: onMore, child: const Text('See all')),
        ],
      ),
    );
  }
}

const loadingSpinner = Padding(
  padding: EdgeInsets.all(40),
  child: Center(child: CircularProgressIndicator(color: NK.maroon)),
);
