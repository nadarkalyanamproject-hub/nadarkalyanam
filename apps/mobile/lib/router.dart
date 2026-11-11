import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import 'features/auth/deletion_pending_screen.dart';
import 'features/auth/identity_screen.dart';
import 'features/auth/otp_screen.dart';
import 'features/auth/phone_screen.dart';
import 'features/auth/welcome_screen.dart';
import 'features/home/home_screen.dart';
import 'features/interests/interests_screen.dart';
import 'features/matches/matches_screen.dart';
import 'features/me/horoscope_screen.dart';
import 'features/me/me_screen.dart';
import 'features/me/preferences_screen.dart';
import 'features/member/member_screen.dart';
import 'features/membership/membership_screen.dart';
import 'features/messages/messages_screen.dart';
import 'features/notifications/notifications_screen.dart';
import 'features/onboarding/onboarding_screen.dart';
import 'features/photos/photos_screen.dart';
import 'features/profile/edit_section_screen.dart';
import 'features/profile/profile_screen.dart';
import 'features/search/search_screen.dart';
import 'features/settings/settings_screen.dart';
import 'features/splash/splash_screen.dart';
import 'state/badges.dart';
import 'state/session.dart';
import 'theme.dart';

const _signedOutPaths = {'/welcome', '/register', '/login', '/otp'};

// The session decides the screen; the router only follows it.
GoRouter buildRouter(Session session) {
  return GoRouter(
    initialLocation: '/splash',
    refreshListenable: session,
    redirect: (context, state) {
      final path = state.matchedLocation;
      if (session.phase == Phase.booting || !session.splashDone) return path == '/splash' ? null : '/splash';
      switch (session.phase) {
        case Phase.signedOut:
          return _signedOutPaths.contains(path) ? null : '/welcome';
        case Phase.deletionPending:
          return path == '/deletion-pending' ? null : '/deletion-pending';
        case Phase.needsIdentity:
          return path == '/verify-identity' ? null : '/verify-identity';
        case Phase.needsProfile:
          return path == '/onboarding' ? null : '/onboarding';
        case Phase.ready:
          const entry = {'/splash', '/deletion-pending', '/verify-identity', '/onboarding', ..._signedOutPaths};
          return entry.contains(path) ? '/home' : null;
        case Phase.booting:
          return null;
      }
    },
    routes: [
      GoRoute(path: '/splash', builder: (_, _) => const SplashScreen()),
      GoRoute(path: '/welcome', builder: (_, _) => const WelcomeScreen()),
      GoRoute(path: '/register', builder: (_, _) => const PhoneScreen(login: false)),
      GoRoute(path: '/login', builder: (_, _) => const PhoneScreen(login: true)),
      GoRoute(path: '/otp', builder: (_, state) => OtpScreen(args: state.extra! as OtpArgs)),
      GoRoute(path: '/verify-identity', builder: (_, _) => const IdentityScreen()),
      GoRoute(path: '/deletion-pending', builder: (_, _) => const DeletionPendingScreen()),
      GoRoute(path: '/onboarding', builder: (_, _) => const OnboardingScreen()),
      GoRoute(path: '/photos', builder: (_, _) => const PhotosScreen()),
      GoRoute(path: '/profile/edit/:section', builder: (_, state) => EditSectionScreen(section: state.pathParameters['section']!)),
      GoRoute(path: '/me/profile', builder: (_, _) => const ProfileScreen()),
      GoRoute(path: '/me/settings', builder: (_, _) => const SettingsScreen()),
      GoRoute(path: '/me/preferences', builder: (_, _) => const PreferencesScreen()),
      GoRoute(path: '/me/horoscope', builder: (_, _) => const HoroscopeScreen()),
      GoRoute(path: '/me/contacts', builder: (_, _) => const UnlockedContactsScreen()),
      GoRoute(path: '/me/blocked', builder: (_, _) => const BlockedScreen()),
      GoRoute(path: '/membership', builder: (_, _) => const MembershipScreen()),
      GoRoute(path: '/notifications', builder: (_, _) => const NotificationsScreen()),
      GoRoute(path: '/search', builder: (_, _) => const SearchScreen()),
      GoRoute(
        path: '/search/results',
        builder: (_, state) => SearchResultsScreen(filters: (state.extra as Map<String, String>?) ?? const {}),
      ),
      GoRoute(path: '/search/category/:slug', builder: (_, state) => CategoryScreen(slug: state.pathParameters['slug']!)),
      GoRoute(path: '/member/:id', builder: (_, state) => MemberScreen(profileId: state.pathParameters['id']!)),
      GoRoute(path: '/messages/:id', builder: (_, state) => ThreadScreen(conversationId: state.pathParameters['id']!)),
      StatefulShellRoute.indexedStack(
        builder: (context, state, shell) => _Tabs(shell: shell),
        branches: [
          StatefulShellBranch(routes: [GoRoute(path: '/home', builder: (_, _) => const HomeScreen())]),
          StatefulShellBranch(routes: [GoRoute(path: '/matches', builder: (_, _) => const MatchesScreen())]),
          StatefulShellBranch(routes: [GoRoute(path: '/interests', builder: (_, _) => const InterestsScreen())]),
          StatefulShellBranch(routes: [GoRoute(path: '/messages', builder: (_, _) => const MessagesScreen())]),
          StatefulShellBranch(routes: [GoRoute(path: '/me', builder: (_, _) => const MeScreen())]),
        ],
      ),
    ],
  );
}

