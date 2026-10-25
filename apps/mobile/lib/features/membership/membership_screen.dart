import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';

import '../../data/api.dart';
import '../../data/members.dart';
import '../../data/models.dart';
import '../../state/session.dart';
import '../../theme.dart';
import '../../widgets/form.dart';
import '../../widgets/member.dart';

final _membershipPageProvider = FutureProvider.autoDispose((ref) async {
  final repo = ref.watch(repoProvider);
  final results = await Future.wait([repo.membership(), repo.plans(), repo.vipEnquiryStatus().catchError((_) => null)]);
  return (membership: results[0] as Membership, plans: results[1] as PlansResponse, vip: results[2] as String?);
});

// The card that's highlighted, as on the website.
const _popularPlanCode = 'GOLD_PREMIUM';

String _rupees(int paise) => NumberFormat.currency(locale: 'en_IN', symbol: '₹', decimalDigits: 0).format(paise / 100);

String _duration(int days) {
  if (days % 365 == 0) return days == 365 ? '1 year' : '${days ~/ 365} years';
  if (days % 30 == 0) return days == 30 ? '1 month' : '${days ~/ 30} months';
  return '$days days';
}

// The member's plan and the plans on offer. Buying isn't in the app yet:
// payments will go through Google Play / App Store billing once that's set
// up, so for now the cards only show what each plan includes.
class MembershipScreen extends ConsumerWidget {
  const MembershipScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final data = ref.watch(_membershipPageProvider);
    return Scaffold(
      appBar: AppBar(title: const Text('Membership')),
      body: RefreshIndicator(
        color: NK.maroon,
        onRefresh: () => ref.refresh(_membershipPageProvider.future),
        child: data.when(
          loading: () => ListView(children: const [loadingSpinner]),
          error: (e, _) => ListView(children: [LoadError(error: e, onRetry: () => ref.invalidate(_membershipPageProvider))]),
          data: (d) => ListView(
            padding: const EdgeInsets.fromLTRB(16, 18, 16, 32),
            children: [
              _MyPlan(m: d.membership, plans: d.plans),
              const SizedBox(height: 22),
              Text('Choose your plan', style: serif(26, color: NK.maroon)),
              const SizedBox(height: 6),
              const Text(
                'Buying a plan in the app is coming soon. Here is what each plan includes.',
                style: TextStyle(color: NK.muted, height: 1.45),
              ),
              const SizedBox(height: 16),
              for (final p in d.plans.items) _PlanCard(plan: p, current: d.membership.planName == p.name, vipStatus: d.vip),
              const SizedBox(height: 8),
              NkCard(
                onTap: () => context.push('/me/contacts'),
                child: const Row(
                  children: [
                    Icon(Icons.contact_phone_outlined, color: NK.maroon),
                    SizedBox(width: 12),
                    Expanded(child: Text('My unlocked contacts', style: TextStyle(fontWeight: FontWeight.w700))),
                    Icon(Icons.chevron_right_rounded, color: NK.muted),
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

class _MyPlan extends StatelessWidget {
  const _MyPlan({required this.m, required this.plans});
  final Membership m;
  final PlansResponse plans;

  @override
  Widget build(BuildContext context) {
    final rows = <String, String>{
      if (m.startedAt != null) 'Started': displayDate(m.startedAt!),
      // The last covered day (expiresAt is exclusive).
      if (m.expiresAt != null) 'Valid till': displayDate(m.expiresAt!.subtract(const Duration(milliseconds: 1))),
      if (m.phoneUnlocksUsed != null)
        'Phone unlocks': m.phoneUnlocksRemaining == null ? '${m.phoneUnlocksUsed} used (unlimited)' : '${m.phoneUnlocksUsed} used, ${m.phoneUnlocksRemaining} left',
      if (m.interestsLimit != null) 'Interests this month': '${m.interestsUsedThisMonth ?? 0} of ${m.interestsLimit}',
      if (m.resetsAt != null) 'Resets on': displayDate(m.resetsAt!),
    };
    return Container(
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(22),
        gradient: const LinearGradient(colors: [NK.maroon, NK.maroonDeep], begin: Alignment.topLeft, end: Alignment.bottomRight),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text('YOUR MEMBERSHIP', style: TextStyle(color: NK.goldLight, fontSize: 12, fontWeight: FontWeight.w800, letterSpacing: 1.2)),
          const SizedBox(height: 6),
          Text(m.isActive ? m.planName ?? 'Active plan' : 'No active plan', style: serif(28, color: Colors.white)),
          if (!m.isActive) ...[
            const SizedBox(height: 6),
            Text(
              plans.requirePaidPlan
                  ? 'A plan is needed to see profiles, search, send interests and chat.'
                  : 'You can send ${plans.freeInterestsPerMonth} interests a month. A plan unlocks more.',
              style: TextStyle(color: Colors.white.withValues(alpha: 0.85), height: 1.45),
            ),
          ],
          if (rows.isNotEmpty) const SizedBox(height: 12),
          for (final e in rows.entries)
            Padding(
              padding: const EdgeInsets.only(top: 6),
              child: Row(
                children: [
                  SizedBox(width: 150, child: Text(e.key, style: TextStyle(color: Colors.white.withValues(alpha: 0.75)))),
                  Expanded(child: Text(e.value, style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w700))),
                ],
              ),
            ),
        ],
      ),
    );
  }
}

class _PlanCard extends ConsumerWidget {
  const _PlanCard({required this.plan, required this.current, required this.vipStatus});
  final Plan plan;
  final bool current;
  final String? vipStatus;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final popular = plan.code == _popularPlanCode;
    final original = plan.originalPriceInPaise;
    final discount = original == null || original <= plan.priceInPaise ? null : (100 - plan.priceInPaise * 100 / original).round();
    return Container(
      margin: const EdgeInsets.only(bottom: 14),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: popular ? NK.gold : NK.lineGold, width: popular ? 2 : 1),
      ),
      child: Padding(
        padding: const EdgeInsets.all(18),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Expanded(
                  child: Text(plan.name.toUpperCase(),
                      style: const TextStyle(fontWeight: FontWeight.w800, letterSpacing: 1, color: NK.maroon, fontSize: 15)),
                ),
                if (current)
                  _Tag(text: 'Your plan', color: NK.success)
                else if (popular)
                  const _Tag(text: 'Popular', color: NK.goldText),
              ],
            ),
            Text(_duration(plan.durationDays), style: const TextStyle(color: NK.muted)),
            const SizedBox(height: 10),
            if (!plan.isAssisted)
              Row(
                crossAxisAlignment: CrossAxisAlignment.end,
                children: [
                  Text(_rupees(plan.priceInPaise), style: serif(32, color: NK.ink)),
                  if (discount != null) ...[
                    const SizedBox(width: 8),
                    Padding(
                      padding: const EdgeInsets.only(bottom: 6),
                      child: Text(_rupees(original!),
                          style: const TextStyle(color: NK.subtle, decoration: TextDecoration.lineThrough, fontSize: 15)),
                    ),
                    const SizedBox(width: 6),
                    Padding(
                      padding: const EdgeInsets.only(bottom: 6),
                      child: Text('$discount% off', style: const TextStyle(color: NK.success, fontWeight: FontWeight.w700)),
                    ),
                  ],
                ],
              ),
            if (plan.description != null) ...[
              const SizedBox(height: 6),
              Text(plan.description!, style: const TextStyle(color: NK.muted, height: 1.4)),
            ],
            const SizedBox(height: 12),
            for (final f in plan.features)
              Padding(
                padding: const EdgeInsets.only(bottom: 7),
                child: Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Icon(f.available ? Icons.check_circle_rounded : Icons.schedule_rounded,
                        size: 19, color: f.available ? NK.success : NK.subtle),
                    const SizedBox(width: 8),
                    Expanded(
                      child: Text.rich(TextSpan(
                        text: f.label,
                        style: TextStyle(color: f.available ? NK.ink : NK.muted),
                        children: [
                          if (!f.available)
                            const TextSpan(text: '  Coming soon', style: TextStyle(color: NK.goldText, fontSize: 12, fontWeight: FontWeight.w700)),
                        ],
                      )),
                    ),
                  ],
                ),
              ),
            if (plan.isAssisted) ...[
              const SizedBox(height: 8),
              _VipButton(status: vipStatus),
            ],
          ],
        ),
      ),
    );
  }
}

