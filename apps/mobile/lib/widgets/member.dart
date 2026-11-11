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

// The first name, skipping a title such as "Dr." or "Mrs.".
String firstName(String fullName) {
  const titles = {'dr', 'mr', 'mrs', 'ms', 'miss', 'er', 'prof', 'thiru', 'selvi', 'tmt'};
  final words = fullName.trim().split(RegExp(r'\s+'));
  final title = words.isNotEmpty && titles.contains(words.first.toLowerCase().replaceAll('.', ''));
  return title && words.length > 1 ? words[1] : (words.isEmpty ? '' : words.first);
}

class MemberAvatar extends StatelessWidget {
  const MemberAvatar({super.key, required this.url, this.radius = 26, this.ring = false});
  final String? url;
  final double radius;
  // A thin gold ring around the photo.
  final bool ring;

  @override
  Widget build(BuildContext context) {
    final avatar = CircleAvatar(
      radius: radius,
      backgroundColor: NK.butter,
      foregroundImage: url == null ? null : NetworkImage(url!),
      child: Icon(Icons.person_outline_rounded, color: NK.maroon, size: radius),
    );
    if (!ring) return avatar;
    return Container(
      padding: const EdgeInsets.all(2.5),
      decoration: const BoxDecoration(shape: BoxShape.circle, gradient: NK.goldGradient),
      child: Container(
        padding: const EdgeInsets.all(2),
        decoration: const BoxDecoration(shape: BoxShape.circle, color: Colors.white),
        child: avatar,
      ),
    );
  }
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
    // The photo fills the whole card; name, place, work and the action sit
    // on a dark fade at the bottom, like a portrait print.
    final shape = BorderRadius.circular(24);
    return DecoratedBox(
      decoration: BoxDecoration(borderRadius: shape, boxShadow: NK.softShadow),
      child: Material(
        color: NK.butter,
        shape: RoundedRectangleBorder(borderRadius: shape),
        clipBehavior: Clip.antiAlias,
        child: InkWell(
          onTap: () => context.push('/member/${member.profileId}'),
          child: Stack(
            fit: StackFit.expand,
            children: [
              MemberPhoto(url: member.photoUrl),
              DecoratedBox(
                decoration: BoxDecoration(
                  gradient: LinearGradient(
                    begin: Alignment.topCenter,
                    end: Alignment.bottomCenter,
                    stops: const [0.35, 0.62, 1],
                    // Maroon over the cream placeholder; it reads muddy in black.
                    colors: member.photoUrl == null
                        ? const [Color(0x005C0C13), Color(0x995C0C13), Color(0xF23D070C)]
                        : const [Color(0x001A0F0A), Color(0x8C1A0F0A), Color(0xF21A0F0A)],
                  ),
                ),
              ),
              // A thin gold frame just inside the edge.
              IgnorePointer(
                child: Container(
                  margin: const EdgeInsets.all(5),
                  decoration: BoxDecoration(
                    borderRadius: BorderRadius.circular(20),
                    border: Border.all(color: NK.goldLight.withValues(alpha: 0.35)),
                  ),
                ),
              ),
              if (badge != null)
                Positioned(
                  left: 12,
                  top: 12,
                  child: Container(
                    padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 4),
                    decoration: BoxDecoration(
                      gradient: NK.goldGradient,
                      borderRadius: BorderRadius.circular(999),
                      boxShadow: const [BoxShadow(color: Color(0x33000000), blurRadius: 8, offset: Offset(0, 2))],
                    ),
                    child: Text(badge!, style: const TextStyle(color: NK.maroonDeep, fontSize: 11, fontWeight: FontWeight.w800)),
                  ),
                ),
              Positioned(
                left: 12,
                right: 12,
                bottom: 12,
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Row(
                      children: [
                        Flexible(
                          child: Text(
                            [firstName(member.fullName), if (member.age > 0) '${member.age}'].join(', '),
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style: serif(22, color: Colors.white),
                          ),
                        ),
                        if (member.isVerified) ...[const SizedBox(width: 5), const Icon(Icons.verified_rounded, color: NK.goldLight, size: 17)],
                      ],
                    ),
                    if (member.place != null)
                      _CardLine(icon: Icons.location_on_outlined, text: member.place!),
                    if (member.work != null)
                      _CardLine(icon: Icons.work_outline_rounded, text: member.work!),
                    const SizedBox(height: 10),
                    RelationshipButton(
                      profileId: member.profileId,
                      relationship: member.relationship,
                      conversationId: member.conversationId,
                      compact: true,
                      onDark: true,
                      onChanged: onChanged,
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _CardLine extends StatelessWidget {
  const _CardLine({required this.icon, required this.text});
  final IconData icon;
  final String text;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(top: 3),
      child: Row(
        children: [
          Icon(icon, size: 13, color: NK.goldLight),
          const SizedBox(width: 4),
          Expanded(
            child: Text(
              text,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: TextStyle(color: Colors.white.withValues(alpha: 0.88), fontSize: 12, fontWeight: FontWeight.w500),
            ),
          ),
        ],
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
    this.onDark = false,
    this.onChanged,
  });
  final String profileId;
  final Relationship relationship;
  final String? conversationId;
  final bool compact;
  // Drawn over a photo: lighter, translucent styles that read on dark.
  final bool onDark;
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
    if (widget.onDark) return _darkButton(size, text);
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

  // The same four states, styled to sit on a photo.
  Widget _darkButton(Size size, TextStyle text) {
    Widget pill({required Widget child, VoidCallback? onTap, Color? fill, Gradient? gradient, Color fg = Colors.white}) {
      return SizedBox(
        height: size.height,
        width: double.infinity,
        child: DecoratedBox(
          decoration: BoxDecoration(
            color: fill,
            gradient: gradient,
            borderRadius: BorderRadius.circular(999),
            border: gradient == null ? Border.all(color: Colors.white.withValues(alpha: 0.35)) : null,
          ),
          child: Material(
            type: MaterialType.transparency,
            shape: const StadiumBorder(),
            clipBehavior: Clip.antiAlias,
            child: InkWell(
              onTap: onTap,
              child: DefaultTextStyle.merge(
                style: text.copyWith(color: fg),
                child: IconTheme.merge(data: IconThemeData(color: fg, size: 16), child: Center(child: child)),
              ),
            ),
          ),
        ),
      );
    }

    Widget label(IconData icon, String t) => Row(
          mainAxisSize: MainAxisSize.min,
          children: [Icon(icon), const SizedBox(width: 6), Flexible(child: Text(t, maxLines: 1, overflow: TextOverflow.ellipsis))],
        );

    switch (current) {
      case Relationship.connected:
        return pill(
          gradient: const LinearGradient(colors: [Color(0xFF2A9461), NK.success]),
          onTap: () => widget.conversationId == null ? context.go('/messages') : context.push('/messages/${widget.conversationId}'),
          child: label(Icons.chat_bubble_outline_rounded, 'Message'),
        );
      case Relationship.received:
        return pill(
          gradient: NK.goldGradient,
          fg: NK.maroonDeep,
          onTap: () => context.go('/interests'),
          child: label(Icons.mark_email_unread_outlined, 'Respond'),
        );
      case Relationship.sent:
        return pill(fill: Colors.white.withValues(alpha: 0.16), child: label(Icons.check_rounded, 'Interest sent'));
      case Relationship.none:
        return pill(
          gradient: NK.goldGradient,
          fg: NK.maroonDeep,
          onTap: busy ? null : _send,
          child: busy
              ? const SizedBox(width: 16, height: 16, child: CircularProgressIndicator(strokeWidth: 2, color: NK.maroonDeep))
              : label(Icons.favorite_rounded, 'Send interest'),
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
        childAspectRatio: 0.64,
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
      height: 310,
      child: ListView.separated(
        scrollDirection: Axis.horizontal,
        // Room above and below so the cards' shadows aren't cut off.
        padding: const EdgeInsets.fromLTRB(18, 4, 18, 20),
        itemCount: members.length,
        separatorBuilder: (_, _) => const SizedBox(width: 12),
        itemBuilder: (_, i) => SizedBox(width: 184, child: MemberGridCard(member: members[i], onChanged: onChanged)),
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
            width: 84,
            height: 84,
            padding: const EdgeInsets.all(6),
            decoration: BoxDecoration(shape: BoxShape.circle, border: Border.all(color: NK.lineGold)),
            child: Container(
              decoration: const BoxDecoration(
                shape: BoxShape.circle,
                gradient: LinearGradient(colors: [NK.butter, NK.goldPale], begin: Alignment.topLeft, end: Alignment.bottomRight),
              ),
              child: Icon(icon, color: NK.goldText, size: 32),
            ),
          ),
          const SizedBox(height: 18),
          Text(title, textAlign: TextAlign.center, style: serif(25, color: NK.ink)),
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
                Text(title, style: serif(25, color: NK.ink)),
                const SizedBox(height: 5),
                const Ornament(),
                if (subtitle != null) ...[
                  const SizedBox(height: 6),
                  Text(subtitle!, style: const TextStyle(color: NK.muted, fontSize: 13)),
                ],
              ],
            ),
          ),
          if (onMore != null)
            TextButton(
              onPressed: onMore,
              child: const Row(
                mainAxisSize: MainAxisSize.min,
                children: [Text('See all'), SizedBox(width: 2), Icon(Icons.arrow_forward_rounded, size: 16)],
              ),
            ),
        ],
      ),
    );
  }
}

// A short gold rule with a diamond, under section headings.
class Ornament extends StatelessWidget {
  const Ornament({super.key, this.color = NK.gold});
  final Color color;

  @override
  Widget build(BuildContext context) {
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        Container(width: 18, height: 1.4, color: color),
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 4),
          child: Transform.rotate(angle: 0.785398, child: Container(width: 5, height: 5, color: color)),
        ),
        Container(
          width: 22,
          height: 1.4,
          decoration: BoxDecoration(gradient: LinearGradient(colors: [color, color.withValues(alpha: 0)])),
        ),
      ],
    );
  }
}

const loadingSpinner = Padding(
  padding: EdgeInsets.all(40),
  child: Center(child: CircularProgressIndicator(color: NK.maroon)),
);