class _Tabs extends ConsumerStatefulWidget {
  const _Tabs({required this.shell});
  final StatefulNavigationShell shell;

  @override
  ConsumerState<_Tabs> createState() => _TabsState();
}

class _TabsState extends ConsumerState<_Tabs> {
  late final Badges _badges = ref.read(badgesProvider);

  @override
  void initState() {
    super.initState();
    _badges.start();
  }

  @override
  void dispose() {
    _badges.stop();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final badges = ref.watch(badgesProvider);
    final shell = widget.shell;

    return Scaffold(
      body: shell,
      bottomNavigationBar: _NavBar(
        current: shell.currentIndex,
        onTap: (i) {
          HapticFeedback.selectionClick();
          shell.goBranch(i, initialLocation: i == shell.currentIndex);
        },
        items: [
          const _NavItem(Icons.home_outlined, Icons.home_rounded, 'Home'),
          const _NavItem(Icons.favorite_border_rounded, Icons.favorite_rounded, 'Matches'),
          _NavItem(Icons.star_border_rounded, Icons.star_rounded, 'Interests', dot: badges.newInterests),
          _NavItem(Icons.chat_bubble_outline_rounded, Icons.chat_bubble_rounded, 'Messages', count: badgeText(badges.messages)),
          const _NavItem(Icons.person_outline_rounded, Icons.person_rounded, 'Me'),
        ],
      ),
    );
  }
}

class _NavItem {
  const _NavItem(this.icon, this.selectedIcon, this.label, {this.count, this.dot = false});
  final IconData icon;
  final IconData selectedIcon;
  final String label;
  final String? count;
  final bool dot;
}

// A deep maroon bar with rounded top corners. The selected tab sits in a
// gold pill; the others are soft white.
class _NavBar extends StatelessWidget {
  const _NavBar({required this.current, required this.onTap, required this.items});
  final int current;
  final ValueChanged<int> onTap;
  final List<_NavItem> items;

  @override
  Widget build(BuildContext context) {
    final bottom = MediaQuery.of(context).padding.bottom;
    return Container(
      padding: EdgeInsets.fromLTRB(8, 10, 8, bottom > 0 ? bottom : 10),
      decoration: const BoxDecoration(
        gradient: LinearGradient(colors: [NK.maroonDeep, NK.maroonNight], begin: Alignment.topCenter, end: Alignment.bottomCenter),
        borderRadius: BorderRadius.vertical(top: Radius.circular(26)),
        boxShadow: [BoxShadow(color: Color(0x332B1B14), blurRadius: 20, offset: Offset(0, -4))],
      ),
      child: Row(
        children: [
          for (var i = 0; i < items.length; i++)
            Expanded(child: _NavButton(item: items[i], selected: i == current, onTap: () => onTap(i))),
        ],
      ),
    );
  }
}

class _NavButton extends StatelessWidget {
  const _NavButton({required this.item, required this.selected, required this.onTap});
  final _NavItem item;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final color = selected ? NK.maroonDeep : Colors.white.withValues(alpha: 0.72);
    final badge = item.count != null || item.dot;
    return Semantics(
      button: true,
      selected: selected,
      label: item.count == null ? item.label : '${item.label}, ${item.count} unread',
      excludeSemantics: true,
      child: InkResponse(
        onTap: onTap,
        radius: 36,
        highlightShape: BoxShape.rectangle,
        containedInkWell: false,
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            AnimatedContainer(
              duration: const Duration(milliseconds: 260),
              curve: Curves.easeOutCubic,
              width: selected ? 56 : 40,
              height: 32,
              decoration: BoxDecoration(
                gradient: selected ? NK.goldGradient : null,
                borderRadius: BorderRadius.circular(999),
              ),
              child: Center(
                child: Badge(
                  isLabelVisible: badge,
                  label: item.count == null ? null : Text(item.count!),
                  backgroundColor: NK.goldLight,
                  textColor: NK.maroonDeep,
                  smallSize: 8,
                  child: Icon(selected ? item.selectedIcon : item.icon, color: color, size: 23),
                ),
              ),
            ),
            const SizedBox(height: 4),
            Text(
              item.label,
              maxLines: 1,
              overflow: TextOverflow.fade,
              softWrap: false,
              style: TextStyle(
                fontSize: 11.5,
                fontWeight: selected ? FontWeight.w800 : FontWeight.w600,
                color: selected ? NK.goldLight : Colors.white.withValues(alpha: 0.72),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
