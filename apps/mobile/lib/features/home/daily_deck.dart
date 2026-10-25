import 'dart:math' as math;

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../../data/api.dart';
import '../../data/daily_picks.dart';
import '../../data/members.dart';
import '../../state/session.dart';
import '../../theme.dart';
import '../../widgets/form.dart';
import '../../widgets/member.dart';

// Today's picks as a card stack: swipe right (or tap the heart) to send an
// interest, left to skip, tap the card to open the profile. What the member
// has already swiped is remembered for the day on this phone, so the deck
// doesn't start over when the app is reopened.
class DailyDeck extends ConsumerStatefulWidget {
  const DailyDeck({super.key, required this.picks, this.onChanged});
  final List<MemberCard> picks;
  final VoidCallback? onChanged;

  @override
  ConsumerState<DailyDeck> createState() => _DailyDeckState();
}

class _DailyDeckState extends ConsumerState<DailyDeck> with SingleTickerProviderStateMixin {
  static const _threshold = 110.0;

  late final AnimationController _fly = AnimationController(vsync: this, duration: const Duration(milliseconds: 260));
  Animation<Offset>? _flight;
  Offset _drag = Offset.zero;
  Set<String>? _done;
  bool _busy = false;

  String get _key => 'nk.daily.${istDateKey()}';

  List<MemberCard> get _left => widget.picks.where((m) => !(_done ?? const {}).contains(m.profileId)).toList();

  @override
  void initState() {
    super.initState();
    _fly.addListener(() => setState(() => _drag = _flight!.value));
    _load();
  }

  @override
  void dispose() {
    _fly.dispose();
    super.dispose();
  }

  Future<void> _load() async {
    try {
      final prefs = await SharedPreferences.getInstance();
      // Only today's key is kept.
      for (final k in prefs.getKeys().where((k) => k.startsWith('nk.daily.') && k != _key)) {
        await prefs.remove(k);
      }
      if (mounted) setState(() => _done = (prefs.getStringList(_key) ?? []).toSet());
    } catch (_) {
      if (mounted) setState(() => _done = {});
    }
  }

  Future<void> _remember(String profileId) async {
    _done = {...?_done, profileId};
    try {
      final prefs = await SharedPreferences.getInstance();
      await prefs.setStringList(_key, _done!.toList());
    } catch (_) {}
  }

  Future<void> _animateTo(Offset end) async {
    _flight = Tween(begin: _drag, end: end).animate(CurvedAnimation(parent: _fly, curve: Curves.easeOut));
    await _fly.forward(from: 0);
  }

  // like: send an interest; otherwise skip.
  Future<void> _decide(MemberCard m, {required bool like}) async {
    if (_busy) return;
    _busy = true;
    HapticFeedback.lightImpact();
    final width = MediaQuery.of(context).size.width;
    await _animateTo(Offset((like ? 1 : -1) * width * 1.4, _drag.dy + 40));
    if (like) {
      try {
        await ref.read(repoProvider).sendInterest(m.profileId);
        if (mounted) showSnack(context, 'Interest sent to ${firstName(m.fullName)}');
        widget.onChanged?.call();
      } on ApiException catch (e) {
        // Put the card back: nothing was sent.
        if (mounted) {
          showSnack(context, e.message);
          setState(() => _drag = Offset.zero);
        }
        _busy = false;
        return;
      }
    }
    await _remember(m.profileId);
    if (mounted) setState(() => _drag = Offset.zero);
    _busy = false;
  }