class _Tag extends StatelessWidget {
  const _Tag({required this.text, required this.color});
  final String text;
  final Color color;

  @override
  Widget build(BuildContext context) => Container(
        padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 3),
        decoration: BoxDecoration(color: color.withValues(alpha: 0.12), borderRadius: BorderRadius.circular(999)),
        child: Text(text, style: TextStyle(color: color, fontWeight: FontWeight.w800, fontSize: 11.5)),
      );
}

// VIP Assisted: ask the team to call (name and number come from the account).
class _VipButton extends ConsumerStatefulWidget {
  const _VipButton({required this.status});
  final String? status;

  @override
  ConsumerState<_VipButton> createState() => _VipButtonState();
}

class _VipButtonState extends ConsumerState<_VipButton> {
  bool busy = false;
  bool sent = false;

  Future<void> _request() async {
    setState(() => busy = true);
    try {
      await ref.read(repoProvider).requestVipCall('');
      if (!mounted) return;
      setState(() => sent = true);
      showSnack(context, 'Thank you. Our team will call you soon.');
    } on ApiException catch (e) {
      if (mounted) showSnack(context, e.message);
    } finally {
      if (mounted) setState(() => busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final open = sent || widget.status == 'NEW' || widget.status == 'CONTACTED';
    if (open) {
      return const Text('Your request is with our team. They will call you on your registered number.',
          style: TextStyle(color: NK.success, fontWeight: FontWeight.w600));
    }
    return BusyButton(label: 'Request a call', busy: busy, onPressed: _request);
  }
}

// GET /me/phone-unlocks: members whose number you've unlocked.
class UnlockedContactsScreen extends ConsumerWidget {
  const UnlockedContactsScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final future = ref.watch(_contactsProvider);
    return Scaffold(
      appBar: AppBar(title: const Text('Unlocked contacts')),
      body: RefreshIndicator(
        color: NK.maroon,
        onRefresh: () => ref.refresh(_contactsProvider.future),
        child: future.when(
          loading: () => ListView(children: const [loadingSpinner]),
          error: (e, _) => ListView(children: [LoadError(error: e, onRetry: () => ref.invalidate(_contactsProvider))]),
          data: (items) => items.isEmpty
              ? ListView(
                  children: const [
                    EmptyState(
                      icon: Icons.contact_phone_outlined,
                      title: 'No unlocked contacts',
                      message: "When you unlock a connected member's phone number, they're listed here.",
                    ),
                  ],
                )
              : ListView.separated(
                  padding: const EdgeInsets.symmetric(vertical: 8),
                  itemCount: items.length,
                  separatorBuilder: (_, _) => const Divider(indent: 84),
                  itemBuilder: (_, i) {
                    final c = items[i];
                    final m = c.member;
                    return ListTile(
                      contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 4),
                      leading: MemberAvatar(url: m.photoUrl, radius: 26),
                      title: Text(m.fullName, style: const TextStyle(fontWeight: FontWeight.w700)),
                      subtitle: Text(
                        [m.ageAndCity, if (c.unlockedAt != null) 'Unlocked ${displayDate(c.unlockedAt!)}'].where((s) => s.isNotEmpty).join('\n'),
                      ),
                      isThreeLine: c.unlockedAt != null,
                      trailing: const Icon(Icons.chevron_right_rounded),
                      onTap: () => context.push('/member/${m.profileId}'),
                    );
                  },
                ),
        ),
      ),
    );
  }
}

final _contactsProvider = FutureProvider.autoDispose((ref) => ref.watch(repoProvider).unlockedContacts());
