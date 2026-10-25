import 'package:flutter/material.dart';
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
    Widget icon(IconData data, {String? count, bool dot = false}) =>
        Badge(isLabelVisible: count != null || dot, label: count == null ? null : Text(count), backgroundColor: NK.maroon, child: Icon(data));

    return Scaffold(
      body: shell,
      bottomNavigationBar: DecoratedBox(
        decoration: const BoxDecoration(border: Border(top: BorderSide(color: NK.line))),
        child: NavigationBar(
          selectedIndex: shell.currentIndex,
          onDestinationSelected: (i) => shell.goBranch(i, initialLocation: i == shell.currentIndex),
          destinations: [
            const NavigationDestination(
                icon: Icon(Icons.home_outlined), selectedIcon: Icon(Icons.home_rounded, color: NK.maroon), label: 'Home'),
            const NavigationDestination(
                icon: Icon(Icons.favorite_border_rounded), selectedIcon: Icon(Icons.favorite_rounded, color: NK.maroon), label: 'Matches'),
            NavigationDestination(
              icon: icon(Icons.star_border_rounded, dot: badges.newInterests),
              selectedIcon: const Icon(Icons.star_rounded, color: NK.maroon),
              label: 'Interests',
            ),
            NavigationDestination(
              icon: icon(Icons.chat_bubble_outline_rounded, count: badgeText(badges.messages)),
              selectedIcon: icon(Icons.chat_bubble_rounded, count: badgeText(badges.messages)),
              label: 'Messages',
            ),
            const NavigationDestination(
                icon: Icon(Icons.person_outline_rounded), selectedIcon: Icon(Icons.person_rounded, color: NK.maroon), label: 'Me'),
          ],
        ),
      ),
    );
  }
}