  @override
  Widget build(BuildContext context) {
    if (_done == null) return const SizedBox(height: 460, child: loadingSpinner);
    final left = _left;
    if (left.isEmpty) return _AllDone(total: widget.picks.length);

    final top = left.first;
    final next = left.length > 1 ? left[1] : null;
    final width = MediaQuery.of(context).size.width;
    final progress = (_drag.dx.abs() / _threshold).clamp(0.0, 1.0);

    return Column(
      children: [
        SizedBox(
          height: 460,
          child: Stack(
            clipBehavior: Clip.none,
            children: [
              if (next != null)
                Positioned.fill(
                  child: Transform.translate(
                    offset: Offset(0, 14 - 14 * progress),
                    child: Transform.scale(scale: 0.94 + 0.06 * progress, child: _PickCard(member: next)),
                  ),
                ),
              Positioned.fill(
                child: GestureDetector(
                  onTap: () => context.push('/member/${top.profileId}'),
                  onPanUpdate: _busy ? null : (d) => setState(() => _drag += d.delta),
                  onPanEnd: _busy
                      ? null
                      : (d) {
                          final flung = d.velocity.pixelsPerSecond.dx;
                          if (_drag.dx > _threshold || flung > 900) {
                            _decide(top, like: true);
                          } else if (_drag.dx < -_threshold || flung < -900) {
                            _decide(top, like: false);
                          } else {
                            _animateTo(Offset.zero);
                          }
                        },
                  child: Transform.translate(
                    offset: _drag,
                    child: Transform.rotate(
                      angle: (_drag.dx / width) * (math.pi / 10),
                      child: _PickCard(member: top, like: _drag.dx > 0 ? progress : 0, skip: _drag.dx < 0 ? progress : 0),
                    ),
                  ),
                ),
              ),
            ],
          ),
        ),
        const SizedBox(height: 16),
        Row(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            _RoundButton(
              icon: Icons.close_rounded,
              color: NK.muted,
              size: 58,
              tooltip: 'Skip',
              onTap: _busy ? null : () => _decide(top, like: false),
            ),
            const SizedBox(width: 18),
            _RoundButton(
              icon: Icons.person_search_rounded,
              color: NK.goldText,
              size: 48,
              tooltip: 'View profile',
              onTap: () => context.push('/member/${top.profileId}'),
            ),
            const SizedBox(width: 18),
            _RoundButton(
              icon: Icons.favorite_rounded,
              color: Colors.white,
              background: NK.maroon,
              size: 58,
              tooltip: 'Send interest',
              onTap: _busy ? null : () => _decide(top, like: true),
            ),
          ],
        ),
        const SizedBox(height: 10),
        Text(
          '${widget.picks.length - left.length + 1} of ${widget.picks.length} today · Swipe right to send interest',
          style: const TextStyle(color: NK.subtle, fontSize: 12.5),
        ),
      ],
    );
  }
}

class _PickCard extends StatelessWidget {
  const _PickCard({required this.member, this.like = 0, this.skip = 0});
  final MemberCard member;
  final double like;
  final double skip;

  @override
  Widget build(BuildContext context) {
    final m = member;
    return DecoratedBox(
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(28),
        boxShadow: const [BoxShadow(color: Color(0x332B1B14), blurRadius: 24, offset: Offset(0, 10))],
      ),
      child: ClipRRect(
        borderRadius: BorderRadius.circular(28),
        child: Stack(
          fit: StackFit.expand,
          children: [
            MemberPhoto(url: m.photoUrl, iconSize: 96),
            const DecoratedBox(
              decoration: BoxDecoration(
                gradient: LinearGradient(
                  begin: Alignment.topCenter,
                  end: Alignment.bottomCenter,
                  stops: [0.45, 1],
                  colors: [Colors.transparent, Color(0xE61A0F0A)],
                ),
              ),
            ),
            Positioned(
              left: 16,
              top: 16,
              child: Container(
                padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
                decoration: BoxDecoration(color: NK.goldLight, borderRadius: BorderRadius.circular(999)),
                child: const Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Icon(Icons.auto_awesome_rounded, size: 14, color: NK.maroonDeep),
                    SizedBox(width: 4),
                    Text("Today's pick", style: TextStyle(color: NK.maroonDeep, fontWeight: FontWeight.w800, fontSize: 12)),
                  ],
                ),
              ),
            ),
            Positioned(
              left: 20,
              right: 20,
              bottom: 22,
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      Flexible(
                        child: Text(
                          [firstName(m.fullName), if (m.age > 0) '${m.age}'].join(', '),
                          style: serif(32, color: Colors.white),
                          overflow: TextOverflow.ellipsis,
                        ),
                      ),
                      if (m.isVerified) ...[const SizedBox(width: 6), const Icon(Icons.verified_rounded, color: NK.goldLight)],
                    ],
                  ),
                  if (m.city != null || m.state != null) ...[
                    const SizedBox(height: 4),
                    Row(
                      children: [
                        const Icon(Icons.place_outlined, size: 16, color: Colors.white70),
                        const SizedBox(width: 4),
                        Flexible(child: Text([?m.city, ?m.state].join(', '), style: const TextStyle(color: Colors.white, fontSize: 14.5))),
                      ],
                    ),
                  ],
                  if (m.work != null) ...[
                    const SizedBox(height: 4),
                    Row(
                      children: [
                        const Icon(Icons.work_outline_rounded, size: 16, color: Colors.white70),
                        const SizedBox(width: 4),
                        Flexible(child: Text(m.work!, style: const TextStyle(color: Colors.white, fontSize: 14.5), overflow: TextOverflow.ellipsis)),
                      ],
                    ),
                  ],
                ],
              ),
            ),
            if (like > 0) _Stamp(text: 'INTEREST', color: NK.success, opacity: like, left: true),
            if (skip > 0) _Stamp(text: 'SKIP', color: NK.error, opacity: skip, left: false),
          ],
        ),
      ),
    );
  }
}

