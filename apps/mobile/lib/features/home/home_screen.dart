import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';

import '../../data/members.dart';
import '../../data/models.dart';
import '../../state/session.dart';
import '../../theme.dart';
import '../../widgets/form.dart';
import '../../widgets/logo.dart';
import '../../widgets/member.dart';
import '../../widgets/top_actions.dart';

final membershipProvider = FutureProvider.autoDispose<Membership>((ref) => ref.watch(repoProvider).membership());

String _day(DateTime d) => DateFormat('dd-MM-yyyy').format(d.toLocal());

class HomeScreen extends ConsumerWidget {
  const HomeScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final session = ref.watch(sessionProvider);
    final profile = session.profile;
    final membership = ref.watch(membershipProvider);
    final first = (profile?.fullName ?? '').split(' ').first;

    // Matching is open once there's no pre-launch date and the member isn't
    // locked out for want of a plan.
    final open = membership.maybeWhen(data: (m) => m.opensAt == null && !m.accessLocked, orElse: () => false);

    return Scaffold(
      appBar: AppBar(title: const Logo(size: 17), actions: const [TopActions()]),
      body: RefreshIndicator(
        color: NK.maroon,
        onRefresh: () async {
          ref.invalidate(membershipProvider);
          ref.invalidate(_homeStripsProvider);
          await session.refreshProfile();
        },
        child: ListView(
          padding: const EdgeInsets.only(top: 20, bottom: 32),
          children: [
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 18),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  Text(first.isEmpty ? 'Vanakkam' : 'Vanakkam, $first', style: serif(30, color: NK.ink)),
                  const SizedBox(height: 4),
                  Text(open ? 'Here are members picked for you.' : 'Here is where your profile stands.',
                      style: const TextStyle(color: NK.muted, fontSize: 14.5)),
                  const SizedBox(height: 18),
                  membership.when(
                    loading: () => const Padding(padding: EdgeInsets.all(28), child: Center(child: CircularProgressIndicator(color: NK.maroon))),
                    error: (e, _) => ErrorBanner('$e'),
                    data: (m) => Column(
                      children: [
                        if (m.opensAt != null) _OpensCard(opensAt: m.opensAt!),
                        if (m.opensAt == null && m.accessLocked) const _PlanNeededCard(),
                        if (m.launchOffer != null) ...[const SizedBox(height: 14), _OfferCard(offer: m.launchOffer!)],
                      ],
                    ),
                  ),
                  if (profile != null && profile.completionScore < 100) ...[const SizedBox(height: 14), _CompletionCard(profile: profile)],
                ],
              ),
            ),
            if (open) const _HomeStrips(),
            if (profile != null && profile.completionScore >= 100)
              Padding(padding: const EdgeInsets.fromLTRB(18, 14, 18, 0), child: _CompletionCard(profile: profile)),
          ],
        ),
      ),
    );
  }
}

final _homeStripsProvider = FutureProvider.autoDispose((ref) async {
  final repo = ref.watch(repoProvider);
  // A strip that fails just isn't shown; the others still load.
  Future<List<MemberCard>> safe(Future<List<MemberCard>> f) => f.catchError((_) => <MemberCard>[]);
  final results = await Future.wait([
    safe(repo.matches(limit: 12).then((m) => m.items.where((c) => c.relationship != Relationship.connected).toList())),
    safe(repo.category('newly-joined')),
    safe(repo.category('viewed-me')),
    safe(repo.category('viewed-by-me')),
  ]);
  return results;
});

// The website's signed-in home sections.
class _HomeStrips extends ConsumerWidget {
  const _HomeStrips();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final data = ref.watch(_homeStripsProvider);
    void reload() => ref.invalidate(_homeStripsProvider);
    return data.when(
      loading: () => loadingSpinner,
      error: (e, _) => LoadError(error: e, onRetry: reload),
      data: (lists) {
        final sections = [
          ('Recommended for you', 'Based on your preferences, location and lifestyle.', lists[0], '/matches', true),
          ('Newly joined', 'Members who joined in the last 30 days.', lists[1], '/search/category/newly-joined', false),
          ('Viewed your profile', 'Members who recently opened your profile.', lists[2], '/search/category/viewed-you', false),
          ('Profiles you viewed', 'Members whose profiles you opened recently.', lists[3], '/search/category/viewed-by-you', false),
        ];
        final shown = sections.where((s) => s.$3.isNotEmpty).toList();
        if (shown.isEmpty) {
          return const EmptyState(
            icon: Icons.favorite_border_rounded,
            title: 'No members to show yet',
            message: 'Set your partner preferences and check back as new members join.',
          );
        }
        return Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            for (final s in shown) ...[
              SectionTitle(s.$1, subtitle: s.$2, onMore: () => s.$5 ? context.go(s.$4) : context.push(s.$4)),
              MemberStrip(members: s.$3.take(10).toList(), onChanged: reload),
            ],
          ],
        );
      },
    );
  }
}