class _Stamp extends StatelessWidget {
  const _Stamp({required this.text, required this.color, required this.opacity, required this.left});
  final String text;
  final Color color;
  final double opacity;
  final bool left;

  @override
  Widget build(BuildContext context) {
    return Positioned(
      top: 54,
      left: left ? 22 : null,
      right: left ? null : 22,
      child: Opacity(
        opacity: opacity,
        child: Transform.rotate(
          angle: (left ? -1 : 1) * 0.25,
          child: Container(
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 4),
            decoration: BoxDecoration(
              border: Border.all(color: color, width: 3),
              borderRadius: BorderRadius.circular(10),
              color: Colors.white.withValues(alpha: 0.85),
            ),
            child: Text(text, style: TextStyle(color: color, fontSize: 26, fontWeight: FontWeight.w900, letterSpacing: 2)),
          ),
        ),
      ),
    );
  }
}

class _RoundButton extends StatelessWidget {
  const _RoundButton({required this.icon, required this.color, required this.size, required this.tooltip, this.onTap, this.background = Colors.white});
  final IconData icon;
  final Color color;
  final Color background;
  final double size;
  final String tooltip;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    return Tooltip(
      message: tooltip,
      child: Material(
        color: background,
        shape: const CircleBorder(side: BorderSide(color: NK.line)),
        elevation: 3,
        shadowColor: const Color(0x332B1B14),
        child: InkWell(
          customBorder: const CircleBorder(),
          onTap: onTap,
          child: SizedBox(width: size, height: size, child: Icon(icon, color: color, size: size * 0.46)),
        ),
      ),
    );
  }
}

class _AllDone extends StatelessWidget {
  const _AllDone({required this.total});
  final int total;

  @override
  Widget build(BuildContext context) {
    return NkCard(
      padding: const EdgeInsets.fromLTRB(22, 28, 22, 24),
      child: Column(
        children: [
          Container(
            width: 64,
            height: 64,
            decoration: const BoxDecoration(color: NK.butter, shape: BoxShape.circle),
            child: const Icon(Icons.check_rounded, color: NK.gold, size: 34),
          ),
          const SizedBox(height: 14),
          Text(total == 0 ? 'No picks today' : "You've seen today's picks", style: serif(22, color: NK.ink), textAlign: TextAlign.center),
          const SizedBox(height: 6),
          const Text('New picks arrive tomorrow. Meanwhile, browse all your matches.',
              textAlign: TextAlign.center, style: TextStyle(color: NK.muted, height: 1.45)),
          const SizedBox(height: 16),
          OutlinedButton(onPressed: () => context.go('/matches'), child: const Text('See your matches')),
        ],
      ),
    );
  }
}