class _PlanNeededCard extends StatelessWidget {
  const _PlanNeededCard();

  @override
  Widget build(BuildContext context) {
    return NkCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text('Choose a plan to start matching', style: serif(22, color: NK.maroon)),
          const SizedBox(height: 8),
          const Text(
            'A plan is needed to see profiles, search, send interests and chat. Your profile stays visible to members with a plan.',
            style: TextStyle(color: NK.muted, height: 1.5),
          ),
          const SizedBox(height: 14),
          FilledButton(onPressed: () => context.push('/membership'), child: const Text('See plans')),
        ],
      ),
    );
  }
}

class _OpensCard extends StatelessWidget {
  const _OpensCard({required this.opensAt});
  final DateTime opensAt;

  @override
  Widget build(BuildContext context) {
    final days = opensAt.difference(DateTime.now()).inDays + 1;
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(22),
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(24),
        gradient: const LinearGradient(colors: [NK.maroon, NK.maroonDeep], begin: Alignment.topLeft, end: Alignment.bottomRight),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
            decoration: BoxDecoration(color: NK.goldLight, borderRadius: BorderRadius.circular(999)),
            child: Text(days <= 1 ? 'Opens tomorrow' : '$days days to go',
                style: const TextStyle(color: NK.maroonDeep, fontWeight: FontWeight.w700, fontSize: 12.5)),
          ),
          const SizedBox(height: 14),
          Text('Matching opens on ${_day(opensAt)}', style: serif(26, color: Colors.white)),
          const SizedBox(height: 8),
          Text(
            'Members are joining now, so there will be real profiles to see from the first day. Until then, complete your profile and add photos so the right families can find you.',
            style: TextStyle(color: Colors.white.withValues(alpha: 0.85), height: 1.5, fontSize: 14),
          ),
        ],
      ),
    );
  }
}

class _OfferCard extends StatelessWidget {
  const _OfferCard({required this.offer});
  final LaunchOffer offer;

  @override
  Widget build(BuildContext context) {
    final start = offer.startsAt;
    final end = offer.endsAt?.subtract(const Duration(days: 1));
    return NkCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              const Icon(Icons.workspace_premium_outlined, color: NK.gold),
              const SizedBox(width: 8),
              Expanded(
                child: Text('Launch offer: ${offer.planName} free', style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 16)),
              ),
            ],
          ),
          if (start != null && end != null) ...[
            const SizedBox(height: 4),
            Text('${_day(start)} – ${_day(end)}', style: const TextStyle(color: NK.muted)),
          ],
          const SizedBox(height: 14),
          if (offer.earned)
            const _Check(done: true, label: "You have it. Your free plan starts on launch day.")
          else ...[
            Text(
              offer.qualifyBy == null ? 'Finish these to get it:' : 'Finish these by ${_day(offer.qualifyBy!)} to get it:',
              style: const TextStyle(fontWeight: FontWeight.w600),
            ),
            const SizedBox(height: 8),
            _Check(done: !offer.needsProfile, label: 'Your profile details'),
            _Check(done: !offer.needsPhoto, label: 'At least one photo', action: offer.needsPhoto ? () => context.push('/photos') : null),
          ],
        ],
      ),
    );
  }
}

class _Check extends StatelessWidget {
  const _Check({required this.done, required this.label, this.action});
  final bool done;
  final String label;
  final VoidCallback? action;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 6),
      child: Row(
        children: [
          Icon(done ? Icons.check_circle_rounded : Icons.radio_button_unchecked_rounded, size: 20, color: done ? NK.success : NK.subtle),
          const SizedBox(width: 8),
          Expanded(child: Text(label)),
          if (action != null) TextButton(onPressed: action, child: const Text('Add')),
        ],
      ),
    );
  }
}

class _CompletionCard extends StatelessWidget {
  const _CompletionCard({required this.profile});
  final Profile profile;

  @override
  Widget build(BuildContext context) {
    final score = profile.completionScore;
    return NkCard(
      onTap: () => context.push('/me/profile'),
      child: Row(
        children: [
          SizedBox(
            width: 64,
            height: 64,
            child: Stack(
              fit: StackFit.expand,
              children: [
                CircularProgressIndicator(value: score / 100, strokeWidth: 6, color: NK.gold, backgroundColor: NK.line),
                Center(child: Text('$score%', style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 15))),
              ],
            ),
          ),
          const SizedBox(width: 16),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(score >= 100 ? 'Your profile is complete' : 'Complete your profile',
                    style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 16)),
                const SizedBox(height: 4),
                Text(
                  score >= 100 ? 'Keep it up to date as things change.' : 'A complete profile with photos gets far more interest.',
                  style: const TextStyle(color: NK.muted, fontSize: 13.5),
                ),
              ],
            ),
          ),
          const Icon(Icons.chevron_right_rounded, color: NK.muted),
        ],
      ),
    );
  }
}
